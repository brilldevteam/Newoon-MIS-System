const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const parser = require('../dist/compliance-clients/document-text-parser');
const { normalizeAiResult, DocumentReaderService } = require('../dist/compliance-clients/document-reader.service');
const secretBox = require('../dist/ai-settings/secret-box');
const { AiSettingsService } = require('../dist/ai-settings/ai-settings.service');
const records = require('../dist/compliance-clients/client-records');
const { ClientLegalDocumentsService } = require('../dist/compliance-clients/client-legal-documents.service');
const { LegalDocumentsAccessGuard } = require('../dist/compliance-clients/client-legal-documents.controller');
const { ComplianceDocumentsService } = require('../dist/compliance-clients/compliance-documents.service');
const { ComplianceClientsService } = require('../dist/compliance-clients/compliance-clients.service');

// Legal documents register, document reading and AI settings (2026-11-22, Phase 2).
// Synthetic persistence only: never connects to the configured database and never calls OpenAI (fetch is replaced).
// Run from the repository root after `npm run build`: node backend/scripts/check-legal-documents.cjs
const actor = { id: 'ops-user', email: 'ops@example.invalid', tenantId: 'tenant-a', roles: ['OPERATING_TEAM'] };

function checkParser() {
  assert.equal(parser.parseDate('31/12/2026'), '2026-12-31', 'Day first');
  assert.equal(parser.parseDate('2026-12-31'), '2026-12-31');
  assert.equal(parser.parseDate('31 December 2026'), '2026-12-31');
  assert.equal(parser.parseDate('Dec 31, 2026'), '2026-12-31');
  assert.equal(parser.parseDate('31/02/2026'), null, 'Not a real date');
  assert.equal(parser.parseDate('13/13/2026'), null);

  const cr = parser.parseDocumentText('CR_EXTRACT_EN', [
    'State of Qatar - Ministry of Commerce and Industry',
    'Commercial Registration No: 04669',
    'Trade Name: Arabic Game Partners LLC',
    'Legal Form: Limited Liability Company',
    'Registration Date: 14/03/2019',
    'Expiry Date: 31/12/2026',
    'Capital: QAR 200,000',
    'Address: Zone 63, Street 920, Doha',
    'Activities: Video games trading; Software consultancy'
  ].join('\n'));
  assert.equal(cr.document.documentNumber, '04669', 'Leading zeros are kept');
  assert.equal(cr.document.expiryDate, '2026-12-31');
  assert.equal(cr.document.holderName, 'Arabic Game Partners LLC');
  assert.equal(cr.company.crExpiryDate, '2026-12-31');
  assert.equal(cr.company.dateOfIncorporation, '2019-03-14');
  assert.equal(cr.company.legalForm, 'Limited Liability Company');
  assert.equal(cr.company.shareCapital, 'QAR 200,000');
  assert.equal(cr.company.countryOfIncorporation, 'Qatar');
  assert.match(cr.company.licenseActivities, /Video games/);

  const qfc = parser.parseDocumentText('COMMERCIAL_LICENSE', 'Qatar Financial Centre\nQFC Number: 04669\nCompany Name: Arabic Game Partners LLC\nValid until: 31 December 2026');
  assert.equal(qfc.document.documentNumber, 'QFC Number 04669', 'QFC licences show "QFC Number"');
  assert.equal(qfc.document.expiryDate, '2026-12-31');
  assert.equal(parser.parseDocumentText('CR_EXTRACT_EN', 'Commercial Registration No: CR-DEMO-90210').document.documentNumber, 'CR-DEMO-90210', 'Numbers may start with letters');
  assert.equal(parser.parseDocumentText('CR_EXTRACT_EN', 'Commercial Registration No: pending').document.documentNumber, null, 'A word without digits is not a number');
  const card = parser.parseDocumentText('COMPUTER_CARD', 'Establishment ID: 17-3101-95\nExpiry Date: 16/03/2027');
  assert.equal(card.document.documentNumber, '17-3101-95');
  assert.equal(card.document.expiryDate, '2027-03-16');
  const tax = parser.parseDocumentText('TAX_CARD', 'Tax Identification Number: T04669\nExpiry: 04/02/2028');
  assert.equal(tax.document.documentNumber, 'T04669');
  assert.equal(tax.company.taxIdentificationNo, 'T04669');
  const empty = parser.parseDocumentText('CR_EXTRACT_EN', '');
  assert.deepEqual(empty.company, {}, 'Nothing is invented from an empty text');
  assert.equal(empty.document.documentNumber, null);
}

