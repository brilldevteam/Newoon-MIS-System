const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const puppeteer = require('puppeteer-core');
const PizZip = require('pizzip');
const { KycService } = require('../dist/kyc/kyc.service');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');
const { preliminaryPdfHtml } = require('../dist/enquiries/preliminary-pdf');
const { exportKycDocx, exportKycHtml } = require('../dist/kyc/export');
async function main() {
  const number = 'KYC-2026-0042';
  const source = { companyName: 'Synthetic Number Test', completedAt: '2026-11-01', shareholders: [], declaration: {} };
  const form = { id: 'form', tenantId: 'a', kycCaseId: 'case', version: 1, sections: [{ sectionKey: 'GENERAL_COMPANY', data: { formVariant: 'PRELIMINARY_PROPOSED_COMPANY', reference: 'stale', legalName: source.companyName } }], shareholders: [], ubos: [], managers: [], requiredDocuments: [], generatedDocuments: [], kycCase: { kycNumber: number, legalDocuments: [], sourceEnquiry: { details: { preliminaryKyc: source } } } };
  const service = Object.create(KycService.prototype);
  const payload = service.serializeForm(form);
  assert.equal(payload.preliminaryDocument.kycNumber, number); assert.equal(payload.sectionA.reference, number);
  assert.equal(source.kycNumber, undefined, 'Do not mutate original preliminary document');
  const enquiry = Object.create(EnquiriesService.prototype);
  enquiry.findOne = async () => ({ enquiryType: 'PROPOSED_COMPANY', details: { preliminaryKyc: source }, generatedKycCases: [{ kycNumber: number }] });
  const result = await enquiry.getPreliminaryKyc({}, 'enquiry'); assert.equal(result.data.kycNumber, number);
  const html = preliminaryPdfHtml(result.data); assert.ok(html.includes(`KYC Number: ${number}`));
  assert.ok(preliminaryPdfHtml(source).includes('KYC Number: Not assigned'));
  assert.ok(preliminaryPdfHtml({ ...source, kycNumber: '<script>' }).includes('&lt;script&gt;'));
  const docx = await exportKycDocx(payload, 1);
  assert.ok(new PizZip(docx).file('word/document.xml').asText().includes(number));
  assert.ok((await exportKycHtml(payload, 1)).includes(number));
  const output = path.join(os.tmpdir(), 'newoon-number-preview'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'kyc-number.docx'), docx);
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1000, height: 900 }); await page.setContent(html);
    assert.ok((await page.$eval('body', (el) => el.textContent)).includes(number));
    await page.screenshot({ path: path.join(output, 'preliminary-number.png'), fullPage: true });
    await page.pdf({ path: path.join(output, 'preliminary-number.pdf'), format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  } finally { await browser.close(); }
  console.log(`KYC number checks passed: canonical case reference, preliminary/enquiry data, PDF HTML, DOCX and non-mutating source. Synthetic previews: ${output}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
