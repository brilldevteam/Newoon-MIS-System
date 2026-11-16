// Operator-only recovery. Run with Node --env-file=backend/.env; no seed/reset or application bootstrap.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const readline = require('node:readline');
const { Writable } = require('node:stream');

// Keep in sync with backend/src/common/security/password-policy.ts (this script runs without the app).
function passwordPolicyError(password) {
  const ok = typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password, 'utf8') <= 72 && /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/s.test(password);
  return ok ? null : 'Password must be at least 8 characters and include a capital letter, a number and a symbol (maximum 72 bytes).';
}

async function resetAdminPassword(prisma, email, password) {
  const policyError = passwordPolicyError(password);
  if (policyError) throw new Error(policyError);
  const normalized = email.trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { email: normalized }, include: { roles: { include: { role: true } } } });
  if (!target || !target.roles.some((row) => ['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(row.role.name))) throw new Error('No matching administrator account. Nothing changed.');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash, sessionVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null } });
    await tx.auditLog.create({ data: { tenantId: target.tenantId, actorId: target.id, action: 'UPDATE', entityType: 'User', entityId: target.id, metadata: { event: 'OPERATOR_ADMIN_PASSWORD_RECOVERY' } } });
  });
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Use an interactive terminal. Passwords are not accepted as command-line arguments.');
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  const ask = (label, hidden = false) => new Promise((resolve, reject) => {
    muted = hidden;
    if (hidden) process.stdout.write(label);
    const onClose = () => reject(new Error('Recovery cancelled.'));
    rl.once('close', onClose);
    rl.question(hidden ? '' : label, (answer) => {
      rl.removeListener('close', onClose); muted = false;
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
  rl.on('SIGINT', () => rl.close());
  const prisma = new PrismaClient();
  try {
    const email = await ask('Administrator email: ');
    const password = await ask('New password, 8+ characters with a capital letter, a number and a symbol (hidden): ', true);
    const confirmation = await ask('Confirm password (hidden): ', true);
    if (password !== confirmation) throw new Error('Passwords do not match. Nothing changed.');
    if (await ask('Type RESET to confirm: ') !== 'RESET') throw new Error('Recovery cancelled.');
    await resetAdminPassword(prisma, email, password);
    console.log('Administrator password updated. No other accounts, roles or records changed.');
    console.log('Existing signed-in sessions for this account have ended and any sign-in lockout was cleared.');
  } finally { muted = false; rl.close(); await prisma.$disconnect(); }
}

module.exports = { resetAdminPassword };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
