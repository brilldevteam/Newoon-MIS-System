const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const records = require('../dist/compliance-clients/client-records');
const store = require('../dist/compliance-clients/client-records-store');
const { profileFromForm } = require('../dist/compliance-clients/compliance-client-profile');
const { syncIdentityExpiryItems } = require('../dist/compliance-clients/identity-expiry-sync');
const { ComplianceClientsService } = require('../dist/compliance-clients/compliance-clients.service');

// Client records (2026-11-22): one entity record and one record per person with any number of roles.
// Synthetic persistence only: never connects to the configured database.
// Run from the repository root after `npm run build`: node backend/scripts/check-client-records.cjs
const actor = { id: 'aml-user', email: 'synthetic@example.invalid', tenantId: 'tenant-a', roles: ['AML_TEAM'] };
const client = { id: 'c1', tenantId: 'tenant-a', name: 'Synthetic Holding W.L.L.' };

// A KYC where the same person is shareholder, UBO, director, signatory and key contact.
function onboardingForm() {
  return {
    version: 1, status: 'FINAL', updatedAt: new Date('2026-06-01'),
    sectionA: { legalName: 'Synthetic Holding W.L.L.', legalForm: 'Other', legalFormOther: 'Branch', commercialRegistrationNo: '04669', countryOfIncorporation: ['Qatar'], dateOfIncorporation: '2020-01-31', website: 'example.test' },
    sectionB: {
      shareholders: [
        { id: 's1', fullName: 'Samer Saleh', shareholderType: 'Individual', isUbo: true, shareholderPercentage: 60, uboInterestPercentage: 60, nationality: ['Jordan'], qidNumber: '28240002378', qidExpiry: '2028-07-26', passportNumber: 'U0668936', passportExpiry: '2031-05-20' },
        { id: 's2', fullName: 'Parent Holdings S.A.', shareholderType: 'Corporate Entity', identityNumber: 'CR-77', shareholderPercentage: 40 }
      ],
      ubos: [
        { id: 'u1', fullName: 'Indirect Owner', parentRowId: 's2', uboInterestPercentage: '40', qidNumber: '111', qidExpiry: '2027-01-10' }
      ]
    },
    sectionC: { managers: [
      { id: 'm1', fullName: 'SAMER  SALEH', position: ['Director', 'CEO'], isAuthorizedSignatory: true, entityName: 'Synthetic Holding W.L.L.', passportNumber: 'QA9876543' },
      { id: 'm2', fullName: 'Hana Ali', position: ['Secretary'] },
      { id: 'm3', fullName: 'Omar Said', position: 'Compliance Officer' }
    ] },
    sectionE: { fullName: 'Samer Saleh', position: ['Director'], mobileNumber: '+97455550000', email: 'samer@example.invalid' }
  };
}

