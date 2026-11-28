const assert = require('node:assert/strict');
const { documentPeopleRows } = require('../dist/enquiries/document-people');
const rows = documentPeopleRows([
  { id: 'a', files: ['a.pdf'], row: { fullName: 'Owner One', qidNumber: '20000000001', nationality: 'Qatar' }, positions: ['Shareholder', 'UBO', 'Director'] },
  { id: 'b', files: ['b.pdf'], row: { fullName: 'Ubo Only', passportNumber: 'SYN1' }, positions: ['UBO'] },
  { id: 'c', files: ['c.pdf'], row: { fullName: 'Contact Only' }, positions: ['Contact Person'] },
  { id: 'd', files: ['d.pdf'], row: {}, positions: ['Director'] }
]);
assert.equal(rows.shareholders.length, 1); assert.equal(rows.shareholders[0].isUbo, true);
assert.equal(rows.shareholders[0].identityNumber, 'QID: 20000000001');
assert.equal(rows.ubos.length, 1); assert.equal(rows.ubos[0].fullName, 'Ubo Only');
assert.equal(rows.management.length, 1); assert.equal(rows.management[0].position, 'Director');
assert.deepEqual(documentPeopleRows('nope'), { shareholders: [], ubos: [], management: [] });
console.log('Enquiry document people checks passed.');
