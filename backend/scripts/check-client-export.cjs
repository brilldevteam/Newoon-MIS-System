const assert = require('node:assert/strict');
const { Workbook } = require('exceljs');
const { addClientDetailSheets, peopleForLevel } = require('../dist/compliance-clients/client-export');

// Client details in the register Excel export (2026-11-23, Phase 4): company details, people and legal documents.
// Synthetic data only; no database. Run from the repository root after `npm run build`:
//   node backend/scripts/check-client-export.cjs
const NOW = new Date('2026-11-23T00:00:00Z');
const clients = [{ id: 'c1', clientCode: 'CL-2026-0001', name: 'Synthetic W.L.L.' }, { id: 'c2', clientCode: 'CL-2026-0002', name: 'Second Co' }];
const entities = [{ clientId: 'c1', legalName: 'Synthetic Trading W.L.L.', commercialRegistrationNo: '04669', crExpiryDate: '2026-12-31', shareCapital: 'QAR 200,000', poBox: '123', financialYearEnd: '31 December', auditorName: 'Audit Partners', taxIdentificationNo: 'T04669' }];
const role = (name, extra = {}) => ({ id: `${name}-${Math.random()}`, role: name, title: '', percentage: null, viaPersonId: null, sourceSection: null, sourceRowId: null, ...extra });
const person = (over) => ({ id: 'p', clientId: 'c1', partyType: 'INDIVIDUAL', title: null, fullName: 'X', nationality: null, dualCitizenship: null, otherNationality: null, dateOfBirth: null, address: null, telephone: null, email: null, isPep: null, pepDetails: null, representedEntity: null, qidNumber: null, qidExpiry: null, nationalAddressExpiry: null, registrationNumber: null, linkedClientName: null, legacyIdentity: null, passports: [], roles: [], ...over });
const people = [
  person({
    id: 'p1', title: 'Sheikh', fullName: 'Samer Saleh', nationality: 'Jordan', dualCitizenship: true, otherNationality: 'Qatar', dateOfBirth: '1979-04-12', qidNumber: '28240002378', qidExpiry: '2026-12-20',
    passports: [{ id: 'a', passportNumber: 'U0668936', issuingCountry: 'Jordan', expiryDate: '2031-05-20', isPrimary: true }, { id: 'b', passportNumber: 'Q2222222', issuingCountry: 'Qatar', expiryDate: '2033-03-01', isPrimary: false }],
    isPep: true, pepDetails: 'Former adviser', telephone: '+97455550000', email: 'samer@example.invalid', representedEntity: 'Synthetic W.L.L.', nationalAddressExpiry: '2026-10-27',
    roles: [role('SHAREHOLDER', { percentage: '60' }), role('UBO', { percentage: '60' }), role('DIRECTOR'), role('AUTHORISED_SIGNATORY'), role('KEY_CONTACT'), role('CEO')]
  }),
  person({ id: 'p2', fullName: 'Parent Holdings S.A.', partyType: 'CORPORATE', registrationNumber: 'CR-77', roles: [role('SHAREHOLDER', { percentage: '40' })] }),
  person({ id: 'p3', fullName: 'Hidden Owner', passports: [{ id: 'c', passportNumber: 'LB1', issuingCountry: null, expiryDate: null, isPrimary: true }], roles: [role('UBO', { percentage: '40', viaPersonId: 'p2' })] }),
  person({ id: 'p4', clientId: 'c2', fullName: 'Hana Ali', roles: [role('SECRETARY')] })
];
const documents = [
  { clientId: 'c1', typeLabel: 'Commercial Registration Extract (English)', nature: 'COMPANY', documentNumber: '04669', holderName: 'Synthetic W.L.L.', location: 'Qatar', issueDate: null, expiryDate: '2026-12-31', personRoles: null, source: 'REGISTER' },
  { clientId: 'c1', typeLabel: 'Articles of Association', nature: 'COMPANY', documentNumber: null, holderName: 'Synthetic W.L.L.', location: 'Qatar', issueDate: null, expiryDate: null, personRoles: null, source: 'REGISTER' },
  { clientId: 'c1', typeLabel: 'National Address certificate', nature: 'INDIVIDUAL', documentNumber: null, holderName: 'Samer Saleh', location: 'Qatar', issueDate: null, expiryDate: '2026-10-27', personRoles: 'Shareholder', source: 'REGISTER' }
];

function build(level) {
  const workbook = new Workbook();
  const counts = addClientDetailSheets(workbook, { clients, entities, people, documents }, level, NOW);
  const read = (name) => {
    const sheet = workbook.getWorksheet(name);
    const headers = sheet.getRow(1).values.slice(1);
    const rows = [];
    sheet.eachRow((row, index) => { if (index > 1) rows.push(Object.fromEntries(headers.map((header, position) => [header, row.getCell(position + 1).value]))); });
    return { headers, rows };
  };
  return { counts, company: read('Company Details'), people: read('People'), documents: read('Legal Documents'), workbook };
}