function checkAiResult() {
  const result = normalizeAiResult({
    document: { documentNumber: ' 04669 ', holderName: 'Arabic Game Partners LLC', location: 'Qatar', issueDate: 'not a date', expiryDate: '2026-12-31' },
    company: { legalName: 'Arabic Game Partners LLC', commercialRegistrationNo: '04669', crExpiryDate: '31/12/2026', dateOfIncorporation: 'yesterday', shareCapital: null },
    people: [
      { fullName: 'Samer Saleh', nationality: 'Jordan', roles: ['SHAREHOLDER', 'DIRECTOR', 'EMPEROR'], sharePercentage: '60%', idNumber: null },
      { fullName: ' ', nationality: null, roles: [], sharePercentage: null, idNumber: null },
      { fullName: 'Too Much', nationality: null, roles: ['SHAREHOLDER'], sharePercentage: '160', idNumber: null }
    ]
  });
  assert.equal(result.document.documentNumber, '04669');
  assert.equal(result.document.issueDate, null, 'Dates that are not real dates are dropped');
  assert.equal(result.company.crExpiryDate, '2026-12-31');
  assert.equal(result.company.dateOfIncorporation, undefined);
  assert.equal(result.company.shareCapital, undefined);
  assert.equal(result.people.length, 2, 'People without a name are dropped');
  assert.deepEqual(result.people[0].roles, ['SHAREHOLDER', 'DIRECTOR'], 'Unknown roles are dropped');
  assert.equal(result.people[0].sharePercentage, '60');
  assert.equal(result.people[1].sharePercentage, null, 'Percentages above 100 are dropped');
}

async function checkSecretsAndSettings() {
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert.equal(secretBox.canEncryptSecrets(), false);
  assert.throws(() => secretBox.encryptSecret('x'), /SETTINGS_ENCRYPTION_KEY/);
  process.env.SETTINGS_ENCRYPTION_KEY = 'synthetic-settings-key-for-checks-only-0123456789';
  const stored = secretBox.encryptSecret('sk-synthetic-not-a-real-key-000000');
  assert.ok(!stored.includes('sk-synthetic'), 'The key is not stored in clear');
  assert.equal(secretBox.decryptSecret(stored), 'sk-synthetic-not-a-real-key-000000');
  process.env.SETTINGS_ENCRYPTION_KEY = 'a-different-key-for-checks-only-0123456789';
  assert.equal(secretBox.decryptSecret(stored), null, 'Another server key cannot read it');
  process.env.SETTINGS_ENCRYPTION_KEY = 'synthetic-settings-key-for-checks-only-0123456789';

  const rows = [];
  const audits = [];
  const prisma = {
    tenantAiSetting: {
      findUnique: async ({ where }) => rows.find((row) => row.tenantId === where.tenantId) || null,
      create: async ({ data }) => { const row = { id: 's1', updatedAt: new Date(), ...data }; rows.push(row); return row; },
      update: async ({ where, data }) => Object.assign(rows.find((row) => row.id === where.id), data, { updatedAt: new Date() }),
      delete: async ({ where }) => rows.splice(rows.findIndex((row) => row.id === where.id), 1)
    },
    auditLog: { create: async ({ data }) => audits.push(data) },
    $transaction: async (callback) => callback(prisma)
  };
  const service = new AiSettingsService(prisma);
  const admin = { id: 'admin', tenantId: 'tenant-a', roles: ['COMPANY_ADMIN'] };
  await assert.rejects(service.save(admin, { model: 'gpt-4.1-mini' }), /Enter the OpenAI API key/);
  await assert.rejects(service.save(admin, { apiKey: 'not-a-key' }), /does not look like/);
  await assert.rejects(service.save(admin, { apiKey: 'sk-synthetic-not-a-real-key-000000', model: 'bad model!' }), /model name/);
  const saved = await service.save(admin, { apiKey: 'sk-synthetic-not-a-real-key-000000' });
  assert.equal(saved.configured, true);
  assert.equal(saved.keyHint, 'sk-…0000');
  assert.ok(!JSON.stringify(saved).includes('synthetic-not-a-real'), 'The key is never returned');
  assert.ok(!JSON.stringify(audits).includes('synthetic-not-a-real'), 'The key is never written to the audit log');
  assert.equal((await service.credentialsFor('tenant-a')).apiKey, 'sk-synthetic-not-a-real-key-000000');
  await service.save(admin, { enabled: false });
  assert.equal(await service.credentialsFor('tenant-a'), null, 'A turned-off service is not used');
  assert.equal(await service.credentialsFor('tenant-b'), null, 'Another company has its own setting');
  await assert.rejects(service.get({ id: 'x', tenantId: null, roles: ['SUPER_ADMIN'] }), /company/);
  await service.remove(admin);
  assert.equal(rows.length, 0);
  // Before the access matrix is saved, only administrators reach the AI settings (same fallback as Users).
  const { AiSettingsController } = require('../dist/ai-settings/ai-settings.controller');
  assert.deepEqual(Reflect.getMetadata('roles', AiSettingsController), ['SUPER_ADMIN', 'COMPANY_ADMIN']);
}

