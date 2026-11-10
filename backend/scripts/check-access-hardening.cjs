// Synthetic checks for the access hardening fixes; no database or files are touched.
// Run from the repository root after `npm run build -w backend`: node backend/scripts/check-access-hardening.cjs
const assert = require('node:assert/strict');
const { Reflector } = require('@nestjs/core');
const { RolesGuard } = require('../dist/common/guards/roles.guard');
const { AccessControlService } = require('../dist/access-control/access-control.service');
const { KycController } = require('../dist/kyc/kyc.controller');
const { ClientsController } = require('../dist/clients/clients.controller');
const { TenantsController } = require('../dist/tenants/tenants.controller');
const { AuditLogsController } = require('../dist/audit-logs/audit-logs.controller');
const { EnquiriesController } = require('../dist/enquiries/enquiries.controller');
const { AuditLogsService } = require('../dist/audit-logs/audit-logs.service');
const { TenantsService } = require('../dist/tenants/tenants.service');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');
const { KycService } = require('../dist/kyc/kyc.service');
const { ClientsService } = require('../dist/clients/clients.service');

// Access control backed by a fake permission store: `grants` maps role -> permission keys once the matrix is saved.
function accessControl(configured, grants = {}) {
  return new AccessControlService({
    permission: { findUnique: async () => ({ roles: configured ? [{}] : [] }) },
    rolePermission: {
      findFirst: async ({ where }) => where.role.name.in.some((role) => (grants[role] || []).includes(where.permission.key)) ? {} : null
    }
  });
}

function guardAllows(service, controller, handler, method, roles) {
  const guard = new RolesGuard(new Reflector(), service);
  return guard.canActivate({
    getHandler: () => controller.prototype[handler],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ method, user: { id: 'u', tenantId: 't', roles } }) })
  });
}

const forbiddenUserFields = (select) => ['passwordHash', 'status'].filter((field) => select && field in select && select[field]).length === 0;

