// Synthetic browser regression for the preliminary document diagram and preview controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {PreliminaryKycDocument} from './frontend/src/components/PreliminaryKycDocument';
    import {DocumentPreviewFrame} from './frontend/src/components/DocumentPreviewFrame';
    import {OwnershipStructureDiagram} from './frontend/src/components/OwnershipStructureDiagram';
    const shareholders=[{id:'company',fullName:'Example Holdings Limited',shareholderType:'Corporate Entity',ownershipPercentage:100}];
    const ubos=[{id:'person',parentRowId:'company',fullName:'Sample Beneficial Owner',ownershipPercentage:100,isUbo:true}];
    createRoot(document.getElementById('root')).render(<DocumentPreviewFrame structure={<OwnershipStructureDiagram rootName='Example Client' rows={shareholders} ubos={ubos}/>}><PreliminaryKycDocument data={{companyName:'Example Client',shareholders,ubos,management:[],documents:[]}} embedded/></DocumentPreviewFrame>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'error' });
  const assets = 'frontend/dist/assets';
  const css = fs.readdirSync(assets).find(name => name.endsWith('.css'));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  const output = path.join(os.tmpdir(), 'newoon-kyc-preview-check');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 768, 390, 320]) {
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width, height: 1000 });
      await page.setContent(html);
      await page.waitForSelector('[data-ownership-diagram] svg path');
      await new Promise(resolve => setTimeout(resolve, 150));
      assert.equal(await page.$$eval('[data-ownership-diagram] svg path', items => items.length), 4);
      assert.ok(await page.$eval('[data-ownership-diagram]', el => el.textContent.includes('Example Holdings Limited') && el.textContent.includes('Sample Beneficial Owner')));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow at ${width}`);
      await page.screenshot({ path: path.join(output, `document-${width}.png`), fullPage: true });
      await page.$eval('[data-ownership-diagram]', el => el.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: path.join(output, `diagram-${width}.png`) });
      await page.select('select[aria-label="Document zoom"]', '1.25');
      assert.equal(await page.$eval('select', el => el.value), '1.25');
      await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent === 'Structure').click());
      await page.waitForSelector('[data-ownership-diagram] svg');
      assert.equal(await page.$eval('button[aria-pressed="true"]', el => el.textContent), 'Structure');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, `structure-${width}.png`) });
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log(`KYC preview checks passed at 1440, 768, 390 and 320 pixels. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
