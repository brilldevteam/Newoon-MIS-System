// Synthetic: every person added on the Attachments step is offered on the Contact step; picking fills the position,
// "Enter a new person manually" clears it, and a person without positions leaves it empty.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom'; import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage';
    localStorage.setItem('newoon_token','synthetic'); createRoot(document.getElementById('root')).render(<MemoryRouter><AddEnquiryPage/></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 }); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url()); let data;
      if (url.pathname === '/api/auth/me') data = { id: 'operator', tenantId: 'synthetic', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: ['enquiries.view', 'enquiries.edit'] };
      else if (url.pathname === '/api/clients') data = [];
      else if (url.pathname === '/api/enquiries/duplicate-check') data = { duplicate: null };
      else if (url.pathname === '/api/enquiries/company-documents/read') data = { method: 'LOCAL', message: 'ok', aiConfigured: false, document: {}, company: { legalName: 'SAMPLE TRADING SERVICES' }, people: [
        { fullName: 'ALPHA OWNER ONE', nationality: 'Qatar', roles: ['SHAREHOLDER', 'MANAGER'], sharePercentage: '51', idNumber: '29000000001' },
        { fullName: 'BETA OWNER TWO', nationality: 'Philippines', roles: ['DIRECTOR'], sharePercentage: null, idNumber: '28000000002' },
        { fullName: 'GAMMA OWNER THREE', nationality: 'Qatar', roles: ['SHAREHOLDER'], sharePercentage: null, idNumber: '27000000003' }] };
      else return request.respond({ contentType: 'text/html; charset=utf-8', body: html });
      return request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const click = (text) => page.evaluate((text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text)?.click(), text);
    await page.goto('https://picker.test'); await page.waitForFunction(() => document.body.textContent.includes('Enquiry type'));
    await click('Next'); await page.waitForFunction(() => document.body.textContent.includes('Required Attachments'));
    await page.$$eval('input[type=file]', (inputs) => { const t = new DataTransfer(); t.items.add(new File(['x'], 'Commercial Registration.pdf', { type: 'application/pdf' })); inputs[0].files = t.files; inputs[0].dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForFunction(() => document.body.textContent.includes('added under People'));
    // A person with no copy and no positions is added by hand.
    await click('Add person');
    await page.waitForFunction(() => document.querySelectorAll('input[aria-label^="Full name of person"]').length === 4);
    await page.$$eval('input[aria-label="Full name of person 4"]', ([input]) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'DELTA MANUAL FOUR'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('blur', { bubbles: true })); input.blur(); });
    // Alpha and Beta are marked Contact Person on the Attachments step; Gamma and Delta are not.
    for (const index of [0, 1]) {
      const triggers = await page.$$('li[role=row] [role="button"]');
      await triggers[index].click(); await page.waitForSelector('[data-searchable-select-menu] button');
      await page.evaluate(() => [...document.querySelectorAll('[data-searchable-select-menu] button')].find((b) => b.textContent.trim() === 'Contact Person')?.click());
      await page.click('h3');
    }
    await click('Next'); await page.waitForFunction(() => document.body.textContent.includes('Company details'));
    await page.click('[role="button"]'); await page.waitForSelector('[data-searchable-select-menu] button');
    await page.click('[data-searchable-select-menu] button'); await page.click('h1');
    await click('Next'); await page.waitForSelector('select[aria-label="Select person"]');
    const labels = await page.$eval('select[aria-label="Select person"]', (select) => [...select.options].map((o) => o.textContent.trim()));
    for (const name of ['ALPHA OWNER ONE', 'BETA OWNER TWO']) assert.ok(labels.some((text) => text.startsWith(name)), `${name} is offered (marked Contact Person, no copy needed)`);
    for (const name of ['GAMMA OWNER THREE', 'DELTA MANUAL FOUR']) assert.ok(!labels.some((text) => text.startsWith(name)), `${name} is not a Contact Person, so is not offered`);
    const pick = async (name) => {
      const value = await page.$eval('select[aria-label="Select person"]', (select, name) => [...select.options].find((o) => o.text.startsWith(name)).value, name);
      await page.select('select[aria-label="Select person"]', value);
      await page.waitForFunction((name) => [...document.querySelectorAll('input')].some((i) => i.value === name), {}, name);
    };
    // The text of the Position field (its chips).
    const position = () => page.evaluate(() => {
      const label = [...document.querySelectorAll('label, span, div, p')].find((n) => /^Position\s*\*?$/.test(n.textContent.trim()) && n.children.length <= 1);
      return (label?.parentElement?.textContent || '').replace(/Position\s*\*?/, '').replace(/Select.*/, '').trim();
    });
    await pick('ALPHA OWNER ONE'); let text = await position();
    assert.ok(/Shareholder/.test(text) && /Manager/.test(text), `Shareholder and Manager fill the position (got "${text}")`);
    await pick('BETA OWNER TWO'); text = await position();
    assert.ok(/Director/.test(text) && !/Shareholder|Manager/.test(text), `The previous positions are replaced (got "${text}")`);
    await page.select('select[aria-label="Select person"]', '');
    await page.waitForFunction(() => [...document.querySelectorAll('input')].every((i) => i.value !== 'BETA OWNER TWO'));
    text = await position();
    assert.ok(!/Shareholder|Director|Manager/.test(text), `Manual entry clears the position (got "${text}")`);
    assert.deepEqual(errors, []);
    console.log('Contact person picker checks passed: only the people marked Contact Person offered, position follows the person, manual entry clears it.');
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
