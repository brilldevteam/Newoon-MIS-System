// Synthetic, offline browser checks for immediate document autofill. No real client records or API credentials.
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
      return <main className='mx-auto max-w-5xl p-3'><DocumentIntakePanel company={company} companyTargets={[{field:'legalName',key:'legalName',label:'Legal name'},{field:'commercialRegistrationNo',key:'commercialRegistrationNo',label:'CR number'}]} targets={[{value:'contact',label:'Sample Person (Contact)',row:person,nationalityOptions:['Nepal']}]} read={async(file,kind)=>{
        active++; maxActive=Math.max(maxActive,active); attempts[file.name]=(attempts[file.name]||0)+1;
        try { await new Promise(resolve=>setTimeout(resolve,150));
          if(file.name.includes('retry')&&attempts[file.name]===1)throw new Error('Temporary read failure. Try again.');
          if(kind==='PASSPORT')return {kind:'IDENTITY',data:{found:true,identityType:'QID',documentNumber:'29000000001',nameOnDocument:'SAMPLE PERSON',dateOfBirth:'1990-01-01',expiryDate:'2027-02-14',documentNumberCheck:'FAILED',readFromText:true,qid:{number:'29000000001',expiry:'2027-02-14'},passport:{number:'SYN1234',expiry:'2036-01-12'},typeMatches:false,expiryValid:true,nationality:'NEPAL',issuingCountry:''}};
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
      assert.equal(await page.$('[role=dialog]'), null, 'No review dialog');
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('button')].some(button => button.textContent === 'Review')), false, 'No review button');
      assert.equal(await page.evaluate(() => window.intakeState().company.legalName), 'Existing Company');
      assert.equal(await page.evaluate(() => window.intakeState().company.commercialRegistrationNo), 'CR123');
      const person = await page.evaluate(() => window.intakeState().person);
      assert.equal(person.passportNumber, 'SYN1234');
      assert.equal(person.passportExpiry, '2036-01-12');
      assert.equal(person.qidNumber, '29000000001');
      assert.equal(person.qidExpiry, '2027-02-14');
      assert.equal(person.nationality, 'Nepal');
      await page.click('button[title="Retry document"]');
      await page.waitForFunction(() => window.intakeState().attempts['retry.png'] === 2 && document.getElementById('root').textContent.includes('3 / 3 processed'));
      await page.screenshot({ path: path.join(output, `inbox-${width}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Inbox must fit viewport');
      const boxes = await page.$$eval('[data-document-card]', cards => cards.map(card => { const box = card.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
      assert.equal(boxes.length, 3, 'Each document must have its own box');
      if (width >= 768) {
        assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 1 && boxes[1].x > boxes[0].x, 'Attachment boxes should sit side by side');
      } else assert.ok(boxes[1].y > boxes[0].y, 'Mobile attachment boxes should stack');
      assert.deepEqual(errors, []); await page.close();
    }
    console.log(`Automatic inbox checks passed at 1440, 768, 390 and 320px: no review, protected existing values, both identity numbers/expiries, nationality, sequential reading and individual retry. Screenshots: ${output}`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
