import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { expiryState } from './compliance-monitoring.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;
const DEFAULT_INTERVAL_HOURS = 6;
const PENDING_APPROVAL_REMINDER_DAYS = 3;

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

// Periodic sweep that turns due dates into notifications: reviews due within 30 days or overdue, tracked documents
// expiring within 90/60/30 days or expired, and risk changes waiting for approval for more than three days.
// Each milestone is notified once: a ComplianceReminder row is claimed first (unique key), so repeated runs and
// several server processes never send the same reminder twice. Set COMPLIANCE_REMINDERS_ENABLED=false to disable.
@Injectable()
export class ComplianceRemindersService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ComplianceRemindersService.name);
  private timers: NodeJS.Timeout[] = [];
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    if (String(process.env.COMPLIANCE_REMINDERS_ENABLED || 'true').toLowerCase() === 'false') {
      this.logger.log('Compliance reminders are disabled (COMPLIANCE_REMINDERS_ENABLED=false).');
      return;
    }
    const hours = Math.max(1, Number(process.env.COMPLIANCE_REMINDER_INTERVAL_HOURS) || DEFAULT_INTERVAL_HOURS);
    const run = () => this.sweep().catch((error) => this.logger.error(`Compliance reminder sweep failed: ${error instanceof Error ? error.message : error}`));
    const first = setTimeout(run, FIRST_RUN_DELAY_MS);
    const repeat = setInterval(run, hours * 60 * 60 * 1000);
    first.unref();
    repeat.unref();
    this.timers = [first, repeat];
  }

  onApplicationShutdown() {
    this.timers.forEach((timer) => clearTimeout(timer));
  }

  // tenantId limits a manual run to one company; the scheduled run covers every company.
  async sweep(tenantId?: string, now = new Date()) {
    if (this.running) return { created: 0, skipped: true };
    this.running = true;
    try {
      let created = 0;
      const tenantWhere = tenantId ? { tenantId } : {};

      const dueClients = await this.prisma.client.findMany({
        where: { ...tenantWhere, status: 'ACTIVE', nextReviewDate: { lte: new Date(now.getTime() + 30 * DAY_MS) } },
        select: { id: true, tenantId: true, name: true, clientCode: true, nextReviewDate: true }
      });
      for (const client of dueClients) {
        const overdue = client.nextReviewDate!.getTime() < now.getTime();
        const milestone = `${overdue ? 'overdue' : 'due-30'}:${dateKey(client.nextReviewDate!)}`;
        created += await this.remind(client.tenantId, 'REVIEW', client.id, milestone, {
          clientId: client.id,
          type: NotificationType.COMPLIANCE_REVIEW_DUE,
          title: `${overdue ? 'Review overdue' : 'Review due soon'}: ${client.name}`,
          message: `The periodic review of ${label(client)} ${overdue ? 'was due' : 'is due'} on ${dateKey(client.nextReviewDate!)}.`
        });
      }

      const expiring = await this.prisma.clientExpiryItem.findMany({
        where: { ...tenantWhere, isActive: true, expiryDate: { lte: new Date(now.getTime() + 90 * DAY_MS) }, client: { status: { in: ['ACTIVE', 'ON_HOLD'] } } },
        include: { client: { select: { id: true, name: true, clientCode: true } } }
      });
      for (const item of expiring) {
        const state = expiryState(item.expiryDate, now);
        if (state === 'VALID') continue;
        const document = item.documentType === 'OTHER' ? item.documentLabel || 'Document' : item.documentType.replace('_', ' ');
        created += await this.remind(item.tenantId, 'EXPIRY', item.id, `${state}:${dateKey(item.expiryDate)}`, {
          clientId: item.clientId,
          type: NotificationType.COMPLIANCE_DOCUMENT_EXPIRING,
          title: `${state === 'EXPIRED' ? 'Document expired' : 'Document expiring'}: ${item.client.name}`,
          message: `${document} of ${item.holderName} for ${label(item.client)} ${state === 'EXPIRED' ? 'expired' : 'expires'} on ${dateKey(item.expiryDate)}.`
        });
      }

      const waiting = await this.prisma.clientRiskChange.findMany({
        where: { ...tenantWhere, status: 'PENDING', createdAt: { lte: new Date(now.getTime() - PENDING_APPROVAL_REMINDER_DAYS * DAY_MS) } },
        include: { client: { select: { id: true, name: true, clientCode: true } } }
      });
      for (const change of waiting) {
        created += await this.remind(change.tenantId, 'RISK_CHANGE', change.id, `waiting-${PENDING_APPROVAL_REMINDER_DAYS}d`, {
          clientId: change.clientId,
          type: NotificationType.COMPLIANCE_RISK_CHANGE_REQUESTED,
          title: `Risk change still awaiting approval: ${change.client.name}`,
          message: `The risk change for ${label(change.client)} requested on ${dateKey(change.createdAt)} has not been decided yet.`
        });
      }

      if (created) this.logger.log(`Compliance reminders sent: ${created}.`);
      return { created, skipped: false };
    } finally {
      this.running = false;
    }
  }

  // Claims the milestone and creates the notification in one transaction; an existing claim means already sent.
  private async remind(tenantId: string, kind: string, entityId: string, milestone: string, notification: { clientId: string; type: NotificationType; title: string; message: string }) {
    try {
      await this.prisma.$transaction([
        this.prisma.complianceReminder.create({ data: { tenantId, kind, entityId, milestone } }),
        this.prisma.notification.create({ data: { tenantId, ...notification } })
      ]);
      return 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return 0;
      throw error;
    }
  }
}

function label(client: { name: string; clientCode: string | null }) {
  return client.clientCode ? `${client.name} (${client.clientCode})` : client.name;
}
