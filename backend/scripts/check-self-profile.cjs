const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { SelfProfileService, UpdateSelfProfileDto } = require('../dist/auth/self-profile.controller');
async function main() {
  let stored; let audit;
  const prisma = {
    user: { findUniqueOrThrow: async ({ where, select }) => { assert.equal(where.id, 'self'); assert.equal(select.passwordHash, undefined); return { firstName: 'Sample', profile: stored }; } },
    $transaction: async (fn) => fn({
      user: { update: async ({ where, data }) => { assert.equal(where.id, 'self'); assert.deepEqual(Object.keys(data), ['firstName', 'lastName']); return { tenantId: 'a' }; } },
      userProfile: { upsert: async ({ where, create, update }) => { assert.equal(where.userId, 'self'); assert.equal(create.userId, 'self'); stored = update; } },
      auditLog: { create: async ({ data }) => { audit = data; } }
    })
  };
  const service = new SelfProfileService(prisma);
  const dto = { firstName: ' Sample ', lastName: ' Person ', bio: 'Plain text <script> is never rendered as HTML', avatarDataUrl: createCanvas(32, 32).toDataURL('image/png') };
  await service.update('self', { ...dto, userId: 'other', roles: ['SUPER_ADMIN'] });
  assert.equal(stored.bio, dto.bio); assert.match(stored.avatarDataUrl, /^data:image\/png;base64,/);
  assert.deepEqual(audit.metadata, { event: 'SELF_PROFILE_UPDATED' });
  await service.update('self', { ...dto, avatarDataUrl: null }); assert.equal(stored.avatarDataUrl, null);
  await assert.rejects(service.update('self', { ...dto, firstName: ' ' }), /required/);
  await assert.rejects(service.update('self', { ...dto, avatarDataUrl: 'https://example.invalid/picture' }), /PNG/);
  await assert.rejects(service.update('self', { ...dto, avatarDataUrl: 'data:image/png;base64,AAAA' }), /Invalid/);
  await assert.rejects(service.update('self', { ...dto, avatarDataUrl: createCanvas(1025, 1).toDataURL('image/png') }), /oversized/);
  assert.ok((await validate(plainToInstance(UpdateSelfProfileDto, { ...dto, bio: 'x'.repeat(501) }))).length);
  assert.ok((await validate(plainToInstance(UpdateSelfProfileDto, { ...dto, roles: ['SUPER_ADMIN'] }), { whitelist: true, forbidNonWhitelisted: true })).length);
  console.log('Profile checks passed: self-only writes, safe field selection, image normalization/rejection, removal, DTO limits and audit privacy (synthetic persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
