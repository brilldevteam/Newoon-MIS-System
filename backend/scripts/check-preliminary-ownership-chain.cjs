// Synthetic regression checks for multi-level (parent company) ownership on the preliminary KYC enquiry form.
// No database, credentials or client records are used. Run from the repository root after `npm run build`.
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const chain = require('../dist/common/preliminary-ownership-chain');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');
const { preliminaryPdfHtml } = require('../dist/enquiries/preliminary-pdf');

// The frontend copy must behave identically; bundle it and run the same fixtures through both.
const bundle = esbuild.buildSync({ entryPoints: ['frontend/src/utils/preliminary-ownership-chain.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const frontendModule = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(frontendModule, frontendModule.exports);
const frontendChain = frontendModule.exports;

const company = (id, fullName, ownershipPercentage, parentRowId = '') => ({ id, shareholderType: 'Corporate Entity', fullName, ownershipPercentage, parentRowId, nationality: 'United Kingdom', identityNumber: `CR-${id}`, address: 'United Kingdom', isUbo: false });
const person = (id, fullName, ownershipPercentage, extra = {}) => ({ id, shareholderType: 'Individual', fullName, ownershipPercentage, parentRowId: '', nationality: 'Qatar', identityNumber: `P-${id}`, address: 'Qatar', isUbo: false, ...extra });
// Synthetic four-level chain: client <- Direct Holding (100%) <- Middle Holdco (100%) <- Top Parent Inc (100%) <- person 38.7%.
const sample = () => [
  company('top', 'Top Parent Inc', '100', 'mid'),
  company('direct', 'Direct Holding Ltd', '100'),
  company('mid', 'Middle Holdco LLC', '100', 'direct')
];
const ubo = { id: 'ubo', fullName: 'Sample Beneficial Owner', identityNumber: 'P-UBO', parentRowId: 'top', ownershipPercentage: '38.7', uboPercentage: '38.7' };

for (const [label, api] of [['backend', chain], ['frontend', frontendChain]]) {
  const rows = sample();
  assert.equal(api.chainParentId(rows[0], rows), 'mid', `${label}: parent company link`);
  assert.equal(api.chainParentId(rows[1], rows), '', `${label}: direct shareholder`);
  assert.equal(api.directOwnershipTotal(rows), 100, `${label}: only direct shareholders count towards 100%`);
  assert.deepEqual(api.ownershipChainOrder(rows).map(({ row, number, depth }) => [row.id, number, depth]), [['direct', '1', 0], ['mid', '1.1', 1], ['top', '1.1.1', 2]], `${label}: chain order and numbering`);
  assert.equal(api.shareholderOfLabel(rows[0], rows), 'Middle Holdco LLC');
  assert.equal(api.shareholderOfLabel(rows[1], rows), 'Client company');
  assert.equal(api.indirectUboPercentage('38.7', 'top', rows), '38.7', `${label}: 38.7% x 100% x 100% x 100%`);
  const partial = [company('direct', 'Direct Holding Ltd', '60'), person('p2', 'Other Owner', '40'), company('mid', 'Middle Holdco LLC', '50', 'direct')];
  assert.equal(api.indirectUboPercentage('80', 'mid', partial), '24', `${label}: 80% x 50% x 60%`);
  assert.equal(api.indirectUboPercentage('80', 'mid', [company('direct', 'D', ''), company('mid', 'M', '50', 'direct')]), '', `${label}: missing percentage gives no calculation`);
  assert.deepEqual([...api.ownersAndSelfIds('direct', rows)].sort(), ['direct', 'mid', 'top'], `${label}: a company cannot be placed under its own owners`);
  // Circular, self, missing and non-company links fall back to direct shareholders instead of looping.
  const circular = [company('a', 'A', '100', 'b'), company('b', 'B', '100', 'a')];
  assert.equal(api.chainParentId(circular[0], circular), '', `${label}: circular link`);
  assert.equal(api.ownershipChainOrder(circular).length, 2, `${label}: circular rows still listed once`);
  assert.equal(api.chainParentId(company('self', 'S', '100', 'self'), [company('self', 'S', '100', 'self')]), '');
  assert.equal(api.chainParentId(company('x', 'X', '100', 'missing'), [company('x', 'X', '100', 'missing')]), '');
  const personParent = [person('pp', 'Person', '100'), company('c', 'C', '50', 'pp')];
  assert.equal(api.chainParentId(personParent[1], personParent), '', `${label}: a person cannot be a parent company target`);
  assert.equal(api.chainParentId({ ...person('ind', 'Person', '10'), parentRowId: 'direct' }, rows), '', `${label}: individuals stay direct shareholders`);
  // The client's video: a second direct company shareholder pushes the direct total to 200%.
  assert.equal(api.directOwnershipTotal([...rows, company('abc', 'abc', '100')]), 200);
  assert.equal(api.directOwnershipTotal([company('d', 'D', '50%'), company('e', 'E', '50,0')]), 100, `${label}: same percentage leniency as the API`);
  assert.deepEqual(api.overOwnedCompanies(rows, [ubo]), [], `${label}: 100% + 38.7% UBO in different companies is fine`);
  assert.deepEqual(api.overOwnedCompanies([...rows, company('extra', 'Extra Parent', '30', 'mid')], []), [{ name: 'Middle Holdco LLC', total: 130 }], `${label}: owners of one company above 100%`);
  assert.deepEqual(api.overOwnedCompanies(rows, [{ ...ubo, ownershipPercentage: '5' }, { ...ubo, id: 'u2', parentRowId: 'direct', ownershipPercentage: '10' }]).map((item) => item.name), ['Direct Holding Ltd'], `${label}: linked beneficial owners count towards a company's owners`);
}

const enquiry = Object.create(EnquiriesService.prototype);
const base = { companyName: 'Example Proposed LLC', proposedLegalForm: 'LLC', jurisdiction: 'QFC', businessActivity: 'Consulting', registeredOfficeAddress: 'Example office', sourceOfFunds: 'Capital', management: [{ fullName: 'Example Manager', position: 'Director' }], documents: [{ available: true }] };
assert.doesNotThrow(() => enquiry.assertCompletePreliminaryKyc({ ...base, shareholders: sample(), ubos: [ubo] }), 'Four-level chain submits');
assert.throws(() => enquiry.assertCompletePreliminaryKyc({ ...base, shareholders: [...sample(), company('abc', 'abc', '100')], ubos: [] }), /Direct shareholder ownership must total 100%. Current total: 200.00%/);
assert.throws(() => enquiry.assertCompletePreliminaryKyc({ ...base, shareholders: [...sample(), company('extra', 'Extra Parent', '30', 'mid')], ubos: [] }), /Owners of Middle Holdco LLC add up to 130.00%/);
assert.throws(() => enquiry.assertCompletePreliminaryKyc({ ...base, shareholders: [...sample(), company('bad', 'Bad Parent', '101', 'mid')], ubos: [] }), /between 0 and 100/);
assert.throws(() => enquiry.assertCompletePreliminaryKyc({ ...base, shareholders: [...sample(), company('blank', '', '', 'mid')], ubos: [] }), /name and ownership percentage/);

// Saving keeps valid parent links and clears circular, missing or non-company ones.
const saved = enquiry.preliminaryKycData({ shareholders: [...sample(), company('loop1', 'Loop One', '100', 'loop2'), company('loop2', 'Loop Two', '100', 'loop1'), company('lost', 'Lost', '10', 'missing'), { ...person('ind', 'Individual', '0'), parentRowId: 'direct' }], ubos: [ubo] }, { proposedCompanyName: 'Example', details: {} });
const parentOf = Object.fromEntries(saved.shareholders.map((row) => [row.id, row.parentRowId]));
assert.deepEqual(parentOf, { top: 'mid', direct: '', mid: 'direct', loop1: '', loop2: '', lost: '', ind: '' });
assert.equal(saved.ubos[0].parentRowId, 'top');

const html = preliminaryPdfHtml({ ...base, shareholders: sample(), ubos: [ubo] });
for (const text of ['Shareholder of', '<td>1.1.1</td><td>Top Parent Inc</td>', '<td>Middle Holdco LLC</td><td>100</td>', 'Total direct ownership %: 100.00%', '<td>Sample Beneficial Owner</td><td>Top Parent Inc</td>', 'Total UBO %: 38.70%']) {
  assert.ok(html.includes(text), `Preliminary PDF HTML should include ${text}`);
}
assert.ok(html.indexOf('Direct Holding Ltd') < html.indexOf('Middle Holdco LLC') && html.indexOf('Middle Holdco LLC') < html.indexOf('<td>Top Parent Inc</td>'), 'PDF lists the chain top-down from the direct shareholder');

console.log('Preliminary ownership chain checks passed: helpers (backend/frontend parity), submit rules, save sanitizing and PDF Section B.');
