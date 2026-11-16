const assert = require('node:assert/strict');
const { isOwnOrigin } = require('../dist/common/security/same-origin');

// Run after `npm run build`: node backend/scripts/check-same-origin.cjs
assert.equal(isOwnOrigin('https://mis-test.newoon.com', 'mis-test.newoon.com'), true, 'The site\'s own pages are allowed');
assert.equal(isOwnOrigin('http://localhost:5000', 'localhost:5000'), true);
assert.equal(isOwnOrigin('http://LOCALHOST:5000', 'localhost:5000'), true, 'Host comparison ignores case');
assert.equal(isOwnOrigin('http://localhost:5000', 'localhost:5173'), false, 'A different port is a different origin');
assert.equal(isOwnOrigin('https://evil.example', 'mis-test.newoon.com'), false, 'Other sites are refused');
assert.equal(isOwnOrigin('https://mis-test.newoon.com.evil.example', 'mis-test.newoon.com'), false, 'Lookalike hosts are refused');
assert.equal(isOwnOrigin('https://evil.example', undefined), false, 'No Host header means no match');
assert.equal(isOwnOrigin('null', 'mis-test.newoon.com'), false, 'Opaque origins are refused');
assert.equal(isOwnOrigin('file://mis-test.newoon.com', 'mis-test.newoon.com'), false, 'Only http(s) origins can match');
console.log('Same-origin CORS checks passed.');
