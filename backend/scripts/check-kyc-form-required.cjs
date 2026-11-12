// Required KYC form details before Submit to DMLRO (2026-11-12).
// Build first (npm run build), then: node backend/scripts/check-kyc-form-required.cjs
const assert = require('node:assert/strict');
const { kycFormCompletenessIssues, kycFormCompletenessMessage } = require('../dist/common/kyc-form-completeness');

const complete = () => ({
  fullKycStarted: false,
  sectionA: {
    legalName: 'Synthetic Co', commercialRegistrationNo: '12345', dateOfIncorporation: '2020-01-01', countryOfIncorporation: 'Qatar',
    legalForm: 'LLC', registeredOfficeAddress: 'Doha', telephone: '+974 5555 1234', email: 'info@example.invalid',
    businessNature: 'Trading', relatedIndustry: 'Finance', prospectiveService: ['N001 - Secretary']
  },
  sectionB: { shareholders: [
    { id: 'p1', fullName: 'Holding Co', shareholderType: 'Corporate Entity', nationality: ['Qatar'], identityNumber: 'CR1', shareholderPercentage: '60' },
    { id: 'p2', fullName: 'Owner One', shareholderType: 'Individual', nationality: ['India'], identityNumber: 'P1', shareholderPercentage: '40', isUbo: true },
    { id: 'p3', fullName: 'Owner Two', shareholderType: 'Individual', nationality: ['Qatar'], identityNumber: 'Q2', shareholderPercentage: '100', parentRowId: 'p1', isUbo: true }
  ], ubos: [] },
  sectionC: { managers: [{ fullName: 'Manager One', position: 'Director', nationality: 'Qatar', identityNumber: 'Q9', isAuthorizedSignatory: true }] },
  sectionE: { fullName: 'Contact', position: ['Manager'], mobileNumber: '+974 5555 9999', email: 'contact@example.invalid' },
  sectionG: { fullName: 'Signer', position: 'Director', date: '2026-11-12', signatureDataUrl: 'data:image/png;base64,AAAA' }
});

function sections(form) { return kycFormCompletenessIssues(form).map((issue) => issue.section); }

async function main() {
  assert.deepEqual(kycFormCompletenessIssues(complete()), [], 'A complete form has no gaps');

  // Each section reports its own gaps, by name.
  let form = complete();
  form.sectionA = { ...form.sectionA, email: 'not-an-email', telephone: '+974 ', commercialRegistrationNo: '', relatedIndustry: '' };
  let issues = kycFormCompletenessIssues(form);
  assert.deepEqual(issues[0].missing, ['Commercial Registration No.', 'Telephone', 'Email (a valid address)', 'Related Industry']);

  form = complete();
  form.sectionC.managers = [{ fullName: 'No Details', isAuthorizedSignatory: false }];
  issues = kycFormCompletenessIssues(form);
  assert.equal(issues[0].title, 'B. Managers / Signatories');
  assert.ok(issues[0].missing.some((text) => /Person "No Details": position, nationality, QID \/ Passport No\./.test(text)));
  assert.ok(issues[0].missing.some((text) => /Authorized signatory/.test(text)));
  form.sectionC.managers = [];
  assert.match(kycFormCompletenessIssues(form)[0].missing[0], /at least one manager/);

  form = complete();
  form.sectionB.shareholders[1].shareholderPercentage = '30';
  form.sectionB.shareholders[2].identityNumber = '';
  issues = kycFormCompletenessIssues(form);
  assert.equal(issues[0].title, 'C. Shareholders');
  assert.ok(issues[0].missing.some((text) => /Shareholder "Owner Two": QID \/ Passport number/.test(text)));
  assert.ok(issues[0].missing.some((text) => /total 100% \(now 90%\)/.test(text)), 'Only direct shareholders count toward 100%');

  form = complete();
  form.sectionB.shareholders.forEach((row) => { row.isUbo = false; });
  assert.ok(kycFormCompletenessIssues(form)[0].missing.some((text) => /beneficial owner/.test(text)));
  form.sectionB.ubos = [{ fullName: 'Manual UBO' }];
  assert.deepEqual(sections(form), [], 'A UBO added in the UBO list counts');

  form = complete();
  form.sectionE = { fullName: 'Contact' };
  form.sectionG = { fullName: 'Signer', positionOther: 'Chairman' };
  issues = kycFormCompletenessIssues(form);
  assert.deepEqual(issues.map((issue) => issue.section), ['sectionE', 'sectionG']);
  assert.deepEqual(issues[1].missing, ['Date', 'Authorized signature'], 'An "Other" position text counts');

  // Preliminary forms keep their own rules until the full KYC is started.
  form = { ...complete(), sectionA: { formVariant: 'PRELIMINARY_PROPOSED_COMPANY' } };
  assert.deepEqual(kycFormCompletenessIssues(form), []);
  assert.ok(kycFormCompletenessIssues({ ...form, fullKycStarted: true }).length > 0);

  assert.match(kycFormCompletenessMessage(kycFormCompletenessIssues({ ...complete(), sectionE: {} })), /^E\. Key Communication Person: Full name; Position \/ Job title; Mobile Number; Email \(a valid address\)\.$/);
  console.log('KYC required-details checks passed: A company details, B managers and signatory, C shareholders / 100% / UBO, E contact, G declaration, preliminary exemption and plain messages.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
