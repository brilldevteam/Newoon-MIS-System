// One-off backfill for clients that were already Active, Inactive or On hold before the compliance register existed.
// For each such client without a client code it assigns, in activation order:
//   - a client code CL-<activation year>-NNNN (after any codes already issued that year)
//   - risk level and CDD type from the latest KYC case (reclassification > internal review > CRRF)
//   - activatedAt (when the case reached CLIENT_ACTIVE, else the client's last update), lastReviewDate = activatedAt,
//     nextReviewDate by risk (High 1y, Medium 2y, Low 3y)
//   - email/phone from the primary contact when empty
//   - a service engagement for that KYC case when it has none
// It never changes status, never touches clients that already have a code, and writes an audit entry per client.
// A second pass fills a missing CR / QFC number from the client's latest KYC form (Section A).
//
// Build first (npm run build), then from the repository root:
//   node --env-file=backend/.env backend/scripts/backfill-compliance-clients.cjs            (dry run, no writes)
//   node --env-file=backend/.env backend/scripts/backfill-compliance-clients.cjs --apply    (writes)
// Back up the database before --apply on any shared server.
const { PrismaClient } = require('@prisma/client');
const {
  COMPLIANCE_REGISTER_STATUSES,
  nextClientCode,
  nextEngagementNumber,
  nextReviewDateFor,
  onboardingRiskProfile
} = require('../dist/common/client-compliance');

const apply = process.argv.includes('--apply');

