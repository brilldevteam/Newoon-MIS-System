// Browser check of the email sign-in code step with synthetic API fixtures (no backend, no email).
// Run from the repository root after `npm run build -w frontend`: node frontend/scripts/check-login-otp-ui.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

const CHALLENGE = { otpRequired: true, challengeId: '0f9d6a4e-3a7c-4c2b-9b7e-5d2f1a0c8e11', maskedEmail: 'r*******@example.invalid', expiresInSeconds: 600, resendAfterSeconds: 2 };

async function run() {
  const compiled = esbuild.buildSync({ stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {LoginPage} from './frontend/src/pages/LoginPage'; createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/login']}><Routes><Route path='/login' element={<LoginPage/>}/><Route path='/dashboard' element={<p id='dashboard'>Dashboard fixture</p>}/></Routes></MemoryRouter>);`,
    resolveDir: process.cwd(), loader: 'tsx'
  }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const css = fs.readdirSync('frontend/dist/assets').find((name) => name.endsWith('.css'));
  const html = `<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>${fs.readFileSync(path.join('frontend/dist/assets', css), 'utf8')}</style></head><body><div id='root'></div><script>${compiled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check'] });
  const output = path.join(os.tmpdir(), 'newoon-login-otp-preview'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      const page = await browser.newPage(); await page.setViewport({ width, height });
      const errors = []; const calls = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.woff2')) return void request.respond({ contentType: 'font/woff2', body: fs.readFileSync(path.join('frontend/dist/assets', path.basename(url.pathname))) });
        const respond = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (!url.pathname.startsWith('/api/')) return void request.respond({ contentType: 'text/html', body: html });
        const body = request.postData() ? JSON.parse(request.postData()) : {};
        calls.push({ path: url.pathname, body });
        if (url.pathname === '/api/auth/login') return void respond(CHALLENGE);
        if (url.pathname === '/api/auth/login/resend') return void respond(CHALLENGE);
        if (url.pathname === '/api/auth/login/verify') {
          return void (body.code === '123456'
            ? respond({ accessToken: 'fixture-token', user: { id: 'u' } })
            : respond({ error: { message: 'Incorrect code. 4 attempts left.' } }, 401));
        }
        return void respond({ message: 'Not found' }, 404);
      });

      await page.goto('http://fixture.test/login');
      await page.type('#login-email', 'reviewer@example.invalid');
      await page.type('#login-password', 'Synthetic-password-only');
      await page.click('button[type=submit]');
      await page.waitForSelector('#login-code');
      const text = await page.$eval('body', (el) => el.innerText);
      assert.ok(text.includes('Check your email') && text.includes('r*******@example.invalid'), 'code step explains where the code went');
      assert.equal(await page.$eval('#login-code', (el) => el.getAttribute('autocomplete')), 'one-time-code');
      assert.equal(await page.evaluate(() => localStorage.getItem('newoon_token')), null, 'no session before the code is verified');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name} has horizontal overflow`);
      await page.screenshot({ path: path.join(output, `${name}-code-step.png`), fullPage: true });

      // Only digits are accepted, up to six.
      await page.type('#login-code', '12a-345678');
      assert.equal(await page.$eval('#login-code', (el) => el.value), '123456');

      // A wrong code shows the server message and clears the field.
      await page.$eval('#login-code', (el) => { el.value = ''; });
      await page.click('#login-code', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.type('#login-code', '000000');
      await page.click('button[type=submit]');
      await page.waitForFunction(() => document.body.innerText.includes('Incorrect code. 4 attempts left.'));
      assert.equal(await page.$eval('#login-code', (el) => el.value), '');

      // Resend is disabled during the cooldown, then sends a new code.
      const resendText = () => page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.startsWith('Resend'))?.textContent);
      assert.match(await resendText(), /Resend code in \d+s/);
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent === 'Resend code' && !button.disabled), { timeout: 5000 });
      await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Resend code').click());
      await page.waitForFunction(() => document.body.innerText.includes('A new code was sent'));
      assert.ok(calls.some((call) => call.path === '/api/auth/login/resend' && call.body.challengeId === CHALLENGE.challengeId));

      // The right code signs in.
      await page.type('#login-code', '123456');
      await page.click('button[type=submit]');
      await page.waitForSelector('#dashboard');
      assert.equal(await page.evaluate(() => localStorage.getItem('newoon_token')), 'fixture-token');
      assert.deepEqual(calls.filter((call) => call.path === '/api/auth/login/verify').map((call) => call.body.code), ['000000', '123456']);

      // "Use a different account" returns to the password step.
      await page.evaluate(() => localStorage.clear());
      await page.goto('http://fixture.test/login');
      await page.type('#login-email', 'reviewer@example.invalid');
      await page.type('#login-password', 'Synthetic-password-only');
      await page.click('button[type=submit]');
      await page.waitForSelector('#login-code');
      await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Use a different account').click());
      await page.waitForSelector('#login-password');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('Login code UI checks passed on desktop and mobile: code step, digit-only input, wrong-code message, resend cooldown, sign-in and back to password. Screenshots: ' + output);
}

run().catch((error) => { console.error(error); process.exit(1); });
