const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Workbook } = require('exceljs');
const { Prisma } = require('@prisma/client');
const { ComplianceClientsService } = require('../dist/compliance-clients/compliance-clients.service');
const { ComplianceDocumentsService, DEFAULT_DOCUMENT_SECTIONS } = require('../dist/compliance-clients/compliance-documents.service');
const os = require('node:os');
const { ComplianceMonitoringService, expiryState } = require('../dist/compliance-clients/compliance-monitoring.service');
const { ComplianceRemindersService } = require('../dist/compliance-clients/compliance-reminders.service');
const { ClientsService } = require('../dist/clients/clients.service');
const { KycService } = require('../dist/kyc/kyc.service');
const { AccessControlService, ACCESS_AREAS } = require('../dist/access-control/access-control.service');
const profile = require('../dist/compliance-clients/compliance-client-profile');
const { syncIdentityExpiryItems } = require('../dist/compliance-clients/identity-expiry-sync');
const mrz = require('../dist/common/mrz');
const { nextReviewDateFor, nextClientCode, nextEngagementNumber, legacyClientCode, onboardingRiskProfile } = require('../dist/common/client-compliance');

// Synthetic persistence only: never connects to the configured database.
// Run from the repository root after `npm run build`: node backend/scripts/check-compliance-clients.cjs
const root = path.resolve(__dirname, '..', '..');
const actor = { id: 'aml-user', email: 'synthetic@example.invalid', tenantId: 'tenant-a', roles: ['AML_TEAM'] };

function years(from, to) {
  return to.getFullYear() - from.getFullYear();
}

async function checkReviewCycle() {
  const from = new Date('2026-11-09T00:00:00Z');
  assert.equal(years(from, nextReviewDateFor('HIGH', from)), 1);
  assert.equal(years(from, nextReviewDateFor('MEDIUM', from)), 2);
  assert.equal(years(from, nextReviewDateFor('LOW', from)), 3);
  assert.equal(nextReviewDateFor(null, from), null, 'No risk level means no scheduled review');
}

async function checkRiskProfile() {
  const tx = (reclass, review, crrf) => ({
    riskReclassification: { findFirst: async () => reclass },
    kycInternalReview: { findFirst: async () => review },
    crrfRecord: { findFirst: async () => crrf }
  });
  assert.deepEqual(await onboardingRiskProfile(tx({ newRisk: 'HIGH' }, { riskClassification: 'LOW', dueDiligenceType: 'ENHANCED' }, { riskRating: 'LOW' }), 'case', 't'), { riskLevel: 'HIGH', cddType: 'ENHANCED' });
  assert.deepEqual(await onboardingRiskProfile(tx(null, { riskClassification: 'MEDIUM', dueDiligenceType: null }, { riskRating: 'LOW' }), 'case', 't'), { riskLevel: 'MEDIUM', cddType: null });
  assert.deepEqual(await onboardingRiskProfile(tx(null, null, { riskRating: 'LOW' }), 'case', 't'), { riskLevel: 'LOW', cddType: null });
  assert.deepEqual(await onboardingRiskProfile(tx(null, null, null), 'case', 't'), { riskLevel: null, cddType: null });
  const year2026 = new Date('2026-11-09T00:00:00Z');
  const latestCode = (clientCode) => ({ client: { findFirst: async ({ where }) => { assert.deepEqual(where.clientCode, { startsWith: 'CL-2026-' }); return clientCode ? { clientCode } : null; } } });
  assert.equal(await nextClientCode(latestCode(null), 't', year2026), 'CL-2026-0001', 'First client of the year');
  assert.equal(await nextClientCode(latestCode('CL-2026-0041'), 't', year2026), 'CL-2026-0042', 'Highest code + 1, so deleted clients never cause a repeat');
  assert.equal(await nextClientCode(latestCode('CL-2026-9999'), 't', year2026), 'CL-2026-10000');
  assert.equal(legacyClientCode(263), 'CL-LEG-0263', 'Legacy clients keep their old number in the new format');
  const latestEngagement = (engagementNumber) => ({ clientEngagement: { findFirst: async () => (engagementNumber ? { engagementNumber } : null) } });
  assert.equal(await nextEngagementNumber(latestEngagement('ENG-2026-0007'), 't', year2026), 'ENG-2026-0008');
}

function listPrisma(captured) {
  return {
    client: {
      count: async (args) => { captured.push(args.where); return 0; },
      findMany: async (args) => { captured.push(args.where); return []; },
      groupBy: async () => []
    },
    $queryRaw: async () => []
  };
}