async function activationDate(tx, client, kycCase) {
  if (client.activatedAt) return client.activatedAt;
  if (kycCase) {
    const activated = await tx.kycCaseStatusHistory.findFirst({
      where: { kycCaseId: kycCase.id, tenantId: client.tenantId, toStatus: 'CLIENT_ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    });
    if (activated) return activated.createdAt;
  }
  return client.updatedAt;
}

async function planClient(tx, client) {
  const kycCase = await tx.kycCase.findFirst({
    where: { clientId: client.id, tenantId: client.tenantId },
    orderBy: [{ updatedAt: 'desc' }],
    include: { service: { select: { name: true } }, clientEngagement: { select: { id: true } } }
  });
  const activatedAt = await activationDate(tx, client, kycCase);
  const profile = kycCase ? await onboardingRiskProfile(tx, kycCase.id, client.tenantId) : { riskLevel: null, cddType: null };
  const riskLevel = client.riskLevel || profile.riskLevel;
  const primary = client.contacts.find((contact) => contact.isPrimary) || client.contacts[0];
  return {
    kycCase,
    data: {
      clientCode: await nextClientCode(tx, client.tenantId, activatedAt),
      activatedAt,
      riskLevel,
      cddType: client.cddType || profile.cddType,
      email: client.email ?? primary?.email ?? null,
      phone: client.phone ?? primary?.phone ?? null,
      lastReviewDate: client.lastReviewDate ?? activatedAt,
      nextReviewDate: client.nextReviewDate ?? nextReviewDateFor(riskLevel, client.lastReviewDate ?? activatedAt)
    }
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const candidates = await prisma.client.findMany({
      where: { clientCode: null, status: { in: [...COMPLIANCE_REGISTER_STATUSES] } },
      include: { contacts: true }
    });
    // Issue codes in activation order so earlier clients get lower numbers within a year.
    const dated = await Promise.all(candidates.map(async (client) => {
      const kycCase = await prisma.kycCase.findFirst({ where: { clientId: client.id, tenantId: client.tenantId }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
      return { client, at: await activationDate(prisma, client, kycCase) };
    }));
    dated.sort((left, right) => left.at - right.at);

    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${dated.length} client(s) without a client code in the register.`);
    const summarize = (client, plan, engagementNumber) => [
      plan.data.clientCode,
      client.name,
      `status ${client.status}`,
      `risk ${plan.data.riskLevel || 'Pending'}`,
      `CDD ${plan.data.cddType || 'not set'}`,
      `activated ${plan.data.activatedAt.toISOString().slice(0, 10)}`,
      `next review ${plan.data.nextReviewDate ? plan.data.nextReviewDate.toISOString().slice(0, 10) : 'not scheduled'}`,
      engagementNumber ? `engagement ${engagementNumber}` : plan.kycCase ? 'engagement exists' : 'no KYC case'
    ].join(' | ');

    // Writes one client inside the given transaction; the dry run uses the same code and rolls everything back.
    async function backfill(tx, client) {
      const fresh = await tx.client.findUniqueOrThrow({ where: { id: client.id }, include: { contacts: true } });
      if (fresh.clientCode) return null; // assigned by an activation meanwhile
      const plan = await planClient(tx, fresh);
      await tx.client.update({ where: { id: client.id }, data: plan.data });
      let engagementNumber = null;
      if (plan.kycCase && !plan.kycCase.clientEngagement) {
        engagementNumber = await nextEngagementNumber(tx, client.tenantId, plan.data.activatedAt);
        await tx.clientEngagement.create({
          data: {
            tenantId: client.tenantId,
            clientId: client.id,
            kycCaseId: plan.kycCase.id,
            engagementNumber,
            serviceName: plan.kycCase.service?.name || plan.kycCase.title,
            description: `Backfilled from KYC ${plan.kycCase.kycNumber}`,
            status: client.status === 'ACTIVE' ? 'IN_PROGRESS' : 'PENDING',
            startDate: plan.data.activatedAt
          }
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: client.tenantId,
          action: 'UPDATE',
          entityType: 'ComplianceClient',
          entityId: client.id,
          metadata: {
            event: 'COMPLIANCE_REGISTER_BACKFILL',
            clientCode: plan.data.clientCode,
            riskLevel: plan.data.riskLevel,
            cddType: plan.data.cddType,
            kycCaseId: plan.kycCase?.id || null,
            engagementNumber
          }
        }
      });
      return summarize(client, plan, engagementNumber);
    }

    if (!apply) {
      await prisma.$transaction(async (tx) => {
        for (const { client } of dated) {
          const line = await backfill(tx, client);
          if (line) console.log(`  would set: ${line}`);
        }
        throw Object.assign(new Error('dry-run rollback'), { dryRun: true });
      }, { timeout: 120000 }).catch((error) => { if (!error.dryRun) throw error; });
    } else {
      // One transaction per client, so a failure leaves earlier clients done and the run can simply be repeated.
      for (const { client } of dated) {
        const line = await prisma.$transaction((tx) => backfill(tx, client), { timeout: 60000 });
        if (line) console.log(`  set: ${line}`);
      }
    }
    if (!apply && dated.length) console.log('No changes were written. Re-run with --apply to write them.');

    // Second pass: register clients without a CR / QFC number take it from their latest KYC form (Section A).
    const missingRegistration = await prisma.client.findMany({
      where: { status: { in: [...COMPLIANCE_REGISTER_STATUSES] }, OR: [{ registrationNumber: null }, { registrationNumber: '' }] },
      select: { id: true, tenantId: true, name: true }
    });
    let filled = 0;
    for (const client of missingRegistration) {
      const section = await prisma.kycSectionData.findFirst({
        where: { tenantId: client.tenantId, sectionKey: 'GENERAL_COMPANY', kycCase: { clientId: client.id } },
        orderBy: { updatedAt: 'desc' },
        select: { data: true, kycCaseId: true }
      });
      const registrationNumber = String(section?.data?.commercialRegistrationNo ?? '').trim();
      if (!registrationNumber) continue;
      filled += 1;
      console.log(`  ${apply ? 'set' : 'would set'} CR / QFC no.: ${client.name} -> ${registrationNumber}`);
      if (!apply) continue;
      await prisma.$transaction([
        prisma.client.update({ where: { id: client.id }, data: { registrationNumber } }),
        prisma.auditLog.create({
          data: { tenantId: client.tenantId, action: 'UPDATE', entityType: 'ComplianceClient', entityId: client.id, metadata: { event: 'COMPLIANCE_REGISTER_BACKFILL', registrationNumber, kycCaseId: section.kycCaseId } }
        })
      ]);
    }
    console.log(`CR / QFC numbers ${apply ? 'filled' : 'to fill'}: ${filled} of ${missingRegistration.length} clients without one.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
