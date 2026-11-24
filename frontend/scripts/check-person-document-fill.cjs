// Shared inline passport/QID autofill checks; synthetic data only.
const assert = require('node:assert/strict');
const esbuild = require('esbuild'); const Module = require('node:module'); const path = require('node:path');
const bundle = esbuild.buildSync({ entryPoints: ['frontend/src/utils/document-fill.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' }).outputFiles[0].text;
const filename = path.resolve('person-document-fill-check.cjs');
const unit = new Module(filename); unit.filename = filename; unit._compile(bundle, filename);
const { identityFill } = unit.exports;
const combined = {
  found: true, identityType: 'QID', typeMatches: true, documentNumber: '29000000001', documentNumberCheck: 'OK',
  expiryDate: '2027-02-14', expiryValid: true, dateOfBirth: '1990-01-01', nameOnDocument: 'SAMPLE PERSON', nationality: 'NEPAL', issuingCountry: '',
  qid: { number: '29000000001', expiry: '2027-02-14' }, passport: { number: 'SYN1234', expiry: '2036-01-12' }
};
for (const readFromText of [false, true]) {
  const filled = identityFill({}, { ...combined, readFromText }, 'QID').change;
  assert.equal(filled.qidNumber, combined.qid.number);
  assert.equal(filled.qidExpiry, combined.qid.expiry);
  assert.equal(filled.passportNumber, combined.passport.number);
  assert.equal(filled.passportExpiry, combined.passport.expiry);
  assert.equal(filled.dateOfBirth, combined.dateOfBirth);
  assert.equal(filled.fullName, 'Sample Person');
}
const sameNumberMissingExpiry = identityFill({ passportNumber: 'syn 1234' }, combined, 'QID').change;
assert.equal(sameNumberMissingExpiry.passportNumber, undefined, 'Keep the existing secondary number');
assert.equal(sameNumberMissingExpiry.passportExpiry, '2036-01-12', 'Fill missing secondary expiry for the same number');
const anotherPassport = identityFill({ passportNumber: 'MANUALLY-ENTERED', passportExpiry: '' }, combined, 'QID').change;
assert.equal(anotherPassport.passportNumber, undefined);
assert.equal(anotherPassport.passportExpiry, undefined, 'Do not attach an expiry to a different existing passport');
const passportFirst = identityFill({}, { ...combined, identityType: 'PASSPORT', documentNumber: 'SYN1234', expiryDate: '2036-01-12' }, 'PASSPORT').change;
assert.equal(passportFirst.qidNumber, combined.qid.number);
assert.equal(passportFirst.qidExpiry, combined.qid.expiry);
assert.equal(passportFirst.passportNumber, combined.passport.number);
assert.equal(passportFirst.passportExpiry, combined.passport.expiry);
assert.deepEqual(identityFill({}, { found: false, message: 'Unreadable' }, 'PASSPORT').change, {});
console.log('Inline identity checks passed: both numbers and distinct expiries, with/without printed-text marker, matching secondary expiry completion and conflicting secondary preservation.');