async function checkListFilters() {
  const captured = [];
  const service = new ComplianceClientsService(listPrisma(captured));
  const result = await service.list(actor, { status: 'ALL', riskLevel: 'PENDING', cddType: 'NONE', review: 'OVERDUE', search: 'cl-2026' });
  assert.deepEqual(result.pagination, { page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const where = captured[0].AND;
  assert.deepEqual(where[0], { tenantId: 'tenant-a' }, 'List must be tenant scoped');
  assert.deepEqual(where[1], { status: { in: ['ACTIVE', 'INACTIVE', 'ON_HOLD'] }, NOT: { status: 'ON_HOLD', activatedAt: null, clientCode: null } }, 'Prospects, rejected clients and never-activated held engagements stay out of the register');
  assert.deepEqual(where[2], { riskLevel: null });
  assert.deepEqual(where[3], { cddType: null });
  assert.equal(where[4].status, 'ACTIVE');
  assert.ok(where[4].nextReviewDate.lt instanceof Date);
  assert.ok(where[5].OR.some((condition) => condition.clientCode?.contains === 'cl-2026' && condition.clientCode.mode === 'insensitive'), 'Search matches the client code text');

  await assert.rejects(service.list(actor, { status: 'PROSPECT' }), /Invalid status filter/);
  await assert.rejects(service.list(actor, { riskLevel: 'EXTREME' }), /Invalid risk level/);
  await assert.rejects(service.list(actor, { review: 'SOMETIME' }), /Invalid review filter/);
  await assert.rejects(service.list({ ...actor, tenantId: null }, {}), /not assigned to a tenant/);

  captured.length = 0;
  await service.list({ ...actor, roles: ['SUPER_ADMIN'], tenantId: null }, { pageSize: '500', page: '-3' });
  assert.deepEqual(captured[0].AND[0], {}, 'Super Admin spans tenants like the Clients register');
}

function updatePrisma(client) {
  const calls = { updates: [], audits: [] };
  const prisma = {
    client: {
      findFirst: async ({ where }) => {
        if (where.tenantId && where.tenantId !== client.tenantId) return null;
        if (where.status && !where.status.in.includes(client.status)) return null;
        if (where.id !== client.id) return null;
        return {
          ...client,
          contacts: [], engagements: [], kycCases: [], riskChanges: [], reviews: [], screenings: [], expiryItems: [], _count: { engagements: 0, kycCases: 0 }
        };
      },
      update: (args) => { calls.updates.push(args); Object.assign(client, args.data); return args; }
    },
    auditLog: { create: (args) => { calls.audits.push(args); return args; } },
    $transaction: async (operations) => operations
  };
  return { prisma, calls };
}

async function checkUpdates() {
  const base = { id: 'c1', tenantId: 'tenant-a', name: 'Synthetic Holding', status: 'ACTIVE', cddType: null, jurisdiction: null, email: null, phone: null, address: null, statusReason: null, clientCode: 'CL-2026-0007' };

  let { prisma, calls } = updatePrisma({ ...base });
  let service = new ComplianceClientsService(prisma);
  await assert.rejects(service.update(actor, 'c1', { status: 'INACTIVE' }), /reason/);
  assert.equal(calls.updates.length, 0);

  const updated = await service.update(actor, 'c1', { status: 'INACTIVE', statusReason: '  Engagement ended ', cddType: 'ENHANCED' });
  assert.equal(updated.status, 'INACTIVE');
  assert.equal(updated.statusReason, 'Engagement ended');
  assert.equal(updated.cddType, 'ENHANCED');
  assert.equal(calls.audits.length, 1, 'Every change is audited');
  assert.equal(calls.audits[0].data.entityType, 'ComplianceClient');
  assert.deepEqual(Object.keys(calls.audits[0].data.metadata.changes).sort(), ['cddType', 'status', 'statusReason']);

  await service.update(actor, 'c1', { status: 'ACTIVE' });
  assert.equal(calls.updates.at(-1).data.status, 'ACTIVE');
  assert.equal(calls.updates.at(-1).data.statusReason, null, 'Reactivation clears the inactive reason');

  const auditsBefore = calls.audits.length;
  await service.update(actor, 'c1', { cddType: 'ENHANCED' });
  assert.equal(calls.audits.length, auditsBefore, 'No-op updates write no audit entry');

  ({ prisma, calls } = updatePrisma({ ...base, status: 'ON_HOLD' }));
  service = new ComplianceClientsService(prisma);
  await assert.rejects(service.update(actor, 'c1', { status: 'ACTIVE' }), /Only inactive clients/);

  ({ prisma } = updatePrisma({ ...base, status: 'PROSPECT' }));
  await assert.rejects(new ComplianceClientsService(prisma).update(actor, 'c1', { cddType: 'REGULAR' }), /not found/, 'Prospects cannot be edited as compliance clients');

  ({ prisma } = updatePrisma({ ...base, tenantId: 'tenant-b' }));
  await assert.rejects(new ComplianceClientsService(prisma).update(actor, 'c1', { cddType: 'REGULAR' }), /not found/, 'Other tenants are invisible');
}

async function checkExport() {
  const row = {
    id: 'c1', clientCode: 'CL-2026-0012', name: 'Synthetic Trading W.L.L. — عربي', registrationNumber: '01234', jurisdiction: 'QFC', email: null, phone: null,
    address: null, country: 'Qatar', status: 'ACTIVE', statusReason: null, cddType: 'REGULAR', riskLevel: 'MEDIUM',
    lastReviewDate: new Date('2026-01-01'), nextReviewDate: new Date('2028-01-01'), activatedAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'),
    contacts: [{ name: 'Contact', email: 'contact@example.invalid', phone: null }],
    engagements: [{ engagementNumber: 'ENG-2026-0001', serviceName: 'Secretary & Compliance Service', status: 'IN_PROGRESS', startDate: null }],
    kycCases: [{ id: 'k1', kycNumber: 'KYC-2026-0001', status: 'CLIENT_ACTIVE' }],
    riskChanges: [{ id: 'r1', proposedRisk: 'HIGH' }],
    reviews: [],
    screenings: [{ result: 'ALERT', screenedAt: new Date('2026-10-01') }],
    expiryItems: [{ expiryDate: new Date(Date.now() + 10 * 86400000) }],
    _count: { engagements: 1, kycCases: 1 }
  };
  // The export also reads the client records (company, people, legal documents); this client has none, and its
  // records are created on the way (ensureRecords is replaced here; see check-client-export.cjs and the Phase 4 test).
  const prisma = {
    client: { findMany: async ({ where }) => (where.entityProfile ? [] : [row]) },
    clientEntityProfile: { findMany: async () => [] },
    clientPerson: { findMany: async () => [] },
    clientLegalDocument: { findMany: async () => [] }
  };
  const service = new ComplianceClientsService(prisma);
  const file = await service.exportExcel(actor, {});
  assert.match(file.fileName, /^compliance-clients-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.equal(file.truncated, false);
  const workbook = new Workbook();
  await workbook.xlsx.load(file.content);
  const sheet = workbook.getWorksheet('Compliance Clients');
  assert.equal(sheet.getRow(1).getCell(1).value, 'Client Code');
  assert.equal(sheet.getRow(2).getCell(1).value, 'CL-2026-0012');
  assert.equal(sheet.getRow(2).getCell(2).value, row.name, 'Unicode names survive the export');
  assert.equal(sheet.getRow(2).getCell(5).value, 'RDD');
  assert.equal(sheet.getRow(2).getCell(9).value, 'contact@example.invalid', 'Falls back to the primary contact email');
  assert.equal(sheet.rowCount, 2);
  assert.deepEqual(workbook.worksheets.map((item) => item.name), ['Compliance Clients', 'Company Details', 'People', 'Legal Documents'], 'The client details follow the register sheet');
  assert.equal(workbook.getWorksheet('Company Details').getRow(2).getCell(2).value, row.name, 'A client without records still has a company row');
}

async function checkClientsIntake() {
  const created = [];
  const where = [];
  const clients = new ClientsService({
    client: {
      create: async (args) => { created.push(args.data); return args.data; },
      findMany: async (args) => { where.push(args.where); return []; }
    }
  });
  await clients.create({ ...actor, roles: ['OPERATING_TEAM'] }, { name: 'Manual Prospect' });
  assert.equal(created[0].status, 'PROSPECT', 'Manually added clients start as prospects');
  await clients.findAll(actor);
  await clients.findAll(actor, 'all');
  await clients.findAll(actor, 'prospect');
  assert.deepEqual(where, [
    { tenantId: 'tenant-a', status: 'ACTIVE' },
    { tenantId: 'tenant-a' },
    { tenantId: 'tenant-a', status: 'PROSPECT' }
  ]);
  assert.throws(() => clients.findAll(actor, 'REJECTED'), /Invalid client status filter/);
}

async function checkActivation() {
  const state = {
    client: { id: 'c1', tenantId: 'tenant-a', clientCode: null, activatedAt: null, riskLevel: null, cddType: null, email: null, phone: null, currentKycCaseId: null },
    latestCode: 'CL-2026-0041',
    engagements: [],
    audits: [],
    failNextUpdate: true
  };
  const tx = {
    client: {
      findUniqueOrThrow: async () => ({ ...state.client }),
      findFirst: async ({ where }) => (where.clientCode.startsWith === `CL-${new Date().getFullYear()}-` ? { clientCode: state.latestCode.replace('2026', String(new Date().getFullYear())) } : null),
      update: async ({ data }) => {
        if (state.failNextUpdate) {
          state.failNextUpdate = false;
          state.latestCode = 'CL-2026-0042'; // another activation took the next code meanwhile
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'synthetic' });
        }
        Object.assign(state.client, data);
      }
    },
    clientEngagement: {
      findUnique: async () => null,
      findFirst: async () => (state.engagements.length ? { engagementNumber: state.engagements.at(-1).engagementNumber } : null),
      create: async ({ data }) => { state.engagements.push(data); }
    },
    riskReclassification: { findFirst: async () => null },
    kycInternalReview: { findFirst: async () => ({ riskClassification: 'HIGH', dueDiligenceType: 'ENHANCED' }) },
    crrfRecord: { findFirst: async () => ({ riskRating: 'LOW' }) },
    kycSectionData: { findFirst: async ({ where }) => (where.sectionKey === 'GENERAL_COMPANY' ? { data: { commercialRegistrationNo: ' CR-SYN-0042 ' } } : null) }
  };
  const fakeThis = {
    text: KycService.prototype.text,
    prisma: { $transaction: async (callback) => callback(tx) },
    audit: async (_tx, _user, tenantId, entityType, entityId, metadata) => { state.audits.push({ tenantId, entityType, entityId, metadata }); },
    syncClientRecords: async (_tx, _user, synced, previous) => { state.recordsSyncedFor = synced.id; state.recordsPrevious = previous; }
  };
  const kycCase = {
    id: 'k1', tenantId: 'tenant-a', clientId: 'c1', title: 'Synthetic KYC', kycNumber: 'KYC-2026-0007',
    service: { name: 'Secretary & Compliance Service' },
    client: { contacts: [{ email: 'primary@example.invalid', phone: '+97400000000', isPrimary: true }] }
  };
  await KycService.prototype.activateComplianceClient.call(fakeThis, actor, kycCase);
  assert.equal(state.client.status, 'ACTIVE');
  const year = new Date().getFullYear();
  assert.equal(state.client.clientCode, `CL-${year}-0043`, 'A code conflict retries with the next free client code');
  assert.equal(state.client.currentKycCaseId, 'k1', 'The activated KYC becomes the current KYC');
  assert.equal(state.recordsSyncedFor, 'k1', 'Activation fills the client records (people, roles, expiry dates)');
  assert.equal(state.recordsPrevious, null, 'A new client has no earlier KYC to fill the records from');
  assert.equal(state.client.riskLevel, 'HIGH');
  assert.equal(state.client.cddType, 'ENHANCED');
  assert.equal(state.client.email, 'primary@example.invalid');
  assert.equal(state.client.registrationNumber, 'CR-SYN-0042', 'The CR / QFC number is copied from the approved KYC');
  assert.equal(years(state.client.lastReviewDate, state.client.nextReviewDate), 1, 'High risk is reviewed yearly');
  assert.equal(state.engagements.length, 1);
  assert.equal(state.engagements[0].kycCaseId, 'k1');
  assert.equal(state.engagements[0].serviceName, 'Secretary & Compliance Service');
  assert.match(state.engagements[0].engagementNumber, /^ENG-\d{4}-0001$/);
  assert.equal(state.audits.length, 1);

  // A second activation keeps the existing client code and activation date.
  const firstActivated = state.client.activatedAt;
  tx.clientEngagement.findUnique = async () => ({ id: 'e1', startDate: new Date('2026-01-01') });
  tx.clientEngagement.update = async () => undefined;
  await KycService.prototype.activateComplianceClient.call(fakeThis, actor, kycCase);
  assert.equal(state.client.clientCode, `CL-${year}-0043`, 'Re-activation keeps the existing code');
  assert.equal(state.client.activatedAt, firstActivated);
  assert.equal(state.engagements.length, 1, 'Re-activation does not duplicate the engagement');

  // Non-conflict errors are not retried.
  let attempts = 0;
  await assert.rejects(KycService.prototype.activateComplianceClient.call({
    ...fakeThis,
    prisma: { $transaction: async () => { attempts += 1; throw new Error('Synthetic failure'); } }
  }, actor, kycCase), /Synthetic failure/);
  assert.equal(attempts, 1);
}

async function checkAccess() {
  assert.ok(ACCESS_AREAS.some((area) => area.key === 'compliance'));
  const access = new AccessControlService({});
  assert.equal(access.allowsByDefault(['AML_TEAM'], 'compliance', true), true);
  assert.equal(access.allowsByDefault(['SEF'], 'compliance', false), true);
  assert.equal(access.allowsByDefault(['SEF'], 'compliance', true), false);
  assert.equal(access.allowsByDefault(['OPERATING_TEAM'], 'compliance', true), false);
  // Accounting and HR open the register but see only their allocated clients (Phase 3); they never edit it.
  assert.equal(access.allowsByDefault(['ACCOUNTING_TEAM'], 'compliance', false), true);
  assert.equal(access.allowsByDefault(['HR_TEAM'], 'compliance', true), false);
  assert.equal(access.allowsByDefault(['CEO'], 'compliance', false), true);
  assert.equal(access.allowsByDefault(['CEO'], 'compliance', true), false, 'CEO is read-only');

  const guard = fs.readFileSync(path.join(root, 'backend/src/common/guards/roles.guard.ts'), 'utf8');
  assert.match(guard, /ComplianceClientsController: 'compliance'/);
  assert.match(guard, /COMPLIANCE_AREAS = new Set\([^)]*'compliance'/);

  // The migration's grants for already-configured matrices must equal the code defaults.
  const migration = fs.readFileSync(path.join(root, 'backend/prisma/migrations/20261109100000_compliance_client_register/migration.sql'), 'utf8');
  const phase3 = fs.readFileSync(path.join(root, 'backend/prisma/migrations/20261122130000_client_allocation_ceo_role/migration.sql'), 'utf8');
  assert.match(phase3, /'compliance\.view'/);
  assert.match(phase3, /VALUES \(gen_random_uuid\(\)::text, 'CEO'/);
  assert.match(phase3, /"name" IN \('ACCOUNTING_TEAM', 'HR_TEAM'\)/);
  const granted = [
    ...[...migration.matchAll(/\('([A-Z_]+)', 'compliance\.(view|edit)'\)/g)].map((match) => `${match[1]}:${match[2]}`),
    'CEO:view', 'ACCOUNTING_TEAM:view', 'HR_TEAM:view'
  ].sort();
  const roles = ['COMPANY_ADMIN', 'OPERATING_TEAM', 'AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF', 'CEO', 'ACCOUNTING_TEAM', 'HR_TEAM'];
  const expected = roles.flatMap((role) => [
    access.allowsByDefault([role], 'compliance', false) ? `${role}:view` : null,
    access.allowsByDefault([role], 'compliance', true) ? `${role}:edit` : null
  ]).filter(Boolean).sort();
  assert.deepEqual(granted, expected);
}

async function checkProfileMapping() {
  assert.equal(profile.profileFromForm(null), null);
  assert.deepEqual(profile.optionList(['Director', 'Other'], 'Treasurer'), ['Director', 'Treasurer']);
  assert.deepEqual(profile.optionList('Director, Secretary'), ['Director', 'Secretary']);
  assert.deepEqual(profile.officerRoles(['Director', 'Secretary'], false).sort(), ['DIRECTOR', 'SECRETARY']);
  assert.deepEqual(profile.officerRoles(['Senior Executive Function'], true).sort(), ['SEF', 'SIGNATORY']);
  assert.deepEqual(profile.officerRoles(['CEO'], false), ['MANAGER']);
  assert.deepEqual(profile.officerRoles([], false), ['OTHER']);

  const form = {
    version: 2, status: 'FINAL', updatedAt: new Date('2026-07-16'),
    sectionA: { legalName: 'Synthetic Holding W.L.L.', legalForm: 'Other', legalFormOther: 'Branch', commercialRegistrationNo: '01234', countryOfIncorporation: ['Qatar'], dateOfIncorporation: '2020-01-31T00:00:00.000Z' },
    sectionB: {
      shareholders: [
        { id: 'corp', fullName: 'Parent Holdings S.A.', shareholderType: 'Corporate Entity', isUbo: true, ownershipPercentage: '100' },
        { id: 'person', fullName: 'Direct Owner', shareholderType: 'Individual', isUbo: true, shareholderPercentage: 25, nationality: ['Qatar'] }
      ],
      ubos: [
        { id: 'u1', fullName: 'Indirect Owner — مالك', parentRowId: 'corp', uboInterestPercentage: '60', identityNumber: '00123' },
        { id: 'u2', fullName: 'Direct Owner', sourceShareholderId: 'person', uboInterestPercentage: 25 }
      ]
    },
    sectionC: { managers: [
      { id: 'm1', fullName: 'Board Member', position: 'Director, Secretary', isAuthorizedSignatory: true },
      { id: 'm2', fullName: 'Executive', position: ['SEF'] }
    ] },
    sectionE: {}
  };
  const mapped = profile.profileFromForm(form);
  assert.equal(mapped.company.legalForm, 'Branch', '"Other" shows the typed value');
  assert.equal(mapped.company.countryOfIncorporation, 'Qatar');
  assert.equal(mapped.company.dateOfIncorporation, '2020-01-31');
  assert.equal(mapped.shareholders.length, 2);
  assert.equal(mapped.shareholders[1].percentage, '25');
  const uboNames = mapped.ubos.map((ubo) => ubo.fullName);
  assert.ok(!uboNames.includes('Parent Holdings S.A.'), 'Corporate shareholders are not beneficial owners');
  assert.equal(uboNames.filter((name) => name === 'Direct Owner').length, 1, 'A UBO entered twice is shown once');
  const indirect = mapped.ubos.find((ubo) => ubo.id === 'u1');
  assert.equal(indirect.linkedCompany, 'Parent Holdings S.A.', 'Indirect owners show the company they hold through');
  assert.equal(indirect.percentage, '60');
  assert.equal(indirect.identityNumber, '00123', 'Identity numbers keep leading zeros');
  assert.deepEqual(mapped.officers[0].roles.sort(), ['DIRECTOR', 'SECRETARY', 'SIGNATORY']);
  assert.deepEqual(mapped.officers[1].roles, ['SEF']);
  assert.equal(mapped.keyContact.fullName, null, 'An empty key-contact section has no values but can be filled in');
  assert.equal(mapped.keyContact.ref.section, 'KEY_CONTACT');
}

// Older client-page edits (before the client records) overlay the approved KYC form without changing it.
async function checkProfileEdits() {
  const form = {
    version: 1, status: 'FINAL', updatedAt: new Date('2026-11-01'),
    sectionA: { legalName: 'Synthetic W.L.L.', legalForm: 'Other', legalFormOther: 'Branch' },
    sectionB: {
      shareholders: [
        { id: 's1', fullName: 'Old Owner', shareholderType: 'Individual', identityNumber: '28412345678', isUbo: true, shareholderPercentage: 100 },
        { id: 's2', fullName: 'Corp Ltd', shareholderType: 'Corporate Entity', identityNumber: 'CR-1' }
      ],
      ubos: []
    },
    sectionC: { managers: [{ id: 'new-id-after-resave', fullName: 'Board Member', position: 'Director', qidNumber: '111', qidExpiry: new Date('2027-01-10T00:00:00Z') }] },
    sectionE: { fullName: 'Contact', passportNumber: 'P1', passportExpiry: '2026-12-20' }
  };
  const frozen = JSON.stringify(form);
  const overrides = [
    { section: 'COMPANY', rowId: '', rowLabel: null, field: 'legalForm', value: 'LLC' },
    { section: 'SHAREHOLDER', rowId: 's1', rowLabel: 'Old Owner', field: 'fullName', value: 'New Owner' },
    { section: 'SHAREHOLDER', rowId: 's1', rowLabel: 'Old Owner', field: 'qidNumber', value: '28499999999' },
    { section: 'SHAREHOLDER', rowId: 's1', rowLabel: 'Old Owner', field: 'qidExpiry', value: '2027-01-05' },
    // Officer ids change when a form is saved again: the edit falls back to the name it was made on.
    { section: 'OFFICER', rowId: 'old-id', rowLabel: 'Board Member', field: 'passportNumber', value: 'X9' },
    { section: 'OFFICER', rowId: 'old-id', rowLabel: 'Board Member', field: 'passportExpiry', value: '2026-12-01' },
    { section: 'SHAREHOLDER', rowId: 's1', rowLabel: 'Old Owner', field: 'notAllowed', value: 'ignored' }
  ];
  const mapped = profile.profileFromForm(form, overrides);
  assert.equal(JSON.stringify(form), frozen, 'The KYC form itself is not changed');
  assert.equal(mapped.company.legalForm, 'LLC', '"Other" text is cleared when the legal form is edited');
  const owner = mapped.shareholders[0];
  assert.equal(owner.fullName, 'New Owner');
  assert.equal(owner.qidNumber, '28499999999');
  assert.equal(owner.identityNumber, 'QID: 28499999999', 'The printed identity is derived from the split values');
  assert.equal(owner.legacyIdentity, '28412345678', 'The earlier combined value is still shown');
  assert.equal(mapped.ubos[0].fullName, 'New Owner', 'A shareholder UBO shows the edited shareholder row');
  assert.deepEqual(mapped.ubos[0].ref, { section: 'SHAREHOLDER', rowId: 's1', rowLabel: 'New Owner' });
  assert.equal(mapped.shareholders[1].identityNumber, 'CR-1', 'Corporate shareholders keep the CR number');
  assert.equal(mapped.shareholders[1].legacyIdentity, null);
  const officer = mapped.officers[0];
  assert.equal(officer.passportNumber, 'X9');
  assert.equal(officer.qidExpiry, '2027-01-10', 'Stored manager dates are read as dates');
  assert.equal(officer.identityNumber, 'QID: 111 / Passport: X9');
  assert.equal(mapped.keyContact.passportExpiry, '2026-12-20');

  // QID / passport alerts start at 60 days; company documents keep the 90-day reminder.
  const day = 86400000;
  const sent = [];
  const reminderPrisma = {
    client: { findMany: async () => [] },
    clientRiskChange: { findMany: async () => [] },
    clientExpiryItem: {
      findMany: async () => [
        { id: 'q80', tenantId: 'tenant-a', clientId: 'c1', documentType: 'QID', holderName: 'A', expiryDate: new Date(Date.now() + 80 * day), client: { name: 'Synthetic', clientCode: null } },
        { id: 'p50', tenantId: 'tenant-a', clientId: 'c1', documentType: 'PASSPORT', holderName: 'B', expiryDate: new Date(Date.now() + 50 * day), client: { name: 'Synthetic', clientCode: null } },
        { id: 'cr80', tenantId: 'tenant-a', clientId: 'c1', documentType: 'CR', holderName: 'Synthetic', expiryDate: new Date(Date.now() + 80 * day), client: { name: 'Synthetic', clientCode: null } }
      ]
    },
    complianceReminder: { create: (args) => args },
    notification: { create: (args) => args },
    $transaction: async (ops) => { sent.push(ops[0].data.entityId); return ops; }
  };
  await new ComplianceRemindersService(reminderPrisma).sweep('tenant-a');
  assert.deepEqual(sent.sort(), ['cr80', 'p50'], 'No 90-day reminder for QID or passport');

}

// Final approval of a re-KYC makes it the current KYC without an engagement decision; onboarding is unchanged.
async function checkRekycCompletion() {
  const run = async (purpose) => {
    const state = { client: { id: 'c1', tenantId: 'tenant-a', name: 'Synthetic', riskLevel: 'LOW', cddType: 'SIMPLIFIED', currentKycCaseId: 'k-old' }, statuses: [], notices: [], audits: [] };
    const tx = {
      kycCase: { findUniqueOrThrow: async () => ({ purpose, clientId: 'c1', kycNumber: 'KYC-2026-0010' }) },
      client: { findUniqueOrThrow: async () => ({ ...state.client }), update: async ({ data }) => Object.assign(state.client, data) },
      riskReclassification: { findFirst: async () => null },
      kycInternalReview: { findFirst: async () => ({ riskClassification: 'HIGH', dueDiligenceType: 'ENHANCED' }) },
      crrfRecord: { findFirst: async () => ({ riskRating: 'HIGH' }) }
    };
    const fakeThis = {
      completeRekyc: KycService.prototype.completeRekyc,
      notifyReadyForClientConversion: async () => state.notices.push('convert'),
      recordStatus: async (_tx, from, _user, to) => state.statuses.push([from.status, to]),
      syncClientRecords: async (_tx, _user, _case, previous) => { state.synced = true; state.recordsFrom = previous; return { seeded: false, created: 0, updated: 2, archived: 0, documentsLinked: 0 }; },
      audit: async (_tx, _user, _tenant, _type, _id, metadata) => state.audits.push(metadata),
      createNotification: async (_tx, _case, type, title) => state.notices.push(`${type}:${title}`)
    };
    await KycService.prototype.afterKycFinal.call(fakeThis, tx, actor, { id: 'k-new', tenantId: 'tenant-a', title: 'Synthetic Re-KYC' });
    return state;
  };
  const rekyc = await run('REKYC');
  assert.equal(rekyc.client.currentKycCaseId, 'k-new');
  assert.equal(rekyc.client.riskLevel, 'HIGH', 'Risk and CDD come from the approved re-KYC');
  assert.equal(rekyc.client.cddType, 'ENHANCED');
  assert.equal(years(new Date(), rekyc.client.nextReviewDate), 1, 'The next review restarts from the re-KYC approval');
  assert.deepEqual(rekyc.statuses, [['KYC_FINAL_APPROVED', 'CLIENT_ACTIVE']]);
  assert.ok(!rekyc.notices.includes('convert'), 'A re-KYC is not sent to Operations for client conversion');
  assert.ok(rekyc.synced);
  assert.equal(rekyc.audits[0].action, 'CLIENT_REKYC_COMPLETED');
  assert.equal(rekyc.audits[0].previousKycCaseId, 'k-old');
  assert.equal(rekyc.recordsFrom, 'k-old', 'The client records are updated from the re-KYC (filled from the previous KYC first when missing)');
  assert.equal(rekyc.audits[0].records.updated, 2);

  const onboarding = await run('ONBOARDING');
  assert.deepEqual(onboarding.notices, ['convert']);
  assert.equal(onboarding.client.currentKycCaseId, 'k-old', 'Onboarding approval still waits for the engagement decision');
}

async function checkProfileAccess() {
  const client = {
    id: 'c1', tenantId: 'tenant-a', clientCode: 'CL-2026-0001', name: 'Synthetic', registrationNumber: null, jurisdiction: null, email: null, phone: null, address: null,
    country: null, industry: null, status: 'ACTIVE', statusReason: null, cddType: null, riskLevel: 'LOW', lastReviewDate: null, nextReviewDate: null, activatedAt: null, createdAt: new Date(),
    contacts: [], engagements: [], riskChanges: [], reviews: [], screenings: [], expiryItems: [],
    kycCases: [{ id: 'k-old', kycNumber: 'KYC-2026-0001', title: 'Old', status: 'CLIENT_REJECTED', createdAt: new Date(), updatedAt: new Date(), service: null, kycForm: { id: 'f-old' } },
      { id: 'k-active', kycNumber: 'KYC-2026-0002', title: 'Active', status: 'CLIENT_ACTIVE', createdAt: new Date(), updatedAt: new Date(), service: null, kycForm: { id: 'f-active' } }],
    _count: { engagements: 0, kycCases: 2 }
  };
  const seen = { where: null, snapshotCase: null };
  const prisma = {
    client: { findFirst: async ({ where }) => { seen.where = where; return where.tenantId === 'tenant-a' ? client : null; } },
    legalDocument: { findMany: async ({ where }) => { assert.equal(where.tenantId, 'tenant-a'); return []; } },
    riskReclassification: { findMany: async () => [] },
    crrfRecord: { findFirst: async () => ({ riskRating: 'HIGH', updatedAt: new Date(), internalComment: 'confidential', documents: [] }) },
    kycInternalReview: { findFirst: async () => null },
    clientProfileOverride: { findMany: async () => [] },
    clientDocument: { findMany: async ({ where }) => { assert.equal(where.tenantId, 'tenant-a'); return []; } },
    clientEntityProfile: { findUnique: async () => null },
    clientAllocation: { findMany: async () => [] },
    clientPerson: { findMany: async ({ where }) => { assert.equal(where.tenantId, 'tenant-a'); return []; } }
  };
  const kycService = { formSnapshot: async () => null };
  const accessFor = (crrfAllowed) => ({ allows: async () => crrfAllowed, allowsByDefault: () => false });
  const service = (access) => {
    const created = new ComplianceClientsService(prisma, kycService, access);
    created.ensureRecords = async (_user, _client, profileCase) => { seen.snapshotCase = profileCase?.id ?? null; };
    return created;
  };

  const allowed = await service(accessFor(true)).findOne(actor, 'c1');
  assert.equal(seen.snapshotCase, 'k-active', 'The activated KYC case seeds the client records');
  assert.deepEqual(seen.where.status, { in: ['ACTIVE', 'INACTIVE', 'ON_HOLD'] });
  assert.deepEqual(seen.where.NOT, { status: 'ON_HOLD', activatedAt: null, clientCode: null });
  assert.equal(allowed.crrf.riskRating, 'HIGH');
  assert.equal(allowed.crrf.internalComment, undefined, 'CRRF reviewer comments are never returned');
  assert.equal(allowed.client.tenantId, undefined);

  const restricted = await service(accessFor(false)).findOne({ ...actor, roles: ['OPERATING_TEAM'] }, 'c1');
  assert.equal(restricted.crrf, null, 'Roles without CRRF access do not receive CRRF data');
  assert.equal(restricted.crrfRestricted, true);

  await assert.rejects(new ComplianceClientsService(prisma, kycService, accessFor(true)).findOne({ ...actor, tenantId: 'tenant-b' }, 'c1'), /not found/);
}

async function checkDocuments() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'client-docs-check-'));
  const previousRoot = process.env.CLIENT_DOCUMENT_UPLOAD_DIR;
  process.env.CLIENT_DOCUMENT_UPLOAD_DIR = root;
  try {
    const state = { sections: [], documents: [], audits: [] };
    const clients = [{ id: 'c1', tenantId: 'tenant-a', status: 'ACTIVE' }, { id: 'c2', tenantId: 'tenant-b', status: 'ACTIVE' }, { id: 'c3', tenantId: 'tenant-a', status: 'PROSPECT' }];
    const matches = (row, where) => Object.entries(where).every(([key, value]) => {
      if (key === 'NOT') return !matches(row, value);
      if (value && typeof value === 'object' && 'in' in value) return value.in.includes(row[key]);
      if (value && typeof value === 'object' && 'equals' in value) return String(row[key]).toLowerCase() === value.equals.toLowerCase();
      if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
      return row[key] === value;
    });
    let nextId = 1;
    const prisma = {
      client: { findFirst: async ({ where }) => clients.find((row) => matches(row, where)) || null },
      clientDocumentSection: {
        createMany: async ({ data }) => {
          for (const row of data) {
            if (!state.sections.some((s) => s.tenantId === row.tenantId && s.key === row.key)) state.sections.push({ id: `s${nextId++}`, isActive: true, isSystem: false, createdAt: new Date(), ...row });
          }
        },
        findMany: async ({ where }) => state.sections.filter((row) => matches(row, where)),
        findFirst: async ({ where }) => state.sections.find((row) => matches(row, where)) || null,
        aggregate: async () => ({ _max: { sortOrder: Math.max(...state.sections.map((s) => s.sortOrder)) } }),
        create: async ({ data }) => { const row = { id: `s${nextId++}`, isActive: true, isSystem: false, createdAt: new Date(), ...data }; state.sections.push(row); return row; },
        update: async ({ where, data }) => Object.assign(state.sections.find((s) => s.id === where.id), data)
      },
      clientDocument: {
        findMany: async ({ where }) => state.documents.filter((row) => matches(row, where)),
        findFirst: async ({ where }) => {
          const row = state.documents.find((doc) => matches(doc, where));
          return row ? { ...row, section: state.sections.find((s) => s.id === row.sectionId) } : null;
        },
        create: async ({ data }) => { const row = { id: `d${nextId++}`, deletedAt: null, createdAt: new Date(), ...data }; state.documents.push(row); return row; },
        update: ({ where, data }) => { Object.assign(state.documents.find((d) => d.id === where.id), data); return {}; }
      },
      auditLog: { create: (args) => { state.audits.push(args.data); return args; } },
      $transaction: async (arg) => (typeof arg === 'function' ? arg(prisma) : arg)
    };
    const service = new ComplianceDocumentsService(prisma);
    const pdf = { originalname: 'evidence.pdf', mimetype: 'application/pdf', size: 30, buffer: Buffer.from('%PDF-1.4 synthetic content') };

    const listed = await service.listClientDocuments(actor, 'c1');
    assert.deepEqual(listed.sections.map((s) => s.key), DEFAULT_DOCUMENT_SECTIONS.map((s) => s.key), 'Default folders are created for the tenant');
    await service.listClientDocuments(actor, 'c1');
    assert.equal(state.sections.length, DEFAULT_DOCUMENT_SECTIONS.length, 'Default folders are not duplicated');
    await assert.rejects(service.listClientDocuments(actor, 'c2'), /not found/, 'Other tenants are invisible');
    await assert.rejects(service.listClientDocuments(actor, 'c3'), /not found/, 'Prospects have no compliance folders');

    const cdd = state.sections.find((s) => s.key === 'cdd');
    await assert.rejects(service.upload(actor, 'c1', { sectionId: cdd.id }, []), /at least one file/);
    await assert.rejects(service.upload(actor, 'c1', { sectionId: cdd.id }, [{ ...pdf, buffer: Buffer.from('not a pdf') }]), /does not match/);
    await assert.rejects(service.upload(actor, 'c1', {}, [pdf]), /Choose the folder/);
    const after = await service.upload(actor, 'c1', { sectionId: cdd.id, title: ' Passport copy ', notes: 'Checked' }, [pdf, { ...pdf, originalname: '../../escape.pdf' }]);
    const files = after.sections.find((s) => s.key === 'cdd').documents;
    assert.equal(files.length, 2);
    assert.ok(files.every((doc) => doc.title.startsWith('Passport copy — ')), 'A shared title is suffixed per file');
    assert.ok(state.documents.every((doc) => doc.storagePath.startsWith('tenant-a/c1/') && !doc.storagePath.includes('..')), 'Stored paths stay inside the client folder');
    assert.ok(state.documents.every((doc) => fs.existsSync(path.join(root, doc.storagePath))));
    assert.equal(state.audits.filter((a) => a.action === 'CREATE' && a.entityType === 'ClientDocument').length, 2);

    const file = await service.getFile(actor, 'c1', state.documents[0].id);
    assert.ok(file.content.toString().startsWith('%PDF'));
    state.documents[0].storagePath = '../../outside.pdf';
    await assert.rejects(service.getFile(actor, 'c1', state.documents[0].id), /missing from storage/, 'Paths outside the upload root are refused');
    await assert.rejects(service.getFile({ ...actor, tenantId: 'tenant-b' }, 'c1', state.documents[1].id), /not found/);

    await service.remove(actor, 'c1', state.documents[1].id, ' Wrong client ');
    assert.ok(state.documents[1].deletedAt instanceof Date, 'Removal is a soft delete');
    assert.equal(state.documents[1].deleteReason, 'Wrong client');
    assert.ok(fs.existsSync(path.join(root, state.documents[1].storagePath)), 'The file is kept as evidence');
    await assert.rejects(service.getFile(actor, 'c1', state.documents[1].id), /not found/, 'Removed files are no longer served');

    await assert.rejects(service.updateSection(actor, 'c1', cdd.id, { isActive: false }), /Default folders/);
    const custom = await service.createSection(actor, 'c1', { title: 'Board Resolutions' });
    assert.equal(custom.category, 'COMPLIANCE');
    await assert.rejects(service.createSection(actor, 'c1', { title: 'board resolutions' }), /already exists/);
    await service.updateSection(actor, 'c1', custom.id, { isActive: false });
    await assert.rejects(service.upload(actor, 'c1', { sectionId: custom.id }, [pdf]), /archived/);
    assert.ok(!(await service.listClientDocuments(actor, 'c1')).sections.some((s) => s.id === custom.id), 'An empty archived folder is hidden');
  } finally {
    if (previousRoot === undefined) delete process.env.CLIENT_DOCUMENT_UPLOAD_DIR;
    else process.env.CLIENT_DOCUMENT_UPLOAD_DIR = previousRoot;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// In-memory Prisma stand-in for the monitoring checks: equality, in, not, gte/lte/lt and OR filters.
function memoryPrisma(seed) {
  const tables = { ...seed };
  let nextId = 1;
  const matchValue = (value, condition) => {
    if (condition && typeof condition === 'object' && !(condition instanceof Date) && !Array.isArray(condition)) {
      if ('in' in condition) return condition.in.includes(value);
      if ('not' in condition) return value !== condition.not;
      if ('gte' in condition || 'lte' in condition || 'lt' in condition) {
        if (value == null) return false;
        const time = new Date(value).getTime();
        if ('gte' in condition && time < new Date(condition.gte).getTime()) return false;
        if ('lte' in condition && time > new Date(condition.lte).getTime()) return false;
        if ('lt' in condition && time >= new Date(condition.lt).getTime()) return false;
        return true;
      }
      if ('status' in condition) return true; // relation filters are not modelled
    }
    return value === condition;
  };
  const matches = (row, where = {}) => Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some((part) => matches(row, part));
    if (key === 'client') return true;
    return matchValue(row[key], condition);
  });
  const model = (name, unique = []) => {
    tables[name] = tables[name] || [];
    return {
      findFirst: async ({ where } = {}) => tables[name].find((row) => matches(row, where)) || null,
      findUnique: async ({ where }) => tables[name].find((row) => matches(row, where)) || null,
      findUniqueOrThrow: async ({ where }) => { const row = tables[name].find((r) => matches(r, where)); if (!row) throw new Error(`${name} missing`); return row; },
      findMany: async ({ where } = {}) => tables[name].filter((row) => matches(row, where)).map((row) => ({ client: tables.client?.find((c) => c.id === row.clientId), ...row })),
      create: async ({ data }) => {
        if (unique.length && tables[name].some((row) => unique.every((key) => row[key] === data[key]))) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'synthetic' });
        }
        const defaults = { clientRiskChange: { status: 'PENDING' }, clientReview: { status: 'IN_PROGRESS', startedAt: new Date() } }[name] || {};
        const row = { id: `${name}-${nextId++}`, createdAt: new Date(), ...defaults, ...data };
        tables[name].push(row);
        return row;
      },
      update: async ({ where, data }) => Object.assign(tables[name].find((row) => row.id === where.id), data),
      count: async ({ where } = {}) => tables[name].filter((row) => matches(row, where)).length
    };
  };
  const prisma = {
    tables,
    client: model('client'),
    clientRiskChange: model('clientRiskChange'),
    clientReview: model('clientReview'),
    clientScreening: model('clientScreening'),
    clientExpiryItem: model('clientExpiryItem'),
    notification: model('notification'),
    auditLog: model('auditLog'),
    complianceReminder: model('complianceReminder', ['tenantId', 'kind', 'entityId', 'milestone']),
    $queryRaw: async () => [],
    $transaction: async (arg) => {
      if (typeof arg === 'function') return arg(prisma);
      // Array form: emulate atomicity for the reminder claim + notification pair.
      const snapshot = JSON.stringify({ r: tables.complianceReminder.length, n: tables.notification.length });
      try { return await Promise.all(arg); } catch (error) {
        const counts = JSON.parse(snapshot);
        tables.complianceReminder.length = counts.r;
        tables.notification.length = counts.n;
        throw error;
      }
    }
  };
  return prisma;
}