function checkFull() {
  const { counts, company, people: peopleSheet, documents: docs } = build('FULL');
  assert.deepEqual(counts, { companyRows: 2, peopleRows: 4, documentRows: 7 }, 'Every client has a company row; one row per person; documents plus QID and passports');
  for (const header of ['Commercial Registration No', 'CR Expiry Date', 'Place of Incorporation', 'Share Capital', 'Tax Card No (TIN)', 'PO Box', 'Financial Year End', 'Approved Auditor', 'License Activities']) assert.ok(company.headers.includes(header), header);
  assert.equal(company.rows[0]['Commercial Registration No'], '04669', 'Leading zeros are kept');
  assert.equal(company.rows[0]['Share Capital'], 'QAR 200,000');
  assert.equal(company.rows[0]['CR Expiry Date'].toISOString().slice(0, 10), '2026-12-31');
  assert.equal(company.rows[1]['Legal Name of Company'], 'Second Co', 'A client without records still has a row, named after the client');

  const samer = peopleSheet.rows.find((row) => row['Full Name / Company'] === 'Samer Saleh');
  assert.equal(peopleSheet.rows.filter((row) => row['Full Name / Company'] === 'Samer Saleh').length, 1, 'A person with six roles is one row');
  assert.equal(samer['Designation'], 'Shareholder, UBO, Director, Authorised Signatory, Key Communication Person, CEO');
  assert.deepEqual([samer['Key Communication Person'], samer['Authorised Signatory'], samer['Shareholder %'], samer['UBO %'], samer['UBO Held Through']], ['Yes', 'Yes', 60, 60, 'Direct']);
  assert.deepEqual([samer['Title'], samer['Dual Citizenship'], samer['Other Nationality'], samer['PEP'], samer['PEP Details']], ['Sheikh', 'Yes', 'Qatar', 'Yes', 'Former adviser']);
  assert.deepEqual([samer['QID Number'], samer['Passport Number']], ['28240002378', 'U0668936']);
  assert.equal(samer['Other Passports'], 'Q2222222 (exp. 2033-03-01)', 'Extra passports are listed');
  assert.equal(samer['National Address Expiry'].toISOString().slice(0, 10), '2026-10-27');
  const corporate = peopleSheet.rows.find((row) => row['Full Name / Company'] === 'Parent Holdings S.A.');
  assert.deepEqual([corporate['Type'], corporate['CR / Registration No (companies)'], corporate['PEP'], corporate['Dual Citizenship']], ['Company', 'CR-77', '', '']);
  const hidden = peopleSheet.rows.find((row) => row['Full Name / Company'] === 'Hidden Owner');
  assert.equal(hidden['UBO Held Through'], 'Parent Holdings S.A.', 'A UBO held through a company names it');

  assert.deepEqual(docs.rows.slice(0, 2).map((row) => row['Nature']), ['Company', 'Company'], 'Company documents come first');
  const cr = docs.rows.find((row) => row['Document Type'].startsWith('Commercial Registration'));
  assert.deepEqual([cr['Number'], cr['Nationality / Location'], cr['Days Left'], cr['Status']], ['04669', 'Qatar', 38, 'Within 60 days']);
  assert.equal(docs.rows.find((row) => row['Document Type'] === 'National Address certificate')['Status'], 'Expired');
  assert.equal(docs.rows.find((row) => row['Document Type'] === 'Articles of Association')['Status'], '', 'A document without expiry shows none');
  assert.equal(docs.rows.filter((row) => row['Document Type'] === 'Passport').length, 3, 'Every passport is listed');
  assert.ok(docs.rows.some((row) => row['Document Type'] === 'QID' && row['Number'] === '28240002378'));
}

function checkLevels() {
  const ops = build('OPERATIONS');
  assert.ok(!ops.people.rows.some((row) => row['Full Name / Company'] === 'Hidden Owner'), 'Operations does not get people who are only UBOs');
  assert.ok(!ops.people.headers.includes('UBO %') && !ops.people.headers.includes('UBO Held Through'));
  assert.equal(ops.people.rows.find((row) => row['Full Name / Company'] === 'Samer Saleh')['Designation'].includes('UBO'), false, 'or the UBO role');
  assert.ok(ops.people.headers.includes('Passport Number'), 'Operations keeps passports');

  const allocated = build('ALLOCATED');
  for (const header of ['Passport Number', 'Passport Expiry', 'Other Passports', 'UBO %']) assert.ok(!allocated.people.headers.includes(header), header);
  assert.ok(!allocated.documents.rows.some((row) => row['Document Type'] === 'Passport'), 'Allocated staff get no passport rows');
  assert.ok(allocated.documents.rows.some((row) => row['Document Type'] === 'QID'));
  assert.equal(peopleForLevel(people.map((item) => ({ ...item })), 'ALLOCATED').every((item) => item.passports.length === 0), true);
  assert.equal(people[0].passports.length, 2, 'The source data is not changed');
}

checkFull();
checkLevels();
console.log('Client export checks passed: company, people and legal document sheets, all fields from the requirement documents, one row per person with every role, held-through, extra passports, document statuses, and Operations / allocated levels (synthetic data).');
