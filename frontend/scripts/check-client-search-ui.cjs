const assert=require('node:assert/strict');
const fs=require('node:fs'); const path=require('node:path'); const os=require('node:os');
const esbuild=require('esbuild'); const puppeteer=require('puppeteer-core');
const {fixtures,actor,createSearchListService}=require('../../backend/scripts/check-client-search.cjs');
async function main(){
  const bundle=esbuild.buildSync({stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import {ComplianceClientListPage} from './frontend/src/pages/ComplianceClientListPage';import {ToastProvider} from './frontend/src/components/ToastProvider';
    localStorage.setItem('newoon_token','synthetic-only');
    createRoot(document.getElementById('root')).render(<MemoryRouter><ToastProvider><div className='p-4'><ComplianceClientListPage/></div></ToastProvider></MemoryRouter>);
  `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'error',define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api')}});
  const css=fs.readdirSync('frontend/dist/assets').find(name=>name.endsWith('.css'));
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join('frontend/dist/assets',css),'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;
  const output=path.join(os.tmpdir(),'newoon-client-search');fs.mkdirSync(output,{recursive:true});
  const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox']});
  const service=createSearchListService();const user={...actor(['AML_TEAM']),firstName:'Sample',lastName:'User',accessControlConfigured:true,permissions:['compliance.view']};
  try{
    for(const width of [1440,390]){
      const page=await browser.newPage();await page.setViewport({width,height:1000});const queries=[];const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request',async request=>{
        try{
          const url=new URL(request.url());
          if(!url.pathname.startsWith('/api/'))return request.respond({contentType:'text/html; charset=utf-8',body:html});
          if(url.pathname==='/api/auth/me')return request.respond({contentType:'application/json',body:JSON.stringify(user)});
          if(url.pathname==='/api/compliance/clients'){
            const filters=Object.fromEntries(url.searchParams);queries.push(filters.search||'');
            if(filters.search==='20000000001')await new Promise(resolve=>setTimeout(resolve,1000));
            const data=await service.list(user,filters);
            return request.respond({contentType:'application/json',body:JSON.stringify(data)});
          }
          throw new Error('Unexpected endpoint '+url.pathname);
        }catch(error){errors.push(error.message);await request.abort();}
      });
      await page.goto('https://search.test');const selector='input[aria-label="Search compliance clients and linked people"]';await page.waitForSelector(selector);
      const fill=async value=>{await page.$eval(selector,(input,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);};
      const passportResponse=page.waitForResponse(response=>new URL(response.url()).searchParams.get('search')==='SYNPA12345');
      await fill('SYNPA12345');await passportResponse;await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('Company one'));
      assert.ok(queries.includes('SYNPA12345'),'Passport must reach the backend');
      assert.ok(await page.evaluate(()=>document.querySelector('tbody').textContent.includes('Company two')),'Return all related client rows');
      const match=await page.$eval('[data-matched-person]',element=>element.textContent);
      assert.ok(match.includes('Alex Morgan')&&match.includes('20000000001')&&match.includes('SYNPA12345'),'Show exact matched person, QID and passport, not just company name');
      assert.ok(match.includes('Director'),'Show the matching person role');
      assert.ok(await page.$$eval('[data-search-match]',nodes=>nodes.some(node=>node.textContent.includes('Passport: SYNPA12345'))),'Identify the exact matching field');
      assert.ok(await page.$eval('[role="status"]',node=>node.textContent.includes('matching clients for SYNPA12345')),'Show an accurate search result summary');
      assert.ok(await page.$$eval('[data-matched-person]',nodes=>nodes.every(node=>!node.textContent.includes('Unrelated Director'))),'Do not include other people attached to the same company');
      await page.screenshot({path:path.join(output,`passport-${width}.png`),fullPage:true});
      await fill('Compliance Officer');await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('Company custom'));
      const editedPerson=fixtures.find(row=>row.id==='one').people[0];const oldEmail=editedPerson.email;
      editedPerson.email='browser.updated@example.test';
      const emailResponse=page.waitForResponse(response=>new URL(response.url()).searchParams.get('search')==='browser.updated@example.test');
      await fill('browser.updated@example.test');await emailResponse;await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('Company one'));
      assert.ok(await page.evaluate(()=>!document.querySelector('tbody').textContent.includes('Company two')),'Edited person email must match only its current related client');
      assert.ok(await page.$eval('[data-matched-person]',element=>element.textContent.includes('browser.updated@example.test')),'Person result must display the current edited email');
      editedPerson.email=oldEmail;
      await fill('20000000001');while(!queries.includes('20000000001'))await new Promise(resolve=>setTimeout(resolve,30));
      await fill('NO-RESULT');await page.waitForFunction(()=>document.querySelector('tbody')?.textContent.includes('No compliance clients match'));
      await new Promise(resolve=>setTimeout(resolve,1200));
      assert.ok(await page.evaluate(()=>document.querySelector('tbody').textContent.includes('No compliance clients match')),'Slow old QID response must not overwrite newer search');
      const qidResponse=page.waitForResponse(response=>new URL(response.url()).searchParams.get('search')==='20000000001');
      await fill('20000000001');await qidResponse;await page.waitForSelector('[data-matched-person]');
      await page.screenshot({path:path.join(output,`qid-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log('Client search browser checks passed at 1440/390px: actual register, actual compiled backend filter with synthetic records, passports/custom roles/edited person email, related client results and out-of-order request protection. Screenshots: '+output);
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
