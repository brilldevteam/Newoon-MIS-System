// Synthetic check: positions chosen on the Attachments step are written to the enquiry's people rows.
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const out = esbuild.buildSync({ entryPoints: ['frontend/src/utils/attachment-people.ts'], bundle: true, write: false, format: 'cjs', platform: 'node' }).outputFiles[0].text;
const mod = { exports: {} }; new Function('module', 'exports', out)(mod, mod.exports);
const { placePerson, attachmentPositionOptions } = mod.exports;
for (const position of ['UBO', 'Secretary', 'Contact Person', 'Shareholder', 'Director', 'Manager']) assert.ok(attachmentPositionOptions.includes(position), position);
const layout = {
  newShareholder: () => ({ id: 's' + Math.random(), shareholderType: 'Individual', fullName: '', nationality: '', identityNumber: '', ownershipPercentage: '', isUbo: false }),
  newOfficer: () => ({ id: 'm' + Math.random(), fullName: '', identityNumber: '', nationality: '', position: '', positions: [] }),
  setPositions: (row, positions) => ({ ...row, positions, position: positions.join(', ') }),
  positionsOf: (row) => row.positions || [],
  nationality: (value) => value
};
const person = { id: 'p1', files: ['a.pdf'], row: { fullName: 'Sample Person', qidNumber: '20000000001', passportNumber: 'SYN12345', nationality: 'Qatar' } };
const empty = { shareholders: [layout.newShareholder()], ubos: [], management: [layout.newOfficer()] };
let r = placePerson(empty, person, ['Shareholder', 'UBO', 'Director', 'Secretary', 'Contact Person'], layout);
assert.equal(r.shareholders.length, 1); assert.equal(r.shareholders[0].fullName, 'Sample Person'); assert.equal(r.shareholders[0].isUbo, true);
assert.equal(r.shareholders[0].identityNumber, 'QID: 20000000001 / Passport: SYN12345');
assert.equal(r.ubos.length, 0, 'A shareholder UBO is flagged on the shareholder, not duplicated');
assert.deepEqual(r.management[0].positions, ['Director', 'Secretary']); assert.equal(r.management.length, 1); assert.equal(r.contact, true);
// Changing positions again reuses the same rows.
r = placePerson(r, person, ['UBO', 'Manager'], layout);
assert.equal(r.shareholders.length, 0, 'No longer a shareholder: the untouched row is removed');
assert.equal(r.ubos.length, 1); assert.deepEqual(r.management[0].positions, ['Manager']); assert.equal(r.management.length, 1);
// Typed ownership data is never removed.
const typed = { shareholders: [{ ...layout.newShareholder(), fullName: 'Sample Person', qidNumber: '20000000001', ownershipPercentage: '40' }], ubos: [], management: [] };
r = placePerson(typed, person, [], layout);
assert.equal(r.shareholders.length, 1, 'A row with a percentage stays');
console.log('Attachment people checks passed: UBO / Secretary / Contact Person options, shareholder+UBO flag, management positions, re-placement, typed rows kept.');
