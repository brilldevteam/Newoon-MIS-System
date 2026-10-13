const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

async function run() {
  const fixture = {
    id: 'form', tenantId: 'tenant', kycCaseId: 'synthetic', version: 1, status: 'SUBMITTED', isLocked: true,
    sectionA: { legalName: 'Original Company', reference: 'KYC-SYNTHETIC' },
    sectionB: { shareholders: [], ubos: [] }, sectionC: { managers: [] }, sectionD: {}, sectionE: {},
    sectionF: { documents: [] }, sectionG: { fullName: 'Synthetic Signatory' }, sectionH: {}, generatedDocuments: [], updatedAt: '2026-10-13'
  };
  const current = structuredClone(fixture);
  current.version = 2; current.status = 'AMENDMENT_DRAFT'; current.isLocked = false;
  current.sectionA.legalName = 'Amended Company';
  const revision = { id: 'original', version: 1, reason: 'Correct the company name', createdAt: '2026-10-13', createdBy: 'reviewer', snapshot: fixture, files: [] };
  const compiled = esbuild.buildSync({ stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {KycFormRevisionsPage} from './frontend/src/pages/KycFormRevisionsPage'; createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/kyc/synthetic/revisions']}><Routes><Route path='/kyc/:id/revisions' element={<KycFormRevisionsPage/>}/></Routes></MemoryRouter>);`,
    resolveDir: process.cwd(), loader: 'tsx'
  }, bundle: true, platform: 'browser', format: 'iife', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const cssFile = fs.readdirSync('frontend/dist/assets').find((name) => name.endsWith('.css'));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join('frontend/dist/assets', cssFile), 'utf8')}</style></head><body><main style="padding:16px"><div id="root"></div></main><script>${compiled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/fixture') return void request.respond({ contentType: 'text/html', body: html });
      const data = url.pathname.endsWith('/form/revisions/original') ? revision : url.pathname.endsWith('/form/revisions') ? [revision] : url.pathname.endsWith('/form') ? current : null;
      if (data) return void request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
      void request.abort();
    });
    const output = path.resolve('docs/kyc-revisions-preview');
    fs.mkdirSync(output, { recursive: true });
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      await page.setViewport({ width, height });
      await page.goto('http://127.0.0.1/fixture');
      try { await page.waitForFunction(() => document.body.innerText.includes('Changes (1)'), { timeout: 10000 }); }
      catch (failure) { throw new Error(`Fixture failed: ${errors.join('; ')} | ${await page.evaluate(() => document.body.innerText)}`, { cause: failure }); }
      assert.ok(await page.evaluate(() => document.body.innerText.includes('Amended Company')));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.screenshot({ path: path.join(output, `${name}-changes.png`), fullPage: true });
      await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((element) => element.textContent.includes('Compare forms')).click());
      await page.waitForFunction(() => document.body.innerText.includes('Original - Revision 1'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await page.screenshot({ path: path.join(output, `${name}-forms.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('Desktop/mobile revision selection, change summary, both form previews and no horizontal overflow verified with synthetic API fixtures.');
  } finally { await browser.close(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