async function checkReader() {
  const pdf = { buffer: Buffer.from('%PDF-1.4 synthetic'), mimetype: 'application/pdf', originalname: 'cr.pdf' };
  const realFetch = global.fetch;
  const calls = [];
  const aiAnswer = { document: { documentNumber: '04669', holderName: 'Arabic Game Partners LLC', location: 'Qatar', issueDate: null, expiryDate: '2026-12-31' },
    company: { legalName: 'Arabic Game Partners LLC', commercialRegistrationNo: '04669', dateOfIncorporation: null, crExpiryDate: '2026-12-31', countryOfIncorporation: 'Qatar', placeOfIncorporation: null, legalForm: 'LLC', registeredOfficeAddress: null, shareCapital: null, taxIdentificationNo: null, licenseActivities: null },
    people: [{ fullName: 'Samer Saleh', nationality: 'Jordan', roles: ['SHAREHOLDER'], sharePercentage: '60', idNumber: null }] };
  global.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), auth: options.headers.Authorization });
    return { ok: true, status: 200, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(aiAnswer) }] }] }) };
  };
  try {
    const withKey = new DocumentReaderService({ credentialsFor: async () => ({ provider: 'OPENAI', apiKey: 'sk-test', model: 'gpt-4.1-mini' }) }, {});
    const read = await withKey.read('tenant-a', 'CR_EXTRACT_EN', pdf);
    assert.equal(read.method, 'AI');
    assert.equal(read.people[0].fullName, 'Samer Saleh');
    assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(calls[0].body.text.format.type, 'json_schema');
    assert.equal(calls[0].body.text.format.strict, true);
    assert.match(calls[0].body.input[0].content[1].file_data, /^data:application\/pdf;base64,/, 'PDFs are sent as a file');

    // The AI service failing falls back to the local reader with a clear message.
    global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    withKey.readLocally = async () => ({ ...parser.parseDocumentText('CR_EXTRACT_EN', ''), method: 'NONE', aiConfigured: false, message: 'Local.' });
    const fallback = await withKey.read('tenant-a', 'CR_EXTRACT_EN', pdf);
    assert.equal(fallback.method, 'NONE');
    assert.match(fallback.message, /API key was refused/);

    // Without a key nothing is sent anywhere.
    let sent = false;
    global.fetch = async () => { sent = true; throw new Error('should not be called'); };
    const local = new DocumentReaderService({ credentialsFor: async () => null }, {});
    local.extractText = async () => 'Commercial Registration No: 04669\nExpiry Date: 31/12/2026';
    const localRead = await local.read('tenant-a', 'CR_EXTRACT_EN', pdf);
    assert.equal(sent, false, 'No document leaves the server without an AI key');
    assert.equal(localRead.method, 'LOCAL');
    assert.equal(localRead.document.documentNumber, '04669');
    const word = await local.read('tenant-a', 'CR_EXTRACT_EN', { buffer: Buffer.from('PK'), mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalname: 'cr.docx' });
    assert.equal(word.method, 'NONE', 'Word files are not read');
  } finally {
    global.fetch = realFetch;
  }
}

