const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {AppLayout} from './frontend/src/layouts/AppLayout'; import {EnquiryListPage} from './frontend/src/pages/EnquiryListPage'; import {EnquiryDetailsPage} from './frontend/src/pages/EnquiryDetailsPage'; import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage'; import {RequireAccess} from './frontend/src/routes/RequireRoles'; createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[window.location.pathname]}><Routes><Route element={<AppLayout/>}><Route path='/enquiries' element={<EnquiryListPage/>}/><Route path='/enquiries/:id' element={<EnquiryDetailsPage/>}/><Route element={<RequireAccess area='enquiries' write fallbackRoles={['OPERATING_TEAM']}/>}><Route path='/enquiries/:id/edit' element={<AddEnquiryPage/>}/></Route><Route path='/access-denied' element={<p>Denied fixture</p>}/></Route></Routes></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id='root'></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const output = path.join(os.tmpdir(), 'newoon-returned-access-preview'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage(); await page.setViewport({ width, height: 1000 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('newoon_token', 'synthetic'));
      let permissions = ['enquiries.view', 'enquiries.edit']; let caseStatus = 'RETURNED_TO_BD';
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      const enquiry = () => ({ id: 'synthetic', enquiryCode: 'ENQ-SYNTHETIC', enquiryType: 'PROPOSED_COMPANY', proposedCompanyName: 'Synthetic Returned Company', status: 'RETURNED_TO_BD', requestedServices: ['N009 - Company Formation - QFC'], keyContactName: 'Sample Person', details: {}, attachments: [], comments: [], statusHistory: [], generatedKycCases: [{ id: 'case', status: caseStatus, title: 'Synthetic KYC', kycNumber: 'KYC-SYNTHETIC' }] });
      const notice = () => ({ id: 'notice', title: 'KYC case returned to BD', message: 'Synthetic correction request', type: 'ADDITIONAL_INFORMATION_REQUESTED', isRead: false, createdAt: '2026-11-02T08:00:00Z', enquiry: { id: 'synthetic', status: caseStatus === 'RETURNED_TO_BD' ? 'RETURNED_TO_BD' : 'CONVERTED_TO_KYC' }, kycCase: { id: 'case', status: caseStatus } });
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.woff2')) return void request.respond({ contentType: 'font/woff2', body: fs.readFileSync(path.join(assets, path.basename(url.pathname))) });
        let data;
        if (url.pathname === '/api/auth/me') data = { id: 'operator', tenantId: 'a', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions };
        else if (url.pathname === '/api/auth/profile') data = { firstName: 'Sample', lastName: 'Operator', email: 'synthetic@example.invalid', roles: [], profile: null };
        else if (url.pathname === '/api/notifications') data = [notice()];
        else if (url.pathname.startsWith('/api/notifications/')) data = { ...notice(), isRead: true };
        else if (url.pathname === '/api/enquiries') data = [enquiry()];
        else if (url.pathname === '/api/enquiries/synthetic') data = enquiry();
        else if (url.pathname === '/api/clients') data = [];
        else return void request.respond({ contentType: 'text/html', body: html });
        return void request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
      });
      await page.goto('https://fixture.test/enquiries'); await page.waitForSelector('a[title="Edit"]');
      await page.waitForSelector('[aria-label="Notifications"]'); await page.click('[aria-label="Notifications"]');
      await page.waitForSelector('a[href="/enquiries/synthetic/edit"]');
      const returnedLink = await page.$('a[href="/enquiries/synthetic/edit"].block');
      assert.ok(returnedLink, 'Returned notification itself must link to edit'); await returnedLink.click();
      await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Edit Enquiry'), { timeout: 8000 }).catch(async (error) => { console.error(errors, await page.$eval('#root', (el) => el.textContent)); throw error; });
      assert.ok(await page.$('form'), 'Returned enquiry editor must stay open');
      await page.screenshot({ path: path.join(output, `returned-editor-${width}.png`), fullPage: true });
      caseStatus = 'DMLRO_REVIEW_PENDING'; await page.goto('https://fixture.test/enquiries/synthetic/edit');
      await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Synthetic Returned Company'));
      assert.equal(await page.$('a[href="/enquiries/synthetic/edit"]'), null);
      await page.click('[aria-label="Notifications"]');
      await page.waitForSelector('a[href="/enquiries/synthetic"].block');
      assert.equal(await page.$('a[href="/enquiries/synthetic/edit"].block'), null, 'Old return notice must not send active review to edit');
      caseStatus = 'RETURNED_TO_BD'; permissions = ['enquiries.view']; await page.goto('https://fixture.test/enquiries');
      await page.waitForFunction(() => document.querySelector('#root').textContent.includes('ENQ-SYNTHETIC'));
      assert.equal(await page.$('a[title="Edit"]'), null);
      permissions = ['enquiries.view', 'enquiries.edit']; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForSelector('a[title="Edit"]');
      permissions = ['enquiries.view']; await page.goto('https://fixture.test/enquiries/synthetic/edit');
      await page.waitForFunction(() => document.querySelector('#root').textContent.includes('Denied fixture'));
      assert.deepEqual(errors, []); await page.close();
    }
    console.log(`Returned enquiry UI checks passed: list/editor/details, review locks, View denial and focus permission refresh on desktop/mobile. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
