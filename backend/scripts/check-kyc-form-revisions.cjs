const assert = require('node:assert/strict');
const { KycService } = require('../dist/kyc/kyc.service');
const form = {
  id: 'form', tenantId: 'tenant', kycCaseId: 'case', version: 1, fullKycStarted: false,
  sections: [{ sectionKey: 'GENERAL_COMPANY', data: { legalName: 'Original' } }, { sectionKey: 'CLIENT_DECLARATION', data: { fullName: 'Signatory', signatureDataUrl: 'original-signature' } }],
  shareholders: [], ubos: [], managers: [], requiredDocuments: [], generatedDocuments: [],
  internalReview: { dmlroSignatureDataUrl: 'old-review-signature', dmlroDecision: 'APPROVE' },
  kycCase: { legalDocuments: [], sourceEnquiry: null }
};
const stored = [];
let status = 'DMLRO_REVIEW_PENDING';
let fullConversion = false;
const tx = {
  $queryRaw: async () => [],
  kycCase: { findFirst: async () => ({ status }) },
  kycForm: {
    findFirst: async () => structuredClone(form),
    update: async ({ data }) => { form.version++; form.status = data.status; form.fullKycStarted = data.fullKycStarted; }
  },
  kycFormRevision: { create: async ({ data }) => { const row = { id: `revision-${data.version}`, ...structuredClone(data) }; stored.push(row); return row; } },
  kycInternalReview: { updateMany: async ({ data }) => { assert.equal(data.dmlroSignatureDataUrl, null); assert.equal(data.mlroDecision, null); Object.assign(form.internalReview, data); } },
  auditLog: { create: async () => ({}) },
  internalReviewSubmission: { updateMany: async ({ data }) => {
    assert.equal(data.isLocked, false);
    if (fullConversion) {
      assert.equal(Object.hasOwn(data, 'formalComments'), false, 'Conversion must not erase submitted comments');
      assert.equal(Object.hasOwn(data, 'data'), false, 'Conversion must not erase submitted review data');
    } else { assert.equal(data.formalComments, null); assert.deepEqual(data.data, {}); }
  } },
  signedKycDocument: { findMany: async () => [], updateMany: async ({ data }) => { assert.equal(data.activeVersion, false); } }
};

async function run() {
  const service = Object.create(KycService.prototype);
  const user = { id: 'reviewer', tenantId: 'tenant', roles: ['DMLRO'] };
  const currentCase = { id: 'case', tenantId: 'tenant', status };
  await service.beginFormAmendment(tx, user, currentCase, 'Correct company name');
  assert.equal(form.version, 2);
  assert.equal(form.status, 'AMENDMENT_DRAFT');
  assert.equal(stored[0].snapshot.sectionG.signatureDataUrl, 'original-signature');
  assert.equal(stored[0].snapshot.sectionH.dmlroSignatureDataUrl, 'old-review-signature');
  form.sections[0].data.legalName = 'Amended';
  form.sections[1].data.signatureDataUrl = 'new-client-signature';
  assert.equal(stored[0].snapshot.sectionA.legalName, 'Original');
  assert.equal(stored[0].snapshot.sectionG.signatureDataUrl, 'original-signature');
  await service.beginFormAmendment(tx, user, currentCase, 'Second return');
  assert.equal(form.version, 3);
  assert.equal(stored[1].snapshot.sectionA.legalName, 'Amended');
  status = 'SUPERVISOR_REVIEW_PENDING';
  await assert.rejects(service.beginFormAmendment(tx, user, currentCase, 'Concurrent return'), /case changed/);
  assert.equal(form.version, 3);
  service.prisma = {
    kycCase: { findFirst: async () => ({ status: 'SUPERVISOR_REVIEW_PENDING' }) },
    kycForm: { findFirst: async () => ({ ...form, isLocked: false }) }
  };
  const aml = { id: 'aml', tenantId: 'tenant', roles: ['AML_SUPERVISOR'] };
  await assert.rejects(service.requireWritableForm(aml, 'case', ['AML_SUPERVISOR'], 1), /revision has changed/);
  await assert.rejects(service.requireWritableForm(aml, 'case', ['AML_SUPERVISOR']), /revision has changed/);
  assert.equal((await service.requireWritableForm(aml, 'case', ['AML_SUPERVISOR'], 3)).version, 3);
  service.prisma.kycCase.findFirst = async () => ({ status: 'AML_REVIEW_STARTED' });
  assert.equal(await service.isLegacyFullKycDraft('case', 'AML_REVIEW_STARTED', aml), false);
  form.fullKycStarted = true;
  assert.equal(await service.isLegacyFullKycDraft('case', 'AML_REVIEW_STARTED', aml), true);
  await service.requireWritableForm(aml, 'case', ['AML_SUPERVISOR'], 3);
  await assert.rejects(service.requireWritableForm(aml, 'case', ['AML_SUPERVISOR'], 2), /revision has changed/);
  assert.equal(await service.isLegacyFullKycDraft('case', 'DMLRO_REVIEW_PENDING', aml), false);
  status = 'MLRO_APPROVED';
  fullConversion = true;
  form.fullKycStarted = false;
  Object.assign(form.internalReview, { amlClarificationFindings: 'Original AML comment', dmlroComments: 'Original DMLRO comment', mlroComments: 'Original MLRO comment' });
  tx.internalReviewTask = { upsert: async () => ({}) };
  tx.workflowComment = { create: async () => ({}) };
  tx.kycCase.findUniqueOrThrow = async () => ({ id: 'case', status });
  service.recordStatus = async (_, __, ___, next) => { status = next; };
  service.prisma.$transaction = async (callback) => callback(tx);
  await service.startPreliminaryFullKyc(aml, { id: 'case', tenantId: 'tenant', status }, { reason: 'Prepare full KYC' });
  assert.equal(status, 'SUPERVISOR_REVIEW_PENDING');
  assert.equal(form.fullKycStarted, true);
  assert.equal(form.status, 'AMENDMENT_DRAFT');
  assert.equal(form.internalReview.amlClarificationFindings, 'Original AML comment');
  assert.equal(form.internalReview.dmlroComments, 'Original DMLRO comment');
  assert.equal(form.internalReview.mlroComments, 'Original MLRO comment');
  assert.equal(stored.at(-1).snapshot.sectionH.mlroComments, 'Original MLRO comment');
  assert.equal(stored[0].snapshot.sectionA.legalName, 'Original');
  assert.equal(stored[0].snapshot.sectionG.signatureDataUrl, 'original-signature');
  console.log('Immutable V1/V2 snapshots, populated amendments, approval reset and concurrent-status guard passed.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
