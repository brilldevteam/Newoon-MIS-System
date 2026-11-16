const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

async function main() {
  const bundle = esbuild.buildSync({ stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom'; import {DashboardPage} from './frontend/src/pages/DashboardPage'; createRoot(document.getElementById('root')).render(<MemoryRouter><main className='p-5'><DashboardPage/></main></MemoryRouter>);`,
    resolveDir: process.cwd(), loader: 'tsx'
  }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const css = fs.readdirSync('frontend/dist/assets').find((name) => name.endsWith('.css'));
  const html = `<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>${fs.readFileSync(path.join('frontend/dist/assets', css), 'utf8')}</style></head><body><div id='root'></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const output = path.join(os.tmpdir(), 'newoon-dashboard-preview'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage(); await page.setViewport({ width, height: 1000 });
      await page.evaluateOnNewDocument(() => localStorage.setItem('newoon_token', 'synthetic-dashboard-token'));
      let fail = false;
      let summary = { totalTenants: 1, totalClients: 7, openEnquiries: 2, pendingKyc: 3, pendingApprovals: 1, approvedKyc: 4, enabledModules: 2 };
      const errors = []; page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.woff2')) return void request.respond({ contentType: 'font/woff2', body: fs.readFileSync(path.join('frontend/dist/assets', path.basename(url.pathname))) });
        if (url.pathname === '/api/auth/me') return void request.respond({ contentType: 'application/json', body: JSON.stringify({ id: 'fixture', tenantId: 'a', roles: ['OPERATING_TEAM'] }) });
        if (url.pathname === '/api/dashboard/summary') return void request.respond({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { message: 'Synthetic summary unavailable' } : summary) });
        return void request.respond({ contentType: 'text/html', body: html });
      });
      await page.goto('http://fixture.test/dashboard');
      await page.waitForFunction(() => document.querySelector('#root').textContent.includes('Tracked KYC approval rate'));
      assert.match(await page.$eval('#root', (el) => el.textContent), /50%/);
      const clientText = await page.$eval('a[href="/clients"]', (el) => el.textContent);
      assert.match(clientText, /7/);
      assert.ok(await page.$('a[href="/kyc-workflow?filter=pending-kyc"]'));
      assert.ok(await page.$('a[href="/kyc-workflow?filter=pending-approvals"]'));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Dashboard must not overflow');
      await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true });
      summary = Object.fromEntries(Object.keys(summary).map((key) => [key, 0]));
      await page.reload(); await page.waitForFunction(() => document.querySelector('#root').textContent.includes('No pending work'));
      fail = true; await page.reload(); await page.waitForSelector('[role="alert"]');
      assert.equal(await page.$('a[href="/clients"]'), null, 'Failed requests must not display zero metric cards');
      assert.match(await page.$eval('[role="alert"]', (el) => el.textContent), /Synthetic summary unavailable/);
      assert.deepEqual(errors, []); await page.close();
    }
    console.log(`Dashboard browser checks passed: API-driven counts, percentage, empty/error states and desktop/mobile layout. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
