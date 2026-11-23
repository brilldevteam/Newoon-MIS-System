// Synthetic checks (2026-11-23, Phase 5): per-person title, dual citizenship and PEP on the KYC form rows; the printed
// KYC shows the title with the name and lists PEP / dual-citizenship people under Section D; the answers flow into the
// client records and back into a re-KYC. No database. Run from the repository root after `npm run build`.
const assert = require('node:assert/strict');
const PizZip = require('pizzip');
const { KycService } = require('../dist/kyc/kyc.service');
const { exportKycDocx, exportKycHtml } = require('../dist/kyc/export');
const { profileFromForm } = require('../dist/compliance-clients/compliance-client-profile');
const records = require('../dist/compliance-clients/client-records');

const service = Object.create(KycService.prototype);
const form = (overrides = {}) => ({
  id: 'form', tenantId: 'a', kycCaseId: 'case', version: 1,
  sections: [
    { sectionKey: 'GENERAL_COMPANY', data: { legalName: 'Synthetic Declarations LLC' } },
    { sectionKey: 'OWNERSHIP', data: { shareholders: [{ id: 's1', fullName: 'Samer Saleh', shareholderType: 'Individual', title: 'Sheikh', dualCitizenship: 'Yes', otherNationality: 'Qatar', isPep: 'No', shareholderPercentage: 100, isUbo: true, nationality: ['Jordan'], qidNumber: '28240002378', qidExpiry: '2029-01-01' }], ubos: [] } },
    { sectionKey: 'COMPLIANCE_RISK', data: { pepQuestion: 'No', dualCitizenshipQuestion: 'No', ...overrides.sectionD } },
    { sectionKey: 'COMMUNICATION_PERSON', data: { fullName: 'Hana Ali', title: 'Ms', isPep: 'Yes', pepDetails: 'Former official', ...overrides.sectionE } }
  ],
  shareholders: [], ubos: [], requiredDocuments: [], generatedDocuments: [],
  managers: [{ id: 'm1', fullName: 'Omar Said', title: 'Mr', position: 'Chairman', dualCitizenship: 'No', isPep: 'Yes', pepDetails: 'Municipal board', isAuthorizedSignatory: true, nationality: 'Egypt', qidExpiry: new Date('2030-01-01') }],
  kycCase: { kycNumber: 'KYC-2026-0098', legalDocuments: [], sourceEnquiry: null }
});