function checkExpiryLinks() {
  const person = { id: 'p1', partyType: 'INDIVIDUAL', fullName: 'Samer Saleh', roles: [{ role: 'DIRECTOR', title: '' }], passports: [], qidExpiry: null, nationalAddressExpiry: '2026-10-27' };
  const legal = [
    { id: 'd1', typeLabel: 'Commercial Registration Extract (English)', expiryType: 'CR', isRegistration: true, isNationalAddress: false, documentNumber: '04669', holderName: 'Synthetic', personId: null, expiryDate: '2026-12-31' },
    { id: 'd2', typeLabel: 'National Address certificate', expiryType: 'OTHER', isRegistration: false, isNationalAddress: true, documentNumber: null, holderName: 'Samer Saleh', personId: 'p1', expiryDate: '2026-10-27' },
    { id: 'd3', typeLabel: 'Articles of Association', expiryType: 'OTHER', isRegistration: false, isNationalAddress: false, documentNumber: null, holderName: 'Synthetic', personId: null, expiryDate: null }
  ];
  const items = records.recordExpiries({ crExpiryDate: '2026-12-31', legalName: 'Synthetic' }, [person], legal);
  assert.deepEqual(items.map((item) => item.sourceKey).sort(), ['legal:d1', 'legal:d2'], 'Each register document with an expiry is listed once; the profile dates they match are not repeated');
  assert.equal(items.find((item) => item.sourceKey === 'legal:d2').holderRole, 'Director');
  const withoutDocs = records.recordExpiries({ crExpiryDate: '2026-12-31', legalName: 'Synthetic' }, [person], []);
  assert.deepEqual(withoutDocs.map((item) => item.sourceKey).sort(), ['entity:CR', 'person:NATIONAL_ADDRESS:p1']);
}

