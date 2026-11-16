// Synthetic checks for sign-in lockout, email one-time codes and session revocation. No database, email or network.
// Run from the repository root after `npm run build -w backend`: node backend/scripts/check-login-protection.cjs
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const { AuthService, LOGIN_POLICY } = require('../dist/auth/auth.service');
const { JwtStrategy } = require('../dist/auth/jwt.strategy');
const { LoginRateLimiter } = require('../dist/auth/login-rate-limiter');
const { UsersService } = require('../dist/users/users.service');

const PASSWORD = 'Synthetic-password-only-2026';

// Minimal in-memory Prisma stand-in for the models AuthService touches.
function fakePrisma(user) {
  const challenges = new Map();
  const audits = [];
  const applyUser = (data) => {
    for (const [key, value] of Object.entries(data)) {
      user[key] = value && typeof value === 'object' && 'increment' in value ? user[key] + value.increment : value;
    }
    return { ...user };
  };
  const withUser = (challenge) => challenge && { ...challenge, user: { ...user } };
  return {
    user,
    audits,
    challenges,
    user_: user,
    prisma: {
      user: {
        findUnique: async ({ where }) => (where.email === user.email || where.id === user.id ? { ...user } : null),
        update: async ({ data }) => applyUser(data)
      },
      auditLog: { create: async ({ data }) => { audits.push(data); return data; } },
      loginChallenge: {
        create: async ({ data }) => {
          const row = { id: randomUUID(), attempts: 0, sendCount: 1, lastSentAt: new Date(), consumedAt: null, createdAt: new Date(), ...data };
          challenges.set(row.id, row);
          return { ...row };
        },
        update: async ({ where, data }) => {
          const row = challenges.get(where.id);
          for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : value;
          return { ...row };
        },
        updateMany: async ({ where, data }) => {
          const row = challenges.get(where.id);
          if (!row || (where.consumedAt === null && row.consumedAt)) return { count: 0 };
          Object.assign(row, data);
          return { count: 1 };
        },
        findUnique: async ({ where }) => withUser(challenges.get(where.id) && { ...challenges.get(where.id) }),
        delete: async ({ where }) => { challenges.delete(where.id); return {}; },
        deleteMany: async ({ where }) => {
          for (const [id, row] of challenges) if (row.userId === where.userId && !row.consumedAt) challenges.delete(id);
          return {};
        }
      }
    }
  };
}

async function setup({ otp = false, mailConfigured = true, mailFails = false, env = {} } = {}) {
  const user = {
    id: 'user-1', email: 'reviewer@example.invalid', firstName: 'Sample', lastName: 'Reviewer', tenantId: 'tenant-a',
    passwordHash: await bcrypt.hash(PASSWORD, 4), status: 'ACTIVE', roles: [{ role: { name: 'DMLRO' } }], tenant: null,
    failedLoginCount: 0, lockedUntil: null, sessionVersion: 3
  };
  const store = fakePrisma(user);
  const sent = [];
  const tokens = [];
  const settings = { JWT_SECRET: 'synthetic-secret', LOGIN_OTP_ENABLED: otp ? 'true' : 'false', ...env };
  const auth = new AuthService(
    store.prisma,
    { signAsync: async (payload) => { tokens.push(payload); return `token-${tokens.length}`; } },
    { effectivePermissions: async () => ({ permissions: [], configured: false }) },
    { get: (key) => settings[key] },
    {
      isConfigured: () => mailConfigured,
      sendLoginCode: async (to, name, code) => { if (mailFails) throw new Error('SMTP down'); sent.push({ to, code }); }
    }
  );
  return { auth, store, sent, tokens, user };
}

const login = (auth, password = PASSWORD) => auth.login({ email: 'reviewer@example.invalid', password }, '203.0.113.5');

