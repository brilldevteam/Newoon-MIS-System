const assert = require('node:assert/strict');
const { KycService } = require('../dist/kyc/kyc.service');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');

async function main() {
  const service = Object.create(KycService.prototype);
  let status = 'DMLRO_REVIEW_PENDING';
  let locked = false;
  let active = true;
  let writes = 0;
  service.findOne = async () => ({ id: 'case', status, tenantId: 'tenant' });
  service.prisma = {
    kycCase: { findFirstOrThrow: async () => ({ status }) },
    internalReviewTask: { findFirst: async () => active ? {} : null },
    internalReviewSubmission: { findUnique: async () => ({ isLocked: locked }) }
  };
  service.saveSectionData = async () => { writes++; };
  for (const [role, part, own, next] of [
    ['DMLRO', 'DMLRO', 'DMLRO_REVIEW_PENDING', 'MLRO_REVIEW_PENDING'],
    ['MLRO', 'MLRO', 'MLRO_REVIEW_PENDING', 'SEF_DECISION_PENDING'],
    ['SEF', 'SEF', 'SEF_DECISION_PENDING', 'SEF_APPROVED']
  ]) {
    const user = { id: 'user', tenantId: 'tenant', roles: [role] };
    const data = { reviewPart: part };
    status = own; locked = false; active = true;
    await service.assertFormReviewEditable(user, 'case', data);
    locked = true;
    await assert.rejects(service.assertFormReviewEditable(user, 'case', data), /locked/);
    locked = false; status = next;
    await assert.rejects(service.autoSaveForm(user, 'case', { sectionA: {}, sectionH: data }), /locked/);
    await assert.rejects(service.saveInternalReview(user, 'case', data), /locked/);
    assert.equal(writes, 0, 'Rejected saves must not persist an earlier section');
    status = own; active = false;
    await assert.rejects(service.assertFormReviewEditable(user, 'case', data), /active review task/);
    active = true;
    await service.assertFormReviewEditable(user, 'case', data);
  }
  const enquiries = Object.create(EnquiriesService.prototype);
  enquiries.prisma = { kycCase: { findMany: async () => [{ status }] } };
  for (const role of ['OPERATING_TEAM', 'AML_TEAM', 'AML_SUPERVISOR']) {
    const user = { tenantId: 'tenant', roles: [role] };
    for (status of ['DMLRO_REVIEW_PENDING', 'MLRO_REVIEW_PENDING', 'SEF_DECISION_PENDING']) {
      assert.equal(await enquiries.canModifyEnquiry(user, 'CONVERTED_TO_KYC', 'enquiry'), false);
    }
  }
  status = 'SUPERVISOR_REVIEW_PENDING';
  assert.equal(await enquiries.canModifyEnquiry({ tenantId: 'tenant', roles: ['AML_SUPERVISOR'] }, 'CONVERTED_TO_KYC', 'enquiry'), true);
  console.log('Review edit-lock checks passed (mocked persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
