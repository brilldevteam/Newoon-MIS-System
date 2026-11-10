// Operator-only bootstrap of the first Super Admin. Run with Node --env-file=backend/.env; no seed/reset or application bootstrap.
// Refuses when an active Super Admin already exists (add more from User Administration) or the email is taken (use reset-admin-password.cjs).
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const readline = require('node:readline');
const { Writable } = require('node:stream');

async function createSuperAdmin(prisma, { email, firstName, lastName, password }) {
  const normalized = email.trim().toLowerCase();
  const first = firstName.trim(); const last = lastName.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error('Enter a valid email address.');
  if (!first || !last || first.length > 100 || last.length > 100) throw new Error('First and last name are required (up to 100 characters).');
  if (password.length < 16 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Use at least 16 characters and no more than 72 UTF-8 bytes.');
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.count({ where: { status: 'ACTIVE', roles: { some: { role: { name: 'SUPER_ADMIN' } } } } });
    if (existing) throw new Error('An active Super Admin already exists. Add more from User Administration, or use reset-admin-password.cjs. Nothing changed.');
    if (await tx.user.findUnique({ where: { email: normalized }, select: { id: true } })) throw new Error('That email already belongs to an account. Nothing changed.');
    // Roles are reference data; created here only if the database was migrated without being seeded.
    const role = await tx.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN', description: 'SUPER ADMIN role' } });
    const user = await tx.user.create({
      data: { tenantId: null, email: normalized, passwordHash, firstName: first, lastName: last, status: 'ACTIVE', roles: { create: { roleId: role.id } } },
      select: { id: true, email: true }
    });
    await tx.auditLog.create({ data: { tenantId: null, actorId: user.id, action: 'CREATE', entityType: 'User', entityId: user.id, metadata: { event: 'OPERATOR_SUPER_ADMIN_BOOTSTRAP', roles: ['SUPER_ADMIN'] } } });
    return user;
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
    const onClose = () => reject(new Error('Cancelled. Nothing changed.'));
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
    const email = await ask('Super Admin email: ');
    const firstName = await ask('First name: ');
    const lastName = await ask('Last name: ');
    const password = await ask('Password, at least 16 characters (hidden): ', true);
    const confirmation = await ask('Confirm password (hidden): ', true);
    if (password !== confirmation) throw new Error('Passwords do not match. Nothing changed.');
    if (await ask('Type CREATE to confirm: ') !== 'CREATE') throw new Error('Cancelled. Nothing changed.');
    const user = await createSuperAdmin(prisma, { email, firstName, lastName, password });
    console.log(`Super Admin created for ${user.email}. Sign in, then add company admins and users from User Administration.`);
  } finally { muted = false; rl.close(); await prisma.$disconnect(); }
}

module.exports = { createSuperAdmin };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