async function main() {
  // Without email codes, a correct password signs in and the token carries the session version.
  {
    const { auth, tokens } = await setup();
    const result = await login(auth);
    assert.equal(result.accessToken, 'token-1');
    assert.equal(tokens[0].sv, 3);
    await assert.rejects(auth.login({ email: 'nobody@example.invalid', password: PASSWORD }), /Invalid email or password/);
  }

  // Lockout after repeated wrong passwords; even the right password is refused until it expires.
  {
    const { auth, store, user } = await setup();
    for (let attempt = 1; attempt <= LOGIN_POLICY.maxFailedAttempts; attempt++) {
      await assert.rejects(login(auth, 'wrong-password-123'), /Invalid email or password/);
    }
    assert.ok(user.lockedUntil > new Date(), 'account is locked');
    assert.equal(user.failedLoginCount, 0);
    assert.ok(store.audits.some((entry) => entry.metadata?.event === 'ACCOUNT_LOCKED'));
    await assert.rejects(login(auth), (error) => error.getStatus() === 429 && /Try again in 15 minutes/.test(error.message));
    user.lockedUntil = new Date(Date.now() - 1000);
    assert.equal((await login(auth)).accessToken, 'token-1', 'lock expires on its own');
    assert.equal(user.lockedUntil, null);
  }

  // Email code flow: password, then the emailed code; codes are stored hashed and single-use.
  {
    const { auth, store, sent, tokens } = await setup({ otp: true });
    const challenge = await login(auth);
    assert.equal(challenge.otpRequired, true);
    assert.equal(challenge.maskedEmail, 'r*******@example.invalid');
    assert.equal(sent.length, 1);
    assert.match(sent[0].code, /^\d{6}$/);
    const stored = store.challenges.get(challenge.challengeId);
    assert.notEqual(stored.codeHash, sent[0].code, 'only a hash is stored');
    assert.ok(!stored.codeHash.includes(sent[0].code));
    assert.equal(tokens.length, 0, 'no session before the code is verified');

    const wrong = sent[0].code === '000000' ? '111111' : '000000';
    await assert.rejects(auth.verifyLoginCode({ challengeId: challenge.challengeId, code: wrong }), /Incorrect code\. 4 attempts left/);
    const session = await auth.verifyLoginCode({ challengeId: challenge.challengeId, code: sent[0].code });
    assert.equal(session.accessToken, 'token-1');
    await assert.rejects(auth.verifyLoginCode({ challengeId: challenge.challengeId, code: sent[0].code }), /expired/, 'a code works once');
  }

  // Resend: cooldown, a fresh code replaces the old one, and the number of sends is capped.
  {
    const { auth, store, sent } = await setup({ otp: true });
    const challenge = await login(auth);
    await assert.rejects(auth.resendLoginCode({ challengeId: challenge.challengeId }), (error) => error.getStatus() === 429 && /Wait \d+ seconds/.test(error.message));
    store.challenges.get(challenge.challengeId).lastSentAt = new Date(Date.now() - 61000);
    await auth.resendLoginCode({ challengeId: challenge.challengeId });
    assert.equal(sent.length, 2);
    if (sent[0].code !== sent[1].code) {
      await assert.rejects(auth.verifyLoginCode({ challengeId: challenge.challengeId, code: sent[0].code }), /Incorrect code/);
    }
    assert.equal((await auth.verifyLoginCode({ challengeId: challenge.challengeId, code: sent[1].code })).accessToken, 'token-1');

    const second = await login(auth);
    store.challenges.get(second.challengeId).sendCount = LOGIN_POLICY.maxCodeSends;
    store.challenges.get(second.challengeId).lastSentAt = new Date(Date.now() - 61000);
    await assert.rejects(auth.resendLoginCode({ challengeId: second.challengeId }), /Too many codes requested/);
  }

  // Expired codes and too many wrong codes require signing in again.
  {
    const { auth, store, sent } = await setup({ otp: true });
    const challenge = await login(auth);
    store.challenges.get(challenge.challengeId).expiresAt = new Date(Date.now() - 1000);
    await assert.rejects(auth.verifyLoginCode({ challengeId: challenge.challengeId, code: sent[0].code }), /expired/);

    const again = await login(auth);
    store.challenges.get(again.challengeId).attempts = LOGIN_POLICY.maxCodeAttempts;
    await assert.rejects(auth.verifyLoginCode({ challengeId: again.challengeId, code: sent[1].code }), /Too many incorrect codes/);
  }

  // Email codes enabled but email not working: sign-in fails safely and leaves no pending code.
  {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { auth, store } = await setup({ otp: true, mailConfigured: false, env: { LOGIN_OTP_DEV_LOG: 'true' } });
    await assert.rejects(login(auth), (error) => error.getStatus() === 503);
    assert.equal(store.challenges.size, 0);
    process.env.NODE_ENV = previous;

    const failing = await setup({ otp: true, mailFails: true });
    await assert.rejects(login(failing.auth), /could not send the sign-in code/);
    assert.equal(failing.store.challenges.size, 0);
  }

  // Sessions end when the session version changes; tokens issued before this feature (no `sv`) stay valid at version 0.
  {
    const account = { id: 'user-1', email: 'a@example.invalid', tenantId: 't', status: 'ACTIVE', sessionVersion: 1, roles: [{ role: { name: 'DMLRO' } }] };
    const strategy = new JwtStrategy({ get: () => 'synthetic-secret' }, { user: { findUnique: async () => ({ ...account }) } });
    assert.equal((await strategy.validate({ sub: 'user-1', sv: 1 })).id, 'user-1');
    await assert.rejects(strategy.validate({ sub: 'user-1', sv: 0 }), /session has ended/);
    account.sessionVersion = 0;
    assert.equal((await strategy.validate({ sub: 'user-1' })).id, 'user-1');
  }

  // An administrator password reset ends the user's sessions and clears any lockout.
  {
    let updateData;
    const target = { id: 'target', tenantId: 'tenant-a', status: 'ACTIVE', roles: [{ role: { name: 'DMLRO' } }] };
    const tx = {
      user: { findFirst: async () => target, update: async ({ data }) => { updateData = data; return target; } },
      auditLog: { create: async () => ({}) }
    };
    const users = new UsersService({ ...tx, $transaction: async (callback) => callback(tx) });
    await users.resetPassword({ id: 'admin', tenantId: 'tenant-a', roles: ['COMPANY_ADMIN'] }, 'target', { password: PASSWORD });
    assert.deepEqual(updateData.sessionVersion, { increment: 1 });
    assert.equal(updateData.lockedUntil, null);
    assert.equal(updateData.failedLoginCount, 0);
  }

  // Per-network throttle only when TRUST_PROXY is configured.
  {
    const limiter = new LoginRateLimiter(3, 60000, true);
    assert.equal(limiter.hit('198.51.100.7', 0), 0);
    limiter.hit('198.51.100.7', 1); limiter.hit('198.51.100.7', 2);
    assert.ok(limiter.hit('198.51.100.7', 3) > 0, 'fourth attempt in the window waits');
    assert.equal(limiter.hit('198.51.100.8', 3), 0, 'other networks are unaffected');
    assert.equal(limiter.hit('198.51.100.7', 61000), 0, 'window expires');
    assert.equal(new LoginRateLimiter(1, 60000, false).hit('x'), 0);
  }

  console.log('Login protection checks passed: lockout and expiry, email code flow (hashed, single-use, resend limits, expiry), safe failure without email, session revocation and network throttle (synthetic data).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
