// Operator-only recovery. Run with Node --env-file=backend/.env; no seed/reset or application bootstrap.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const readline = require('node:readline');
const { Writable } = require('node:stream');

async function resetAdminPassword(prisma, email, password) {
  if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Use at least 16 characters and no more than 72 UTF-8 bytes.');
  const normalized = email.trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { email: normalized }, include: { roles: { include: { role: true } } } });
  if (!target || !target.roles.some((row) => ['COMPANY_ADMIN', 'SUPER_ADMIN'].includes(row.role.name))) throw new Error('No matching administrator account. Nothing changed.');
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash } });
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
    const password = await ask('New password (hidden): ', true);
    const confirmation = await ask('Confirm password (hidden): ', true);
    if (password !== confirmation) throw new Error('Passwords do not match. Nothing changed.');
    if (await ask('Type RESET to confirm: ') !== 'RESET') throw new Error('Recovery cancelled.');
    await resetAdminPassword(prisma, email, password);
    console.log('Administrator password updated. No other accounts, roles or records changed.');
    console.log('Existing signed-in sessions are not revoked by password reset; suspension is enforced on subsequent authenticated requests.');
  } finally { muted = false; rl.close(); await prisma.$disconnect(); }
}

module.exports = { resetAdminPassword };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
