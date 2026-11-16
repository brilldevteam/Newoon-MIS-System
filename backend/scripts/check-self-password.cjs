const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { SelfPasswordService } = require('../dist/auth/self-password.controller');

async function main() {
  const old = 'Synthetic-old-password-2026';
  const next = 'Synthetic-new-password-2026';
  let user = { id: 'self', tenantId: 'a', status: 'ACTIVE', passwordHash: await bcrypt.hash(old, 4), sessionVersion: 2, failedLoginCount: 0, lockedUntil: null, roles: [] };
  let writes = 0; let audit; let removedChallenges; let stale = false;
  const prisma = {
    user: { findUnique: async ({ where }) => { assert.equal(where.id, 'self'); return user; }, update: async () => user },
    $transaction: async (fn) => fn({
      user: { updateMany: async ({ where, data }) => {
        assert.equal(where.id, 'self'); assert.equal(where.passwordHash, user.passwordHash);
        if (stale) return { count: 0 };
        assert.ok(await bcrypt.compare(next, data.passwordHash)); assert.deepEqual(Object.keys(data), ['passwordHash']); writes++; return { count: 1 };
      } },
      loginChallenge: { deleteMany: async ({ where }) => { removedChallenges = where.userId; } },
      auditLog: { create: async ({ data }) => { audit = data; } }
    })
  };
  const service = new SelfPasswordService(prisma);
  service.changePassword = service.change.bind(service);
  const dto = { currentPassword: old, newPassword: next, confirmPassword: next };
  await assert.rejects(service.changePassword('self', { ...dto, confirmPassword: 'different' }), /do not match/);
  await assert.rejects(service.changePassword('self', { ...dto, newPassword: 'short', confirmPassword: 'short' }), /16 characters/);
  await assert.rejects(service.changePassword('self', { ...dto, newPassword: '\u00e9'.repeat(40), confirmPassword: '\u00e9'.repeat(40) }), /UTF-8/);
  await assert.rejects(service.changePassword('self', { ...dto, currentPassword: 'wrong' }), /Current password/);
  await assert.rejects(service.changePassword('self', { ...dto, newPassword: old, confirmPassword: old }), /different new password/);
  assert.equal(writes, 0);
  stale = true; await assert.rejects(service.changePassword('self', dto), /Account changed/); stale = false;
  await service.changePassword('self', dto);
  assert.equal(writes, 1); assert.equal(removedChallenges, undefined);
  assert.deepEqual(audit.metadata, { event: 'SELF_PASSWORD_CHANGED' });
  assert.ok(!JSON.stringify(audit).includes(next)); assert.equal(audit.actorId, 'self');
  user = { ...user, status: 'SUSPENDED' }; await assert.rejects(service.changePassword('self', dto), /Invalid session/);
  user = { ...user, status: 'ACTIVE' };
  for (let i = 0; i < 5; i++) await assert.rejects(service.changePassword('self', { ...dto, currentPassword: 'wrong' }), /Current password/);
  await assert.rejects(service.changePassword('self', dto), /Too many attempts/);
  console.log('Self-password checks passed: verification, policy, stale write protection, throttling and audit privacy (synthetic persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