// In-memory stand-in for the Prisma calls the records code makes.
function memoryDb() {
  let clock = Date.parse('2026-06-01T00:00:00Z');
  const tick = () => new Date((clock += 1000));
  const db = {
    entity: [], people: [], roles: [], passports: [], documents: [], expiry: [], audits: [],
    setClock: (iso) => { clock = Date.parse(iso); }
  };
  const withIncludes = (person) => ({
    ...person,
    roles: db.roles.filter((role) => role.personId === person.id).sort((a, b) => a.createdAt - b.createdAt),
    passports: db.passports.filter((item) => item.personId === person.id).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt - b.createdAt)
  });
  const personMatches = (person, where) => Object.entries(where).every(([key, value]) => {
    if (key === 'archivedAt') return value === null ? !person.archivedAt : true;
    return person[key] === value;
  });
  let ids = 0;
  const id = (prefix) => `${prefix}${++ids}`;
  Object.assign(db, {
    clientEntityProfile: {
      findUnique: async ({ where }) => db.entity.find((item) => item.clientId === where.clientId) || null,
      findUniqueOrThrow: async ({ where }) => db.entity.find((item) => item.clientId === where.clientId),
      create: async ({ data }) => {
        if (db.entity.some((item) => item.clientId === data.clientId)) throw new Prisma.PrismaClientKnownRequestError('Unique', { code: 'P2002', clientVersion: 'synthetic' });
        const row = { id: id('ent'), fieldEditedAt: {}, ...data };
        db.entity.push(row);
        return row;
      },
      update: async ({ where, data }) => Object.assign(db.entity.find((item) => item.id === where.id), data)
    },
    clientPerson: {
      findMany: async ({ where, include, select }) => {
        const rows = db.people.filter((person) => personMatches(person, where)).sort((a, b) => a.sortOrder - b.sortOrder);
        return include ? rows.map(withIncludes) : select ? rows.map((row) => Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]))) : rows;
      },
      findFirst: async ({ where, include }) => {
        const row = db.people.find((person) => personMatches(person, where));
        return row ? (include ? withIncludes(row) : row) : null;
      },
      create: async ({ data }) => {
        const { roles, passports, ...rest } = data;
        const row = { id: id('p'), archivedAt: null, fieldEditedAt: {}, sortOrder: 0, createdAt: tick(), ...rest };
        db.people.push(row);
        for (const role of roles?.create || []) db.roles.push({ id: id('r'), title: '', percentage: null, viaPersonId: null, sourceSection: null, sourceRowId: null, createdAt: tick(), ...role, personId: row.id });
        for (const passport of passports?.create || []) db.passports.push({ id: id('pp'), issuingCountry: null, createdAt: tick(), ...passport, personId: row.id });
        return row;
      },
      update: async ({ where, data }) => Object.assign(db.people.find((person) => person.id === where.id), data),
      aggregate: async () => ({ _max: { sortOrder: db.people.reduce((max, person) => Math.max(max, person.sortOrder), -1) } })
    },
    clientPersonRole: {
      deleteMany: async ({ where }) => { db.roles = db.roles.filter((role) => !(role.personId === where.personId && role.createdAt <= where.createdAt.lte)); },
      upsert: async ({ where, update, create }) => {
        const key = where.personId_role_title;
        const found = db.roles.find((role) => role.personId === key.personId && role.role === key.role && role.title === key.title);
        if (found) return Object.assign(found, update);
        const row = { id: id('r'), createdAt: tick(), ...create };
        db.roles.push(row);
        return row;
      },
      count: async ({ where }) => db.roles.filter((role) => role.personId === where.personId).length,
      create: async ({ data }) => {
        if (db.roles.some((role) => role.personId === data.personId && role.role === data.role && role.title === data.title)) throw new Error('duplicate role');
        const row = { id: id('r'), createdAt: tick(), viaPersonId: null, ...data };
        db.roles.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const role = db.roles.find((item) => item.id === where.id);
        if ('percentage' in data) role.percentage = data.percentage;
        if (data.via) role.viaPersonId = data.via.connect ? data.via.connect.id : null;
        return role;
      },
      delete: async ({ where }) => { db.roles = db.roles.filter((role) => role.id !== where.id); }
    },
    clientPersonPassport: {
      updateMany: async ({ where, data }) => db.passports.filter((item) => item.personId === where.personId).forEach((item) => Object.assign(item, data)),
      create: async ({ data }) => { const row = { id: id('pp'), createdAt: tick(), ...data }; db.passports.push(row); return row; },
      update: async ({ where, data }) => Object.assign(db.passports.find((item) => item.id === where.id), data),
      delete: async ({ where }) => { db.passports = db.passports.filter((item) => item.id !== where.id); }
    },
    clientDocument: {
      findMany: async ({ where }) => db.documents.filter((document) => document.clientId === where.clientId && (where.personId === null ? !document.personId : true) && document.personKey),
      updateMany: async ({ where, data }) => {
        const rows = db.documents.filter((document) => document.clientId === where.clientId && !document.personId && document.personKey === where.personKey);
        rows.forEach((document) => Object.assign(document, data));
        return { count: rows.length };
      }
    },
    clientExpiryItem: {
      findMany: async ({ where }) => db.expiry.filter((item) => item.clientId === where.clientId && item.sourceKey !== null),
      create: async ({ data }) => { db.expiry.push({ id: id('x'), ...data }); },
      update: async ({ where, data }) => Object.assign(db.expiry.find((item) => item.id === where.id), data),
      updateMany: async ({ where, data }) => db.expiry.filter((item) => where.id.in.includes(item.id)).forEach((item) => Object.assign(item, data))
    },
    auditLog: { create: async ({ data }) => { db.audits.push(data); } },
    // Legal documents register (Phase 2): empty here; see check-legal-documents.cjs.
    clientLegalDocument: { findMany: async () => [] },
    notification: { create: async () => undefined },
    $transaction: async (callback) => callback(db)
  });
  return db;
}

