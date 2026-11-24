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
  const enquiry = { id: 'synthetic', enquiryCode: 'ENQ-SYNTHETIC', enquiryType: 'PROPOSED_COMPANY', proposedCompanyName: 'Synthetic Company', status: 'DRAFT', requestedServices: [], keyContactName: 'Sample Contact', keyContactEmail: '', keyContactPhone: '', attachments: [], details: { proposedLegalForm: 'QFC LLC', countryOfIncorporation: 'Qatar', preliminaryKyc: { shareholders: [], ubos: [], management: [], documents: [] } } };
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
      else if (url.pathname === '/api/enquiries/identity-documents/read') data = { found: true, identityType: 'PASSPORT', typeMatches: true, documentNumber: 'SYNTHETIC123', documentNumberCheck: 'OK', expiryDate: '2035-01-01', expiryValid: true, dateOfBirth: '1990-01-01', nameOnDocument: 'SAMPLE DIRECTOR', nationality: '', issuingCountry: '' };
      else if (url.pathname === '/api/enquiries/synthetic' && request.method() === 'PATCH') { saved = JSON.parse(request.postData()); data = { ...enquiry, ...saved }; }
      else if (url.pathname === '/api/enquiries/synthetic' || url.pathname === '/api/enquiries/synthetic/attachments/upload') data = enquiry;
      else return void request.respond({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Unexpected synthetic request' }) });
      return void request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('https://intake-integration.test/enquiries/synthetic/edit');
    await page.waitForSelector('input[aria-label="Add documents to inbox"]');
    await (await page.$('input[aria-label="Add documents to inbox"]')).uploadFile(file);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Review'));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Review').click());
    await page.waitForSelector('[role=dialog]');
    await page.select('[role=dialog] select', 'new:director');
    await page.evaluate(() => [...document.querySelectorAll('label')].find(label => label.textContent.includes('I checked')).querySelector('input').click());
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Apply selected details').click());
    await page.waitForFunction(() => !document.querySelector('[role=dialog]') && document.getElementById('root').textContent.includes('Reviewed details applied'));
    assert.equal(saved, undefined, 'Review must not submit/save the enquiry automatically');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Update Enquiry').click());
    await page.waitForFunction(() => document.getElementById('root').textContent.includes('Enquiry updated successfully.'));
    const management = saved.details.preliminaryKyc.management;
    assert.equal(management.length, 1, 'Replace the blank placeholder instead of leaving an invalid empty row');
    assert.equal(management[0].fullName, 'Sample Director');
    assert.equal(management[0].passportNumber, 'SYNTHETIC123');
    assert.equal(management[0].passportExpiry, '2035-01-01');
    assert.equal(management[0].position, 'Director');
    assert.equal(saved.keyContactName, 'Sample Contact', 'Do not change the unrelated key contact');
    assert.equal(saved.proposedCompanyName, 'Synthetic Company', 'Do not change the company from an identity document');
    assert.ok(requests.includes('/api/enquiries/synthetic/attachments/upload'));
    assert.ok(!requests.some(url => /export|generate|\/pdf/.test(url)), 'Intake must not invoke any export flow');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, 'enquiry-after-review.png'), fullPage: true });
    console.log('Enquiry integration passed: identity read -> explicit new director -> reviewed draft -> existing save/upload API payload; unrelated company/contact preserved and no export invoked.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
