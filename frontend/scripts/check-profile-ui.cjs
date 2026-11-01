const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {AccountMenu} from './frontend/src/components/AccountMenu'; import {MyProfilePage} from './frontend/src/pages/MyProfilePage'; createRoot(document.getElementById('root')).render(<MemoryRouter><header className='flex justify-end p-4'><AccountMenu name='Sample Person' role='SEF' logout={()=>localStorage.removeItem('newoon_token')}/></header><main className='p-4'><Routes><Route path='/' element={<p>Workspace</p>}/><Route path='/account/profile' element={<MyProfilePage/>}/></Routes></main></MemoryRouter>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id='root'></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const output = path.join(os.tmpdir(), 'newoon-profile-preview'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage(); await page.setViewport({ width, height: 900 });
      const errors = []; page.on('pageerror', (err) => errors.push(err.message));
      let profile = { firstName: 'Sample', lastName: 'Person', email: 'sample@example.invalid', roles: [{ role: { name: 'SEF' } }], profile: { bio: 'Compliance reviewer', avatarDataUrl: null } }; let fail = false;
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.woff2')) return void request.respond({ contentType: 'font/woff2', body: fs.readFileSync(path.join(assets, path.basename(url.pathname))) });
        if (url.pathname === '/api/auth/profile') {
          if (request.method() === 'PATCH' && !fail) { const body = JSON.parse(request.postData()); assert.equal(body.roles, undefined); profile = { ...profile, firstName: body.firstName, lastName: body.lastName, profile: { bio: body.bio, avatarDataUrl: body.avatarDataUrl } }; }
          return void request.respond({ status: fail ? 400 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { message: 'Synthetic save failure' } : profile) });
        }
        return void request.respond({ contentType: 'text/html', body: html });
      });
      await page.goto('http://fixture.test'); await page.click('[aria-label="Account options"]'); await page.waitForSelector('#account-options');
      await page.screenshot({ path: path.join(output, `menu-${width}.png`) });
      await page.keyboard.press('Escape'); assert.equal(await page.$('#account-options'), null);
      await page.click('[aria-label="Account options"]'); await page.click('a[href="/account/profile"]'); await page.waitForSelector('#profile-bio');
      await page.type('#profile-bio', ' updated');
      await page.click('button[type="submit"]'); await page.waitForFunction(() => document.querySelector('#root').textContent.includes('Profile saved.'));
      assert.match(profile.profile.bio, /updated/);
      const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 10; return canvas.toDataURL().split(',')[1]; });
      const chooser = await page.$('input[type="file"]'); const imagePath = path.join(output, `avatar-${width}.png`); fs.writeFileSync(imagePath, Buffer.from(png, 'base64')); await chooser.uploadFile(imagePath);
      await page.waitForSelector('img[alt="Profile picture"]'); await page.click('button[type="submit"]');
      await page.waitForFunction(() => document.querySelector('#root').textContent.includes('Profile saved.'));
      await page.click('[aria-label="Remove picture"]'); await page.click('button[type="submit"]');
      await page.waitForFunction(() => document.querySelector('#root').textContent.includes('Profile saved.')); assert.equal(profile.profile.avatarDataUrl, null);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `profile-${width}.png`), fullPage: true });
      fail = true; await page.click('button[type="submit"]'); await page.waitForSelector('[role="alert"]'); assert.deepEqual(errors, []); await page.close();
    }
    console.log(`Profile browser checks passed: dropdown/Escape, navigation, save, picture/remove, error and desktop/mobile layout. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
