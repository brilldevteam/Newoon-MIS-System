const assert = require('node:assert/strict');
const { KycService } = require('../dist/kyc/kyc.service');
const { preliminaryDeclaration } = require('../dist/common/preliminary-review');
const preliminary = {
  companyName: 'Synthetic Company',
  documents: [{ documentType: 'Passport', available: true }],
  declaration: {
    fullName: 'Synthetic Signatory', position: 'Director', date: '2026-10-13',
    authorizedSignature: 'signature.png', authorizedSignatureDataUrl: 'data:image/png;base64,c2ln',
    companyStamp: 'stamp.png', companyStampDataUrl: 'data:image/png;base64,c3RhbXA='
  }
};
const service = Object.create(KycService.prototype);
const form = {
  id: 'form', tenantId: 'tenant', kycCaseId: 'case', version: 1,
  sections: [{ sectionKey: 'GENERAL_COMPANY', data: { formVariant: 'PRELIMINARY_PROPOSED_COMPANY' } }],
  shareholders: [], ubos: [], managers: [], requiredDocuments: [], generatedDocuments: [],
  kycCase: { legalDocuments: [], sourceEnquiry: { details: { preliminaryKyc: preliminary } } }
};
const legacy = service.serializeForm(form);
assert.deepEqual(legacy.preliminaryDocument, preliminary);
assert.deepEqual(legacy.sectionG, preliminaryDeclaration(preliminary));
assert.equal(legacy.sectionG.signatureDataUrl, preliminary.declaration.authorizedSignatureDataUrl);
assert.equal(legacy.sectionG.stampDataUrl, preliminary.declaration.companyStampDataUrl);
const snapshotForm = {
  ...form,
  sections: [
    { sectionKey: 'GENERAL_COMPANY', data: { formVariant: 'PRELIMINARY_PROPOSED_COMPANY', preliminaryKyc: preliminary } },
    { sectionKey: 'CLIENT_DECLARATION', data: { fullName: 'Updated Signatory', signatureDataUrl: 'updated-image' } }
  ],
  kycCase: { ...form.kycCase, sourceEnquiry: { details: { preliminaryKyc: { companyName: 'Changed source' } } } }
};
const snapshot = service.serializeForm(snapshotForm);
assert.deepEqual(snapshot.preliminaryDocument, preliminary);
assert.equal(snapshot.sectionG.fullName, 'Updated Signatory');
assert.equal(snapshot.sectionG.signatureDataUrl, 'updated-image');
assert.equal(service.serializeForm({ ...snapshotForm, version: 2, fullKycStarted: true }).preliminaryDocument, null);
const standard = service.serializeForm({ ...form, sections: [{ sectionKey: 'GENERAL_COMPANY', data: { formVariant: 'STANDARD' } }] });
assert.equal(standard.preliminaryDocument, null);
assert.deepEqual(standard.sectionG, {});
console.log('Preliminary review snapshot, legacy declaration/signature recovery, and full/standard form isolation passed.');