const active = (db) => db.people.filter((person) => !person.archivedAt);
const rolesOf = (db, person) => db.roles.filter((role) => role.personId === person.id).map((role) => role.role === 'OTHER' ? `OTHER:${role.title}` : role.role).sort();
const byName = (db, name) => db.people.find((person) => person.fullName === name);

function checkMapping() {
  assert.deepEqual(records.positionRoles(['Director', 'CEO'], true).map((item) => item.role).sort(), ['AUTHORISED_SIGNATORY', 'CEO', 'DIRECTOR']);
  assert.deepEqual(records.positionRoles(['Managing Director', 'General Manager', 'Senior Executive Function'], false).map((item) => item.role).sort(), ['GENERAL_MANAGER', 'MANAGING_DIRECTOR', 'SEF']);
  assert.deepEqual(records.positionRoles(['Compliance Officer'], false), [{ role: 'OTHER', title: 'Compliance Officer' }], 'Unlisted wording is kept as the position');
  assert.deepEqual(records.positionRoles([], false), [{ role: 'OTHER', title: '' }]);

  const { entity, people } = records.draftsFromProfile(profileFromForm(onboardingForm()));
  assert.equal(entity.legalForm, 'Branch');
  assert.equal(entity.commercialRegistrationNo, '04669', 'Numbers keep their leading zeros');
  const samer = people.find((person) => person.fullName === 'Samer Saleh');
  assert.deepEqual(samer.roles.map((role) => role.role).sort(), ['AUTHORISED_SIGNATORY', 'CEO', 'DIRECTOR', 'KEY_CONTACT', 'SHAREHOLDER', 'UBO'],
    'Shareholder, UBO, director, signatory and key contact rows of the same person become one person with every role');
  assert.equal(people.filter((person) => /samer/i.test(person.fullName)).length, 1, 'Name spacing and case do not split a person');
  assert.equal(samer.values.telephone, '+97455550000');
  assert.deepEqual(samer.passports.map((item) => item.number), ['U0668936', 'QA9876543'], 'Different passports on different rows of the same person are all kept, the first as main');
  assert.equal(samer.values.representedEntity, 'Synthetic Holding W.L.L.');
  assert.equal(samer.roles.find((role) => role.role === 'KEY_CONTACT').title, 'Director', 'The key contact keeps their position wording');
  const corporate = people.find((person) => person.partyType === 'CORPORATE');
  assert.equal(corporate.values.registrationNumber, 'CR-77');
  assert.equal(people.find((person) => person.fullName === 'Indirect Owner').roles[0].viaName, 'Parent Holdings S.A.');

  // Same name, different QID: two people.
  const twins = records.draftsFromProfile(profileFromForm({
    ...onboardingForm(), sectionC: { managers: [{ id: 'a', fullName: 'Ali Hassan', position: 'Director', qidNumber: '1' }, { id: 'b', fullName: 'Ali Hassan', position: 'Manager', qidNumber: '2' }] }, sectionE: {}
  }));
  assert.equal(twins.people.filter((person) => person.fullName === 'Ali Hassan').length, 2, 'Different QID numbers are never merged by name');
}

