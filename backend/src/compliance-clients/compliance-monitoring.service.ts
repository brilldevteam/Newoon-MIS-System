import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { COMPLIANCE_REGISTER_WHERE, nextReviewDateFor } from '../common/client-compliance';
import { standardDocumentKinds, validateUploadFiles } from '../common/security/upload-security';
import { RequestUser } from '../common/types/request-user.type';
import { userSummarySelect } from '../common/user-summary';
import { PrismaService } from '../prisma/prisma.service';
import { ComplianceDocumentsService, UploadedClientFile } from './compliance-documents.service';
import { CompleteReviewDto, CreateScreeningDto, DecideRiskChangeDto, RequestRiskChangeDto, SaveExpiryItemDto } from './dto/compliance-monitoring.dto';

// Roles that may approve or reject a client risk change. Checked in the service as well as by the role matrix,
// because a matrix grant of "compliance edit" must not be enough to decide risk.
export const RISK_DECISION_ROLES = ['DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'];

const DAY_MS = 24 * 60 * 60 * 1000;
type Tx = Prisma.TransactionClient;
type ClientRef = { id: string; tenantId: string; name: string; clientCode: string | null };

@Injectable()
export class ComplianceMonitoringService {
  constructor(private readonly prisma: PrismaService, private readonly documents: ComplianceDocumentsService) {}

