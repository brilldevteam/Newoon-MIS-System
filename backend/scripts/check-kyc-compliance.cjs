const assert = require('node:assert/strict');
const { complianceValidationError } = require('../dist/common/kyc-compliance');
const { buildKycDocumentModel } = require('../dist/kyc/export/kyc-document-model');
const { KycService } = require('../dist/kyc/kyc.service');

async function main() {
  const preliminary = { formVariant: 'PRELIMINARY_PROPOSED_COMPANY' };
  assert.equal(complianceValidationError(preliminary, {}), null);
  assert.match(complianceValidationError(preliminary, {}, true), /PEP exposure/);
  const answers = { pepQuestion: 'Yes', pepDetails: 'Synthetic PEP details', sanctionQuestion: 'No', dualCitizenshipQuestion: 'Yes', dualCitizenshipDetails: 'Synthetic citizenship details' };
  assert.equal(complianceValidationError({}, answers), null);
  assert.match(complianceValidationError({}, { ...answers, pepDetails: '' }), /Add PEP exposure details/);
  for (const key of ['pepQuestion', 'sanctionQuestion', 'dualCitizenshipQuestion']) {
    assert.ok(complianceValidationError({}, { ...answers, [key]: '' }));
  }
  const payload = { kycCaseId: 'synthetic', sectionA: {}, sectionB: {}, sectionC: {}, sectionD: answers, sectionE: {}, sectionF: {}, sectionG: {}, sectionH: {} };
  const full = await buildKycDocumentModel(payload, 1);
  const section = full.blocks.find((block) => block.kind === 'section' && block.title.startsWith('D.'));
  assert.ok(section);
  assert.match(JSON.stringify(section), /Synthetic PEP details/);
  assert.match(JSON.stringify(section), /Synthetic citizenship details/);
  const prelim = await buildKycDocumentModel({ ...payload, sectionA: preliminary }, 1);
  assert.equal(prelim.blocks.some((block) => block.kind === 'section' && block.title.startsWith('D.')), false);
  const converted = await buildKycDocumentModel({ ...payload, sectionA: preliminary, fullKycStarted: true }, 1);
  assert.ok(converted.blocks.some((block) => block.kind === 'section' && block.title.startsWith('D.')));

  const service = Object.create(KycService.prototype);
  service.findOne = async () => ({ id: 'case', status: 'MLRO_APPROVED', sourceEnquiryId: 'source' });
  service.isPreliminaryProposedCompanyCase = async () => true;
  service.routePreliminaryFinalKycForApproval = async () => 'routed';
  service.startPreliminaryFullKyc = async () => 'full';
  for (const role of ['AML_SUPERVISOR', 'DMLRO', 'MLRO']) {
    const user = { roles: [role] };
    assert.equal(await service.completeFinalKycDecision(user, 'case', { decision: 'SAME_KYC_FINAL' }), 'routed');
    assert.equal(await service.completeFinalKycDecision(user, 'case', { decision: 'AMENDMENT_REQUIRED' }), 'full');
  }
  await assert.rejects(service.completeFinalKycDecision({ roles: ['OPERATING_TEAM'] }, 'case', { decision: 'SAME_KYC_FINAL' }), /Only AML Supervisor/);
  service.isPreliminaryProposedCompanyCase = async () => false;
  service.prisma = { $transaction: async () => { throw new Error('AUTHORIZED_FINAL_ACTION'); } };
  for (const role of ['AML_SUPERVISOR', 'DMLRO', 'MLRO']) {
    const user = { roles: [role] };
    await assert.rejects(service.completeFinalKycDecision(user, 'case', { decision: 'SAME_KYC_FINAL' }), /AUTHORIZED_FINAL_ACTION/);
    await assert.rejects(service.startAmendment(user, 'case', { sections: ['D. Compliance and Risk'], reason: 'Synthetic amendment' }), /AUTHORIZED_FINAL_ACTION/);
  }
  await assert.rejects(service.completeFinalKycDecision({ roles: ['OPERATING_TEAM'] }, 'case', { decision: 'SAME_KYC_FINAL' }), /final KYC decision/);
  service.findOne = async () => ({ id: 'case', status: 'DMLRO_REVIEW_PENDING' });
  await assert.rejects(service.completeFinalKycDecision({ roles: ['DMLRO'] }, 'case', { decision: 'SAME_KYC_FINAL' }), /approval/i);
  console.log('Full-KYC compliance, export isolation and final-decision role checks passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