async function checkSeedAndExpiry() {
  const db = memoryDb();
  db.documents.push({ id: 'd1', clientId: 'c1', personKey: 'SAMER SALEH', personId: null });
  const overrides = [
    { section: 'OFFICER', rowId: 'm2', rowLabel: 'Hana Ali', field: 'qidExpiry', value: '2026-12-31', updatedAt: new Date('2026-05-01') },
    { section: 'COMPANY', rowId: '', rowLabel: null, field: 'website', value: 'edited.example', updatedAt: new Date('2026-05-01') }
  ];
  const result = await store.syncClientRecordsFromKyc(db, { client, kycCaseId: 'k1', form: onboardingForm(), overrides, userId: 'u', since: null });
  assert.equal(result.seeded, true);
  assert.equal(active(db).length, 5, 'Samer, the corporate shareholder, the indirect UBO, the secretary and the compliance officer');
  assert.equal(db.entity[0].website, 'edited.example', 'Older client-page edits are kept when the records are created');
  assert.ok(db.entity[0].fieldEditedAt.website, 'and shown as edited');
  const hana = byName(db, 'Hana Ali');
  assert.equal(hana.qidExpiry.toISOString().slice(0, 10), '2026-12-31');
  assert.ok(hana.fieldEditedAt.qidExpiry);
  assert.equal(db.documents[0].personId, byName(db, 'Samer Saleh').id, 'Earlier ID copies are linked to the person');
  assert.deepEqual(db.passports.filter((item) => item.personId === byName(db, 'Samer Saleh').id).map((item) => [item.passportNumber, item.isPrimary]), [['U0668936', true], ['QA9876543', false]]);
  const indirect = db.roles.find((role) => role.personId === byName(db, 'Indirect Owner').id);
  assert.equal(indirect.viaPersonId, byName(db, 'Parent Holdings S.A.').id, 'A UBO held through a company points at that company');
  assert.equal(String(db.roles.find((role) => role.role === 'SHAREHOLDER' && role.personId === byName(db, 'Samer Saleh').id).percentage), '60');

  const keys = db.expiry.filter((item) => item.isActive).map((item) => item.sourceKey).sort();
  assert.deepEqual(keys, ['person:PASSPORT:U0668936', 'person:QID:111', 'person:QID:28240002378', 'person:QID:name:HANAALI'], 'Same expiry keys as before the records, so reminders are not repeated');
  assert.equal(db.expiry.find((item) => item.sourceKey === 'person:QID:28240002378').holderRole.split(', ').length, 6, 'The holder shows all the person\'s roles');
  assert.equal(db.audits.at(-1).metadata.action, 'CLIENT_RECORDS_CREATED');

  // National address and CR expiry dates are listed too.
  const expiries = records.recordExpiries(
    { crExpiryDate: '2026-12-31', commercialRegistrationNo: '04669', legalName: 'Synthetic' },
    [{ id: 'p9', partyType: 'INDIVIDUAL', fullName: 'X', roles: [{ role: 'DIRECTOR', title: '' }], passports: [{ passportNumber: 'A1', expiryDate: '2030-01-01' }, { passportNumber: 'B2', expiryDate: '2031-01-01' }], qidExpiry: null, nationalAddressExpiry: '2026-10-27' }]
  );
  assert.deepEqual(expiries.map((item) => item.sourceKey).sort(), ['entity:CR', 'person:NATIONAL_ADDRESS:p9', 'person:PASSPORT:A1', 'person:PASSPORT:B2'], 'Every passport, the national address and the CR');
  assert.equal(expiries.find((item) => item.sourceKey === 'entity:CR').documentType, 'CR');

  // Expiry sync: unchanged records change nothing; manual records are never touched.
  db.expiry.push({ id: 'manual', clientId: 'c1', sourceKey: null, isActive: true });
  const again = await store.syncRecordExpiries(db, client, 'u');
  assert.deepEqual(again, { created: 0, updated: 0, deactivated: 0 });
  const removed = await syncIdentityExpiryItems(db, client, 'u', []);
  assert.equal(removed.deactivated, 4, 'Documents no longer on the profile are deactivated, not deleted');
  assert.equal(db.expiry.find((item) => item.id === 'manual').isActive, true);

  // Two first loads at once: the second one also saw no records, and the unique entity record stops it (the service
  // then uses the records the first one created).
  const people = db.people.length;
  const findEntity = db.clientEntityProfile.findUnique;
  db.clientEntityProfile.findUnique = async () => null;
  await assert.rejects(store.syncClientRecordsFromKyc(db, { client, kycCaseId: 'k1', form: onboardingForm(), userId: 'u', since: null }), (error) => error.code === 'P2002');
  db.clientEntityProfile.findUnique = findEntity;
  assert.equal(db.people.length, people, 'Nothing is created twice');
  return db;
}

// The CR expiry date on the KYC form (Section A, usually read from the CR copy) is kept on the client and its
// expiry list; an empty or invalid value never clears it.
async function checkCrExpiryFromKyc() {
  const db = memoryDb();
  const withCr = (value) => { const form = onboardingForm(); form.sectionA = { ...form.sectionA, crExpiryDate: value }; return form; };
  const sync = (value) => store.syncClientRecordsFromKyc(db, { client, kycCaseId: 'k1', form: withCr(value), userId: 'u', since: null });
  const crExpiry = () => db.entity[0].crExpiryDate && db.entity[0].crExpiryDate.toISOString().slice(0, 10);
  await sync('2027-03-31');
  assert.equal(crExpiry(), '2027-03-31', 'Seeded from the KYC form');
  assert.ok(db.expiry.some((item) => item.isActive && item.expiryDate && item.expiryDate.toISOString().slice(0, 10) === '2027-03-31'), 'Listed on the Expiry tab');
  await sync('');
  assert.equal(crExpiry(), '2027-03-31', 'An empty KYC value keeps the client date');
  await sync('31/03/2028');
  assert.equal(crExpiry(), '2027-03-31', 'Only YYYY-MM-DD dates are taken');
  await sync('2028-03-31');
  assert.equal(crExpiry(), '2028-03-31', 'A later KYC updates the date');
}