  async overview(user: RequestUser, clientId: string) {
    const client = await this.findClient(user, clientId);
    const [screenings, riskChanges, reviews, expiryItems] = await Promise.all([
      this.prisma.clientScreening.findMany({
        where: { clientId: client.id, tenantId: client.tenantId },
        orderBy: [{ screenedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          performedBy: { select: userSummarySelect },
          documents: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, title: true, fileName: true, mimeType: true, size: true, createdAt: true, sectionId: true, notes: true, uploadedBy: { select: userSummarySelect } } }
        }
      }),
      this.prisma.clientRiskChange.findMany({
        where: { clientId: client.id, tenantId: client.tenantId },
        orderBy: { createdAt: 'desc' },
        include: { requestedBy: { select: userSummarySelect }, decidedBy: { select: userSummarySelect }, review: { select: { id: true } } }
      }),
      this.prisma.clientReview.findMany({
        where: { clientId: client.id, tenantId: client.tenantId },
        orderBy: { startedAt: 'desc' },
        include: { startedBy: { select: userSummarySelect }, completedBy: { select: userSummarySelect }, riskChange: { select: { id: true, status: true, proposedRisk: true } }, _count: { select: { screenings: true } } }
      }),
      this.prisma.clientExpiryItem.findMany({
        where: { clientId: client.id, tenantId: client.tenantId },
        orderBy: [{ isActive: 'desc' }, { expiryDate: 'asc' }]
      })
    ]);
    return {
      screenings,
      riskChanges,
      reviews,
      expiryItems: expiryItems.map((item) => ({ ...item, expiryState: expiryState(item.expiryDate) })),
      canDecideRisk: this.canDecideRisk(user)
    };
  }

  // ---------- Screening ----------

  async createScreening(user: RequestUser, clientId: string, dto: CreateScreeningDto, files: UploadedClientFile[]) {
    const client = await this.findClient(user, clientId);
    const screenedAt = this.pastOrTodayDate(dto.screenedAt, 'Screening date');
    const summary = this.requiredText(dto.summary, 'Summarise the screening result.');
    let reviewId: string | null = null;
    if (dto.reviewId) {
      const review = await this.prisma.clientReview.findFirst({ where: { id: dto.reviewId, clientId: client.id, tenantId: client.tenantId, status: 'IN_PROGRESS' } });
      if (!review) throw new BadRequestException('The selected review is not open.');
      reviewId = review.id;
    }
    // Validate evidence before anything is written, so a rejected file never leaves a screening without its evidence.
    if (files.length) validateUploadFiles(files, standardDocumentKinds, 'document');

    const screening = await this.prisma.$transaction(async (tx) => {
      const row = await tx.clientScreening.create({
        data: {
          tenantId: client.tenantId,
          clientId: client.id,
          reviewId,
          screenedAt,
          scope: this.optionalText(dto.scope),
          listsChecked: [...new Set(dto.listsChecked || [])],
          result: dto.result,
          summary,
          performedById: user.id
        }
      });
      await this.audit(tx, user, client.tenantId, 'ClientScreening', row.id, 'CREATE', { clientId: client.id, result: row.result, screenedAt });
      if (row.result === 'ALERT' || row.result === 'REVIEW') {
        await this.notify(tx, client, NotificationType.COMPLIANCE_SCREENING_ALERT,
          `Screening ${row.result === 'ALERT' ? 'alert' : 'needs review'}: ${client.name}`,
          `Ongoing screening of ${this.clientLabel(client)} was recorded as ${row.result === 'ALERT' ? 'an alert' : 'needing review'}.`);
      }
      return row;
    });

    if (files.length) {
      const section = await this.documents.sectionByKey(client.tenantId, 'screening');
      await this.documents.storeFiles(user, client, section, files, { title: `Screening evidence ${screenedAt.toISOString().slice(0, 10)}`, screeningId: screening.id });
    }
    return this.overview(user, clientId);
  }

  // ---------- Risk changes ----------

  async requestRiskChange(user: RequestUser, clientId: string, dto: RequestRiskChangeDto) {
    const client = await this.findClient(user, clientId);
    await this.prisma.$transaction((tx) => this.createRiskChange(tx, user, client, dto));
    return this.overview(user, clientId);
  }

  async decideRiskChange(user: RequestUser, clientId: string, changeId: string, dto: DecideRiskChangeDto) {
    if (!this.canDecideRisk(user)) throw new ForbiddenException('Only the DMLRO or MLRO can approve or reject a risk change.');
    const client = await this.findClient(user, clientId);
    await this.prisma.$transaction(async (tx) => {
      // Lock the change so two approvers cannot decide it at the same time.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ClientRiskChange" WHERE "id" = ${changeId} FOR UPDATE`);
      const change = await tx.clientRiskChange.findFirst({ where: { id: changeId, clientId: client.id, tenantId: client.tenantId } });
      if (!change) throw new NotFoundException('Risk change not found.');
      if (change.status !== 'PENDING') throw new BadRequestException('This risk change has already been decided.');
      if (change.requestedById === user.id) throw new ForbiddenException('A risk change must be approved by someone other than the person who requested it.');
      const note = this.optionalText(dto.note);
      if (dto.decision === 'REJECT' && !note) throw new BadRequestException('Give a reason for rejecting the risk change.');

      const approved = dto.decision === 'APPROVE';
      await tx.clientRiskChange.update({
        where: { id: change.id },
        data: { status: approved ? 'APPROVED' : 'REJECTED', decidedById: user.id, decidedAt: new Date(), decisionNote: note }
      });
      if (approved) {
        const current = await tx.client.findUniqueOrThrow({ where: { id: client.id }, select: { lastReviewDate: true, cddType: true } });
        await tx.client.update({
          where: { id: client.id },
          data: {
            riskLevel: change.proposedRisk,
            cddType: change.proposedCdd ?? current.cddType,
            // The review cycle restarts from the last completed review under the new risk level.
            nextReviewDate: nextReviewDateFor(change.proposedRisk, current.lastReviewDate ?? new Date())
          }
        });
      }
      await this.audit(tx, user, client.tenantId, 'ClientRiskChange', change.id, 'UPDATE', {
        clientId: client.id, decision: dto.decision, previousRisk: change.previousRisk, proposedRisk: change.proposedRisk, note
      });
      await this.notify(tx, client, NotificationType.COMPLIANCE_RISK_CHANGE_DECIDED,
        `Risk change ${approved ? 'approved' : 'rejected'}: ${client.name}`,
        approved
          ? `${this.clientLabel(client)} is now ${change.proposedRisk.toLowerCase()} risk.`
          : `The request to change ${this.clientLabel(client)} to ${change.proposedRisk.toLowerCase()} risk was rejected.`);
    });
    return this.overview(user, clientId);
  }

  async cancelRiskChange(user: RequestUser, clientId: string, changeId: string) {
    const client = await this.findClient(user, clientId);
    const change = await this.prisma.clientRiskChange.findFirst({ where: { id: changeId, clientId: client.id, tenantId: client.tenantId } });
    if (!change) throw new NotFoundException('Risk change not found.');
    if (change.status !== 'PENDING') throw new BadRequestException('Only a pending risk change can be withdrawn.');
    if (change.requestedById !== user.id && !this.canDecideRisk(user)) throw new ForbiddenException('Only the requester can withdraw this risk change.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientRiskChange.update({ where: { id: change.id }, data: { status: 'CANCELLED', decidedById: user.id, decidedAt: new Date() } });
      await this.audit(tx, user, client.tenantId, 'ClientRiskChange', change.id, 'UPDATE', { clientId: client.id, decision: 'CANCELLED' });
    });
    return this.overview(user, clientId);
  }

  // ---------- Periodic reviews ----------

  async startReview(user: RequestUser, clientId: string) {
    const client = await this.findClient(user, clientId);
    const full = await this.prisma.client.findUniqueOrThrow({ where: { id: client.id }, select: { status: true, nextReviewDate: true, riskLevel: true } });
    if (full.status !== 'ACTIVE') throw new BadRequestException('Periodic reviews are started for active clients only.');
    const open = await this.prisma.clientReview.findFirst({ where: { clientId: client.id, tenantId: client.tenantId, status: 'IN_PROGRESS' } });
    if (open) throw new BadRequestException('A review is already in progress for this client.');
    await this.prisma.$transaction(async (tx) => {
      const review = await tx.clientReview.create({
        data: { tenantId: client.tenantId, clientId: client.id, dueDate: full.nextReviewDate, riskAtStart: full.riskLevel, startedById: user.id }
      });
      await this.audit(tx, user, client.tenantId, 'ClientReview', review.id, 'CREATE', { clientId: client.id, dueDate: full.nextReviewDate });
    });
    return this.overview(user, clientId);
  }

  async completeReview(user: RequestUser, clientId: string, reviewId: string, dto: CompleteReviewDto) {
    const client = await this.findClient(user, clientId);
    const findings = this.requiredText(dto.findings, 'Record the review findings.');
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ClientReview" WHERE "id" = ${reviewId} FOR UPDATE`);
      const review = await tx.clientReview.findFirst({ where: { id: reviewId, clientId: client.id, tenantId: client.tenantId } });
      if (!review) throw new NotFoundException('Review not found.');
      if (review.status !== 'IN_PROGRESS') throw new BadRequestException('This review is no longer in progress.');
      // A review needs current screening evidence: a screening recorded since the review started.
      const screening = await tx.clientScreening.findFirst({
        where: { clientId: client.id, tenantId: client.tenantId, OR: [{ reviewId: review.id }, { createdAt: { gte: review.startedAt } }] }
      });
      if (!screening) throw new BadRequestException('Record a screening for this client before completing the review.');

      let riskChangeId: string | null = null;
      if (dto.outcome === 'RISK_CHANGE_REQUESTED') {
        if (!dto.proposedRisk || !dto.reasonCategory || !this.optionalText(dto.explanation)) {
          throw new BadRequestException('Choose the proposed risk, a reason and an explanation for the risk change.');
        }
        riskChangeId = (await this.createRiskChange(tx, user, client, {
          proposedRisk: dto.proposedRisk, proposedCdd: dto.proposedCdd, reasonCategory: dto.reasonCategory, explanation: dto.explanation!
        })).id;
      }

      const now = new Date();
      const current = await tx.client.findUniqueOrThrow({ where: { id: client.id }, select: { riskLevel: true } });
      await tx.clientReview.update({
        where: { id: review.id },
        data: { status: 'COMPLETED', outcome: dto.outcome, findings, riskChangeId, completedById: user.id, completedAt: now }
      });
      // Until a requested risk change is approved, the next review follows the current risk level.
      await tx.client.update({ where: { id: client.id }, data: { lastReviewDate: now, nextReviewDate: nextReviewDateFor(current.riskLevel, now) } });
      await this.audit(tx, user, client.tenantId, 'ClientReview', review.id, 'UPDATE', { clientId: client.id, outcome: dto.outcome, riskChangeId });
    });
    return this.overview(user, clientId);
  }

  async cancelReview(user: RequestUser, clientId: string, reviewId: string, reason?: string) {
    const client = await this.findClient(user, clientId);
    const review = await this.prisma.clientReview.findFirst({ where: { id: reviewId, clientId: client.id, tenantId: client.tenantId } });
    if (!review) throw new NotFoundException('Review not found.');
    if (review.status !== 'IN_PROGRESS') throw new BadRequestException('This review is no longer in progress.');
    const note = this.requiredText(reason, 'Give a reason for cancelling the review.');
    await this.prisma.$transaction(async (tx) => {
      await tx.clientReview.update({ where: { id: review.id }, data: { status: 'CANCELLED', findings: note, completedById: user.id, completedAt: new Date() } });
      await this.audit(tx, user, client.tenantId, 'ClientReview', review.id, 'UPDATE', { clientId: client.id, outcome: 'CANCELLED', reason: note });
    });
    return this.overview(user, clientId);
  }

  // ---------- Expiry tracking ----------

  async saveExpiryItem(user: RequestUser, clientId: string, dto: SaveExpiryItemDto, itemId?: string) {
    const client = await this.findClient(user, clientId);
    const expiryDate = this.date(dto.expiryDate, 'Expiry date');
    const data = {
      documentType: dto.documentType,
      documentLabel: dto.documentType === 'OTHER' ? this.optionalText(dto.documentLabel) : null,
      holderName: this.requiredText(dto.holderName, 'Enter whose document this is.'),
      holderRole: this.optionalText(dto.holderRole),
      documentNumber: this.optionalText(dto.documentNumber),
      expiryDate,
      notes: this.optionalText(dto.notes),
      isActive: dto.isActive ?? true,
      updatedById: user.id
    };
    if (dto.documentType === 'OTHER' && !data.documentLabel) throw new BadRequestException('Name the document type.');
    await this.prisma.$transaction(async (tx) => {
      if (itemId) {
        const existing = await tx.clientExpiryItem.findFirst({ where: { id: itemId, clientId: client.id, tenantId: client.tenantId } });
        if (!existing) throw new NotFoundException('Expiry record not found.');
        await tx.clientExpiryItem.update({ where: { id: existing.id }, data });
        await this.audit(tx, user, client.tenantId, 'ClientExpiryItem', existing.id, 'UPDATE', { clientId: client.id, documentType: data.documentType, expiryDate, isActive: data.isActive });
      } else {
        const created = await tx.clientExpiryItem.create({ data: { ...data, tenantId: client.tenantId, clientId: client.id, createdById: user.id } });
        await this.audit(tx, user, client.tenantId, 'ClientExpiryItem', created.id, 'CREATE', { clientId: client.id, documentType: data.documentType, expiryDate });
      }
    });
    return this.overview(user, clientId);
  }

  // ---------- helpers ----------

  canDecideRisk(user: RequestUser) {
    return user.roles.some((role) => RISK_DECISION_ROLES.includes(role));
  }

  private async createRiskChange(tx: Tx, user: RequestUser, client: ClientRef, dto: RequestRiskChangeDto) {
    const explanation = this.requiredText(dto.explanation, 'Explain why the risk level should change.');
    const current = await tx.client.findUniqueOrThrow({ where: { id: client.id }, select: { riskLevel: true, cddType: true } });
    const proposedCdd = dto.proposedCdd ?? null;
    if (current.riskLevel === dto.proposedRisk && (!proposedCdd || proposedCdd === current.cddType)) {
      throw new BadRequestException('The proposed risk and CDD type match the current values.');
    }
    const pending = await tx.clientRiskChange.findFirst({ where: { clientId: client.id, tenantId: client.tenantId, status: 'PENDING' } });
    if (pending) throw new BadRequestException('A risk change is already awaiting approval for this client.');
    const change = await tx.clientRiskChange.create({
      data: {
        tenantId: client.tenantId,
        clientId: client.id,
        previousRisk: current.riskLevel,
        proposedRisk: dto.proposedRisk,
        previousCdd: current.cddType,
        proposedCdd,
        reasonCategory: dto.reasonCategory,
        explanation,
        requestedById: user.id
      }
    });
    await this.audit(tx, user, client.tenantId, 'ClientRiskChange', change.id, 'CREATE', { clientId: client.id, previousRisk: current.riskLevel, proposedRisk: dto.proposedRisk, proposedCdd });
    await this.notify(tx, client, NotificationType.COMPLIANCE_RISK_CHANGE_REQUESTED,
      `Risk change awaiting approval: ${client.name}`,
      `A change of ${this.clientLabel(client)} from ${(current.riskLevel || 'pending').toLowerCase()} to ${dto.proposedRisk.toLowerCase()} risk needs DMLRO/MLRO approval.`);
    return change;
  }

  private async notify(tx: Tx, client: ClientRef, type: NotificationType, title: string, message: string) {
    await tx.notification.create({ data: { tenantId: client.tenantId, clientId: client.id, type, title, message } });
  }

  private async audit(tx: Tx, user: RequestUser, tenantId: string, entityType: string, entityId: string, action: 'CREATE' | 'UPDATE', metadata: Record<string, unknown>) {
    await tx.auditLog.create({ data: { tenantId, actorId: user.id, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue } });
  }

  private async findClient(user: RequestUser, clientId: string): Promise<ClientRef> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, ...COMPLIANCE_REGISTER_WHERE, ...this.tenantWhere(user) },
      select: { id: true, tenantId: true, name: true, clientCode: true }
    });
    if (!client) throw new NotFoundException('Compliance client not found');
    return client;
  }

  private tenantWhere(user: RequestUser) {
    if (user.roles.includes('SUPER_ADMIN')) return {};
    if (!user.tenantId) throw new ForbiddenException('User is not assigned to a tenant');
    return { tenantId: user.tenantId };
  }

  private clientLabel(client: ClientRef) {
    return client.clientCode ? `${client.name} (${client.clientCode})` : client.name;
  }

  private date(value: string, label: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${label} is not a valid date.`);
    return parsed;
  }

  private pastOrTodayDate(value: string, label: string) {
    const parsed = this.date(value, label);
    if (parsed.getTime() > Date.now() + DAY_MS) throw new BadRequestException(`${label} cannot be in the future.`);
    return parsed;
  }

  private requiredText(value: unknown, message: string) {
    const text = this.optionalText(value);
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private optionalText(value: unknown) {
    const text = typeof value === 'string' ? value.trim() : '';
    return text || null;
  }
}

export type ExpiryState = 'EXPIRED' | 'DUE_30' | 'DUE_60' | 'DUE_90' | 'VALID';

export function expiryState(expiryDate: Date, now = new Date()): ExpiryState {
  const days = Math.floor((expiryDate.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return 'EXPIRED';
  if (days <= 30) return 'DUE_30';
  if (days <= 60) return 'DUE_60';
  if (days <= 90) return 'DUE_90';
  return 'VALID';
}