function memoryDb() {
  const db = { clients: [{ id: 'c1', tenantId: 'tenant-a', name: 'Synthetic W.L.L.', status: 'ACTIVE', activatedAt: new Date(), clientCode: 'CL-1' }],
    entity: [{ id: 'e1', clientId: 'c1', legalName: 'Synthetic W.L.L.', crExpiryDate: null, commercialRegistrationNo: null, fieldEditedAt: {} }],
    people: [{ id: 'p1', tenantId: 'tenant-a', clientId: 'c1', partyType: 'INDIVIDUAL', fullName: 'Samer Saleh', archivedAt: null, nationalAddressExpiry: null, fieldEditedAt: {}, sortOrder: 0, roles: [], passports: [] }],
    legal: [], notices: [], audits: [], expiry: [] };
  let next = 0;
  const match = (row, where) => Object.entries(where).every(([key, value]) => {
    if (['status', 'NOT'].includes(key) && typeof value === 'object' && value && !('equals' in value)) return key === 'NOT' ? true : value.in ? value.in.includes(row.status) : true;
    if (value === null) return row[key] === null || row[key] === undefined;
    if (typeof value === 'object' && value && 'not' in value) return row[key] !== value.not;
    return row[key] === value;
  });
  Object.assign(db, {
    client: { findFirst: async ({ where }) => db.clients.find((row) => row.id === where.id && (!where.tenantId || row.tenantId === where.tenantId)) || null },
    clientLegalDocument: {
      findMany: async ({ where }) => db.legal.filter((row) => match(row, where)).map((row) => ({ ...row, replacedBy: db.legal.find((other) => other.replacesId === row.id) || null })),
      findFirst: async ({ where }) => db.legal.find((row) => match(row, where)) || null,
      create: async ({ data }) => { const row = { id: `d${++next}`, status: 'CURRENT', createdAt: new Date(), ...data }; db.legal.push(row); return row; },
      update: async ({ where, data }) => Object.assign(db.legal.find((row) => row.id === where.id), data)
    },
    clientPerson: {
      findMany: async ({ where }) => db.people.filter((row) => row.clientId === where.clientId && !row.archivedAt),
      findFirst: async ({ where }) => db.people.find((row) => row.id === where.id && row.clientId === where.clientId) || null,
      findUnique: async ({ where }) => db.people.find((row) => row.id === where.id) || null,
      update: async ({ where, data }) => Object.assign(db.people.find((row) => row.id === where.id), data)
    },
    clientEntityProfile: {
      findUnique: async ({ where }) => db.entity.find((row) => row.clientId === where.clientId) || null,
      update: async ({ where, data }) => Object.assign(db.entity.find((row) => row.id === where.id), data)
    },
    clientDocument: { findMany: async () => [] },
    clientExpiryItem: {
      findMany: async () => db.expiry,
      create: async ({ data }) => db.expiry.push({ id: `x${++next}`, ...data }),
      update: async ({ where, data }) => Object.assign(db.expiry.find((row) => row.id === where.id), data),
      updateMany: async ({ where, data }) => db.expiry.filter((row) => where.id.in.includes(row.id)).forEach((row) => Object.assign(row, data))
    },
    notification: { create: async ({ data }) => db.notices.push(data) },
    auditLog: { create: async ({ data }) => db.audits.push(data) },
    $transaction: async (callback) => callback(db)
  });
  return db;
}

