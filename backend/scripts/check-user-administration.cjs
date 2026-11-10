const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { UsersService } = require('../dist/users/users.service');
const { AuthService } = require('../dist/auth/auth.service');
const { CreateUserDto } = require('../dist/users/dto/manage-user.dto');
const { resetAdminPassword } = require('./reset-admin-password.cjs');
const { createSuperAdmin } = require('./create-super-admin.cjs');

async function main() {
  const actor = { id: 'admin', tenantId: 'tenant-a', roles: ['COMPANY_ADMIN'] };
  const profile = { firstName: 'Sample', lastName: 'Reviewer', email: ' REVIEWER@EXAMPLE.INVALID ', roles: ['DMLRO'] };
  const password = 'Synthetic-password-only-2026';
  const events = []; let stored;
  let target = { id: 'target', tenantId: 'tenant-a', status: 'ACTIVE', roles: [{ role: { name: 'DMLRO' } }] };
  let remaining = 0;
  const tx = {
    $queryRaw: async () => [],
    tenant: { findFirst: async () => ({ id: 'tenant-a' }) },
    role: { findMany: async ({ where }) => where.name.in.map((name) => ({ id: name, name })) },
    user: {
      findFirst: async ({ where }) => where.tenantId && target.tenantId !== where.tenantId ? null : target,
      create: async ({ data, select }) => { assert.equal(select.passwordHash, undefined); stored = data; return { id: 'created', email: data.email, roles: [], tenantId: data.tenantId }; },
      update: async ({ data }) => { stored = data; return { ...target, ...data, passwordHash: undefined }; },
      count: async () => remaining,
      findUnique: async () => target
    },
    userRole: { deleteMany: async () => {} },
    auditLog: { create: async ({ data }) => { events.push(data); } }
  };
  const prisma = { ...tx, $transaction: async (callback) => callback(tx) };
  const service = new UsersService(prisma);
  assert.throws(() => service.findAll({ ...actor, roles: ['AML_SUPERVISOR'] }), /Only administrators/);
  assert.throws(() => service.findAll({ ...actor, tenantId: null }), /belong to a company/);
  const created = await service.create(actor, { ...profile, password });
  assert.equal(stored.email, 'reviewer@example.invalid');
  assert.equal(stored.tenantId, 'tenant-a');
  assert.ok(await bcrypt.compare(password, stored.passwordHash));
  assert.equal(created.passwordHash, undefined);
  await assert.rejects(service.create(actor, { ...profile, password, tenantId: 'tenant-b' }), /own company/);
  await assert.rejects(service.create(actor, { ...profile, password, roles: ['SUPER_ADMIN'] }), /Only a Super Admin/);
  await assert.rejects(service.create(actor, { ...profile, password: 'short' }), /at least 16/);
  await assert.rejects(service.create(actor, { ...profile, password: '界'.repeat(30) }), /UTF-8/);
  await assert.rejects(service.create(actor, { ...profile, password, roles: ['CUSTOM_ROLE'] }), /valid workflow/);
  target = { ...target, tenantId: 'tenant-b' };
  await assert.rejects(service.resetPassword(actor, 'target', { password }), /User not found/);
  target = { ...target, tenantId: 'tenant-a', roles: [{ role: { name: 'SUPER_ADMIN' } }] };
  await assert.rejects(service.resetPassword(actor, 'target', { password }), /platform administrators/);
  target = { ...target, roles: [{ role: { name: 'COMPANY_ADMIN' } }] };
  await assert.rejects(service.update(actor, 'target', { ...profile, status: 'SUSPENDED' }), /at least one active/);
  target = { ...target, id: 'admin' };
  await assert.rejects(service.update(actor, 'admin', { ...profile, status: 'SUSPENDED' }), /your own account/);
  target = { ...target, id: 'target', roles: [{ role: { name: 'DMLRO' } }] };
  await service.update(actor, 'target', { ...profile, status: 'SUSPENDED' });
  assert.equal(stored.status, 'SUSPENDED');
  await service.resetPassword(actor, 'target', { password });
  assert.ok(await bcrypt.compare(password, stored.passwordHash));
  await resetAdminPassword(prisma, profile.email, password).then(() => assert.fail('Non-admin recovery must fail'), (error) => assert.match(error.message, /No matching administrator/));
  assert.ok(!JSON.stringify(events).includes(password));
  assert.ok(!JSON.stringify(events).includes('passwordHash'));
  const dto = plainToInstance(CreateUserDto, { ...profile, password });
  assert.equal((await validate(dto)).length, 0);
  assert.equal(dto.email, 'reviewer@example.invalid');
  const invalid = plainToInstance(CreateUserDto, { ...profile, password, roles: ['SUPER_HACKER'] });
  assert.ok((await validate(invalid)).length);
  const loginUser = { id: 'u', email: 'reviewer@example.invalid', passwordHash: await bcrypt.hash(password, 4), status: 'ACTIVE', roles: [], tenantId: 'tenant-a', failedLoginCount: 0, lockedUntil: null, sessionVersion: 0 };
  const auth = new AuthService({
    user: {
      findUnique: async ({ where }) => { assert.equal(where.email, 'reviewer@example.invalid'); return loginUser; },
      update: async ({ data }) => ({ ...loginUser, failedLoginCount: data.failedLoginCount?.increment ? loginUser.failedLoginCount + 1 : 0 })
    },
    auditLog: { create: async () => ({}) }
  }, { signAsync: async () => 'synthetic-token' }, { effectivePermissions: async () => ({ permissions: [], configured: false }) }, { get: () => undefined }, { isConfigured: () => false });
  assert.equal((await auth.login({ email: profile.email, password })).accessToken, 'synthetic-token');
  await assert.rejects(auth.login({ email: profile.email, password: 'wrong-password' }), /Invalid email or password/);

  // First Super Admin bootstrap: only when none is active, never over an existing email, hash and audit only.
  let activeSupers = 0; let takenEmail = null; let bootstrapped; const bootstrapEvents = [];
  const bootstrapTx = {
    user: {
      count: async () => activeSupers,
      findUnique: async ({ where }) => (where.email === takenEmail ? { id: 'taken' } : null),
      create: async ({ data }) => { bootstrapped = data; return { id: 'super', email: data.email }; }
    },
    role: { upsert: async ({ where }) => ({ id: 'role-super', name: where.name }) },
    auditLog: { create: async ({ data }) => { bootstrapEvents.push(data); } }
  };
  const bootstrapDb = { $transaction: async (callback) => callback(bootstrapTx) };
  const superProfile = { email: ' Owner@Example.Invalid ', firstName: 'Platform', lastName: 'Owner', password };
  await assert.rejects(createSuperAdmin(bootstrapDb, { ...superProfile, password: 'too-short' }), /at least 16/);
  await createSuperAdmin(bootstrapDb, superProfile);
  assert.equal(bootstrapped.email, 'owner@example.invalid');
  assert.equal(bootstrapped.tenantId, null);
  assert.deepEqual(bootstrapped.roles, { create: { roleId: 'role-super' } });
  assert.ok(await bcrypt.compare(password, bootstrapped.passwordHash));
  assert.ok(!JSON.stringify(bootstrapEvents).includes(password) && !JSON.stringify(bootstrapEvents).includes('passwordHash'));
  assert.equal(bootstrapEvents[0].metadata.event, 'OPERATOR_SUPER_ADMIN_BOOTSTRAP');
  takenEmail = 'owner@example.invalid';
  await assert.rejects(createSuperAdmin(bootstrapDb, superProfile), /already belongs/);
  activeSupers = 1;
  await assert.rejects(createSuperAdmin(bootstrapDb, { ...superProfile, email: 'other@example.invalid' }), /already exists/);
  console.log('User administration checks passed: tenant/role boundaries, hashes, self/last-admin protection, DTOs, audit privacy, login validation and first Super Admin bootstrap (mocked persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
