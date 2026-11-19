// Synthetic regression check: resubmitting a KYC file to DMLRO (and a second return to BD) must not break the
// InternalReviewTask unique rule (kycCaseId, stage, status). No database, credentials or client records are used.
// Run from the repository root after `npm run build`.
const assert = require('node:assert/strict');
const { KycService } = require('../dist/kyc/kyc.service');

// In-memory review task table enforcing the same @@unique([kycCaseId, stage, status]) as the schema.
function taskTable(initial) {
  let tasks = initial.map((task, index) => ({ id: `t${index}`, ...task }));
  const matches = (task, where = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'tenantId') return true;
    if (value && typeof value === 'object' && Array.isArray(value.in)) return value.in.includes(task[key]);
    return task[key] === value;
  });
  const assertUnique = () => {
    const keys = tasks.map((task) => `${task.kycCaseId}|${task.stage}|${task.status}`);
    if (new Set(keys).size !== keys.length) {
      const error = new Error('Unique constraint failed on the fields: (`kycCaseId`,`stage`,`status`)'); error.code = 'P2002'; throw error;
    }
  };
  return {
    get rows() { return tasks; },
    findMany: async ({ where, select } = {}) => tasks.filter((task) => matches(task, where)).map((task) => (select ? Object.fromEntries(Object.keys(select).map((key) => [key, task[key]])) : task)),
    deleteMany: async ({ where }) => { const before = tasks.length; tasks = tasks.filter((task) => !matches(task, where)); return { count: before - tasks.length }; },
    updateMany: async ({ where, data }) => { const next = tasks.map((task) => (matches(task, where) ? { ...task, ...data } : task)); const old = tasks; tasks = next; try { assertUnique(); } catch (error) { tasks = old; throw error; } return { count: 1 }; },
    upsert: async ({ where, create, update }) => {
      const key = where.kycCaseId_stage_status;
      const found = tasks.find((task) => task.kycCaseId === key.kycCaseId && task.stage === key.stage && task.status === key.status);
      if (found) Object.assign(found, update); else tasks.push({ id: `t${tasks.length + 10}`, status: 'PENDING', ...create });
      assertUnique(); return found || tasks[tasks.length - 1];
    }
  };
}

function serviceWith(table, kycCase) {
  const service = Object.create(KycService.prototype);
  const noop = async () => ({ id: 'x' });
  const tx = {
    internalReviewTask: table,
    kycInternalReview: { findFirst: async () => null },
    kycCase: { update: noop, findUniqueOrThrow: async () => ({ ...kycCase }), findFirst: async () => ({ ...kycCase }) },
    kycCaseStatusHistory: { create: noop },
    enquiry: { findFirst: async () => ({ id: 'enquiry', tenantId: 'tenant-a', status: 'CONVERTED_TO_KYC' }), update: noop },
    enquiryStatusHistory: { create: noop },
    user: { findMany: async () => [] },
    notification: { createMany: noop }
  };
  service.prisma = { ...tx, legalDocument: { count: async () => 1 }, $transaction: async (fn) => fn(tx) };
  service.requireWritableCase = async () => ({ ...kycCase });
  service.findOne = async () => ({ ...kycCase });
  service.assertReviewPackageReady = async () => undefined;
  service.lockReviewSubmission = async () => ({ id: 'submission' });
  service.audit = async () => undefined;
  service.createNotification = async () => undefined;
  service.caseInclude = () => ({});
  return service;
}

async function main() {
  const user = { id: 'aml-user', tenantId: 'tenant-a', roles: ['AML_TEAM', 'AML_SUPERVISOR'] };
  const kycCase = { id: 'case', tenantId: 'tenant-a', status: 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED', title: 'Synthetic KYC', sourceEnquiryId: 'enquiry' };

  // State after: first submission (Supervisor COMPLETED), DMLRO returned the file (DMLRO RETURNED, new Supervisor PENDING).
  const table = taskTable([
    { kycCaseId: 'case', stage: 'SUPERVISOR', status: 'COMPLETED' },
    { kycCaseId: 'case', stage: 'DMLRO', status: 'RETURNED' },
    { kycCaseId: 'case', stage: 'SUPERVISOR', status: 'PENDING' }
  ]);
  await assert.doesNotReject(() => serviceWith(table, kycCase).submitToAml(user, 'case', { formalComments: '<p>Resubmitted after DMLRO feedback</p>' }), 'Resubmission to DMLRO must not hit the unique task rule');
  const summary = table.rows.map((task) => `${task.stage}:${task.status}`).sort();
  assert.deepEqual(summary, ['DMLRO:PENDING', 'DMLRO:RETURNED', 'SUPERVISOR:COMPLETED'], 'One completed Supervisor task, a new DMLRO task');

  // A second resubmission round (returned again, resubmitted again) also works.
  table.rows.find((task) => task.stage === 'DMLRO' && task.status === 'PENDING').status = 'IN_PROGRESS';
  await table.deleteMany({ where: { kycCaseId: 'case', stage: 'DMLRO', status: 'RETURNED' } });
  await table.updateMany({ where: { kycCaseId: 'case', stage: 'DMLRO', status: { in: ['IN_PROGRESS'] } }, data: { status: 'RETURNED' } });
  await table.upsert({ where: { kycCaseId_stage_status: { kycCaseId: 'case', stage: 'SUPERVISOR', status: 'PENDING' } }, create: { kycCaseId: 'case', stage: 'SUPERVISOR' }, update: {} });
  await assert.doesNotReject(() => serviceWith(table, kycCase).submitToAml(user, 'case', { formalComments: '<p>Second resubmission</p>' }));

  // A second return to BD must not collide with the first round's RETURNED Supervisor task.
  const returned = taskTable([
    { kycCaseId: 'case', stage: 'SUPERVISOR', status: 'RETURNED' },
    { kycCaseId: 'case', stage: 'SUPERVISOR', status: 'PENDING' }
  ]);
  await assert.doesNotReject(() => serviceWith(returned, { ...kycCase, status: 'SUPERVISOR_REVIEW_PENDING' }).returnToBusinessDevelopment(user, 'case', 'Synthetic second return'));
  assert.deepEqual(returned.rows.map((task) => `${task.stage}:${task.status}`), ['SUPERVISOR:RETURNED']);

  // Guard: the fake table really enforces the rule (so the checks above are meaningful).
  const guard = taskTable([{ kycCaseId: 'case', stage: 'SUPERVISOR', status: 'COMPLETED' }, { kycCaseId: 'case', stage: 'SUPERVISOR', status: 'PENDING' }]);
  await assert.rejects(() => guard.updateMany({ where: { kycCaseId: 'case', stage: 'SUPERVISOR', status: { in: ['PENDING'] } }, data: { status: 'COMPLETED' } }), /Unique constraint/);

  console.log('KYC resubmission task checks passed: resubmit to DMLRO after a DMLRO return (twice) and a second return to BD keep review tasks unique (synthetic persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
