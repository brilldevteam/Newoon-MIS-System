const assert = require('node:assert/strict');
const { Reflector } = require('@nestjs/core');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');
const { EnquiriesController } = require('../dist/enquiries/enquiries.controller');
const { RolesGuard } = require('../dist/common/guards/roles.guard');
const { AccessControlService } = require('../dist/access-control/access-control.service');
const esbuild = require('esbuild');
const frontend = esbuild.buildSync({ entryPoints: ['frontend/src/utils/enquiry-edit-access.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const moduleFixture = { exports: {} }; new Function('module', 'exports', frontend.outputFiles[0].text)(moduleFixture, moduleFixture.exports);
const { canEditEnquiryRecord } = moduleFixture.exports;
async function main() {
  let grants = ['enquiries.view', 'enquiries.edit']; let configured = true;
  const access = new AccessControlService({
    permission: { findUnique: async () => ({ roles: configured ? [{}] : [] }) },
    rolePermission: { findFirst: async ({ where }) => grants.includes(where.permission.key) ? {} : null }
  });
  const guard = new RolesGuard(new Reflector(), access);
  const actor = { id: 'operator', tenantId: 'tenant-a', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: grants };
  const allowed = (roles) => guard.canActivate({ getHandler: () => EnquiriesController.prototype.update, getClass: () => EnquiriesController, switchToHttp: () => ({ getRequest: () => ({ user: { ...actor, roles }, method: 'PATCH' }) }) });
  const service = Object.create(EnquiriesService.prototype); let statuses = ['RETURNED_TO_BD'];
  service.prisma = { kycCase: { findMany: async ({ where }) => { assert.equal(where.tenantId, 'tenant-a'); assert.equal(where.sourceEnquiryId, 'enquiry'); return statuses.map((status) => ({ status })); } } };
  for (const role of ['OPERATING_TEAM', 'ACCOUNTING_TEAM', 'AML_SUPERVISOR']) {
    const user = { ...actor, roles: [role] };
    assert.equal(await allowed(user.roles), true, 'Saved Edit grant overrides default role list');
    for (const enquiryStatus of ['DRAFT', 'RETURNED_TO_BD', 'CONVERTED_TO_KYC', 'SUBMITTED_TO_AML_SUPERVISOR']) {
      for (const linked of ['RETURNED_TO_BD', 'DMLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS', 'SEF_DECISION_PENDING', 'CLIENT_ACTIVE']) {
        statuses = [linked];
        const expected = linked === 'RETURNED_TO_BD' && (role === 'AML_SUPERVISOR' || ['DRAFT', 'RETURNED_TO_BD'].includes(enquiryStatus));
        assert.equal(await service.canModifyEnquiry(user, enquiryStatus, 'enquiry'), expected);
        assert.equal(canEditEnquiryRecord(user, { status: enquiryStatus, generatedKycCases: [{ status: linked }] }), expected);
      }
    }
  }
  statuses = ['RETURNED_TO_BD', 'DMLRO_REVIEW_PENDING'];
  assert.equal(await service.canModifyEnquiry(actor, 'RETURNED_TO_BD', 'enquiry'), false, 'A different linked case still under review must stay locked');
  for (const permissions of [['enquiries.view'], []]) {
    grants = permissions;
    assert.equal(await allowed(actor.roles), false);
    assert.equal(canEditEnquiryRecord({ ...actor, permissions }, { status: 'RETURNED_TO_BD' }), false);
  }
  configured = false;
  assert.equal(await allowed(['OPERATING_TEAM']), true);
  assert.equal(await allowed(['ACCOUNTING_TEAM']), false);
  assert.equal(canEditEnquiryRecord({ ...actor, accessControlConfigured: false }, { status: 'RETURNED_TO_BD' }), true);
  console.log('Returned-enquiry checks passed: matrix Edit/View/None, role fallback, return/review locks, frontend/backend parity and tenant-scoped reads (synthetic persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
