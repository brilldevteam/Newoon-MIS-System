// Ministry of Commerce "Summary of commercial registry info" CR (synthetic names and numbers).
const assert = require('node:assert/strict');
const lines = require('./fixtures/moci-cr-layout.json');
const { parseDocumentText } = require('../dist/compliance-clients/document-text-parser');
const text = lines.map((line) => line.map((cell) => cell.text).join(' ')).join('\n');
const out = parseDocumentText('CR_EXTRACT_EN', text, lines);
assert.deepEqual(out.company, {
  commercialRegistrationNo: '100001', legalForm: 'LLC', legalName: 'SAMPLE TRADING SERVICES', shareCapital: '200000', crExpiryDate: '2027-02-22',
  dateOfIncorporation: '2022-02-23', countryOfIncorporation: 'Qatar', taxIdentificationNo: '5000000001',
  licenseActivities: "Performing arts and music schools (854213); Women's Massage and Relaxation Salon (960922)"
});
assert.equal(out.document.expiryDate, '2027-02-22');
assert.deepEqual(out.people.map((p) => [p.fullName, p.roles.join('+'), p.sharePercentage, p.nationality, p.idNumber]), [
  ['ALPHA OWNER ONE SAMPLE', 'SHAREHOLDER+MANAGER', '51', 'Qatar', '29000000001'],
  ['BETA OWNER TWO EXAMPLE', 'SHAREHOLDER+MANAGER', '49', 'Philippines', '28000000002']
]);
console.log('MOCI CR reading checks passed: name, legal form, number, capital, dates, tax number, activities, owners and managers.');
