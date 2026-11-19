// Synthetic checks: a KYC made from a Preliminary KYC prints the Preliminary KYC's date when the KYC Date is empty.
// No database, credentials or client records are used. Run from the repository root after `npm run build`.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const PizZip = require('pizzip');
const { KycService } = require('../dist/kyc/kyc.service');
const { exportKycDocx, exportKycHtml } = require('../dist/kyc/export');

async function main() {
  const service = Object.create(KycService.prototype);
  const form = (sectionA, preliminaryKyc) => ({
    id: 'form', tenantId: 'a', kycCaseId: 'case', version: 1,
    sections: [{ sectionKey: 'GENERAL_COMPANY', data: { formVariant: preliminaryKyc ? 'PRELIMINARY_PROPOSED_COMPANY' : undefined, legalName: 'Synthetic Date Test LLC', ...sectionA } }],
    shareholders: [], ubos: [], managers: [], requiredDocuments: [], generatedDocuments: [],
    kycCase: { kycNumber: 'KYC-2026-0099', legalDocuments: [], sourceEnquiry: preliminaryKyc ? { details: { preliminaryKyc } } : null }
  });
  const preliminary = { companyName: 'Synthetic Date Test LLC', completedAt: '2026-11-19T08:30:00.000Z', shareholders: [], declaration: {} };

  // Converted from a Preliminary KYC, KYC Date never entered: use the Preliminary KYC date.
  const converted = service.serializeForm(form({}, preliminary));
  assert.equal(converted.sectionA.date, '2026-11-19');
  assert.equal(preliminary.date, undefined, 'Do not mutate the stored Preliminary KYC');
  // The Preliminary KYC copied into Section A at conversion is used too.
  assert.equal(service.serializeForm(form({ preliminaryKyc: preliminary }, null)).sectionA.date, '2026-11-19');
  // An entered KYC date always wins.
  assert.equal(service.serializeForm(form({ date: '2026-12-01' }, preliminary)).sectionA.date, '2026-12-01');
  // Standard KYC without a Preliminary KYC, and a Preliminary KYC not yet completed: unchanged (blank).
  assert.equal(service.serializeForm(form({}, null)).sectionA.date, '');
  assert.equal(service.serializeForm(form({}, { ...preliminary, completedAt: undefined })).sectionA.date, '');
  // The client declaration date is not invented: an unfilled declaration stays blank.
  assert.equal(converted.sectionG.date || '', '');

  const html = await exportKycHtml(converted, 1);
  assert.ok(html.includes('Date: 19/11/2026'), 'Letter date at the top of the export');
  assert.ok(html.includes('2026-11-19'), 'Section A date in the export');
  const docx = await exportKycDocx(converted, 1);
  const xml = new PizZip(docx).file('word/document.xml').asText();
  assert.ok(xml.includes('19/11/2026') && xml.includes('2026-11-19'), 'DOCX prints the letter date and the Section A date');

  const output = path.join(os.tmpdir(), 'newoon-kyc-date-preview'); fs.mkdirSync(output, { recursive: true });
  // Preview copies only; a copy left open in Word (locked) must not fail the check.
  for (const [name, content] of [['kyc-date.docx', docx], ['kyc-date.html', html]]) {
    try { fs.writeFileSync(path.join(output, name), content); } catch (error) { console.warn(`Preview ${name} not written (${error.code || error.message}); close it if it is open.`); }
  }
  console.log(`KYC export date checks passed: Preliminary KYC date fallback, entered date wins, standard KYC unchanged, declaration not invented, HTML and DOCX. Synthetic previews: ${output}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