async function checkMonitoring() {
  const lastReview = new Date('2026-01-15T00:00:00Z');
  const prisma = memoryPrisma({
    client: [
      { id: 'c1', tenantId: 'tenant-a', name: 'Synthetic Trading', clientCode: 'CL-2026-0001', status: 'ACTIVE', riskLevel: 'LOW', cddType: 'SIMPLIFIED', lastReviewDate: lastReview, nextReviewDate: new Date('2029-01-15T00:00:00Z') },
      { id: 'c2', tenantId: 'tenant-a', name: 'Dormant LLC', clientCode: 'CL-2026-0002', status: 'INACTIVE', riskLevel: 'LOW', cddType: null, lastReviewDate: null, nextReviewDate: null },
      { id: 'c3', tenantId: 'tenant-b', name: 'Other Tenant', clientCode: 'CL-2026-0001', status: 'ACTIVE', riskLevel: 'LOW', cddType: null }
    ]
  });
  const documents = { sectionByKey: async () => ({ id: 's-screening', key: 'screening' }), storeFiles: async () => undefined };
  const service = new ComplianceMonitoringService(prisma, documents);
  const aml = { id: 'aml-1', email: 'aml@example.invalid', tenantId: 'tenant-a', roles: ['AML_TEAM'] };
  const dmlro = { id: 'dmlro-1', email: 'dmlro@example.invalid', tenantId: 'tenant-a', roles: ['DMLRO'] };
  const dmlroRequester = { ...dmlro, id: 'aml-1' };

  // Risk change request and approval (four eyes)
  await assert.rejects(service.requestRiskChange(aml, 'c1', { proposedRisk: 'LOW', reasonCategory: 'OTHER', explanation: 'Same' }), /match the current values/);
  await service.requestRiskChange(aml, 'c1', { proposedRisk: 'HIGH', proposedCdd: 'ENHANCED', reasonCategory: 'ADVERSE_MEDIA', explanation: 'Negative news found' });
  const change = prisma.tables.clientRiskChange[0];
  assert.equal(change.status, 'PENDING');
  assert.equal(prisma.tables.client[0].riskLevel, 'LOW', 'Risk does not change before approval');
  assert.ok(prisma.tables.notification.some((n) => n.type === 'COMPLIANCE_RISK_CHANGE_REQUESTED' && n.clientId === 'c1'));
  await assert.rejects(service.requestRiskChange(aml, 'c1', { proposedRisk: 'MEDIUM', reasonCategory: 'OTHER', explanation: 'x' }), /already awaiting approval/);
  await assert.rejects(service.decideRiskChange(aml, 'c1', change.id, { decision: 'APPROVE' }), /Only the DMLRO or MLRO/);
  await assert.rejects(service.decideRiskChange(dmlroRequester, 'c1', change.id, { decision: 'APPROVE' }), /someone other than/);
  await assert.rejects(service.decideRiskChange(dmlro, 'c1', change.id, { decision: 'REJECT' }), /reason for rejecting/);
  await assert.rejects(service.decideRiskChange({ ...dmlro, tenantId: 'tenant-b' }, 'c1', change.id, { decision: 'APPROVE' }), /not found/);
  await service.decideRiskChange(dmlro, 'c1', change.id, { decision: 'APPROVE', note: 'Agreed' });
  assert.equal(change.status, 'APPROVED');
  assert.equal(prisma.tables.client[0].riskLevel, 'HIGH');
  assert.equal(prisma.tables.client[0].cddType, 'ENHANCED');
  assert.equal(prisma.tables.client[0].nextReviewDate.toISOString(), '2027-01-15T00:00:00.000Z', 'High risk: next review one year after the last review');
  await assert.rejects(service.decideRiskChange(dmlro, 'c1', change.id, { decision: 'APPROVE' }), /already been decided/);

  // Periodic review
  await assert.rejects(service.startReview(aml, 'c2'), /active clients only/);
  await service.startReview(aml, 'c1');
  await assert.rejects(service.startReview(aml, 'c1'), /already in progress/);
  const review = prisma.tables.clientReview[0];
  await assert.rejects(service.completeReview(aml, 'c1', review.id, { outcome: 'NO_CHANGE', findings: 'Fine' }), /Record a screening/);
  await assert.rejects(service.createScreening(aml, 'c1', { screenedAt: new Date(Date.now() + 5 * 86400000).toISOString(), result: 'CLEAR', summary: 'x' }, []), /future/);
  await service.createScreening(aml, 'c1', { screenedAt: new Date().toISOString(), result: 'ALERT', summary: 'Possible match on UN list', listsChecked: ['UN', 'UN', 'OFAC'], reviewId: review.id }, []);
  assert.deepEqual(prisma.tables.clientScreening[0].listsChecked, ['UN', 'OFAC'], 'Lists are de-duplicated');
  assert.ok(prisma.tables.notification.some((n) => n.type === 'COMPLIANCE_SCREENING_ALERT'), 'Alerts notify immediately');
  await assert.rejects(service.completeReview(aml, 'c1', review.id, { outcome: 'RISK_CHANGE_REQUESTED', findings: 'Escalate' }), /proposed risk/);
  await service.completeReview(aml, 'c1', review.id, { outcome: 'NO_CHANGE', findings: 'Match discounted after checks' });
  assert.equal(review.status, 'COMPLETED');
  const client = prisma.tables.client[0];
  assert.ok(Date.now() - client.lastReviewDate.getTime() < 60000, 'Completing a review sets the last review date');
  assert.equal(client.nextReviewDate.getFullYear() - client.lastReviewDate.getFullYear(), 1, 'Next review follows the high-risk cycle');
  await assert.rejects(service.completeReview(aml, 'c1', review.id, { outcome: 'NO_CHANGE', findings: 'again' }), /no longer in progress/);

  // Expiry tracking
  await assert.rejects(service.saveExpiryItem(aml, 'c1', { documentType: 'OTHER', holderName: 'Company', expiryDate: '2027-01-01' }), /Name the document type/);
  await service.saveExpiryItem(aml, 'c1', { documentType: 'QID', holderName: 'Director One', holderRole: 'Director', documentNumber: '00123', expiryDate: new Date(Date.now() + 20 * 86400000).toISOString() });
  const overview = await service.overview(aml, 'c1');
  assert.equal(overview.expiryItems[0].expiryState, 'DUE_30');
  assert.equal(overview.canDecideRisk, false);
  assert.equal(expiryState(new Date(Date.now() - 86400000)), 'EXPIRED');
  assert.equal(expiryState(new Date(Date.now() + 45 * 86400000)), 'DUE_60');
  assert.equal(expiryState(new Date(Date.now() + 80 * 86400000)), 'DUE_90');
  assert.equal(expiryState(new Date(Date.now() + 200 * 86400000)), 'VALID');

  // Reminder sweep: each milestone notifies once
  client.nextReviewDate = new Date(Date.now() - 2 * 86400000);
  const reminders = new ComplianceRemindersService(prisma);
  const before = prisma.tables.notification.length;
  const first = await reminders.sweep('tenant-a');
  assert.equal(first.created, 2, 'One overdue-review and one expiring-document reminder');
  assert.ok(prisma.tables.notification.slice(before).some((n) => n.type === 'COMPLIANCE_REVIEW_DUE' && n.title.startsWith('Review overdue')));
  assert.ok(prisma.tables.notification.slice(before).some((n) => n.type === 'COMPLIANCE_DOCUMENT_EXPIRING'));
  const second = await reminders.sweep('tenant-a');
  assert.equal(second.created, 0, 'Repeated sweeps do not repeat reminders');
}