async function checkRekycMerge() {
  const db = memoryDb();
  await store.syncClientRecordsFromKyc(db, { client, kycCaseId: 'k1', form: onboardingForm(), userId: 'u', since: null });
  const samer = byName(db, 'Samer Saleh');
  const since = new Date('2026-09-01T00:00:00Z');
  db.setClock('2026-10-01T00:00:00Z');
  // Changes on the client page after the re-KYC started.
  samer.fieldEditedAt = { nationality: '2026-10-01T00:00:00.000Z' };
  samer.nationality = 'Jordan, Qatar';
  samer.isPep = true; // client-only value
  db.roles.push({ id: 'late', personId: byName(db, 'Hana Ali').id, role: 'SEF', title: '', percentage: null, createdAt: new Date('2026-10-02T00:00:00Z') });

  const form = onboardingForm();
  form.sectionB.shareholders[0].nationality = ['Syria']; // older value in the re-KYC form
  form.sectionB.shareholders[0].passportNumber = 'N1111111'; // a renewed passport
  form.sectionB.shareholders[0].passportExpiry = '2035-01-01';
  form.sectionC.managers = [
    { id: 'n1', fullName: 'Samer Saleh', position: ['Director'], isAuthorizedSignatory: true },
    { id: 'n3', fullName: 'New Director', position: ['Director'] }
  ];
  const result = await store.syncClientRecordsFromKyc(db, { client, kycCaseId: 'k2', form, userId: 'u', since });
  assert.equal(result.seeded, false);
  assert.equal(samer.nationality, 'Jordan, Qatar', 'A value edited on the client page after the re-KYC started is kept');
  assert.equal(samer.isPep, true, 'Client-only values are kept');
  assert.deepEqual(rolesOf(db, samer), ['AUTHORISED_SIGNATORY', 'DIRECTOR', 'KEY_CONTACT', 'SHAREHOLDER', 'UBO'], 'Roles follow the approved re-KYC (CEO dropped)');
  const passports = db.passports.filter((item) => item.personId === samer.id);
  assert.deepEqual(passports.map((item) => [item.passportNumber, item.isPrimary]).sort(), [['N1111111', true], ['QA9876543', false], ['U0668936', false]], 'A new passport is added as the main one; the old ones stay listed');
  assert.ok(byName(db, 'New Director'), 'People new on the re-KYC are added');
  const hana = byName(db, 'Hana Ali');
  assert.ok(!hana.archivedAt, 'A person with a role added after the re-KYC started stays');
  assert.deepEqual(rolesOf(db, hana), ['SEF'], 'Only the role added later remains for someone no longer on the KYC');
  assert.ok(byName(db, 'Omar Said').archivedAt, 'Someone no longer on the KYC with no later roles is archived (kept with documents)');
  assert.equal(db.entity[0].sourceKycCaseId, 'k2');
}