async function main() {
  // --- Fix 2: role matrix stays the authority ---
  const unconfigured = accessControl(false);
  // KYC endpoints without a role list follow the matrix defaults before the matrix is saved.
  assert.equal(await guardAllows(unconfigured, KycController, 'findOne', 'GET', ['HR_TEAM']), false, 'HR must not read KYC cases by default');
  assert.equal(await guardAllows(unconfigured, KycController, 'findOne', 'GET', ['AML_TEAM']), true);
  assert.equal(await guardAllows(unconfigured, KycController, 'findOne', 'GET', ['OPERATING_TEAM']), true);
  assert.equal(await guardAllows(unconfigured, EnquiriesController, 'viewAttachment', 'GET', ['ACCOUNTING_TEAM']), true, 'enquiry viewers keep attachment access');
  // Client reads are unchanged; the KYC corporate lookup follows KYC access.
  assert.equal(await guardAllows(unconfigured, ClientsController, 'findAll', 'GET', ['AML_SUPERVISOR']), true);
  assert.equal(await guardAllows(unconfigured, ClientsController, 'match', 'GET', ['AML_TEAM']), true);
  assert.equal(await guardAllows(unconfigured, ClientsController, 'match', 'GET', ['HR_TEAM']), false);
  // Endpoints with their own role list keep it while the matrix is unsaved.
  assert.equal(await guardAllows(unconfigured, KycController, 'remove', 'DELETE', ['OPERATING_TEAM']), false);
  assert.equal(await guardAllows(unconfigured, KycController, 'remove', 'DELETE', ['COMPANY_ADMIN']), true);

  // Once saved, whatever the administrator granted applies (including grants beyond the defaults).
  const configured = accessControl(true, { ACCOUNTING_TEAM: ['enquiries.view', 'enquiries.edit'], AML_TEAM: ['kyc.view', 'kyc.edit'] });
  assert.equal(await guardAllows(configured, EnquiriesController, 'update', 'PATCH', ['ACCOUNTING_TEAM']), true, 'admin-granted enquiry edit must work');
  assert.equal(await guardAllows(configured, ClientsController, 'match', 'GET', ['AML_TEAM']), true, 'KYC users keep the corporate lookup');
  assert.equal(await guardAllows(configured, KycController, 'findOne', 'GET', ['HR_TEAM']), false);

  // Platform administration stays Super Admin only, even for a Company Admin with Administration access.
  const adminGrants = accessControl(true, { COMPANY_ADMIN: ['administration.view', 'administration.edit'] });
  assert.equal(await guardAllows(adminGrants, TenantsController, 'findAll', 'GET', ['COMPANY_ADMIN']), false, 'tenants are platform-wide');
  assert.equal(await guardAllows(adminGrants, TenantsController, 'create', 'POST', ['COMPANY_ADMIN']), false);
  assert.equal(await guardAllows(adminGrants, TenantsController, 'findAll', 'GET', ['SUPER_ADMIN']), true);
  assert.equal(await guardAllows(adminGrants, AuditLogsController, 'findAll', 'GET', ['COMPANY_ADMIN']), true, 'audit logs follow the matrix');

  // --- Fix 1: no full user rows (password hashes) in responses; audit logs scoped per company ---
  let auditArgs;
  const audit = new AuditLogsService({ auditLog: { findMany: async (args) => { auditArgs = args; return []; } } });
  await audit.findAll({ id: 'a', tenantId: 'tenant-a', roles: ['COMPANY_ADMIN'] });
  assert.deepEqual(auditArgs.where, { tenantId: 'tenant-a' });
  assert.ok(forbiddenUserFields(auditArgs.include.actor.select) && auditArgs.include.actor.select.firstName);
  await audit.findAll({ id: 'a', tenantId: null, roles: ['SUPER_ADMIN'] });
  assert.deepEqual(auditArgs.where, {});

  let tenantArgs;
  await new TenantsService({ tenant: { findUniqueOrThrow: async (args) => { tenantArgs = args; return {}; } } }).findOne('tenant-a');
  assert.ok(forbiddenUserFields({ passwordHash: tenantArgs.include.users.select.passwordHash }) && tenantArgs.include.users.select.email);

  let enquiryArgs;
  const enquiries = new EnquiriesService({ enquiry: { findMany: async (args) => { enquiryArgs = args; return []; } } }, {});
  await enquiries.findAll({ id: 'u', tenantId: 'tenant-a', roles: ['ACCOUNTING_TEAM'] });
  assert.ok(enquiryArgs.include.comments.include.author.select.firstName);
  assert.equal(enquiryArgs.include.comments.include.author.select.passwordHash, undefined);
  assert.equal(enquiryArgs.include.statusHistory.include.changedBy.select.passwordHash, undefined);

  // --- Fix 3: deletes write an audit entry in the same transaction ---
  const actor = { id: 'actor-1', tenantId: 'tenant-a', roles: ['SUPER_ADMIN'] };
  function deletionStore(model) {
    const operations = [];
    return {
      operations,
      prisma: {
        auditLog: { create: (args) => ({ op: 'audit', args }) },
        [model]: { delete: (args) => ({ op: 'delete', args }) },
        $transaction: async (list) => { operations.push(...list); return list; }
      }
    };
  }

  const enquiryStore = deletionStore('enquiry');
  const enquiryService = new EnquiriesService(enquiryStore.prisma, {});
  enquiryService.findOne = async () => ({ id: 'enq-1', tenantId: 'tenant-a', enquiryCode: 'ENQ-2026-0001', companyName: 'Example LLC', status: 'DRAFT' });
  enquiryService.removeEnquiryAttachmentDirectory = () => {};
  await enquiryService.remove(actor, 'enq-1');
  assert.deepEqual(enquiryStore.operations.map((item) => item.op), ['audit', 'delete']);
  assert.equal(enquiryStore.operations[0].args.data.action, 'DELETE');
  assert.equal(enquiryStore.operations[0].args.data.actorId, 'actor-1');
  assert.equal(enquiryStore.operations[0].args.data.metadata.enquiryCode, 'ENQ-2026-0001');

  const kycStore = deletionStore('kycCase');
  const kycService = new KycService(kycStore.prisma, {});
  kycService.requireWritableCase = async () => ({ id: 'case-1', tenantId: 'tenant-a', kycNumber: 'KYC-2026-0001', title: 'Example', status: 'INQUIRY_RECEIVED' });
  await kycService.remove(actor, 'case-1');
  assert.deepEqual(kycStore.operations.map((item) => item.op), ['audit', 'delete']);
  assert.equal(kycStore.operations[0].args.data.entityType, 'KycCase');
  assert.equal(kycStore.operations[0].args.data.metadata.kycNumber, 'KYC-2026-0001');

  const clientStore = deletionStore('client');
  const clientService = new ClientsService(clientStore.prisma);
  clientService.findOne = async () => ({ id: 'client-1', tenantId: 'tenant-a', name: 'Example LLC', status: 'ACTIVE' });
  await clientService.remove(actor, 'client-1');
  assert.deepEqual(clientStore.operations.map((item) => item.op), ['audit', 'delete']);
  assert.equal(clientStore.operations[0].args.data.entityType, 'Client');

  // --- Fix 4: four-eyes rule, one person per review stage in the current approval round ---
  function reviewTx(submissions) {
    const writes = [];
    return {
      writes,
      tx: {
        internalReviewSubmission: {
          // Mirrors the Prisma filter used by lockReviewSubmission.
          findFirst: async ({ where }) => submissions.find((row) => row.kycCaseId === where.kycCaseId && row.stage !== where.stage.not
            && row.status === where.status && row.submittedById === where.submittedById) || null,
          upsert: async (args) => { writes.push(args.where.kycCaseId_stage.stage); return { id: 'saved' }; }
        },
        internalReviewVersion: { count: async () => 0, create: async () => ({}) },
        reviewerComment: { updateMany: async () => ({}) },
        kycForm: { findFirst: async () => null }
      }
    };
  }
  const reviewCase = { id: 'case-1', tenantId: 'tenant-a' };
  const reviewer = (id, roles) => ({ id, tenantId: 'tenant-a', roles });
  const lock = (tx, user, stage) => kycService.lockReviewSubmission(tx, user, reviewCase, stage, { formalComments: 'Reviewed.' });

  // The DMLRO who approved cannot also give the MLRO approval, even holding both roles.
  const sameReviewer = reviewTx([{ kycCaseId: 'case-1', stage: 'DMLRO', status: 'SUBMITTED', submittedById: 'ahmed' }]);
  await assert.rejects(lock(sameReviewer.tx, reviewer('ahmed', ['DMLRO', 'MLRO']), 'MLRO'), /already completed the DMLRO review/);
  assert.deepEqual(sameReviewer.writes, [], 'nothing is saved when the rule blocks a submission');
  // Company Admin may act at any stage, but not at two stages of the same case.
  const admin = reviewTx([{ kycCaseId: 'case-1', stage: 'SUPERVISOR', status: 'SUBMITTED', submittedById: 'sara' }]);
  await assert.rejects(lock(admin.tx, reviewer('sara', ['COMPANY_ADMIN']), 'DMLRO'), /already completed the AML Supervisor review/);
  // A different person completes the next stage normally.
  const different = reviewTx([{ kycCaseId: 'case-1', stage: 'DMLRO', status: 'SUBMITTED', submittedById: 'ahmed' }]);
  await lock(different.tx, reviewer('maryam', ['MLRO']), 'MLRO');
  assert.deepEqual(different.writes, ['MLRO']);
  // Re-submitting your own stage after a return is allowed.
  const resubmit = reviewTx([{ kycCaseId: 'case-1', stage: 'DMLRO', status: 'REOPENED', submittedById: 'ahmed' }]);
  await lock(resubmit.tx, reviewer('ahmed', ['DMLRO']), 'DMLRO');
  assert.deepEqual(resubmit.writes, ['DMLRO']);
  // Approvals from an earlier round (reopened after a return or amendment) do not count.
  const newRound = reviewTx([{ kycCaseId: 'case-1', stage: 'DMLRO', status: 'REOPENED', submittedById: 'ahmed' }]);
  await lock(newRound.tx, reviewer('ahmed', ['DMLRO', 'MLRO']), 'MLRO');
  assert.deepEqual(newRound.writes, ['MLRO']);

  console.log('Access hardening checks passed: role matrix authority and defaults, Super Admin platform pages, no password hashes in responses, company-scoped audit logs, audited deletes and one-person-per-stage approvals (synthetic data).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
