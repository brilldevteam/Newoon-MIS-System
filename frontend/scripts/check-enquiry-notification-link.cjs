const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { NotificationsService } = require('../../backend/dist/notifications/notifications.service');
const compiled = esbuild.buildSync({ entryPoints: ['frontend/src/utils/enquiry-notification-link.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const fixture = { exports: {} }; new Function('module', 'exports', compiled.outputFiles[0].text)(fixture, fixture.exports);
const { enquiryNotificationLink } = fixture.exports;
async function main() {
  const actor = { roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: ['enquiries.view', 'enquiries.edit'] };
  const notification = { type: 'ADDITIONAL_INFORMATION_REQUESTED', enquiry: { id: 'enquiry', status: 'RETURNED_TO_BD' }, kycCase: { id: 'case', status: 'RETURNED_TO_BD' } };
  assert.equal(enquiryNotificationLink(notification, actor), '/enquiries/enquiry/edit');
  assert.equal(enquiryNotificationLink({ ...notification, enquiry: { id: 'enquiry' } }, actor), '/enquiries/enquiry/edit', 'Older API payload can use current KYC status');
  assert.equal(enquiryNotificationLink({ ...notification, kycCase: null }, actor), '/enquiries/enquiry/edit');
  for (const user of [null, { ...actor, permissions: ['enquiries.view'] }, { ...actor, permissions: [] }, { ...actor, roles: ['MLRO'] }]) assert.equal(enquiryNotificationLink(notification, user), '/enquiries/enquiry');
  assert.equal(enquiryNotificationLink({ ...notification, enquiry: { id: 'enquiry', status: 'CONVERTED_TO_KYC' } }, actor), '/enquiries/enquiry');
  assert.equal(enquiryNotificationLink({ ...notification, kycCase: { status: 'DMLRO_REVIEW_PENDING' } }, actor), '/enquiries/enquiry');
  assert.equal(enquiryNotificationLink({ ...notification, type: 'AML_CASE_SUBMITTED' }, actor), '/enquiries/enquiry');
  assert.equal(enquiryNotificationLink({ ...notification, enquiry: null }, actor), null);
  assert.equal(enquiryNotificationLink(notification, { ...actor, accessControlConfigured: false }), '/enquiries/enquiry/edit');
  const service = new NotificationsService({ notification: { findMany: async ({ include }) => { assert.equal(include.enquiry.select.status, true); return []; } } });
  await service.findAll({ id: 'operator', tenantId: 'tenant', roles: ['OPERATING_TEAM'] });
  console.log('Returned notification routing passed: Operations Edit, View/None, stale review state, legacy payload, normal links and current status selection (synthetic fixtures).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
