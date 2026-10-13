const assert = require('node:assert/strict');
const { sharedReviewFeedback } = require('../dist/common/shared-review-feedback');
const { safeComment } = require('../dist/common/review-comments');
const feedback = sharedReviewFeedback('DMLRO', {
  decision: 'RETURN_TO_SUPERVISOR', comments: '<p>Please <strong>correct</strong> the file.</p>',
  reason: 'Signature missing', conditions: 'Attach signed declaration',
  confidentialNotes: 'PRIVATE-NOTE', secret: 'PRIVATE-FIELD'
});
assert.equal(feedback.reason, safeComment('Signature missing'));
assert.ok(feedback.comments.includes('<strong>correct</strong>'));
assert.equal(feedback.decision, 'RETURN_TO_SUPERVISOR');
assert.ok(!JSON.stringify(feedback).includes('PRIVATE'));
assert.deepEqual(Object.keys(feedback).sort(), ['comments', 'conditions', 'decision', 'reason']);
assert.equal(sharedReviewFeedback('DMLRO', { confidentialNotes: 'PRIVATE-NOTE' }), null);
assert.equal(sharedReviewFeedback('SUPERVISOR', { amlClarificationFindings: 'Supervisor findings' }).comments, safeComment('Supervisor findings'));
assert.equal(sharedReviewFeedback('MLRO', { mlroReason: 'Return reason', mlroDecision: 'RETURN_TO_DMLRO' }).reason, safeComment('Return reason'));
assert.ok(!sharedReviewFeedback('DMLRO', { comments: '<p>Public</p><script>alert(1)</script>' }).comments.includes('<script>'));
console.log('Shared feedback legacy fields, rich text, return reasons and private-field isolation passed.');

async function checkCaseRead() {
  const { KycService } = require('../dist/kyc/kyc.service');
  const tenantId = 'synthetic-tenant';
  const caseId = 'synthetic-case';
  const prisma = {
    kycCase: { findFirst: async ({ where }) => {
      assert.equal(where.tenantId, tenantId);
      return { id: caseId, tenantId, kycNumber: 'KYC-TEST', createdAt: new Date(), comments: [] };
    } },
    internalReviewVersion: { findMany: async ({ where }) => {
      assert.deepEqual(where, { tenantId, kycCaseId: caseId, submittedAt: { not: null } });
      return [{ id: 'return-version', stage: 'DMLRO', snapshot: { comments: 'Please correct', reason: 'Missing signature', confidentialNotes: 'PRIVATE' }, submittedBy: 'reviewer', submittedAt: new Date() }];
    } },
    user: { findMany: async () => [{ id: 'reviewer', firstName: 'Test', lastName: 'Reviewer' }] },
    reviewerComment: { findMany: async ({ where }) => {
      assert.deepEqual(where, { tenantId, kycCaseId: caseId, type: 'FORMAL' });
      return [{ id: 'formal-comment', stage: 'MLRO', body: 'Shared comment', createdAt: new Date(), author: null }];
    } }
  };
  const service = new KycService(prisma, null);
  for (const role of ['AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF']) {
    const result = await service.findOne({ id: 'user', tenantId, roles: [role] }, caseId);
    assert.equal(result.reviewFeedback.length, 2);
    assert.ok(result.reviewFeedback.some((item) => item.reason.includes('Missing signature')));
    assert.ok(!JSON.stringify(result.reviewFeedback).includes('PRIVATE'));
  }
  console.log('Mocked case reads: shared feedback visible across reviewer roles; tenant, submitted-only and formal-only filters verified.');
}
checkCaseRead().catch((error) => { console.error(error); process.exitCode = 1; });