function checkRekycPrefill() {
  const form = onboardingForm();
  form.sectionC.managers[0].address = 'Row address';
  const base = (overrides) => ({
    id: 'x', partyType: 'INDIVIDUAL', title: null, fullName: '', nationality: null, dualCitizenship: null, otherNationality: null, dateOfBirth: null, address: null,
    telephone: null, email: null, isPep: null, pepDetails: null, representedEntity: null, qidNumber: null, qidExpiry: null, nationalAddressExpiry: null,
    registrationNumber: null, linkedClientName: null, legacyIdentity: null, passports: [], roles: [], ...overrides
  });
  const role = (r, extra = {}) => ({ id: `${r}-${Math.random()}`, role: r, title: '', percentage: null, viaPersonId: null, sourceSection: null, sourceRowId: null, ...extra });
  const people = [
    base({
      id: 'samer', fullName: 'Samer Saleh', nationality: 'Jordan', qidNumber: '28240002378', qidExpiry: '2029-01-01', telephone: '+974', email: 'samer@example.invalid',
      address: 'A different address on the record', edited: ['telephone', 'passport:pb'],
      passports: [{ id: 'pa', passportNumber: 'OLD', expiryDate: '2026-01-01', isPrimary: false }, { id: 'pb', passportNumber: 'N1111111', expiryDate: '2035-01-01', isPrimary: true }],
      roles: [
        role('SHAREHOLDER', { percentage: '55', sourceSection: 'SHAREHOLDER', sourceRowId: 's1' }),
        role('DIRECTOR', { sourceSection: 'OFFICER', sourceRowId: 'm1' }),
        role('CHAIRMAN'),
        role('KEY_CONTACT', { title: 'Director', sourceSection: 'KEY_CONTACT', sourceRowId: '' })
      ]
    }),
    base({ id: 'corp', partyType: 'CORPORATE', fullName: 'Parent Holdings S.A.', registrationNumber: 'CR-77', roles: [role('SHAREHOLDER', { percentage: '45', sourceSection: 'SHAREHOLDER', sourceRowId: 's2' })] }),
    base({ id: 'hana', fullName: 'Hana Ali', roles: [role('SECRETARY', { sourceSection: 'OFFICER', sourceRowId: 'm2' }), role('UBO', { percentage: '10', viaPersonId: 'corp' })] }),
    base({ id: 'newbie', fullName: 'New Shareholder', roles: [role('SHAREHOLDER', { percentage: '0' })] })
  ];
  const before = JSON.stringify(form);
  const out = records.formFromRecords(form, { legalName: 'Renamed W.L.L.', legalForm: 'LLC', crExpiryDate: '2027-01-01', website: 'not-edited.example' }, people, ['legalName', 'legalForm']);
  assert.equal(JSON.stringify(form), before, 'The approved KYC form is not changed');
  assert.equal(out.sectionA.legalName, 'Renamed W.L.L.');
  assert.equal(out.sectionA.legalFormOther, '', '"Other" text is cleared when the legal form is set');
  assert.equal(out.sectionA.crExpiryDate, undefined, 'Client-only fields are not written into the KYC form');
  assert.equal(out.sectionA.legalForm, 'LLC', 'A single-choice field stays text, not a list');
  assert.equal(out.sectionA.website, 'example.test', 'A value not changed on the client page keeps the KYC wording');
  assert.deepEqual(out.sectionA.countryOfIncorporation, ['Qatar'], 'Untouched values keep their stored format');
  const m1Row = out.sectionC.managers.find((row) => row.id === 'm1');
  assert.equal(m1Row.address, 'Row address', 'A row keeps its own value when the merged person has another one that was not edited');
  assert.equal(out.sectionC.managers.find((row) => row.id === 'm2').address, undefined, 'Hana has no address anywhere, so none is added');
  assert.equal(out.sectionB.shareholders.find((row) => row.id === 's2').nationality, undefined, 'No empty fields are added to rows');
  const s1 = out.sectionB.shareholders.find((row) => row.id === 's1');
  assert.equal(s1.shareholderPercentage, '55');
  assert.equal(s1.isUbo, false, 'Samer no longer holds the UBO role');
  assert.equal(s1.passportNumber, 'N1111111', 'The main passport is printed on the KYC');
  assert.equal(s1.identityNumber, 'QID: 28240002378 / Passport: N1111111');
  assert.equal(out.sectionB.shareholders.find((row) => row.id === 's2').identityNumber, 'CR-77');
  const added = out.sectionB.shareholders.find((row) => row.fullName === 'New Shareholder');
  assert.ok(added && added.id && added.shareholderType === 'Individual', 'A shareholder added on the client page becomes a new row');
  assert.equal(out.sectionB.ubos.length, 1, 'The old UBO row (not on the records any more) is left out; Hana is added');
  assert.equal(out.sectionB.ubos[0].fullName, 'Hana Ali');
  assert.equal(out.sectionB.ubos[0].parentRowId, 's2', 'A UBO held through a company points at its shareholder row');
  const m1 = out.sectionC.managers.find((row) => row.id === 'm1');
  assert.deepEqual(m1.position, ['Director', 'Other']);
  assert.equal(m1.positionOther, 'Chairman', 'Roles that are not KYC options are written as "Other"');
  assert.equal(m1.isAuthorizedSignatory, false);
  assert.ok(!out.sectionC.managers.some((row) => row.id === 'm3'), 'Officers no longer on the records are left out');
  assert.deepEqual(out.sectionC.managers.find((row) => row.id === 'm2').position, ['Secretary']);
  assert.equal(out.sectionE.fullName, 'Samer Saleh');
  assert.equal(out.sectionE.mobileNumber, '+974');
}

