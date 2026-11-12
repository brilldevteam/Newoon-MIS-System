// Client's KYC format and download fixes (2026-11):
// - section order A, B Managers, C Shareholders (UBO List, then Control Structure), D ... H
// - H. Internal Use Only starts on a new page
// - empty conditions / reasons / risk-reason rows are not printed; SEF only when the file went to SEF
// - blank Section H values fall back to what the workflow recorded; DMLRO "APPROVE" prints as "Send to MLRO"
// - MLRO may decide while the case waits for DMLRO; the DMLRO task is closed and the bypass is recorded
// Build first (npm run build), then: node backend/scripts/check-kyc-format.cjs
const assert = require('node:assert/strict');
const { buildKycDocumentModel } = require('../dist/kyc/export/kyc-document-model');
const { renderKycHtml } = require('../dist/kyc/export/kyc-html-renderer');
const { KycService } = require('../dist/kyc/kyc.service');

const base = { kycCaseId: 'c', sectionA: { legalName: 'Synthetic Co' }, sectionB: { shareholders: [{ id: 's1', fullName: 'Owner One', shareholderPercentage: '100', isUbo: true }] }, sectionC: { managers: [{ fullName: 'Manager One' }] }, sectionD: {}, sectionE: {}, sectionF: {}, sectionG: {} };
const sections = (model) => model.blocks.filter((block) => block.kind === 'section');
const labels = (block) => block.blocks.filter((item) => item.kind === 'table').flatMap((table) => table.rows.flatMap((row) => row.cells.flatMap((cell) => (cell.lines || []).map((line) => line.parts.map((part) => part.text || '').join('')))));
const group = (h, name) => {
  const index = h.blocks.findIndex((block) => block.kind === 'subheading' && block.text === name);
  return index < 0 ? null : { blocks: [h.blocks[index + 1]] };
};

