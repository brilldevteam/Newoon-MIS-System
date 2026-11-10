// One-off fix for Preliminary KYC cases caught in the removed "second DMLRO + MLRO approval" round.
//
// Before this change, "Use Preliminary KYC as final" locked the form (status PRELIMINARY_FINAL_REVIEW) and sent the
// already-approved case back to DMLRO and MLRO, where the locked form blocked the reviewers. Confirming the
// Preliminary KYC as final now completes it directly. This script moves the cases still waiting in that round to
// KYC Final Approved so Operations can convert them to clients:
//   - form: status FINAL, locked
//   - case: status KYC_FINAL_APPROVED, with a status-history entry
//   - DMLRO / MLRO review submissions from the first round are locked again as SUBMITTED (they hold that approval)
//   - the open DMLRO / MLRO review tasks the second round created are removed
//   - Operations gets the "convert to client" notification; an audit entry is written per case
// Only cases whose form is PRELIMINARY_FINAL_REVIEW and whose status is DMLRO/MLRO review pending or in progress are
// changed. Anything else in that form state is listed for manual review and left alone.
//
// Build first (npm run build), then from the repository root:
//   node --env-file=backend/.env backend/scripts/finalize-preliminary-final-review.cjs            (dry run, no writes)
//   node --env-file=backend/.env backend/scripts/finalize-preliminary-final-review.cjs --apply    (writes)
// Back up the database before --apply on any shared server.
const { PrismaClient } = require('@prisma/client');

const apply = process.argv.includes('--apply');
const STUCK_STATUSES = ['DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS', 'MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS'];
const NOTE = 'Approved Preliminary KYC confirmed as final; the second DMLRO/MLRO approval round was removed.';

async function finalizeCase(tx, kycCase) {
  const current = await tx.kycCase.findUnique({ where: { id: kycCase.id }, select: { status: true } });
  if (current?.status !== kycCase.status) return false;
  await tx.kycForm.updateMany({ where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id }, data: { status: 'FINAL', isLocked: true } });
  await tx.internalReviewSubmission.updateMany({
    where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, stage: { in: ['DMLRO', 'MLRO'] }, submittedAt: { not: null } },
    data: { status: 'SUBMITTED', isLocked: true }
  });
  await tx.internalReviewTask.deleteMany({
    where: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, stage: { in: ['DMLRO', 'MLRO'] }, status: { in: ['PENDING', 'IN_PROGRESS', 'PAUSED'] } }
  });
  await tx.kycCase.update({ where: { id: kycCase.id }, data: { status: 'KYC_FINAL_APPROVED' } });
  await tx.kycCaseStatusHistory.create({
    data: { tenantId: kycCase.tenantId, kycCaseId: kycCase.id, fromStatus: kycCase.status, toStatus: 'KYC_FINAL_APPROVED', note: NOTE }
  });
  await tx.notification.create({
    data: {
      tenantId: kycCase.tenantId,
      kycCaseId: kycCase.id,
      type: 'CLIENT_READY_FOR_ACTIVATION',
      title: 'Final KYC approved - convert to client',
      message: `${kycCase.title} is final. Operations: open the case, convert it to a client and upload the signed engagement letter.`
    }
  });
  await tx.auditLog.create({
    data: {
      tenantId: kycCase.tenantId,
      action: 'UPDATE',
      entityType: 'KycCase',
      entityId: kycCase.id,
      metadata: { action: 'PRELIMINARY_FINAL_REVIEW_ROUND_CLOSED', event: 'OPERATOR_SCRIPT', fromStatus: kycCase.status }
    }
  });
  return true;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const cases = await prisma.kycCase.findMany({
      where: { kycForm: { status: 'PRELIMINARY_FINAL_REVIEW' } },
      select: { id: true, tenantId: true, title: true, status: true },
      orderBy: { createdAt: 'asc' }
    });
    const eligible = cases.filter((item) => STUCK_STATUSES.includes(item.status));
    const skipped = cases.filter((item) => !STUCK_STATUSES.includes(item.status));
    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${eligible.length} case(s) to move to KYC_FINAL_APPROVED, ${skipped.length} left for manual review.`);
    for (const item of eligible) console.log(`  -> ${item.title} (${item.status})`);
    for (const item of skipped) console.log(`  skip ${item.title} (${item.status})`);
    if (!apply) {
      console.log('No changes written. Re-run with --apply to update these cases.');
      return;
    }
    let done = 0;
    for (const item of eligible) {
      const changed = await prisma.$transaction((tx) => finalizeCase(tx, item));
      if (changed) done += 1;
      else console.log(`  changed meanwhile, not updated: ${item.title}`);
    }
    console.log(`Updated ${done} case(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { finalizeCase };
if (require.main === module) main().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
