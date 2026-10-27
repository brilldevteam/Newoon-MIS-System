const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('frontend/src/pages/AddEnquiryPage.tsx', 'utf8');
const ast = ts.createSourceFile('AddEnquiryPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const validator = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'validateEnquiryStep');
assert.ok(validator, 'Contact step validator must exist');
const scope = {
  countryDialOptions: [{ name: 'Qatar', dialCode: '+974' }],
  resolveOtherValue: (value, other) => (value === 'Other' ? other.trim() : value.trim())
};
vm.createContext(scope);
vm.runInContext(ts.transpileModule(validator.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);

for (const enquiryType of ['PROPOSED_COMPANY', 'EXISTING_LEGAL_ENTITY']) {
  const form = {
    enquiryType, keyContactName: 'Example Contact', keyContactPhone: '+974 55551234',
    keyContactPhoneCountry: 'Qatar', keyContactPosition: 'Director', keyContactPositionOther: '',
    keyContactEmail: '', keyContactNationality: [], keyContactIdentityTypes: [],
    keyContactPassportNumber: '', keyContactQidNumber: '', keyContactPassportExpiryDate: '', keyContactQidExpiryDate: ''
  };
  const validate = (changes = {}) => scope.validateEnquiryStep({ ...form, ...changes }, 'contact');
  assert.equal(validate(), null, 'Only name, mobile and position are needed');
  assert.match(validate({ keyContactName: ' ' }), /full name is required/);
  for (const keyContactPhone of ['', ' ', '+974', '+974 ', 'abc']) {
    assert.match(validate({ keyContactPhone }), /mobile number is required/);
  }
  assert.match(validate({ keyContactPosition: '' }), /position is required/);
  assert.match(validate({ keyContactPosition: 'Other', keyContactPositionOther: ' ' }), /position is required/);
  assert.equal(validate({ keyContactPosition: 'Other', keyContactPositionOther: 'Consultant' }), null);
}
assert.equal(scope.validateEnquiryStep({ enquiryType: 'CURRENT_CLIENT_NEW_SERVICES' }, 'contact'), null);
assert.match(source, /<input required type="tel" value=\{form.keyContactPhone\}/);
assert.match(source, /<input type="email" value=\{form.keyContactEmail\}/);
console.log('Enquiry contact validation checks passed.');
