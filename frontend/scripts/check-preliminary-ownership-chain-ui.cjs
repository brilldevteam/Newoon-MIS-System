// Browser check for multi-level (parent company) ownership on the enquiry Ownership step. Synthetic data only.
// Run from the repository root after `npm run build` (uses the built CSS and the local Chrome install).
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {AppLayout} from './frontend/src/layouts/AppLayout'; import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage'; createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[window.location.pathname]}><Routes><Route element={<AppLayout/>}><Route path='/enquiries/:id/edit' element={<AddEnquiryPage/>}/><Route path='/enquiries/:id' element={<p>Details fixture</p>}/></Route></Routes></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'error', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id='root'></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const output = path.join(os.tmpdir(), 'newoon-ownership-chain-preview'); fs.mkdirSync(output, { recursive: true });
  const company = (id, fullName, ownershipPercentage, parentRowId = '') => ({ id, shareholderType: 'Corporate Entity', fullName, ownershipPercentage, parentRowId, nationality: 'United Kingdom', identityNumber: `CR-${id}`, address: 'United Kingdom', isUbo: false });
  const enquiry = {
    id: 'synthetic', enquiryCode: 'ENQ-SYNTHETIC', enquiryType: 'PROPOSED_COMPANY', proposedCompanyName: 'Synthetic Qatar LLC', status: 'DRAFT', requestedServices: ['N009 - Company Formation - QFC'],
    keyContactName: 'Sample Person', attachments: [], comments: [], statusHistory: [], generatedKycCases: [],
    details: { proposedLegalForm: 'QFC LLC', jurisdictionOfRegistration: 'QFC', countryOfIncorporation: 'Qatar', proposedBusinessActivity: 'Consulting', sourceOfInitialCapital: 'Parent company capital', proposedRegisteredOfficeAddress: 'Synthetic office, Doha', preliminaryKyc: {
      // Stored out of order on purpose: the editor and preview must still show the chain top-down.
      shareholders: [company('mid', 'Synthetic International Holdco I, LLC with a deliberately long registered company name', '100', 'direct'), company('direct', 'Synthetic UK Limited', '100')],
      ubos: [{ id: 'ubo', shareholderType: 'Individual', fullName: 'Sample Beneficial Owner', nationality: 'United States', identityNumber: 'P-0001', address: 'United States', parentRowId: 'mid', ownershipPercentage: '38.7', uboPercentage: '', isUbo: true }],
      management: [], documents: []
    } }
  };
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage(); await page.setViewport({ width, height: 1100 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('newoon_token', 'synthetic'));
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.woff2')) return void request.respond({ contentType: 'font/woff2', body: fs.readFileSync(path.join(assets, path.basename(url.pathname))) });
        let data;
        if (url.pathname === '/api/auth/me') data = { id: 'operator', tenantId: 'a', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: ['enquiries.view', 'enquiries.edit'] };
        else if (url.pathname === '/api/auth/profile') data = { firstName: 'Sample', lastName: 'Operator', email: 'synthetic@example.invalid', roles: [], profile: null };
        else if (url.pathname === '/api/notifications') data = [];
        else if (url.pathname === '/api/enquiries/synthetic') data = enquiry;
        else if (url.pathname === '/api/enquiries/duplicate-check') data = { duplicate: null };
        else if (url.pathname === '/api/clients') data = [];
        else return void request.respond({ contentType: 'text/html', body: html });
        return void request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
      });
      await page.goto('https://fixture.test/enquiries/synthetic/edit');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Ownership')), { timeout: 10000 });
      await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => /^\d*\s*Ownership$/.test(button.textContent.trim()))?.click());
      await page.waitForFunction(() => document.getElementById('root').textContent.includes('Add parent company'), { timeout: 8000 }).catch(async (error) => { console.error(errors, await page.$eval('#root', (el) => el.textContent.slice(0, 800))); throw error; });
      const text = () => page.$eval('#root', (el) => el.textContent);
      let body = await text();
      assert.ok(body.includes('Owns 100% of Synthetic UK Limited'), 'Parent company card says which company it owns');
      assert.ok(body.includes('Total direct shareholder ownership100.00%'), 'Only the direct shareholder counts towards 100%');
      assert.ok(!body.includes('must total 100%'), 'No 200% error for a parent company');
      assert.ok(body.includes('Calculated through the ownership chain: 38.7%'), 'Indirect UBO % is calculated along the chain');
      // Cards are listed top-down: direct shareholder first, then its parent company.
      const order = await page.$$eval('article', (cards) => cards.map((card) => card.querySelector('header')?.textContent || ''));
      assert.ok(order.findIndex((item) => item.includes('Synthetic UK Limited')) < order.findIndex((item) => item.includes('Holdco I')), 'Direct shareholder card before its parent company');
      // Use the calculated UBO %.
      await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Use 38.7%')?.click());
      await page.waitForFunction(() => [...document.querySelectorAll('input[type=number]')].some((input) => input.value === '38.7' && input.closest('label')?.textContent.includes('UBO %')));
      // Add a third level above the Holdco.
      await page.evaluate(() => { const card = [...document.querySelectorAll('article')].find((item) => item.querySelector('header')?.textContent.includes('Holdco I')); [...card.querySelectorAll('button')].find((button) => button.textContent.includes('Add parent company')).click(); });
      await page.waitForFunction(() => document.getElementById('root').textContent.includes('Parent company'), { timeout: 5000 });
      await page.evaluate(() => {
        const card = [...document.querySelectorAll('article')].find((item) => item.querySelector('header')?.textContent.includes('Owns 0% of Synthetic International Holdco'));
        const setValue = (input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); };
        const inputs = card.querySelectorAll('input');
        setValue(inputs[0], 'Synthetic Top Parent, Inc.');
        setValue([...inputs].find((input) => input.type === 'number'), '100');
      });
      await page.waitForFunction(() => document.getElementById('root').textContent.includes('Owns 100% of Synthetic International Holdco'));
      body = await text();
      assert.ok(body.includes('Total direct shareholder ownership100.00%'), 'Adding a parent company keeps the direct total at 100%');
      // The new top company must not be offered as the parent of its own owner chain (no cycles): Synthetic UK Limited's "Shareholder of" omits companies above it.
      const ukOptions = await page.evaluate(() => { const card = [...document.querySelectorAll('article')].find((item) => item.querySelector('header')?.textContent.startsWith('Synthetic UK Limited')); const select = [...card.querySelectorAll('select')].find((item) => item.closest('label')?.textContent.startsWith('Shareholder of')); return [...select.options].map((option) => option.textContent.trim()); });
      assert.deepEqual(ukOptions, ['Client company (direct)'], 'A company cannot be placed under its own parent companies');
      // Link the beneficial owner through the new top company and check the preview table.
      await page.evaluate(() => { const card = [...document.querySelectorAll('article')].find((item) => item.querySelector('header')?.textContent.includes('Sample Beneficial Owner')); const select = [...card.querySelectorAll('select')].find((item) => item.closest('label')?.textContent.startsWith('Owns shares through')); const option = [...select.options].find((item) => item.textContent.includes('Top Parent')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, option.value); select.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForFunction(() => document.getElementById('root').textContent.includes('Calculated through the ownership chain: 38.7%'));
      body = await text();
      for (const expected of ['Shareholder of', '1.1.1Synthetic Top Parent, Inc.', 'Total direct ownership %: 100.00%']) assert.ok(body.includes(expected), `Preview should include ${expected}`);
      // Over-owned company is flagged.
      await page.evaluate(() => { const card = [...document.querySelectorAll('article')].find((item) => item.querySelector('header')?.textContent.includes('Owns 100% of Synthetic International Holdco')); const input = [...card.querySelectorAll('input')].find((item) => item.type === 'number'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '120'); input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForFunction(() => document.getElementById('root').textContent.includes('add up to 120.00%, which is more than 100%'));
      await page.evaluate(() => { const card = [...document.querySelectorAll('article')].find((item) => item.querySelector('header')?.textContent.includes('Owns 120% of Synthetic International Holdco')); const input = [...card.querySelectorAll('input')].find((item) => item.type === 'number'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '100'); input.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForFunction(() => !document.getElementById('root').textContent.includes('which is more than 100%'));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `No horizontal page scroll at ${width}px (overflow ${overflow}px)`);
      await page.screenshot({ path: path.join(output, `ownership-chain-${width}.png`), fullPage: true });
      // Removing the middle company moves its parent company up one level instead of deleting it.
      await page.evaluate(() => { const card = [...document.querySelectorAll('article')].find((item) => item.querySelector('header')?.textContent.includes('Owns 100% of Synthetic UK Limited')); card.querySelector('button[title="Remove"]').click(); });
      await page.waitForFunction(() => document.getElementById('root').textContent.includes('Owns 100% of Synthetic UK Limited') && document.getElementById('root').textContent.includes('Synthetic Top Parent, Inc.') && !document.getElementById('root').textContent.includes('Synthetic International Holdco'));
      assert.deepEqual(errors, []); await page.close();
    }
    console.log(`Preliminary ownership chain UI checks passed on desktop/mobile: chain order, direct total, parent company add/remove, cycle-safe options, calculated UBO %, over-owned warning and preview numbering. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
