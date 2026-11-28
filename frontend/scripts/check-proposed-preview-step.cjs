// Synthetic: the Preliminary KYC preview of a proposed company is hidden on Type and Attachments and shown from Details.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage'; import {AppLayout} from './frontend/src/layouts/AppLayout'; import {ToastProvider} from './frontend/src/components/ToastProvider';
    localStorage.setItem('newoon_token','synthetic');
    createRoot(document.getElementById('root')).render(<ToastProvider><MemoryRouter initialEntries={['/enquiries/synthetic/edit']}><Routes><Route element={<AppLayout/>}><Route path='/enquiries/:id/edit' element={<AddEnquiryPage/>}/></Route></Routes></MemoryRouter></ToastProvider>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const enquiry = { id: 'synthetic', enquiryCode: 'ENQ-SYNTHETIC', enquiryType: 'PROPOSED_COMPANY', status: 'DRAFT', proposedCompanyName: 'Synthetic Company', requestedServices: ['N009 - Company Formation - QFC'], keyContactName: 'Contact', keyContactPhone: '+97455550000', attachments: [], details: { proposedLegalForm: 'QFC LLC', jurisdictionOfRegistration: 'QFC', countryOfIncorporation: 'Qatar', proposedBusinessActivity: 'Consulting', sourceOfInitialCapital: 'Capital', proposedRegisteredOfficeAddress: 'Doha' } };
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1700, height: 1000 }); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url()); let data;
      if (url.pathname === '/api/auth/me') data = { id: 'operator', tenantId: 'synthetic', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: ['enquiries.view', 'enquiries.edit'] };
      else if (url.pathname === '/api/enquiries/synthetic') data = enquiry;
      else if (url.pathname.startsWith('/api/')) data = [];
      else return request.respond({ contentType: 'text/html; charset=utf-8', body: html });
      return request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const preview = () => page.evaluate(() => document.getElementById('root').textContent.includes('Prospective Customer Information'));
    const click = (text) => page.evaluate((text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text)?.click(), text);
    await page.goto('https://preview.test/enquiries/synthetic/edit'); await page.waitForFunction(() => document.body.textContent.includes('Enquiry type'));
    assert.equal(await preview(), false, 'No preview on the Type step');
    await click('Next'); await page.waitForFunction(() => document.body.textContent.includes('Required Attachments'));
    assert.equal(await preview(), false, 'No preview on the Attachments step');
    await click('Next'); await page.waitForFunction(() => document.body.textContent.includes('Proposed company name') || document.body.textContent.includes('Proposed legal form'));
    assert.equal(await preview(), true, 'The preview shows from the Details step');
    assert.deepEqual(errors, []);
    console.log('Proposed company preview checks passed: hidden on Type and Attachments, shown from Details.');
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
