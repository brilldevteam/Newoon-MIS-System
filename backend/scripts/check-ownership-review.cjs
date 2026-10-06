// Synthetic regression checks; no database, credentials, or client records are used.
const assert = require('node:assert/strict');
const { beneficialOwners } = require('../dist/common/ownership');
const { safeComment, hasComment, commentLines } = require('../dist/common/review-comments');
const { KycService } = require('../dist/kyc/kyc.service');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');
const { buildKycDocumentModel } = require('../dist/kyc/export/kyc-document-model');

async function main() {
  const enquiry = Object.create(EnquiriesService.prototype);
  const preliminary = { companyName: 'Example', proposedLegalForm: 'LLC', jurisdiction: 'QFC', businessActivity: 'Consulting', registeredOfficeAddress: 'Example office', sourceOfFunds: 'Capital', management: [{ fullName: 'Example Manager', position: 'Director' }], documents: [{ available: true }] };
  const validate = (percentages) => enquiry.assertCompletePreliminaryKyc({ ...preliminary, shareholders: percentages.map((ownershipPercentage, index) => ({ fullName: `Owner ${index}`, ownershipPercentage })) });
  assert.throws(() => validate(['30', '100']), /must total 100%/);
  assert.throws(() => validate(['30', '60']), /must total 100%/);
  for (const invalid of ['-1', '101', 'NaN', '50abc']) assert.throws(() => validate([invalid]), /between 0 and 100/);
  assert.doesNotThrow(() => validate(['30', '70']));
  assert.doesNotThrow(() => validate(['100']));
  assert.doesNotThrow(() => validate(['33.33', '33.33', '33.34']));
  const owner = { id: 'person', fullName: 'Example Owner', identityNumber: '001234ABC', ownershipPercentage: '50', isUbo: true };
  const corporate = { id: 'company', fullName: 'Example Holding Ltd', shareholderType: 'Corporate Entity', ownershipPercentage: '50' };
  const indirect = { id: 'indirect', fullName: 'Another Owner', identityNumber: '0000987', parentRowId: 'company', ownershipPercentage: '100' };
  assert.deepEqual(beneficialOwners([owner, corporate], [{ fullName: '' }, indirect]), [owner, indirect]);
  assert.equal(beneficialOwners([owner], [{ ...owner }]).length, 1);
  assert.equal(beneficialOwners([{ ...owner, isUbo: false }], [{ ...owner }]).length, 0);
  assert.equal(beneficialOwners([{ ...corporate, isUbo: true }], []).length, 0);
  for (const empty of ['', '<p><br></p>', '<p>&nbsp;</p>', '<ul><li></li></ul>', '<script>alert(1)</script>']) assert.equal(hasComment(empty), false, empty);
  assert.equal(hasComment('<p><strong>Reviewed</strong></p>'), true);
  assert(!safeComment('<p onclick="x()">Safe</p><img src=x onerror=x()><script>x()</script>').includes('script'));
  const lines = commentLines('<p><strong>Bold</strong> <mark>highlight</mark></p><p><em>Second paragraph</em></p>');
  assert(lines.flat().some((part) => part.bold && part.text === 'Bold'));
  assert(lines.flat().some((part) => part.highlight && part.text === 'highlight'));
  assert(lines.flat().some((part) => part.italic && part.text === 'Second paragraph'));
  assert.equal(commentLines(safeComment('Review A & B'))[0][0].text, 'Review A & B');
  assert.deepEqual(commentLines('<ol><li>First</li><li>Second</li></ol>').map((line) => line.map((run) => run.text).join('')), ['1. First', '2. Second']);
  const model = await buildKycDocumentModel({ sectionA: { legalName: 'Example' }, sectionB: { shareholders: [owner, corporate], ubos: [indirect] }, sectionH: { mlroComments: '<p><strong>Reviewed</strong> <mark>with conditions</mark></p>' } }, 1);
  const blocks = model.blocks.flatMap((block) => block.kind === 'section' ? block.blocks : [block]);
  const diagram = blocks.find((block) => block.kind === 'diagram');
  assert(diagram.diagram.svg.includes('ANOTHER OWNER'), 'Linked natural-person UBO must appear in exported chart');
  const comments = blocks.filter((block) => block.kind === 'table').flatMap((block) => block.rows).flatMap((row) => row.cells).find((cell) => cell.lines?.some((line) => line.parts.some((part) => part.text === 'Reviewed')));
  assert.equal(comments.span, 2, 'Review comments must span the full export width');
  assert(comments.lines.flatMap((line) => line.parts).some((part) => part.highlight));

  const service = Object.create(KycService.prototype);
  service.assertStageRole = () => {};
  service.assertReviewStageActive = async () => {};
  await assert.rejects(() => service.submitSupervisorReview({}, 'case', { formalComments: '<p><br></p>' }), /Supervisor comments/);
  await assert.rejects(() => service.submitDmlroReview({}, 'case', { formalComments: '' }), /DMLRO comments/);
  service.findOne = async () => ({ id: 'case', tenantId: 'tenant', clientId: 'client', status: 'SUPERVISOR_REVIEW_PENDING', client: { name: 'Example', registrationNumber: '001' } });
  service.assertPreviousStageComplete = service.assertEditableReview = async () => {};
  service.lockReviewSubmission = async () => { throw new Error('VALID_PACKAGE_REACHED_LOCK'); };
  const checks = ['NCTC', 'UN', 'OFAC', 'EU', 'PPO_LIST', 'WORLD_CHECK', 'GOOGLE'].map((checkType) => ({ checkType, resultStatus: 'NO_MATCH' }));
  const documents = checks.slice(0, 5).map((check) => ({ checkType: check.checkType, storagePath: 'synthetic.pdf' }));
  const tx = {
    screeningRecord: { findMany: async () => [] },
    screeningCaseCheck: { findMany: async () => checks },
    screeningCaseDocument: { findMany: async () => documents },
    kycForm: { findFirst: async () => null },
    crrfRecord: { findFirst: async () => null }
  };
  service.prisma = { $transaction: async (callback) => callback(tx) };
  const route = () => service.submitReviewAndRoute({}, 'case', 'SUPERVISOR', { formalComments: 'Reviewed' }, 'DMLRO');
  await assert.rejects(route, /Complete Screening/);
  tx.screeningRecord.findMany = async () => [{ identifier: '001', entityName: 'Example', status: 'COMPLETED', conclusionStatus: 'CLEAR', remarks: 'Reviewed', checks: [] }];
  await assert.rejects(route, /CRRF/);
  tx.crrfRecord.findFirst = async () => ({ riskRating: 'MEDIUM', documents: [{ storagePath: 'synthetic.pdf' }] });
  await assert.rejects(route, /VALID_PACKAGE_REACHED_LOCK/);
  service.serializeForm = () => ({ sectionA: {}, sectionB: { shareholders: [{ fullName: 'Missing Owner', identityNumber: '999' }], ubos: [] }, sectionC: { managers: [] } });
  tx.kycForm.findFirst = async () => ({});
  await assert.rejects(route, /Complete Screening/);
  tx.kycForm.findFirst = async () => null;
  tx.screeningCaseDocument.findMany = async () => [];
  await assert.rejects(route, /Complete Screening/);
  service.requireWritableCase = service.findOne;
  service.prisma.legalDocument = { count: async () => 1 };
  const legacy = () => service.submitToAml({}, 'case');
  await assert.rejects(legacy, /Complete Screening/);
  tx.screeningCaseDocument.findMany = async () => documents;
  tx.kycInternalReview = { findFirst: async () => ({ amlClarificationFindings: '<p><br></p>' }) };
  await assert.rejects(legacy, /Supervisor comments/);
  tx.kycInternalReview.findFirst = async () => ({ amlClarificationFindings: '<p>Reviewed package</p>' });
  await assert.rejects(legacy, /VALID_PACKAGE_REACHED_LOCK/);
  await assert.rejects(() => service.submitToAml({}, 'case', { formalComments: '<p><br></p>' }), /Supervisor comments/);
  tx.kycInternalReview.findFirst = async () => null;
  service.lockReviewSubmission = async (_, __, ___, ____, dto) => {
    assert.equal(dto.formalComments, '<p><strong>Reviewed preliminary case</strong></p>');
    assert.equal(dto.data.amlClarificationFindings, dto.formalComments);
    throw new Error('SUBMISSION_COMMENTS_REACHED_LOCK');
  };
  await assert.rejects(() => service.submitToAml({}, 'case', { formalComments: '<p><strong>Reviewed preliminary case</strong></p>' }), /SUBMISSION_COMMENTS_REACHED_LOCK/);
  tx.kycInternalReview.findFirst = async () => ({ amlClarificationFindings: 'Reviewed' });
  tx.legalDocument = { count: async () => 1 };
  assert.equal((await service.submissionReadiness({}, 'case')).ready, true);
  tx.screeningRecord.findMany = async () => [];
  tx.crrfRecord.findFirst = async () => null;
  const pending = await service.submissionReadiness({}, 'case');
  assert.equal(pending.ready, false);
  assert.equal(pending.checks.find((check) => check.label === 'Screening').complete, false);
  assert.equal(pending.checks.find((check) => check.label === 'CRRF').complete, false);
  console.log('Ownership, safe formatting, empty comments, Screening and CRRF regression checks passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