async function checkRegister() {
  const db = memoryDb();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-docs-'));
  process.env.CLIENT_DOCUMENT_UPLOAD_DIR = folder;
  const files = new ComplianceDocumentsService(db);
  const service = new ClientLegalDocumentsService(db, files, { read: async () => ({}) });
  const pdf = { originalname: 'cr.pdf', mimetype: 'application/pdf', size: 9, buffer: Buffer.from('%PDF-1.4\n') };

  await assert.rejects(service.create(actor, 'c1', { typeKey: 'CR_EXTRACT_EN' }, []), /Select one file/);
  await assert.rejects(service.create(actor, 'c1', { typeKey: 'QID' }, [pdf]), /added on the person/);
  await assert.rejects(service.create(actor, 'c1', { typeKey: 'NATIONAL_ADDRESS' }, [pdf]), /Choose the person/);
  await assert.rejects(service.create(actor, 'c1', { typeKey: 'OTHER' }, [pdf]), /document name/);
  await assert.rejects(service.create(actor, 'c1', { typeKey: 'TAX_CARD', expiryDate: '31/12/2026' }, [pdf]), /YYYY-MM-DD/);
  await assert.rejects(service.create(actor, 'c1', { typeKey: 'TAX_CARD', issueDate: '2027-01-01', expiryDate: '2026-01-01' }, [pdf]), /before the issue date/);
  await assert.rejects(service.create({ ...actor, tenantId: 'tenant-b' }, 'c1', { typeKey: 'TAX_CARD' }, [pdf]), /not found/);

  const first = await service.create(actor, 'c1', { typeKey: 'CR_EXTRACT_EN', documentNumber: '04669', location: 'Qatar', expiryDate: '2026-12-31' }, [pdf]);
  const cr = db.legal.find((row) => row.id === first.id);
  assert.equal(cr.holderName, 'Synthetic W.L.L.', 'A company document is named after the company by default');
  assert.ok(fs.existsSync(path.join(folder, cr.storagePath)), 'The file is stored in the client folder');
  assert.equal(db.entity[0].crExpiryDate.toISOString().slice(0, 10), '2026-12-31', 'A CR document sets the company CR expiry');
  assert.equal(db.entity[0].commercialRegistrationNo, '04669', 'and the CR number when it is missing');
  assert.ok(db.expiry.some((item) => item.sourceKey === `legal:${cr.id}` && item.documentType === 'CR'), 'and appears on the Expiry tab');
  assert.ok(!db.expiry.some((item) => item.sourceKey === 'entity:CR' && item.isActive), 'without a second entry for the same CR expiry');
  assert.equal(db.notices.at(-1).type, 'COMPLIANCE_LEGAL_DOCUMENT_CHANGED', 'The AML team is notified');
  assert.match(db.notices.at(-1).message, /04669/);
  assert.equal(db.audits.at(-1).metadata.action, 'LEGAL_DOCUMENT_ADDED');

  const renewed = await service.create(actor, 'c1', { typeKey: 'CR_EXTRACT_EN', documentNumber: '04669', expiryDate: '2027-12-31', replacesId: cr.id }, [pdf]);
  assert.equal(cr.status, 'REPLACED', 'The previous document is kept as replaced');
  assert.equal(db.legal.find((row) => row.id === renewed.id).replacesId, cr.id);
  assert.equal(db.entity[0].crExpiryDate.toISOString().slice(0, 10), '2027-12-31');
  assert.ok(db.expiry.find((item) => item.sourceKey === `legal:${cr.id}`).isActive === false, 'The old expiry entry is deactivated');
  await assert.rejects(service.create(actor, 'c1', { typeKey: 'CR_EXTRACT_EN', replacesId: cr.id }, [pdf]), /no longer current/);

  const address = await service.create(actor, 'c1', { typeKey: 'NATIONAL_ADDRESS', personId: 'p1', expiryDate: '2026-10-27' }, [pdf]);
  assert.equal(db.legal.find((row) => row.id === address.id).holderName, 'Samer Saleh', 'An individual document is named after the person');
  assert.equal(db.people[0].nationalAddressExpiry.toISOString().slice(0, 10), '2026-10-27', 'and its expiry is linked to the person');

  await service.update(actor, 'c1', renewed.id, { documentNumber: '04670' });
  assert.equal(db.legal.find((row) => row.id === renewed.id).documentNumber, '04670');
  assert.equal(db.notices.at(-1).title.startsWith('Legal document changed'), true);
  await assert.rejects(service.remove(actor, 'c1', renewed.id, ' '), /reason/);
  await service.remove(actor, 'c1', renewed.id, 'Wrong company uploaded');
  assert.equal(db.legal.find((row) => row.id === renewed.id).status, 'DELETED', 'Removal keeps the record');
  assert.equal(db.legal.find((row) => row.id === renewed.id).statusReason, 'Wrong company uploaded');
  assert.match(db.notices.at(-1).message, /Wrong company uploaded/);
  await assert.rejects(service.update(actor, 'c1', renewed.id, { documentNumber: '1' }), /no longer current/);
  const list = await service.list(actor, 'c1');
  assert.ok(list.types.some((type) => type.key === 'ORG_CHART'), 'The catalogue includes the organisation chart');
  assert.equal(list.documents.filter((document) => document.status === 'CURRENT').length, 1);
  assert.equal(list.documents.length, 3, 'History is returned for the history view');
  const view = await service.getFile(actor, 'c1', address.id);
  assert.equal(view.content.toString().slice(0, 8), '%PDF-1.4');
  fs.rmSync(folder, { recursive: true, force: true });
}

