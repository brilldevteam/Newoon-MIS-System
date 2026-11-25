// Synthetic browser test; no database or real documents.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');
const ts = require('typescript');
async function main() {
  const source=fs.readFileSync('frontend/src/pages/AddEnquiryPage.tsx','utf8');
  const ast=ts.createSourceFile('enquiry.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const names=['enquirySteps','attachmentTemplates','mergeAttachmentTemplates','isAdditionalAttachment','hasAttachmentContent'];
  const functions=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(ast)).join('\n');
  const helpers=new Function('kycDocumentTypes',ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+'; return {enquirySteps,mergeAttachmentTemplates};')(['Commercial Registration / CR Extract','Entity Card / Computer Card','Certificate of Incorporation','Articles of Association','QID / Passport copies','CR of legal entity parties','National address certificates','Latest Audited Financial Statements','Tax Card']);
  for(const type of ['EXISTING_LEGAL_ENTITY','PROPOSED_COMPANY','CURRENT_CLIENT_NEW_SERVICES']) {
    const steps=helpers.enquirySteps(type); assert.equal(steps[1].id,'attachments'); assert.equal(steps.filter(step=>step.id==='attachments').length,1);
  }
  const saved={documentType:'Identity Proof - Proposed Director',fileName:'legacy.pdf',storedFiles:[{fileName:'legacy.pdf',storagePath:'synthetic-only'}]};
  const merged=helpers.mergeAttachmentTemplates('PROPOSED_COMPANY','QFC LLC',[saved]);
  assert.equal(merged.length,10); assert.equal(merged[9],saved,'Preserve uploaded legacy categories and their stored file metadata');
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {MemoryRouter} from 'react-router-dom'; import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage';
    localStorage.setItem('newoon_token','synthetic');
    createRoot(document.getElementById('root')).render(<MemoryRouter><AddEnquiryPage/></MemoryRouter>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets';
  const css = fs.readdirSync(assets).find(name => name.endsWith('.css'));
  const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets,css),'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  const output = path.join(os.tmpdir(),'newoon-enquiry-attachments'); fs.mkdirSync(output,{recursive:true});
  try {
    for (const width of [1440,390]) {
      const page = await browser.newPage(); await page.setViewport({width,height:1000});
      const errors=[]; const reads=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.setRequestInterception(true);
      page.on('request',async request=>{
        const url = new URL(request.url()); let data;
        if(url.pathname==='/api/auth/me') data={id:'operator',tenantId:'synthetic',roles:['OPERATING_TEAM'],accessControlConfigured:true,permissions:['enquiries.view','enquiries.edit']};
        else if(url.pathname==='/api/clients') data=[];
        else if(url.pathname==='/api/enquiries/duplicate-check') data={duplicate:null};
        else if(url.pathname==='/api/enquiries/company-documents/read') {
          reads.push('company'); data={company:{legalName:'Synthetic Extract Company',countryOfIncorporation:'Qatar'},people:[],method:'LOCAL',message:'Synthetic'};
        } else if(url.pathname==='/api/enquiries/identity-documents/read') {
          reads.push('identity'); data={found:true,identityType:'QID',documentNumber:'20000000001',nameOnDocument:'SAMPLE PERSON',dateOfBirth:'1990-01-01',expiryDate:'2030-01-01',documentNumberCheck:'OK',expiryValid:true,typeMatches:true,nationality:'Qatar',qid:{number:'20000000001',expiry:'2030-01-01'},passport:{number:'SYNPA12345',expiry:'2031-02-01'}};
          if(reads.filter(item=>item==='identity').length===2) data={...data,documentNumber:'20000000002',nameOnDocument:'SECOND PERSON',qid:{number:'20000000002',expiry:'2030-01-01'},passport:undefined};
        } else return request.respond({contentType:'text/html; charset=utf-8',body:html});
        return request.respond({contentType:'application/json',body:JSON.stringify(data)});
      });
      const click = text => page.evaluate(text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text)?.click(),text);
      await page.goto('https://attachments.test'); await page.waitForFunction(()=>document.body.textContent.includes('Enquiry type'));
      assert.equal(await page.$('[aria-label="Document inbox"]'),null);
      const steps=await page.$$eval('button',nodes=>nodes.map(node=>node.textContent.trim()).filter(text=>/^\d+/.test(text)));
      assert.match(steps[1],/^2\s*Attachments$/); assert.equal(steps.filter(text=>text.includes('Attachments')).length,1);
      await click('Next'); await page.waitForFunction(()=>document.body.textContent.includes('Required Attachment Options'));
      const upload = async (index,names) => page.$$eval('input[type=file]',(inputs,{index,names})=>{
        const transfer=new DataTransfer(); for(const name of names)transfer.items.add(new File(['synthetic'],name,{type:'application/pdf'}));
        inputs[index].files=transfer.files; inputs[index].dispatchEvent(new Event('change',{bubbles:true}));
      },{index,names});
      assert.equal(await page.$$eval('input[type=file]',nodes=>nodes.length),9,'Same nine categories as KYC');
      const labels=await page.$$eval('input[type=file]',nodes=>nodes.map(node=>node.parentElement.parentElement.parentElement.firstElementChild.textContent.trim()));
      assert.deepEqual(labels,['Commercial Registration / CR Extract','Entity Card / Computer Card','Certificate of Incorporation','Articles of Association','QID / Passport copies','CR of legal entity parties','National address certificates','Latest Audited Financial Statements','Tax Card']);
      await upload(0,['company-one.pdf','company-two.pdf']);
      await page.waitForFunction(()=>document.body.textContent.includes('company-two.pdf:'));
      assert.equal(reads.filter(item=>item==='company').length,2,'Read every file in a batch');
      await upload(4,['combined-identity.pdf','other-identity.pdf']);
      await page.waitForFunction(()=>document.body.textContent.includes('other-identity.pdf:'));
      await page.screenshot({path:path.join(output,`attachments-${width}.png`),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await click('Next'); await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='Synthetic Extract Company'));
      await page.click('[role="button"]'); await page.waitForSelector('[data-searchable-select-menu] button');
      await page.click('[data-searchable-select-menu] button');
      await page.click('h1');
      await click('Next'); await page.waitForSelector('select[aria-label="Select person"]');
      assert.equal(await page.$$eval('input[type=file]',nodes=>nodes.length),0,'Contact must not repeat the attachment uploader');
      const choice=await page.$eval('select[aria-label="Select person"]',select=>[...select.options].find(option=>option.text.includes('Sample Person')).value);
      await page.select('select[aria-label="Select person"]',choice);
      await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='SYNPA12345'));
      const values=await page.$$eval('input',nodes=>nodes.map(node=>node.value));
      assert.ok(values.includes('20000000001')&&values.includes('SYNPA12345'),'Fill both identity numbers from one copy');
      assert.ok(await page.$eval('[data-contact-copies]',node=>node.textContent.includes('combined-identity.pdf')&&!node.textContent.includes('other-identity.pdf')),'Only the selected person copies appear beside identity fields');
      await page.evaluate(()=>{window.open=url=>{window.syntheticOpenedCopy=url;return null;};});
      await page.click('[data-contact-copies] button[aria-label="View combined-identity.pdf"]');
      assert.ok(await page.evaluate(()=>window.syntheticOpenedCopy.startsWith('blob:')),'Pending identity copy can be viewed without uploading again');
      const second=await page.$eval('select[aria-label="Select person"]',select=>[...select.options].find(option=>option.text.includes('Second Person')).value);
      await page.select('select[aria-label="Select person"]',second);
      await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='20000000002'));
      assert.ok(await page.$$eval('input',inputs=>!inputs.some(input=>input.value==='SYNPA12345')),'Switching person cannot retain the previous passport');
      assert.ok(await page.$eval('[data-contact-copies]',node=>node.textContent.includes('other-identity.pdf')&&!node.textContent.includes('combined-identity.pdf')),'Switch the linked copy with the selected person');
      await page.screenshot({path:path.join(output,`person-picker-${width}.png`),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Person dropdown must fit the mobile viewport');
      const type=async label=>{
        await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>/^1\s*Type$/.test(button.textContent.trim()))?.click());
        await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>['Existing Legal Entity','Proposed Company - No Legal Status Yet'].includes(button.textContent.trim()))?.click());
        await page.waitForSelector('[data-searchable-select-menu]');
        await page.evaluate(label=>[...document.querySelectorAll('[data-searchable-select-menu] button')].find(button=>button.textContent.trim()===label)?.click(),label);
        await page.waitForFunction(()=>document.getElementById('root').textContent.includes('Attached document details applied to the selected enquiry type.'));
      };
      const readsBefore=reads.length;
      await type('Proposed Company - No Legal Status Yet');
      await click('Next');
      await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='Synthetic Extract Company'));
      assert.equal(reads.length,readsBefore,'Reuse extraction results after changing type, without another provider call');
      await page.evaluate(()=>{
        const input=[...document.querySelectorAll('input')].find(input=>input.value==='Synthetic Extract Company');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Manually Corrected Company');input.dispatchEvent(new Event('input',{bubbles:true}));
      });
      await type('Existing Legal Entity');
      await type('Proposed Company - No Legal Status Yet');
      await click('Next');
      await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(input=>input.value==='Manually Corrected Company'));
      assert.equal(reads.length,readsBefore,'Repeated switches must not reread the same attachments');
      assert.deepEqual(errors,[]); await page.close();
    }
    console.log('Enquiry attachment checks passed: no inbox, step 2 only, nine KYC categories, all batch files read, company autofill, combined QID/passport and desktop/mobile layout. Screenshots: '+output);
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