// Machine-readable zone parsing (ICAO 9303 specimens): check digits, OCR look-alikes, ID-card number overflow.
async function checkMrz() {
  const join = (...lines) => lines.join('\n');
  const passport = mrz.parseMrz(join('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'));
  assert.equal(passport.format, 'TD3');
  assert.equal(passport.documentNumber, 'L898902C3');
  assert.equal(passport.documentNumberCheck, 'OK');
  assert.equal(passport.expiryDate, '2012-04-15');
  assert.equal(passport.expiryValid, true);
  const noisy = mrz.parseMrz(join('header', 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L8989O2C36UTO74O8122F12O4159ZE184226B<<<<<1O'));
  assert.equal(noisy.documentNumber, 'L898902C3', 'O read for 0 is corrected when the check digit then matches');
  assert.equal(noisy.documentNumberCheck, 'CORRECTED', 'A corrected number is flagged for checking');
  assert.equal(noisy.expiryDate, '2012-04-15');
  const card = mrz.parseMrz(join('I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'));
  assert.equal(card.format, 'TD1');
  assert.equal(card.documentNumber, 'D23145890');
  const qid = '28412345678';
  const line1 = ('IDQAT' + qid.slice(0, 9) + '<' + qid.slice(9) + mrz.checkDigit(qid)).padEnd(30, '<');
  const line2 = '840101' + mrz.checkDigit('840101') + 'M281101' + mrz.checkDigit('281101') + 'QAT<<<<<<<<<<<0';
  const overflow = mrz.parseMrz(join(line1, line2, 'AL<MANSOORI<<KHALID<<<<<<<<<<<'));
  assert.equal(overflow.documentNumber, qid, 'An 11-digit QID number continues in the optional data');
  assert.equal(overflow.documentNumberCheck, 'OK');
  assert.equal(overflow.expiryDate, '2028-11-01');
  assert.equal(overflow.expiryValid, true);
  const wrong = mrz.parseMrz(join('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204158ZE184226B<<<<<10'));
  assert.equal(wrong.expiryValid, false, 'A date that fails its check digit is not confirmed');
  assert.equal(mrz.parseMrz('no machine readable zone here'), null);
}

async function main() {
  await checkMonitoring();
  await checkDocuments();
  await checkProfileMapping();
  await checkMrz();
  await checkProfileEdits();
  await checkRekycCompletion();
  await checkProfileAccess();
  await checkReviewCycle();
  await checkRiskProfile();
  await checkListFilters();
  await checkUpdates();
  await checkExport();
  await checkClientsIntake();
  await checkActivation();
  await checkAccess();
  console.log('Compliance client checks passed: review cycle, risk/CDD precedence, filters and tenant scoping, audited status/CDD updates, xlsx export, profile mapping and CRRF access, older client-page edits overlaid on the KYC, 60/30-day ID alerts, records filled on activation and re-KYC (see check-client-records.cjs), client document folders, risk approval (four eyes), periodic reviews, screening alerts, expiry and one-time reminders, prospect intake, CL-YYYY-NNNN codes with retry, and access defaults (synthetic persistence).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