async function checkAccessGuard() {
  const matrix = (grants) => ({ allows: async (roles, area, write) => (grants === null ? null : roles.some((role) => grants[`${role}:${area}:${write ? 'edit' : 'view'}`])), allowsByDefault: (roles, area, write) => {
    const defaults = { OPERATING_TEAM: { compliance: 'VIEW', clients: 'EDIT' }, SEF: { compliance: 'VIEW' }, AML_TEAM: { compliance: 'EDIT' } };
    return roles.some((role) => { const level = defaults[role]?.[area]; return level === 'EDIT' || (level === 'VIEW' && !write); });
  } });
  const run = async (roles, method, grants = null) => new LegalDocumentsAccessGuard(matrix(grants)).canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: { roles }, method }) }) });
  assert.equal(await run(['OPERATING_TEAM'], 'POST'), true, 'Operations can add and replace documents (clients Edit)');
  assert.equal(await run(['OPERATING_TEAM'], 'GET'), true);
  assert.equal(await run(['AML_TEAM'], 'POST'), true);
  assert.equal(await run(['SEF'], 'GET'), true);
  assert.equal(await run(['SEF'], 'POST'), false, 'View-only roles cannot change documents');
  assert.equal(await run(['HR_TEAM'], 'GET'), false);
  assert.equal(await run(['OPERATING_TEAM'], 'POST', {}), false, 'A saved matrix without those grants is respected');
}

async function checkExpiryExport() {
  const now = Date.now();
  const day = 86400000;
  const items = [
    { clientId: 'c1', isActive: true, documentType: 'CR', documentLabel: 'Commercial Registration Extract (English)', holderName: 'Synthetic', holderRole: 'Company', documentNumber: '04669', expiryDate: new Date(now - 5 * day) },
    { clientId: 'c1', isActive: true, documentType: 'PASSPORT', documentLabel: null, holderName: 'Samer', holderRole: 'Director', documentNumber: 'P1', expiryDate: new Date(now + 20 * day) },
    { clientId: 'c1', isActive: true, documentType: 'QID', documentLabel: null, holderName: 'Samer', holderRole: 'Director', documentNumber: 'Q1', expiryDate: new Date(now + 50 * day) }
  ];
  const seen = [];
  const prisma = {
    client: { findMany: async () => [{ id: 'c1', name: 'Synthetic', clientCode: 'CL-2026-0001' }] },
    clientExpiryItem: { findMany: async ({ where }) => { seen.push(where.expiryDate); return items.filter((item) => !where.expiryDate || ((!where.expiryDate.lt || item.expiryDate < where.expiryDate.lt) && (!where.expiryDate.gte || item.expiryDate >= where.expiryDate.gte) && (!where.expiryDate.lte || item.expiryDate <= where.expiryDate.lte))); } }
  };
  const service = new ComplianceClientsService(prisma);
  const { Workbook } = require('exceljs');
  const rows = async (window) => {
    const file = await service.exportExpiry({ id: 'u', tenantId: 'tenant-a', roles: ['AML_TEAM'] }, 'c1', window);
    const book = new Workbook();
    await book.xlsx.load(file.content);
    const sheet = book.worksheets[0];
    return { name: file.fileName, header: sheet.getRow(1).values.slice(1, 3), docs: sheet.getRows(2, sheet.rowCount - 1)?.map((row) => row.getCell(1).value) || [] };
  };
  const expired = await rows('EXPIRED');
  assert.deepEqual(expired.header, ['Document', 'Expiry Date'], 'Document name and expiry date come first');
  assert.deepEqual(expired.docs, ['Commercial Registration Extract (English)']);
  assert.deepEqual((await rows('30')).docs, ['Passport'], 'Within 30 days excludes expired documents');
  assert.deepEqual((await rows('60')).docs, ['Passport', 'QID']);
  assert.equal((await rows(undefined)).docs.length, 3);
  assert.match(expired.name, /^expiring-documents-CL-2026-0001-expired-/);
}

async function main() {
  checkParser();
  checkAiResult();
  await checkSecretsAndSettings();
  await checkReader();
  checkExpiryLinks();
  await checkRegister();
  await checkAccessGuard();
  await checkExpiryExport();
  console.log('Legal document checks passed: text reading and dates, AI answer limits, encrypted keys never returned or logged, AI reading with fallback and nothing sent without a key, register add/replace/edit/remove with history, CR and national address expiry linked to the profile and Expiry tab, AML notices, tenant scoping, Operations access, expiry Excel windows (synthetic persistence).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