async function main() {
  // Order and titles.
  let model = await buildKycDocumentModel({ ...base, sectionH: {} }, 1);
  assert.deepEqual(sections(model).map((s) => s.title.slice(0, 2)), ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.']);
  const titles = sections(model).map((s) => s.title);
  assert.equal(titles[1], 'B. Manager / Authorized Signatory / Directors / Secretary');
  assert.equal(titles[2], 'C. Shareholders');
  assert.ok(titles.indexOf('D. Compliance and Risk Information') === 3, 'D follows C for a full KYC');
  const c = sections(model)[2];
  const kinds = c.blocks.map((block) => block.kind === 'subheading' ? `sub:${block.text}` : block.kind);
  assert.ok(kinds.indexOf('sub:UBO List') > 0 && kinds.indexOf('diagram') > kinds.indexOf('sub:UBO List'), 'UBO List comes before the Control Structure chart');

  // H on a new page, in both renderers' input and the PDF HTML.
  const h = sections(model).find((s) => s.title.startsWith('H.'));
  assert.equal(h.newPage, true);
  assert.equal(sections(model).filter((s) => s.newPage).length, 1);
  assert.match(renderKycHtml(model), /<section class="new-page"><div class="bar">H\. Internal Use Only/);

  // Empty optional rows hidden; SEF hidden unless sent to SEF.
  let dmlro = labels(group(h, 'DMLRO'));
  assert.ok(!dmlro.some((text) => /^Conditions|^Reason/.test(text)), 'Empty DMLRO conditions/reason are not printed');
  const mlro = labels(group(h, 'MLRO'));
  assert.ok(!mlro.some((text) => /^Risk reason category|^Risk explanation|^Conditions/.test(text)), 'Empty MLRO optional rows are not printed');
  assert.equal(group(h, 'SEF'), null, 'SEF block absent when the file was not sent to SEF');

  // Filled optional rows and SEF are printed.
  model = await buildKycDocumentModel({ ...base, sectionH: { dmlroConditions: 'Annual review', mlroDecision: 'SEND_TO_SEF', mlroRiskExplanation: 'PEP' } }, 1);
  const h2 = sections(model).find((s) => s.title.startsWith('H.'));
  assert.ok(labels(group(h2, 'DMLRO')).some((text) => text.startsWith('Conditions: Annual review')));
  assert.ok(labels(group(h2, 'MLRO')).some((text) => text.startsWith('Risk explanation: PEP')));
  assert.ok(group(h2, 'SEF'), 'SEF printed when MLRO sent the file to SEF');

  // Fallbacks for blank Section H values, and DMLRO wording.
  model = await buildKycDocumentModel({ ...base, sectionH: {}, reviewFallbacks: { riskClassification: 'LOW', dueDiligenceType: 'SIMPLIFIED', amlDate: '2026-11-12T08:00:00.000Z', dmlroDecision: 'APPROVE', mlroDecision: 'APPROVE' } }, 1);
  const h3 = sections(model).find((s) => s.title.startsWith('H.'));
  const top = labels({ blocks: [h3.blocks[0]] });
  assert.ok(top.includes('Risk classification: Low') && top.includes('Due diligence type: Simplified'), JSON.stringify(top));
  assert.ok(labels(group(h3, 'AML Supervisor')).includes('Date: 2026-11-12'));
  assert.ok(labels(group(h3, 'DMLRO')).includes('Decision: Send to MLRO'));
  assert.ok(labels(group(h3, 'MLRO')).includes('Final decision: Approve'));
  // A value entered in the form wins over the fallback.
  model = await buildKycDocumentModel({ ...base, sectionH: { riskClassification: 'HIGH' }, reviewFallbacks: { riskClassification: 'LOW' } }, 1);
  assert.ok(labels({ blocks: [sections(model).find((s) => s.title.startsWith('H.')).blocks[0]] }).includes('Risk classification: High'));
  // MLRO decided for an absent DMLRO.
  model = await buildKycDocumentModel({ ...base, sectionH: {}, reviewFallbacks: { dmlroSkipped: true } }, 1);
  dmlro = labels(group(sections(model).find((s) => s.title.startsWith('H.')), 'DMLRO'));
  assert.deepEqual(dmlro, ['Status: Not reviewed - the MLRO decided while DMLRO was unavailable']);

  // MLRO decision while the case waits for DMLRO.
  const writes = { tasks: [], statuses: [], locked: null, audits: [] };
  let status = 'DMLRO_REVIEW_PENDING';
  const tx = {
    kycCase: { findFirst: async () => ({ status }), findUniqueOrThrow: async () => ({ id: 'c', status }) },
    internalReviewTask: { updateMany: async (args) => { writes.tasks.push(args); return { count: 1 }; } },
    auditLog: { create: async ({ data }) => { writes.audits.push(data); } },
    kycForm: { findUnique: async () => ({ status: 'FINAL_DRAFT' }) },
    notification: { create: async () => ({}) }
  };
  const service = Object.create(KycService.prototype);
  service.prisma = { $transaction: async (fn) => fn(tx), internalReviewSubmission: { findUnique: async () => null } };
  service.findOne = async () => ({ id: 'c', tenantId: 't', title: 'Synthetic Co KYC', status });
  service.assertReviewStageActive = async () => { throw new Error('MLRO task check must be skipped while DMLRO is pending'); };
  service.assertPreviousStageComplete = async () => { throw new Error('DMLRO-complete check must be skipped while DMLRO is pending'); };
  service.recordStatus = async (_tx, _case, _user, next) => { writes.statuses.push(next); status = next; };
  service.lockReviewSubmission = async (_tx, _user, _case, stage, dto) => { writes.locked = { stage, dto }; return { id: 'sub' }; };
  service.clearReviewTaskStatus = async () => {};
  service.upsertActivationChecklist = async () => {};
  service.createNotification = async () => {};
  const mlro2 = { id: 'm', roles: ['MLRO'] };
  await assert.rejects(service.decideMlroReview(mlro2, 'c', { decision: 'APPROVE' }), /DMLRO has not reviewed this case yet/);
  await assert.rejects(service.decideMlroReview(mlro2, 'c', { decision: 'RETURN_TO_DMLRO', reason: 'x' }), /already with DMLRO/);
  await service.decideMlroReview(mlro2, 'c', { decision: 'APPROVE', formalComments: '<p>DMLRO on leave; low risk, approved.</p>', data: { decision: 'APPROVE' } });
  assert.deepEqual(writes.statuses, ['MLRO_REVIEW_IN_PROGRESS', 'MLRO_APPROVED']);
  assert.equal(writes.tasks[0].where.stage, 'DMLRO');
  assert.equal(writes.tasks[0].data.status, 'CANCELLED', 'The open DMLRO task is closed');
  assert.equal(writes.locked.stage, 'MLRO');
  assert.equal(writes.locked.dto.data.bypassedDmlro, true);
  assert.equal(writes.audits.at(-1).metadata.decidedWithoutDmlro, true);
  // A DMLRO decision recorded at the same moment wins: the MLRO bypass is refused.
  status = 'DMLRO_REVIEW_PENDING';
  const raced = tx.kycCase.findFirst;
  tx.kycCase.findFirst = async () => ({ status: 'MLRO_REVIEW_PENDING' });
  await assert.rejects(service.decideMlroReview(mlro2, 'c', { decision: 'APPROVE', formalComments: '<p>ok</p>' }), /case changed/);
  tx.kycCase.findFirst = raced;

  console.log('KYC format checks passed: B Managers / C Shareholders with UBO List before the chart, H on a new page, empty review rows and unused SEF hidden, Section H fallbacks and DMLRO wording, MLRO decision for an absent DMLRO (mocked persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
