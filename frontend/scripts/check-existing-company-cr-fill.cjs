// Synthetic: a Ministry CR read fills the existing-company Details fields and adds owners / managers as people.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom'; import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage';
    localStorage.setItem('newoon_token','synthetic'); createRoot(document.getElementById('root')).render(<MemoryRouter><AddEnquiryPage/></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 }); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url()); let data;
      if (url.pathname === '/api/auth/me') data = { id: 'operator', tenantId: 'synthetic', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: ['enquiries.view', 'enquiries.edit'] };
      else if (url.pathname === '/api/clients') data = [];
      else if (url.pathname === '/api/enquiries/duplicate-check') data = { duplicate: null };
      else if (url.pathname === '/api/enquiries/company-documents/read') data = { method: 'LOCAL', message: 'ok', aiConfigured: false, document: {}, company: { legalName: 'SAMPLE TRADING SERVICES', commercialRegistrationNo: '100001', legalForm: 'LLC', shareCapital: '200000', crExpiryDate: '2027-02-22', dateOfIncorporation: '2022-02-23', countryOfIncorporation: 'Qatar', taxIdentificationNo: '5000000001', licenseActivities: 'Performing arts (854213)' }, people: [{ fullName: 'ALPHA OWNER ONE SAMPLE', nationality: 'Qatar', roles: ['SHAREHOLDER', 'MANAGER'], sharePercentage: '51', idNumber: '29000000001' }, { fullName: 'BETA OWNER TWO EXAMPLE', nationality: 'Philippines', roles: ['SHAREHOLDER', 'MANAGER'], sharePercentage: '49', idNumber: '28000000002' }] };
      else return request.respond({ contentType: 'text/html; charset=utf-8', body: html });
      return request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const click = (text) => page.evaluate((text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text)?.click(), text);
    await page.goto('https://cr.test'); await page.waitForFunction(() => document.body.textContent.includes('Enquiry type'));
    await click('Next'); await page.waitForFunction(() => document.body.textContent.includes('Required Attachments'));
    await page.$$eval('input[type=file]', (inputs) => { const t = new DataTransfer(); t.items.add(new File(['x'], 'Commercial Registration.pdf', { type: 'application/pdf' })); inputs[0].files = t.files; inputs[0].dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForFunction(() => document.body.textContent.includes('added under People'));
    const names = await page.$$eval('input[aria-label^="Full name of person"]', (n) => n.map((i) => i.value));
    assert.deepEqual(names, ['ALPHA OWNER ONE SAMPLE', 'BETA OWNER TWO EXAMPLE']);
    const chips = await page.$eval('[aria-label="People by position"]', (n) => n.textContent);
    assert.match(chips, /2 Shareholders/); assert.match(chips, /2 Managers/);
    await click('Next'); await page.waitForFunction(() => document.body.textContent.includes('Company details'));
    const values = await page.$$eval('input,textarea', (n) => n.map((i) => i.value));
    for (const expected of ['SAMPLE TRADING SERVICES', '100001', 'LLC', '200000', '5000000001', 'Performing arts (854213)']) assert.ok(values.includes(expected), `Details should hold ${expected}`);
    assert.ok(values.some((v) => /2027|22/.test(v)), 'CR expiry date is filled');
    assert.deepEqual(errors, []);
    console.log('Existing company CR fill checks passed: name, number, legal form, capital, dates, tax number, activities and the owners / managers as people.');
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
