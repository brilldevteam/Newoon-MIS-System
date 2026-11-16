const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

async function run() {
  const compiled = esbuild.buildSync({ stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {LoginPage} from './frontend/src/pages/LoginPage'; import {UsersPage} from './frontend/src/pages/UsersPage'; createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[window.location.pathname]}><Routes><Route path='/login' element={<LoginPage/>}/><Route path='/users' element={<main className='p-5'><UsersPage/></main>}/><Route path='/dashboard' element={<p>Dashboard fixture</p>}/></Routes></MemoryRouter>);`,
    resolveDir: process.cwd(), loader: 'tsx'
  }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const css = fs.readdirSync('frontend/dist/assets').find((name) => name.endsWith('.css'));
  const html = `<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>${fs.readFileSync(path.join('frontend/dist/assets', css), 'utf8')}</style></head><body><div id='root'></div><script>${compiled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check'] });
  const output = path.join(os.tmpdir(), 'newoon-account-ui-preview'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
      const page = await browser.newPage(); await page.setViewport({ width, height });
      const errors = []; const calls = [];
      let allowLogin = false;
      let readOnly = false;
      page.on('pageerror', (error) => errors.push(error.message));
      await page.evaluateOnNewDocument(() => localStorage.setItem('newoon_token', 'synthetic-token'));
      await page.setRequestInterception(true);
      const role = (name) => ({ role: { id: name, name } });
      const users = [{ id: 'admin', tenantId: 'tenant-a', firstName: 'Sample', lastName: 'Administrator', email: 'admin@example.invalid', status: 'ACTIVE', createdAt: '2026-10-29', tenant: { id: 'tenant-a', name: 'Sample Company' }, roles: [role('COMPANY_ADMIN')] }];
      const options = { roles: ['COMPANY_ADMIN', 'OPERATING_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'SEF'].map((name) => ({ name })), tenants: [{ id: 'tenant-a', name: 'Sample Company' }] };
      page.on('request', async (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.woff2')) {
          const file = path.join('frontend/dist/assets', path.basename(url.pathname));
          return void request.respond({ contentType: 'font/woff2', body: fs.readFileSync(file) });
        }
        const respond = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (!url.pathname.startsWith('/api/')) return void request.respond({ contentType: 'text/html', body: html });
        const body = request.postData() ? JSON.parse(request.postData()) : {};
        if (url.pathname === '/api/auth/login') return void respond(allowLogin ? { accessToken: 'fixture-token' } : { error: { message: 'Invalid email or password' } }, allowLogin ? 200 : 401);
        if (url.pathname === '/api/auth/me') return void respond({ id: 'admin', tenantId: 'tenant-a', roles: ['COMPANY_ADMIN'], email: 'admin@example.invalid', firstName: 'Sample', lastName: 'Administrator', ...(readOnly ? { accessControlConfigured: true, permissions: ['administration.view'] } : {}) });
        if (url.pathname === '/api/users/options') return void respond(options);
        if (url.pathname === '/api/users' && request.method() === 'GET') return void respond(users);
        if (url.pathname === '/api/users' && request.method() === 'POST') {
          calls.push({ action: 'create', roles: body.roles, tenantId: body.tenantId });
          const result = { ...users[0], ...body, id: 'reviewer', roles: body.roles.map(role) }; delete result.password;
          users.push(result); return void respond(result, 201);
        }
        if (url.pathname.endsWith('/reset-password')) { calls.push({ action: 'reset', hasPassword: Boolean(body.password) }); return void respond({ success: true }); }
        if (url.pathname === '/api/users/reviewer' && request.method() === 'PATCH') { calls.push({ action: 'update', status: body.status }); return void respond({ ...users[1], ...body, roles: body.roles.map(role) }); }
        return void respond({ message: 'Not found' }, 404);
      });
      const clickText = async (text) => {
        const buttons = await page.$$('button');
        for (const button of buttons) if ((await button.evaluate((el) => el.textContent.trim())) === text) return button.click();
        throw new Error('Button not found: ' + text);
      };
      const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), name + ' has horizontal page overflow');
      await page.goto('http://fixture.test/login');
      assert.equal(await page.$eval('#login-email', (el) => el.value), '');
      assert.equal(await page.$eval('#login-password', (el) => el.value), '');
      assert.ok(!(await page.$eval('body', (el) => el.innerText)).includes('Workflow test access'));
      assert.match(await page.$eval('h1', (el) => el.textContent), /Get Started Now/);
      assert.equal(await page.$eval('aside', (el) => getComputedStyle(el).display !== 'none'), width >= 1024);
      const dimensions = await page.evaluate(() => ['login-email', 'login-password'].map((id) => { const rect = document.getElementById(id).parentElement.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
      assert.deepEqual(dimensions[0], dimensions[1], 'Login input containers must have equal dimensions');
      await page.screenshot({ path: path.join(output, `${name}-login-empty.png`), fullPage: true });
      await page.click('[aria-label="Show password"]');
      assert.equal(await page.$eval('#login-password', (el) => el.type), 'text');
      await page.click('[aria-label="Hide password"]');
      await page.type('#login-email', 'wrong@example.invalid'); await page.type('#login-password', 'Synthetic-wrong-password');
      await clickText('Log in'); await page.waitForSelector('[role="alert"]');
      assert.match(await page.$eval('[role="alert"]', (el) => el.textContent), /Invalid email/);
      await noOverflow(); await page.screenshot({ path: path.join(output, `${name}-login.png`), fullPage: true });
      await page.goto('http://fixture.test/users'); await page.waitForFunction(() => document.querySelector('#root').textContent.includes('admin@example.invalid'));
      await clickText('Add user'); await page.waitForSelector('dialog[open]');
      await page.type('input[name="firstName"]', 'Sample'); await page.type('input[name="lastName"]', 'Reviewer'); await page.type('input[name="email"]', 'reviewer@example.invalid');
      await page.evaluate(() => { const label = [...document.querySelectorAll('dialog label')].find((el) => el.textContent === 'DMLRO'); label.querySelector('input').click(); });
      await page.type('#account-password', 'Synthetic-long-password-2026'); await page.type('#account-confirmation', 'Synthetic-long-password-2026');
      assert.ok(await page.$eval('#account-dialog-title', (el) => el.getBoundingClientRect().top >= 0), 'Dialog title must stay visible');
      await noOverflow(); await page.screenshot({ path: path.join(output, `${name}-add-user.png`), fullPage: true });
      await clickText('Create user'); await page.waitForFunction(() => !document.querySelector('dialog'));
      assert.deepEqual(calls[0], { action: 'create', roles: ['DMLRO'], tenantId: undefined });
      await page.click('[aria-label="Edit reviewer@example.invalid"]');
      await page.select('dialog select', 'SUSPENDED'); await clickText('Save changes'); await page.waitForFunction(() => !document.querySelector('dialog'));
      assert.ok(calls.some((call) => call.action === 'update' && call.status === 'SUSPENDED'));
      await page.click('[aria-label="Reset password for reviewer@example.invalid"]');
      await page.type('#account-password', 'Another-synthetic-password-2026'); await page.type('#account-confirmation', 'Another-synthetic-password-2026');
      await clickText('Update password'); await page.waitForFunction(() => !document.querySelector('dialog'));
      assert.ok(calls.some((call) => call.action === 'reset'));
      await noOverflow(); await page.screenshot({ path: path.join(output, `${name}-users.png`), fullPage: true });
      await page.type('[aria-label="Search users"]', 'nothing-matches');
      await page.waitForFunction(() => document.querySelector('#root').textContent.includes('No matching users.'));
      readOnly = true;
      await page.goto('http://fixture.test/users');
      await page.waitForFunction(() => document.querySelector('#root').textContent.includes('admin@example.invalid'));
      assert.equal(await page.$('[aria-label="Edit admin@example.invalid"]'), null);
      assert.ok(!(await page.$eval('body', (el) => el.innerText)).includes('Add user'));
      allowLogin = true;
      await page.goto('http://fixture.test/login');
      await page.type('#login-email', 'admin@example.invalid'); await page.type('#login-password', 'Synthetic-valid-password');
      await clickText('Log in'); await page.waitForFunction(() => document.querySelector('#root').textContent.includes('Dashboard fixture'));
      assert.equal(await page.evaluate(() => localStorage.getItem('newoon_token')), 'fixture-token');
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('Desktop/mobile login and user creation/edit/suspension/password reset checks passed with synthetic API fixtures. Screenshots: ' + output);
  } finally { await browser.close(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
