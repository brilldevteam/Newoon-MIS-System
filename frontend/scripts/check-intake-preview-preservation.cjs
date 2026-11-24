// Locks the preview state approved before the document-inbox feature. This is not export visual certification.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const crypto = require('node:crypto'); const { execFileSync } = require('node:child_process');
const digest = text => crypto.createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
const expected = {
  'frontend/src/components/PreliminaryKycDocument.tsx': 'e33b4750401cb452e37989e17cb187bd59c521661a78c17d3137e17d44e78849',
  'frontend/src/components/DocumentPreviewFrame.tsx': 'a139695860702516b59e2fecf9083226b575b2641f76eddb598a73d7340080d9',
  'frontend/src/components/OwnershipStructureDiagram.tsx': '177d69e037f323e051cb76732f4cdc34a8a7374ec7aadcd6b7b09a347aca8bac'
};
for (const [file, hash] of Object.entries(expected)) assert.equal(digest(fs.readFileSync(file, 'utf8')), hash, `${file} changed since the preview-only update`);
const page = fs.readFileSync('frontend/src/pages/KycFormEditorPage.tsx', 'utf8').replace(/\r\n/g, '\n');
assert.equal(digest(page.slice(page.indexOf('export function LiveDocumentPreviewPanel('), page.indexOf('type FormProps ='))), '7c5f96239ff1ad2fb970c64310bc4ec6ba6dd8fc5dd78ddced57cb689f855a5f', 'Live KYC preview rendering changed');
const backend = execFileSync('git', ['diff', '28e0003', '--', 'backend/src', 'backend/prisma', 'frontend/src/services'], { encoding: 'utf8' });
assert.equal(backend, '', 'The inbox feature must not change backend/export/schema or API service implementations');
console.log('Preview preservation checks passed: existing document/diagram components and live KYC renderer unchanged; backend, export, schema and API wrappers unchanged from 28e0003.');