async function main() {
  const serialized = service.serializeForm(form());
  const html = await exportKycHtml(serialized, 1);
  assert.ok(html.includes('Sheikh Samer Saleh'), 'Shareholder name is printed with the title');
  assert.ok(html.includes('Mr Omar Said'), 'Manager name is printed with the title');
  assert.ok(html.includes('Ms Hana Ali'), 'Key contact name is printed with the title');
  assert.ok(html.includes('PEP (by person)') && html.includes('Mr Omar Said; Ms Hana Ali'), 'PEP people are listed under Section D');
  assert.ok(html.includes('Dual citizenship (by person)') && html.includes('Sheikh Samer Saleh'), 'Dual citizens are listed under Section D');
  assert.ok(!html.includes('2029-01-01') && !html.includes('2030-01-01'), 'QID / passport expiry dates are not printed');
  const xml = new PizZip(await exportKycDocx(serialized, 1)).file('word/document.xml').asText();
  assert.ok(xml.includes('Sheikh Samer Saleh') && xml.includes('PEP (by person)'), 'The Word file prints the same');

  // A KYC without the new answers prints exactly as before: no extra rows.
  const plain = service.serializeForm({ ...form(), sections: [{ sectionKey: 'GENERAL_COMPANY', data: { legalName: 'Plain LLC' } }, { sectionKey: 'COMPLIANCE_RISK', data: { pepQuestion: 'No' } }], managers: [], kycCase: { kycNumber: 'KYC-2026-0097', legalDocuments: [], sourceEnquiry: null } });
  const plainHtml = await exportKycHtml(plain, 1);
  assert.ok(!plainHtml.includes('PEP (by person)') && !plainHtml.includes('Dual citizenship (by person)'), 'No per-person rows without per-person answers');

  // The profile reads the answers from every kind of person row ...
  const profile = profileFromForm(serialized);
  const samer = profile.shareholders[0];
  assert.deepEqual([samer.title, samer.dualCitizenship, samer.otherNationality, samer.isPep], ['Sheikh', 'Yes', 'Qatar', 'No']);
  assert.deepEqual([profile.officers[0].title, profile.officers[0].isPep, profile.officers[0].pepDetails], ['Mr', 'Yes', 'Municipal board']);
  assert.deepEqual([profile.keyContact.title, profile.keyContact.isPep], ['Ms', 'Yes']);
  // ... and they become person records (Yes / No as booleans) with the new designations as roles.
  const { people } = records.draftsFromProfile(profile);
  const omar = people.find((person) => person.fullName === 'Omar Said');
  assert.deepEqual([omar.values.title, omar.values.isPep, omar.values.pepDetails], ['Mr', 'Yes', 'Municipal board']);
  assert.deepEqual(omar.roles.map((role) => role.role).sort(), ['AUTHORISED_SIGNATORY', 'CHAIRMAN']);
  // Conflicting answers for the same person on two rows: Yes wins for PEP and dual citizenship.
  const conflict = profileFromForm(service.serializeForm({
    ...form(),
    sections: [{ sectionKey: 'GENERAL_COMPANY', data: { legalName: 'C' } }, { sectionKey: 'OWNERSHIP', data: { shareholders: [{ id: 's9', fullName: 'Same Person', shareholderType: 'Individual', isPep: 'No', dualCitizenship: 'Yes', qidNumber: '1' }], ubos: [] } }],
    managers: [{ id: 'm9', fullName: 'Same Person', position: 'Director', isPep: 'Yes', dualCitizenship: 'No', qidNumber: '1' }]
  }));
  const merged = records.draftsFromProfile(conflict).people.filter((person) => person.fullName === 'Same Person');
  assert.equal(merged.length, 1);
  assert.deepEqual([merged[0].values.isPep, merged[0].values.dualCitizenship], ['Yes', 'Yes'], 'A Yes on either row wins');
  assert.deepEqual(records.positionRoles(['Shareholder', 'UBO', 'CEO', 'COO', 'Managing Director'], false).map((item) => item.role).sort(), ['CEO', 'COO', 'MANAGING_DIRECTOR', 'SHAREHOLDER', 'UBO']);

  // Back from the records into a re-KYC: client-page changes (edited) win, untouched rows keep their own values.
  const person = (over) => ({ id: 'x', partyType: 'INDIVIDUAL', title: null, fullName: '', nationality: null, dualCitizenship: null, otherNationality: null, dateOfBirth: null, address: null, telephone: null, email: null, isPep: null, pepDetails: null, representedEntity: null, qidNumber: null, qidExpiry: null, nationalAddressExpiry: null, registrationNumber: null, linkedClientName: null, legacyIdentity: null, passports: [], roles: [], ...over });
  const role = (name, extra = {}) => ({ id: `${name}-r`, role: name, title: '', percentage: null, viaPersonId: null, sourceSection: null, sourceRowId: null, ...extra });
  const rekyc = records.formFromRecords(serialized, null, [
    person({ id: 'a', fullName: 'Samer Saleh', title: 'Dr', dualCitizenship: false, isPep: true, pepDetails: 'Added later', edited: ['title', 'dualCitizenship', 'isPep', 'pepDetails'], roles: [role('SHAREHOLDER', { percentage: '100', sourceSection: 'SHAREHOLDER', sourceRowId: 's1' })] }),
    person({ id: 'b', fullName: 'Omar Said', title: 'Mr', isPep: false, roles: [role('CHAIRMAN', { sourceSection: 'OFFICER', sourceRowId: 'm1' })] })
  ]);
  const s1 = rekyc.sectionB.shareholders[0];
  assert.deepEqual([s1.title, s1.dualCitizenship, s1.isPep, s1.pepDetails], ['Dr', 'No', 'Yes', 'Added later'], 'Edited values go back to the form as Yes / No text');
  assert.equal(rekyc.sectionC.managers[0].isPep, 'Yes', 'An unedited row keeps its own answer');

  console.log('KYC person declaration checks passed: title with names, PEP / dual citizenship by person under Section D, no expiry dates printed, unchanged output without answers, profile and record sync, new designations, re-KYC prefill (synthetic).');
}

main().catch((error) => { console.error(error); process.exit(1); });