async function checkService() {
  const db = memoryDb();
  await store.syncClientRecordsFromKyc(db, { client, kycCaseId: 'k1', form: onboardingForm(), userId: 'u', since: null });
  const prisma = {
    ...db,
    client: {
      findFirst: async ({ where }) => (where.tenantId === 'tenant-a' && where.id === 'c1'
        ? { id: 'c1', tenantId: 'tenant-a', name: client.name, status: 'ACTIVE', currentKycCaseId: 'k1', kycCases: [{ id: 'k1', kycNumber: 'KYC-2026-0001', status: 'CLIENT_ACTIVE', serviceId: 'svc', kycForm: { id: 'f1' } }] }
        : null)
    }
  };
  const stored = [];
  const docs = { sectionByKey: async (_tenant, key) => ({ id: 'sec', key }), storeFiles: async (_user, _client, _section, files, options) => stored.push(options) };
  let rekyc = null;
  const kyc = {
    formSnapshot: async () => onboardingForm(),
    createRekycCase: async (_user, _client, source, form) => { rekyc = { source, form }; return { id: 'k2', kycNumber: 'KYC-2026-0002' }; }
  };
  const service = new ComplianceClientsService(prisma, kyc, undefined, docs);
  service.findOne = async () => 'refreshed';
  const samer = byName(db, 'Samer Saleh');
  const corp = byName(db, 'Parent Holdings S.A.');

  assert.equal(await service.updatePersonField(actor, 'c1', samer.id, { field: 'title', value: 'sheikh' }), 'refreshed');
  assert.equal(samer.title, 'Sheikh');
  assert.equal(db.audits.at(-1).metadata.action, 'CLIENT_PERSON_FIELD_EDITED');
  await service.updatePersonField(actor, 'c1', samer.id, { field: 'isPep', value: 'Yes' });
  assert.equal(samer.isPep, true);
  await service.updatePersonField(actor, 'c1', samer.id, { field: 'nationalAddressExpiry', value: '2026-10-27' });
  assert.ok(db.expiry.some((item) => item.sourceKey === `person:NATIONAL_ADDRESS:${samer.id}` && item.documentLabel === 'National Address certificate'), 'The national address expiry is on the Expiry tab');
  await assert.rejects(service.updatePersonField(actor, 'c1', samer.id, { field: 'title', value: 'Lord' }), /Choose a title/);
  await assert.rejects(service.updatePersonField(actor, 'c1', samer.id, { field: 'qidExpiry', value: '05/01/2027' }), /YYYY-MM-DD/);
  await assert.rejects(service.updatePersonField(actor, 'c1', samer.id, { field: 'fullName', value: ' ' }), /cannot be empty/);
  await assert.rejects(service.updatePersonField(actor, 'c1', samer.id, { field: 'sortOrder', value: '1' }), /cannot be edited/);
  await assert.rejects(service.updatePersonField(actor, 'c1', corp.id, { field: 'qidNumber', value: '1' }), /individuals/);
  await assert.rejects(service.updatePersonField({ ...actor, tenantId: 'tenant-b' }, 'c1', samer.id, { field: 'title', value: 'Mr' }), /not found/);

  await service.updateEntityField(actor, 'c1', { field: 'shareCapital', value: 'QAR 200,000' });
  assert.equal(db.entity[0].shareCapital, 'QAR 200,000');
  await service.updateEntityField(actor, 'c1', { field: 'crExpiryDate', value: '2026-12-31' });
  assert.ok(db.expiry.some((item) => item.sourceKey === 'entity:CR' && item.documentType === 'CR'), 'The CR expiry is on the Expiry tab');
  await assert.rejects(service.updateEntityField(actor, 'c1', { field: 'legalName', value: '' }), /cannot be empty/);

  // Linking: a new person with someone's name is refused; the role is added to the existing person instead.
  await assert.rejects(service.addPerson(actor, 'c1', { partyType: 'INDIVIDUAL', fullName: 'samer  saleh', role: 'SEF' }), /already on this client/);
  await service.addRole(actor, 'c1', samer.id, { role: 'SEF' });
  assert.ok(rolesOf(db, samer).includes('SEF'));
  await assert.rejects(service.addRole(actor, 'c1', samer.id, { role: 'SEF' }), /already has this role/);
  await assert.rejects(service.addRole(actor, 'c1', corp.id, { role: 'UBO' }), /applies to individuals/);
  await assert.rejects(service.addRole(actor, 'c1', samer.id, { role: 'OTHER' }), /position/);
  await assert.rejects(service.addRole(actor, 'c1', samer.id, { role: 'CHAIRMAN', viaPersonId: corp.id }), /Only a UBO/);
  await service.addPerson(actor, 'c1', { partyType: 'INDIVIDUAL', fullName: 'Lina Haddad', role: 'UBO', percentage: '15' });
  const lina = byName(db, 'Lina Haddad');
  await service.updateRole(actor, 'c1', lina.id, db.roles.find((role) => role.personId === lina.id).id, { viaPersonId: corp.id });
  assert.equal(db.roles.find((role) => role.personId === lina.id).viaPersonId, corp.id);
  await assert.rejects(service.updateRole(actor, 'c1', lina.id, db.roles.find((role) => role.personId === lina.id).id, { percentage: '150' }), /between 0 and 100/);
  await service.removeRole(actor, 'c1', lina.id, db.roles.find((role) => role.personId === lina.id).id, {});
  assert.ok(lina.archivedAt, 'Removing the last role archives the person');
  assert.equal(db.audits.at(-1).metadata.action, 'CLIENT_PERSON_REMOVED');

  // Several passports per person.
  await service.addPassport(actor, 'c1', samer.id, { passportNumber: 'Q2222222', issuingCountry: 'Qatar', expiryDate: '2033-03-01' });
  await assert.rejects(service.addPassport(actor, 'c1', samer.id, { passportNumber: 'q2222222' }), /already listed/);
  const second = db.passports.find((item) => item.passportNumber === 'Q2222222');
  assert.equal(second.isPrimary, false, 'An extra passport does not replace the main one');
  await service.updatePassport(actor, 'c1', samer.id, second.id, { field: 'isPrimary', value: 'true' });
  assert.deepEqual(db.passports.filter((item) => item.personId === samer.id && item.isPrimary).map((item) => item.passportNumber), ['Q2222222']);
  assert.ok(db.expiry.some((item) => item.sourceKey === 'person:PASSPORT:Q2222222'));

  // ID copies are linked to the person record and update that passport.
  const file = { originalname: 'passport.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') };
  await service.uploadIdentityDocument(actor, 'c1', { personId: samer.id, identityType: 'PASSPORT', passportId: second.id, expiryDate: '2034-03-01' }, [file]);
  assert.equal(stored.at(-1).identity.personId, samer.id);
  assert.equal(stored.at(-1).identity.documentNumber, 'Q2222222');
  assert.equal(second.expiryDate.toISOString().slice(0, 10), '2034-03-01');
  await service.uploadIdentityDocument(actor, 'c1', { personId: samer.id, identityType: 'QID', documentNumber: '28240009999' }, [file]);
  assert.equal(samer.qidNumber, '28240009999');
  await assert.rejects(service.uploadIdentityDocument(actor, 'c1', { personId: corp.id, identityType: 'QID' }, [file]), /individuals/);
  await assert.rejects(service.uploadIdentityDocument(actor, 'c1', { personId: 'missing', identityType: 'QID' }, [file]), /no longer on the client profile/);

  // Re-KYC is prefilled from the records.
  assert.deepEqual(await service.startRekyc(actor, 'c1'), { id: 'k2', kycNumber: 'KYC-2026-0002' });
  assert.deepEqual(rekyc.source, { id: 'k1', kycNumber: 'KYC-2026-0001', serviceId: 'svc' });
  assert.equal(rekyc.form.sectionB.shareholders.find((row) => row.id === 's1').passportNumber, 'Q2222222', 'The re-KYC prints the main passport chosen on the client page');
  assert.equal(rekyc.form.sectionB.shareholders.find((row) => row.id === 's1').qidNumber, '28240009999');
  assert.ok(rekyc.form.sectionC.managers.find((row) => row.id === 'm1').position.includes('SEF'), 'A role added on the client page is in the re-KYC');
}

async function main() {
  checkMapping();
  await checkSeedAndExpiry();
  await checkCrExpiryFromKyc();
  await checkRekycMerge();
  checkRekycPrefill();
  await checkService();
  console.log('Client record checks passed: one person per individual across shareholder/UBO/officer/key-contact rows, seeding with earlier client-page edits and ID copies, expiry keys (QID, passports, national address, CR), re-KYC merge keeping later client-page edits and roles, re-KYC prefill from the records, audited edits with validation and tenant scoping, linking instead of duplicates, several passports per person (synthetic persistence).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
