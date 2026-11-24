// Actual enquiry page and service wrappers with synthetic HTTP responses. No live database/provider is used.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage';createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/enquiries/synthetic/edit']}><Routes><Route path='/enquiries/:id/edit' element={<AddEnquiryPage/>}/></Routes></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', format: 'iife', platform: 'browser', logLevel: 'error', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find(name => name.endsWith('.css'));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;
  const output = path.join(os.tmpdir(), 'newoon-document-intake-integration'); fs.mkdirSync(output, { recursive: true });
  const file = path.join(output, 'sample-passport.png'); fs.writeFileSync(file, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  const enquiry = { id: 'synthetic', enquiryCode: 'ENQ-SYNTHETIC', enquiryType: 'EXISTING_LEGAL_ENTITY', companyName: 'Synthetic Company', status: 'DRAFT', requestedServices: ['N009 - Company Formation - QFC'], keyContactName: '', keyContactEmail: 'contact@example.invalid', keyContactPhone: '+974 00000000', attachments: [], details: {} };
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
    const errors = []; const requests = []; let saved;
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => localStorage.setItem('newoon_token', 'synthetic'));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url()); requests.push(url.pathname);
      if (!url.pathname.startsWith('/api/')) return void request.respond({ contentType: 'text/html', body: html });
      let data;
      if (url.pathname === '/api/auth/me') data = { id: 'operator', tenantId: 'synthetic', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: ['enquiries.view', 'enquiries.edit'] };
      else if (url.pathname === '/api/clients') data = [];
      else if (url.pathname === '/api/enquiries/duplicate-check') data = { duplicate: null };
      else if (url.pathname === '/api/enquiries/identity-documents/read') data = { found: true, identityType: 'QID', typeMatches: false, documentNumber: '29000000001', documentNumberCheck: 'FAILED', expiryDate: '2027-02-14', expiryValid: true, dateOfBirth: '1990-01-01', nameOnDocument: 'SAMPLE PERSON', nationality: 'NEPAL', issuingCountry: '', readFromText: true, qid: { number: '29000000001', expiry: '2027-02-14' }, passport: { number: 'SYNTHETIC123', expiry: '2036-01-12' } };
      else if (url.pathname === '/api/enquiries/synthetic' && request.method() === 'PATCH') { saved = JSON.parse(request.postData()); data = { ...enquiry, ...saved }; }
      else if (url.pathname === '/api/enquiries/synthetic' || url.pathname === '/api/enquiries/synthetic/attachments/upload') data = enquiry;
      else return void request.respond({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Unexpected synthetic request' }) });
      return void request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('https://intake-integration.test/enquiries/synthetic/edit');
    await page.waitForSelector('input[aria-label="Add documents to inbox"]');
    assert.equal(await page.$('[aria-label="Enquiry completion checklist"]'), null, 'Do not show the removed Details to complete panel');
    await (await page.$('input[aria-label="Add documents to inbox"]')).uploadFile(file);
    await page.waitForFunction(() => document.getElementById('root').textContent.includes('1 / 1 processed'));
    assert.equal(await page.$('[role=dialog]'), null, 'No review should be required');
    assert.equal(saved, undefined, 'Autofill changes the draft, not submission/save behavior');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.replace(/\s/g, '') === '2Details').click());
    await page.waitForFunction(() => document.getElementById('root').textContent.includes('Requested services'));
    assert.equal(await page.evaluate(() => document.getElementById('root').textContent.includes("Fill from the company's CR:")), false, 'Remove the redundant company inline CR reader');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.replace(/\s/g, '') === '3Contact').click());
    await page.waitForSelector('select[aria-label="Document type to read"]');
    assert.deepEqual(await page.$eval('select[aria-label="Document type to read"]', select => [...select.options].map(option => option.value)), ['PASSPORT', 'QID'], 'Keep the individual identity upload');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Update Enquiry').click());
    await page.waitForFunction(() => document.getElementById('root').textContent.includes('Enquiry updated successfully.'));
    assert.equal(saved.keyContactName, 'Sample Person');
    assert.equal(saved.details.keyContactPassportNumber, 'SYNTHETIC123');
    assert.equal(saved.details.keyContactPassportExpiryDate, '2036-01-12');
    assert.equal(saved.details.keyContactQidNumber, '29000000001');
    assert.equal(saved.details.keyContactQidExpiryDate, '2027-02-14');
    assert.equal(saved.details.keyContactNationality, 'Nepal');
    assert.deepEqual([...saved.details.keyContactIdentityTypes].sort(), ['Passport', 'QID']);
    assert.equal(saved.keyContactEmail, 'contact@example.invalid');
    assert.equal(saved.keyContactPhone, '+974 00000000');
    assert.equal(saved.companyName, 'Synthetic Company', 'Do not change the company from an identity document');
    assert.ok(requests.includes('/api/enquiries/synthetic/attachments/upload'));
    assert.ok(!requests.some(url => /export|generate|\/pdf/.test(url)), 'Intake must not invoke any export flow');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, 'enquiry-after-review.png'), fullPage: true });
    console.log('Enquiry integration passed: upload -> automatic QID/passport/nationality fill without review -> normal save/upload payload; unrelated company/email/phone preserved and no export invoked.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
