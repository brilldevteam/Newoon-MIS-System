// Synthetic: the KYC case page header, action bar, collapsible Return to BD, document list and sticky Timeline / Comments.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {AppLayout} from './frontend/src/layouts/AppLayout'; import {ToastProvider} from './frontend/src/components/ToastProvider'; import {KycCaseWorkspace} from './frontend/src/layouts/KycCaseWorkspace'; import {KycCaseDetailsPage} from './frontend/src/pages/KycCaseDetailsPage';
    localStorage.setItem('newoon_token','synthetic');
    createRoot(document.getElementById('root')).render(<ToastProvider><MemoryRouter initialEntries={['/kyc/case1']}><Routes><Route element={<AppLayout/>}><Route element={<KycCaseWorkspace/>}><Route path='/kyc/:id' element={<KycCaseDetailsPage/>}/><Route path='/kyc/:id/screening' element={<p>Screening page</p>}/></Route></Route></Routes></MemoryRouter></ToastProvider>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const kycCase = {
    id: 'case1', title: 'SAMPLE TRADING KYC', kycNumber: 'KYC-2026-0007', status: 'SUPERVISOR_REVIEW_PENDING', proposalStatus: 'NOT_REQUIRED', purpose: 'NEW',
    client: { id: 'c1', name: 'SAMPLE TRADING SERVICES', contacts: [{ id: 'k1', name: 'Sample Contact', isPrimary: true }] }, service: { name: 'N002 - Address Service, N004 - Open Bank Account - Personal / Corporate' },
    sourceEnquiry: { id: 'e1', enquiryType: 'EXISTING_LEGAL_ENTITY', details: { documentPeople: [{ id: 'a', files: ['qid.jpeg'], kinds: { 'qid.jpeg': 'QID' }, row: { fullName: 'ALPHA OWNER ONE' } }, { id: 'b', files: ['passport.jpeg'], kinds: { 'passport.jpeg': 'PASSPORT' }, row: { fullName: 'BETA OWNER TWO' } }] } }, kycForm: null,
    legalDocuments: [{ id: 'd1', documentType: 'Commercial Registration / CR Extract', fileName: 'Commercial Registration.pdf', storagePath: 'x' }, { id: 'd2', documentType: 'QID / Passport copies', fileName: 'qid.jpeg', storagePath: 'y' }, { id: 'd3', documentType: 'QID / Passport copies', fileName: 'passport.jpeg', storagePath: 'z' }],
    statusHistory: [{ id: 'h1', toStatus: 'SUPERVISOR_REVIEW_PENDING', createdAt: '2026-11-28T10:00:00Z', note: 'KYC case created from enquiry ENQ-2026-0013' }], comments: [], reviewFeedback: []
  };
  let withHistory = false;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const output = path.join(os.tmpdir(), 'newoon-kyc-case'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage(); await page.setViewport({ width, height: 1000 }); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url()); let data;
        if (url.pathname === '/api/auth/me') data = { id: 'aml', tenantId: 'synthetic', roles: ['AML_SUPERVISOR', 'AML_TEAM'], accessControlConfigured: true, permissions: ['kyc.view', 'kyc.edit', 'screening.view', 'crrf.view'] };
        else if (url.pathname === '/api/kyc-cases/case1' || url.pathname === '/api/kyc/case1') data = kycCase;
        else if (/form\/revisions/.test(url.pathname)) data = withHistory ? [{ id: 'r1', version: 1 }] : [];
        else if (/submission-readiness/.test(url.pathname)) data = { ready: false, checks: [{ key: 'documents', label: 'KYC preparation documents', complete: true }, { key: 'form', label: 'KYC form - required details', complete: false, message: 'A. General Company Information: Registered Office Address; Email (a valid address). | E. Key Communication Person: Email (a valid address).' }, { key: 'screening', label: 'Screening', complete: false, message: 'No screening has been done yet. Open Screening and screen the company.' }, { key: 'comments', label: 'AML Supervisor comments', complete: false, message: 'Write the AML Supervisor comments on the Submit to DMLRO page.' }] };
        else if (url.pathname.startsWith('/api/')) data = [];
        else return request.respond({ contentType: 'text/html; charset=utf-8', body: html });
        return request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
      });
      await page.goto('https://kyc.test/kyc/case1'); await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('SAMPLE TRADING KYC'), { timeout: 15000 });
      const text = await page.$eval('#root', (n) => n.textContent);
      for (const expected of ['KYC-2026-0007', 'Documents Required for KYC Preparation', 'QID / Passport copies', 'Timeline', 'Comments', 'No comments yet']) assert.ok(text.includes(expected), `Case page shows ${expected}`);
      const tabs = await page.$$eval('nav[aria-label="Case sections"] a', (nodes) => nodes.map((n) => n.textContent.trim()));
      assert.deepEqual(tabs, ['Overview', 'KYC Form', 'Screening', 'CRRF'], 'The case tabs sit in the sticky bar; Form history is hidden without earlier versions');
      assert.equal(await page.$eval('nav[aria-label="Case sections"] a[aria-current="page"]', (n) => n.textContent.trim()), 'Overview');
      // Return to BD is a header button that opens a dialog, not a panel in the page.
      assert.ok(!text.includes('Return this case to BD for correction'), 'The old Return to BD panel is gone');
      await page.evaluate(() => [...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === 'Return to BD')?.click());
      await page.waitForSelector('[role="dialog"] textarea');
      assert.ok(await page.$eval('[role="dialog"] button:last-child', (b) => b.disabled), 'Return to BD needs a reason');
      await page.type('[role="dialog"] textarea', 'Please correct the registered address.');
      assert.ok(await page.$eval('[role="dialog"] button:last-child', (b) => !b.disabled));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
      assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('nav[aria-label="Case sections"]').parentElement).position === 'sticky'), 'The case bar stays on top');
      for (const expected of ['ALPHA OWNER ONE', 'BETA OWNER TWO']) assert.ok(text.includes(expected), `The copy shows ${expected}`);
      assert.ok(await page.evaluate(() => { const bar = document.querySelector('nav[aria-label="Case sections"]').parentElement; const stepper = document.querySelector('ol.isolate'); return Number(getComputedStyle(bar).zIndex) >= 20 && Boolean(stepper); }), 'The progress steps stay under the case bar');
      assert.ok(!text.includes('Service & Proposal'), 'Service & Proposal is removed');
      assert.ok(text.includes('1 of 4 done'), 'Checklist shows its progress');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      await page.screenshot({ path: path.join(output, `case-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); await page.close();
    }
    // With earlier form versions the button appears.
    withHistory = true;
    const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url()); let data;
      if (url.pathname === '/api/auth/me') data = { id: 'aml', tenantId: 'synthetic', roles: ['AML_SUPERVISOR', 'AML_TEAM'], accessControlConfigured: true, permissions: ['kyc.view', 'kyc.edit', 'screening.view', 'crrf.view'] };
      else if (url.pathname === '/api/kyc/case1') data = kycCase;
      else if (/form\/revisions/.test(url.pathname)) data = [{ id: 'r1', version: 1 }];
      else if (/submission-readiness/.test(url.pathname)) data = { ready: false, checks: [] };
      else if (url.pathname.startsWith('/api/')) data = [];
      else return request.respond({ contentType: 'text/html; charset=utf-8', body: html });
      return request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('https://kyc.test/kyc/case1');
    await page.waitForFunction(() => [...document.querySelectorAll('nav[aria-label="Case sections"] a')].some((n) => n.textContent.trim() === 'Form history'), { timeout: 15000 });
    // Opening a tab keeps the case bar.
    await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Case sections"] a')].find((n) => n.textContent.trim() === 'Screening').click());
    await page.waitForFunction(() => document.body.textContent.includes('Screening page'));
    assert.ok(await page.$('nav[aria-label="Case sections"]'), 'The case bar stays when a tab is opened');
    await page.close();
    console.log('KYC case page UI checks passed on desktop and mobile. Screenshots: ' + output);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
