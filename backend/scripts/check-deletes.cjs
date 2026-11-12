// Delete rules (2026-11-12):
// - Users: admins may delete accounts with no recorded workflow work; never themselves, a platform admin, another
//   company's user, or the last active Company Admin. Accounts with work must be suspended instead.
// - Enquiries: Super Admin any; Operations / Company Admin only draft or returned enquiries without a KYC case.
// Build first (npm run build), then: node backend/scripts/check-deletes.cjs
const assert = require('node:assert/strict');
const { UsersService } = require('../dist/users/users.service');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');

const admin = { id: 'admin', tenantId: 't1', roles: ['COMPANY_ADMIN'] };

function usersHarness(target, work = 0, otherAdmins = 1) {
  const calls = { deleted: null, audit: null };
  const tx = {
    $queryRaw: async () => [],
    user: {
      findFirst: async ({ where }) => (where.tenantId && where.tenantId !== target.tenantId ? null : target),
      findUniqueOrThrow: async () => ({ _count: { createdEnquiries: work, comments: 0 } }),
      count: async () => otherAdmins,
      delete: async ({ where }) => { calls.deleted = where.id; }
    },
    auditLog: { create: async ({ data }) => { calls.audit = data; } }
  };
  const service = new UsersService({ ...tx, $transaction: async (fn) => fn(tx) });
  return { service, calls };
}

const person = (roles, extra = {}) => ({ id: 'u1', tenantId: 't1', email: 'p@example.invalid', firstName: 'Pat', lastName: 'Example', status: 'ACTIVE', roles: roles.map((name) => ({ role: { name } })), ...extra });

async function main() {
  // Users
  let h = usersHarness(person(['AML_TEAM']));
  assert.deepEqual(await h.service.remove(admin, 'u1'), { id: 'u1' });
  assert.equal(h.calls.deleted, 'u1');
  assert.equal(h.calls.audit.action, 'DELETE');
  assert.equal(h.calls.audit.metadata.email, 'p@example.invalid');

  h = usersHarness(person(['DMLRO']), 3);
  await assert.rejects(h.service.remove(admin, 'u1'), /has work recorded .* Suspended instead/);
  assert.equal(h.calls.deleted, null);

  await assert.rejects(usersHarness(person(['AML_TEAM'], { id: 'admin' })).service.remove(admin, 'admin'), /your own account/);
  await assert.rejects(usersHarness(person(['SUPER_ADMIN'])).service.remove({ ...admin, roles: ['SUPER_ADMIN'] }, 'u1'), /Platform administrator removal is protected/);
  await assert.rejects(usersHarness(person(['SUPER_ADMIN'])).service.remove(admin, 'u1'), /cannot manage platform administrators/);
  await assert.rejects(usersHarness(person(['AML_TEAM'], { tenantId: 't2' })).service.remove(admin, 'u1'), /User not found/);
  await assert.rejects(usersHarness(person(['COMPANY_ADMIN']), 0, 0).service.remove(admin, 'u1'), /at least one active Company Admin/);
  await assert.rejects(usersHarness(person(['AML_TEAM'])).service.remove({ ...admin, roles: ['OPERATING_TEAM'] }, 'u1'), /Only administrators/);

  // Enquiries
  const enquiry = (status, kycCases = 0) => {
    let deleted = false;
    const prisma = {
      kycCase: { count: async () => kycCases },
      auditLog: { create: () => ({ op: 'audit' }) },
      enquiry: { delete: () => { deleted = true; return { op: 'delete' }; } },
      $transaction: async (ops) => ops
    };
    const service = new EnquiriesService(prisma, {});
    service.findOne = async () => ({ id: 'e1', tenantId: 't1', enquiryCode: 'ENQ-2026-0001', companyName: 'Co', status });
    service.removeEnquiryAttachmentDirectory = () => {};
    return { service, deleted: () => deleted };
  };
  const ops = { id: 'o', tenantId: 't1', roles: ['OPERATING_TEAM'] };
  for (const status of ['DRAFT', 'RETURNED_TO_BD']) {
    const e = enquiry(status);
    assert.deepEqual(await e.service.remove(ops, 'e1'), { id: 'e1' });
    assert.ok(e.deleted(), `${status} enquiry deleted by Operations`);
  }
  for (const status of ['SUBMITTED_TO_AML_SUPERVISOR', 'READY_FOR_KYC', 'CONVERTED_TO_KYC']) {
    await assert.rejects(enquiry(status).service.remove(ops, 'e1'), /already been sent to AML/);
  }
  await assert.rejects(enquiry('RETURNED_TO_BD', 1).service.remove(ops, 'e1'), /has a KYC case/);
  await assert.rejects(enquiry('DRAFT').service.remove({ ...ops, roles: ['AML_TEAM'] }, 'e1'), /Only Operations or an administrator/);
  const superDelete = enquiry('CONVERTED_TO_KYC', 1);
  await superDelete.service.remove({ id: 's', tenantId: null, roles: ['SUPER_ADMIN'] }, 'e1');
  assert.ok(superDelete.deleted(), 'Super Admin can still delete any enquiry');

  console.log('Delete checks passed: user delete (no-work accounts only, self/platform/other-company/last-admin protection, audited) and enquiry delete (Operations drafts/returned without KYC; Super Admin any) (mocked persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
