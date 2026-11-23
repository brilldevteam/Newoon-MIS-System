const assert = require('node:assert/strict');
const access = require('../dist/compliance-clients/client-access');
const { ComplianceClientsService } = require('../dist/compliance-clients/compliance-clients.service');

// Client access groups and allocation (2026-11-22, Phase 3). Synthetic data only; no database.
// Run from the repository root after `npm run build`: node backend/scripts/check-client-access.cjs
const user = (roles, id = 'u1') => ({ id, email: `${id}@example.invalid`, tenantId: 'tenant-a', roles });

function checkLevels() {
  for (const role of ['AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'CEO', 'COMPANY_ADMIN', 'SUPER_ADMIN']) assert.equal(access.clientAccessLevel(user([role])), 'FULL', role);
  assert.equal(access.clientAccessLevel(user(['OPERATING_TEAM'])), 'OPERATIONS');
  for (const role of ['ACCOUNTING_TEAM', 'HR_TEAM']) assert.equal(access.clientAccessLevel(user([role])), 'ALLOCATED', role);
  assert.equal(access.clientAccessLevel(user(['ACCOUNTING_TEAM', 'AML_TEAM'])), 'FULL', 'The widest role wins');
  assert.equal(access.clientAccessLevel(user([])), 'ALLOCATED', 'A user with no known role gets the narrowest view');

  const people = ['overview', 'company', 'shareholders', 'officers', 'signatories', 'sef', 'secretary', 'documents', 'engagements'];
  assert.deepEqual(access.CLIENT_TABS.ALLOCATED, people, 'Accounting and HR: profile, people, legal documents, engagements');
  assert.deepEqual(access.CLIENT_TABS.OPERATIONS, [...people, 'compliance-docs', 'expiry']);
  for (const tab of ['ubos', 'kyc', 'crrf', 'screening', 'cdd']) {
    assert.ok(access.CLIENT_TABS.FULL.includes(tab), `Full access sees ${tab}`);
    assert.ok(!access.CLIENT_TABS.OPERATIONS.includes(tab), `Operations does not see ${tab}`);
    assert.ok(!access.CLIENT_TABS.ALLOCATED.includes(tab), `Allocated staff do not see ${tab}`);
  }
  assert.equal(access.clientAccess(user(['ACCOUNTING_TEAM'])).seesPassports, false);
  assert.equal(access.clientAccess(user(['OPERATING_TEAM'])).seesPassports, true);
  assert.equal(access.clientAccess(user(['CEO'])).canManageAllocation, false, 'CEO is read-only');
  for (const role of ['COMPANY_ADMIN', 'AML_SUPERVISOR', 'DMLRO', 'MLRO']) assert.equal(access.clientAccess(user([role])).canManageAllocation, true, role);
  for (const role of ['AML_TEAM', 'SEF', 'OPERATING_TEAM', 'ACCOUNTING_TEAM']) assert.equal(access.clientAccess(user([role])).canManageAllocation, false, role);
}

function checkScope() {
  assert.deepEqual(access.clientScopeWhere(user(['OPERATING_TEAM'])), {}, 'Operations sees every client');
  assert.deepEqual(access.clientScopeWhere(user(['CEO'])), {});
  assert.deepEqual(access.clientScopeWhere(user(['HR_TEAM'], 'hr-1')), { allocations: { some: { userId: 'hr-1' } } }, 'Allocated staff see only their clients');
  assert.throws(() => access.assertClientTab(user(['ACCOUNTING_TEAM']), 'expiry'), /does not have access/);
  assert.doesNotThrow(() => access.assertClientTab(user(['OPERATING_TEAM']), 'expiry'));
  assert.throws(() => access.assertClientTab(user(['OPERATING_TEAM']), 'cdd'), /does not have access/);
}

function sampleDetail(level) {
  const person = (name, roles, passports = [], edited = []) => ({ id: name, fullName: name, roles: roles.map((role) => ({ id: `${name}-${role}`, role })), passports, edited });
  return {
    access: { level, tabs: access.CLIENT_TABS[level] },
    kycCases: [{ id: 'k1' }], legalDocuments: [{ id: 'l1' }], riskHistory: [{ id: 'r1' }], crrf: { riskRating: 'HIGH' }, crrfRestricted: false,
    internalReview: { riskClassification: 'HIGH' }, profileCase: { id: 'k1' },
    identityDocuments: [{ identityType: 'QID' }, { identityType: 'PASSPORT' }],
    profile: {
      source: null, company: {},
      people: [
        person('Owner', ['SHAREHOLDER', 'UBO'], [{ id: 'p1', passportNumber: 'P1' }], ['passport:p1', 'title']),
        person('Hidden UBO', ['UBO']),
        person('Director', ['DIRECTOR'], [{ id: 'p2', passportNumber: 'P2' }])
      ]
    }
  };
}

function checkStripping() {
  const service = new ComplianceClientsService({});
  const full = service.detailForAccess(sampleDetail('FULL'));
  assert.equal(full.profile.people.length, 3);
  assert.equal(full.crrf.riskRating, 'HIGH');

  const ops = service.detailForAccess(sampleDetail('OPERATIONS'));
  assert.deepEqual(ops.profile.people.map((p) => p.fullName), ['Owner', 'Director'], 'Operations does not see people who are only UBOs');
  assert.deepEqual(ops.profile.people[0].roles.map((r) => r.role), ['SHAREHOLDER'], 'or the UBO role');
  assert.equal(ops.profile.people[0].passports.length, 1, 'Operations sees passports');
  assert.equal(ops.crrf, null);
  assert.equal(ops.crrfRestricted, true);
  assert.equal(ops.internalReview, null);
  assert.deepEqual(ops.riskHistory, []);
  assert.equal(ops.kycCases.length, 1, 'Operations keeps the KYC list used for re-KYC links');
  assert.equal(ops.legalDocuments.length, 1);

  const allocated = service.detailForAccess(sampleDetail('ALLOCATED'));
  assert.deepEqual(allocated.profile.people.map((p) => p.passports.length), [0, 0], 'Allocated staff never receive passports');
  assert.deepEqual(allocated.profile.people[0].edited, ['title'], 'or passport edit markers');
  assert.deepEqual(allocated.identityDocuments, [{ identityType: 'QID' }], 'or passport copies');
  assert.deepEqual(allocated.kycCases, []);
  assert.equal(allocated.profileCase, null);
  assert.deepEqual(allocated.legalDocuments, [], 'or KYC uploads');
}

function checkRegisterValues() {
  const service = new ComplianceClientsService({});
  const item = { latestScreening: { result: 'ALERT' }, pendingRiskChange: { id: 'x' }, reviewInProgress: true, riskLevel: 'HIGH', cddType: 'ENHANCED' };
  assert.equal(service.forAccess(user(['AML_TEAM']), item), item, 'Full access is unchanged');
  const ops = service.forAccess(user(['OPERATING_TEAM']), item);
  assert.equal(ops.latestScreening, null);
  assert.equal(ops.pendingRiskChange, null);
  assert.equal(ops.reviewInProgress, false);
  assert.equal(ops.riskLevel, 'HIGH', 'Operations keeps the risk level (it drives their review dates)');
  const allocated = service.forAccess(user(['HR_TEAM']), item);
  assert.equal(allocated.riskLevel, null);
  assert.equal(allocated.cddType, null);
  const dated = service.forAccess(user(['HR_TEAM']), { ...item, nearestExpiry: { state: 'EXPIRED' }, lastReviewDate: 'x', nextReviewDate: 'y', reviewState: 'OVERDUE' });
  assert.deepEqual([dated.nearestExpiry, dated.lastReviewDate, dated.nextReviewDate, dated.reviewState], [null, null, null, 'NOT_SCHEDULED'], 'Allocated staff do not see expiry or review dates');
}

async function checkAllocation() {
  const rows = [];
  const audits = [];
  const users = [{ id: 'acc-1', email: 'acc@example.invalid', tenantId: 'tenant-a', status: 'ACTIVE', roles: [{ role: { name: 'ACCOUNTING_TEAM' } }], firstName: 'A', lastName: 'B' }];
  const prisma = {
    client: { findFirst: async ({ where }) => (where.tenantId === 'tenant-a' ? { id: 'c1', tenantId: 'tenant-a', name: 'Synthetic', status: 'ACTIVE', currentKycCaseId: null, kycCases: [] } : null) },
    clientEntityProfile: { findUnique: async () => ({ id: 'e1' }) },
    user: {
      findFirst: async ({ where }) => users.find((item) => item.id === where.id && item.tenantId === where.tenantId && item.status === where.status) || null,
      findMany: async () => users
    },
    clientAllocation: {
      findUnique: async ({ where }) => rows.find((row) => row.clientId === where.clientId_userId.clientId && row.userId === where.clientId_userId.userId) || null,
      findMany: async () => rows.map((row) => ({ userId: row.userId })),
      findFirst: async ({ where }) => { const row = rows.find((item) => item.id === where.id && item.clientId === where.clientId); return row ? { ...row, user: { email: 'acc@example.invalid' } } : null; },
      create: async ({ data }) => { rows.push({ id: `a${rows.length + 1}`, ...data }); },
      delete: async ({ where }) => rows.splice(rows.findIndex((row) => row.id === where.id), 1)
    },
    auditLog: { create: async ({ data }) => audits.push(data) },
    $transaction: async (callback) => callback(prisma)
  };
  const service = new ComplianceClientsService(prisma);
  service.findOne = async () => 'refreshed';
  const manager = user(['AML_SUPERVISOR'], 'mgr');

  for (const roles of [['AML_TEAM'], ['OPERATING_TEAM'], ['ACCOUNTING_TEAM'], ['SEF'], ['CEO']]) {
    await assert.rejects(service.allocate(user(roles), 'c1', 'acc-1'), /Only Company Admin, AML Supervisor, DMLRO or MLRO/, roles.join());
    await assert.rejects(service.allocationCandidates(user(roles), 'c1'), /Only Company Admin/);
  }
  assert.deepEqual((await service.allocationCandidates(manager, 'c1')).map((item) => item.id), ['acc-1']);
  await assert.rejects(service.allocate(manager, 'c1', 'someone-else'), /active user of this company/);
  assert.equal(await service.allocate(manager, 'c1', 'acc-1'), 'refreshed');
  assert.equal(rows[0].createdById, 'mgr');
  assert.equal(audits.at(-1).metadata.action, 'CLIENT_STAFF_ALLOCATED');
  await assert.rejects(service.allocate(manager, 'c1', 'acc-1'), /already allocated/);
  assert.deepEqual(await service.allocationCandidates(manager, 'c1'), [], 'Allocated people are not offered again');
  await assert.rejects(service.removeAllocation(manager, 'c1', 'missing'), /no longer exists/);
  await service.removeAllocation(manager, 'c1', rows[0].id);
  assert.equal(rows.length, 0);
  assert.equal(audits.at(-1).metadata.action, 'CLIENT_STAFF_UNALLOCATED');
  await assert.rejects(service.allocate({ ...manager, tenantId: 'tenant-b' }, 'c1', 'acc-1'), /not found/, 'Another company cannot allocate');
  await assert.rejects(service.exportExpiry(user(['ACCOUNTING_TEAM']), 'c1', 'ALL'), /does not have access/, 'Allocated staff cannot export expiry lists');
}

async function main() {
  checkLevels();
  checkScope();
  checkStripping();
  checkRegisterValues();
  await checkAllocation();
  console.log('Client access checks passed: access levels and CEO, tabs per group, allocation scope, UBO / KYC / CRRF / risk / passport data left out for Operations and allocated staff, who may allocate, audited allocation, tenant isolation (synthetic persistence).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
