// Confirming an approved KYC as final (Preliminary or normal) completes it in one step and notifies Operations.
// Build first (npm run build), then: node backend/scripts/check-preliminary-final.cjs
const assert = require('node:assert/strict');
const { KycService } = require('../dist/kyc/kyc.service');

function harness(caseStatus) {
  const writes = { forms: [], statuses: [], history: [], notifications: [], audits: [], tasks: [], submissions: [] };
  let status = caseStatus;
  const tx = {
    $queryRaw: async () => [],
    kycCase: {
      findFirst: async () => ({ status }),
      update: async ({ data }) => { status = data.status; writes.statuses.push(data.status); return {}; },
      findUniqueOrThrow: async () => ({ id: 'case', status })
    },
    kycForm: { updateMany: async ({ data }) => { writes.forms.push(data); return { count: 1 }; } },
    kycCaseStatusHistory: { create: async ({ data }) => { writes.history.push(data); return data; } },
    notification: { create: async ({ data }) => { writes.notifications.push(data); return data; } },
    auditLog: { create: async ({ data }) => { writes.audits.push(data); return data; } },
    internalReviewTask: { createMany: async (args) => { writes.tasks.push(args); }, deleteMany: async (args) => { writes.tasks.push(args); } },
    internalReviewSubmission: { updateMany: async (args) => { writes.submissions.push(args); } }
  };
  const service = Object.create(KycService.prototype);
  service.prisma = { $transaction: async (callback) => callback(tx) };
  service.findOne = async () => ({ id: 'case', tenantId: 'tenant-a', title: 'Synthetic Co KYC', status, sourceEnquiryId: 'enquiry' });
  return { service, writes, status: () => status, setStatus: (next) => { status = next; } };
}

async function main() {
  for (const role of ['AML_SUPERVISOR', 'AML_TEAM', 'DMLRO', 'MLRO']) {
    const { service, writes, status } = harness('MLRO_APPROVED');
    service.isPreliminaryProposedCompanyCase = async () => true;
    await service.completeFinalKycDecision({ id: 'u', roles: [role] }, 'case', { decision: 'SAME_KYC_FINAL' });
    assert.equal(status(), 'KYC_FINAL_APPROVED', `${role}: preliminary goes straight to final`);
    assert.deepEqual(writes.forms, [{ isLocked: true, status: 'FINAL', updatedBy: 'u' }]);
    assert.equal(writes.forms.some((data) => data.status === 'PRELIMINARY_FINAL_REVIEW'), false);
    assert.equal(writes.tasks.length, 0, 'no second DMLRO/MLRO review tasks');
    assert.equal(writes.submissions.length, 0, 'first-round DMLRO/MLRO approvals stay submitted');
    assert.equal(writes.history[0].toStatus, 'KYC_FINAL_APPROVED');
    assert.equal(writes.notifications.length, 1);
    assert.equal(writes.notifications[0].type, 'CLIENT_READY_FOR_ACTIVATION');
    assert.equal(writes.notifications[0].kycCaseId, 'case');
    assert.match(writes.notifications[0].message, /convert it to a client/);
    assert.equal(writes.audits[0].metadata.action, 'PRELIMINARY_KYC_MARKED_FINAL');
  }

  // Normal KYC uses the same completion and notification.
  {
    const { service, writes, status } = harness('SEF_APPROVED');
    service.isPreliminaryProposedCompanyCase = async () => false;
    await service.completeFinalKycDecision({ id: 'u', roles: ['MLRO'] }, 'case', { decision: 'SAME_KYC_FINAL' });
    assert.equal(status(), 'KYC_FINAL_APPROVED');
    assert.equal(writes.notifications[0].type, 'CLIENT_READY_FOR_ACTIVATION');
    assert.equal(writes.audits[0].metadata.action, 'APPROVED_KYC_MARKED_FINAL');
  }

  // A second click after the status changed is refused and writes nothing.
  {
    const { service, writes, setStatus } = harness('MLRO_APPROVED');
    service.isPreliminaryProposedCompanyCase = async () => true;
    const stale = await service.findOne();
    setStatus('KYC_FINAL_APPROVED');
    service.findOne = async () => stale;
    await assert.rejects(service.completeFinalKycDecision({ id: 'u', roles: ['DMLRO'] }, 'case', { decision: 'SAME_KYC_FINAL' }), /case changed/);
    assert.equal(writes.notifications.length, 0);
  }

  // Not yet approved: refused.
  {
    const { service } = harness('DMLRO_REVIEW_PENDING');
    service.isPreliminaryProposedCompanyCase = async () => true;
    await assert.rejects(service.completeFinalKycDecision({ id: 'u', roles: ['DMLRO'] }, 'case', { decision: 'SAME_KYC_FINAL' }), /approval/i);
  }
  console.log('Final KYC checks passed: Preliminary KYC is final in one step, Operations is notified to convert it, stale repeats are refused (mocked persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
