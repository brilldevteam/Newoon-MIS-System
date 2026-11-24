// Synthetic, offline browser checks for document review. Uses no real client records or API credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React,{useState,useRef} from 'react'; import {createRoot} from 'react-dom/client';
    import {DocumentIntakePanel} from './frontend/src/components/DocumentIntakePanel';
    import {reviewedPatch} from './frontend/src/utils/document-intake';
    let active=0; let maxActive=0; const attempts={};
    function Fixture(){
      const [company,setCompany]=useState({legalName:'Existing Company',commercialRegistrationNo:''});
      const [person,setPerson]=useState({fullName:'Sample Person',passportNumber:''});
      const state=useRef({company,person}); state.current={company,person};
      window.intakeState=()=>({company,person,maxActive,attempts});
      return <main className='mx-auto max-w-5xl p-3'><DocumentIntakePanel company={company} companyTargets={[{field:'legalName',key:'legalName',label:'Legal name'},{field:'commercialRegistrationNo',key:'commercialRegistrationNo',label:'CR number'}]} targets={[{value:'contact',label:'Sample Person (Contact)',row:person}]} read={async(file,kind)=>{
        active++; maxActive=Math.max(maxActive,active); attempts[file.name]=(attempts[file.name]||0)+1;
        try { await new Promise(resolve=>setTimeout(resolve,150));
          if(file.name.includes('retry')&&attempts[file.name]===1)throw new Error('Temporary read failure. Try again.');
          if(kind==='PASSPORT')return {kind:'IDENTITY',data:{found:true,identityType:'PASSPORT',documentNumber:'SYN1234',nameOnDocument:'SAMPLE PERSON',dateOfBirth:null,expiryDate:null,documentNumberCheck:'OK',typeMatches:true,expiryValid:true,nationality:'',issuingCountry:''}};
          return {kind:'COMPANY',data:{company:{legalName:'Extracted Company',commercialRegistrationNo:'CR123'},people:[],method:'LOCAL',message:'Synthetic extraction. Verify the source.'}};
        }finally{active--;}
      }} apply={async(application)=>{if(application.kind==='COMPANY')setCompany({...state.current.company,...reviewedPatch(state.current.company,application.fields)});else setPerson({...state.current.person,...reviewedPatch(state.current.person,application.fields)});}}/></main>;
    } createRoot(document.getElementById('root')).render(<Fixture/>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'error', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find(name => name.endsWith('.css'));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;
  const output = path.join(os.tmpdir(), 'newoon-document-intake-check'); fs.mkdirSync(output, { recursive: true });
  for (const name of ['company.png', 'passport.png', 'retry.png']) fs.writeFileSync(path.join(output, name), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  const clickText = async(page, text) => page.evaluate(text => { const button = [...document.querySelectorAll('button')].find(el => el.textContent === text); if(!button)throw new Error('Missing button: '+text+'; '+document.getElementById('root').textContent); button.click(); }, text);
  try {
    for (const width of [1440, 768, 390, 320]) {
      const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({ width, height: 1000 });
      await page.setRequestInterception(true); page.on('request', request => request.url().startsWith('https://intake.test') ? request.respond({ contentType: 'text/html', body: html }) : request.continue());
      await page.goto('https://intake.test');
      await page.waitForSelector('input[type=file]');
      await (await page.$('input[type=file]')).uploadFile(path.join(output, 'company.png'), path.join(output, 'passport.png'), path.join(output, 'retry.png'));
      await page.waitForFunction(() => document.getElementById('root').textContent.includes('Temporary read failure'));
      assert.equal(await page.evaluate(() => window.intakeState().maxActive), 1, 'Reads must be sequential');
      assert.equal(await page.evaluate(() => window.intakeState().company.commercialRegistrationNo), '', 'No changes before confirmation');
      await clickText(page, 'Review'); await page.waitForSelector('[role=dialog]');
      assert.equal(await page.$eval('input[aria-label="Suggested Legal name"]', el => el.closest('div').querySelector('input[type=checkbox]').checked), false);
      await page.screenshot({ path: path.join(output, `review-${width}.png`) });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Review must fit viewport');
      await page.evaluate(() => [...document.querySelectorAll('label')].find(el => el.textContent.includes('I checked')).querySelector('input').click());
      await clickText(page, 'Apply selected details');
      await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
      assert.equal(await page.evaluate(() => window.intakeState().company.legalName), 'Existing Company');
      assert.equal(await page.evaluate(() => window.intakeState().company.commercialRegistrationNo), 'CR123');
      await clickText(page, 'Review'); await page.waitForSelector('[role=dialog]');
      assert.equal(await page.$eval('[role=dialog] button.bg-brand-600', el => el.disabled), true, 'Identity target is required');
      await page.select('[role=dialog] select', 'contact');
      await page.evaluate(() => [...document.querySelectorAll('label')].find(el => el.textContent.includes('I checked')).querySelector('input').click());
      await clickText(page, 'Apply selected details');
      await page.waitForFunction(() => window.intakeState().person.passportNumber === 'SYN1234');
      await page.click('button[title="Retry document"]');
      await page.waitForFunction(() => window.intakeState().attempts['retry.png'] === 2 && document.getElementById('root').textContent.includes('Needs review'));
      await page.screenshot({ path: path.join(output, `inbox-${width}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Inbox must fit viewport');
      assert.deepEqual(errors, []); await page.close();
    }
    console.log(`Document inbox browser checks passed at 1440, 768, 390 and 320px: staged values, conflict protection, explicit identity target, sequential reading and individual retry. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
