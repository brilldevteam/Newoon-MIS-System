// Uses the actual enquiry editor with synthetic saved draft responses only.
const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path');
const esbuild=require('esbuild'); const puppeteer=require('puppeteer-core');
async function main(){
  const output=path.join(require('node:os').tmpdir(),'newoon-person-layout');fs.mkdirSync(output,{recursive:true});
  const bundle=esbuild.buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AddEnquiryPage} from './frontend/src/pages/AddEnquiryPage';import {AppLayout} from './frontend/src/layouts/AppLayout';localStorage.setItem('newoon_token','synthetic');createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/enquiries/synthetic/edit']}><Routes><Route element={<AppLayout/>}><Route path='/enquiries/:id/edit' element={<AddEnquiryPage/>}/></Route></Routes></MemoryRouter>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api')}});
  const assets='frontend/dist/assets';const css=fs.readdirSync(assets).find(name=>name.endsWith('.css'));
  const html=`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets,css),'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
  const person={fullName:'Uploaded Sample Person',qidNumber:'20000000001',passportNumber:'SYNPA12345',dateOfBirth:'1990-01-01',nationality:'Qatar'};
  const enquiry={id:'synthetic',enquiryCode:'ENQ-SYNTHETIC',enquiryType:'PROPOSED_COMPANY',status:'DRAFT',proposedCompanyName:'Synthetic Company',requestedServices:['N009 - Company Formation - QFC'],keyContactName:'Existing Contact',keyContactPhone:'+97455550000',keyContactPosition:'Director',attachments:[{documentType:'QID / Passport copies',fileName:'copy.pdf'}],details:{proposedLegalForm:'QFC LLC',jurisdictionOfRegistration:'QFC',countryOfIncorporation:'Qatar',proposedBusinessActivity:'Consulting',sourceOfInitialCapital:'Capital',proposedRegisteredOfficeAddress:'Doha',documentPeople:[{id:'read-person',files:['copy.pdf'],row:person}],preliminaryKyc:{shareholders:[{id:'owner',shareholderType:'Individual',fullName:'Existing Owner',ownershipPercentage:'100',nationality:'Qatar',identityNumber:'',address:'Qatar',isUbo:false}],ubos:[{id:'ubo',shareholderType:'Individual',fullName:'Existing UBO',ownershipPercentage:'25',nationality:'Qatar',identityNumber:'',address:'Qatar',isUbo:true}],management:[{id:'manager',fullName:'Existing Director',position:'Director',positions:['Director'],nationality:'Qatar',identityNumber:''}]}}};
  enquiry.attachments.push({id:'cr-copy',documentType:'Commercial Registration / CR Extract',fileName:'saved-cr.pdf',mimeType:'application/pdf'});
  enquiry.attachments.push({id:'signature',documentType:'Preliminary KYC - Authorised Signature',fileName:'signature.png',mimeType:'image/png'});
  const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox']});
  try{for(const width of [1920,1440,390]){
    const page=await browser.newPage();await page.setViewport({width,height:1000});const errors=[];page.on('pageerror',error=>errors.push(error.message));let payload;let copyViews=0;let companyReads=0;
    await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());let data;
      if(url.pathname.startsWith('/brand/')){const file=path.join('frontend/public',url.pathname);if(fs.existsSync(file))return request.respond({contentType:'image/png',body:fs.readFileSync(file)});}
      if(url.pathname.endsWith('.woff2'))return request.respond({contentType:'font/woff2',body:fs.readFileSync(path.join(assets,path.basename(url.pathname)))});
      if(url.pathname==='/api/auth/me')data={id:'operator',tenantId:'a',roles:['OPERATING_TEAM'],accessControlConfigured:true,permissions:['enquiries.view','enquiries.edit']};
      else if(url.pathname==='/api/auth/profile')data={firstName:'Synthetic',lastName:'Operator',roles:[],profile:null};
      else if(url.pathname==='/api/notifications')data=[];
      else if(url.pathname==='/api/clients')data=[];
      else if(url.pathname==='/api/enquiries/duplicate-check')data={duplicate:null};
      else if(url.pathname==='/api/enquiries/synthetic/attachments/cr-copy/view'){copyViews++;return request.respond({contentType:'application/pdf',body:Buffer.from('%PDF-1.4 synthetic')});}
      else if(url.pathname==='/api/enquiries/synthetic/attachments/signature/view'){errors.push('Signature must not be fetched for extraction');return request.respond({status:400,body:''});}
      else if(url.pathname==='/api/enquiries/company-documents/read'){companyReads++;data={company:{legalName:'Saved Copy Company',countryOfIncorporation:'Qatar'},people:[],method:'LOCAL',message:'Synthetic saved copy'};}
      else if(url.pathname==='/api/enquiries/synthetic'){if(request.method()==='PATCH'){payload=JSON.parse(request.postData());}data=enquiry;}
      else return request.respond({contentType:'text/html; charset=utf-8',body:html});
      return request.respond({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('https://roles.test');await page.waitForFunction(()=>document.body.textContent.includes('Enquiry type'));
    if(width>=1024){
      await page.waitForSelector('button[aria-label="Expand sidebar"]');
      assert.equal(await page.$eval('aside',aside=>Math.round(aside.getBoundingClientRect().width)),80,'Enquiry editor starts collapsed');
      await page.click('button[aria-label="Expand sidebar"]');await page.waitForSelector('button[aria-label="Collapse sidebar"]');
      await page.click('button[aria-label="Collapse sidebar"]');
    }
    const step=async name=>{await page.evaluate(name=>[...document.querySelectorAll('button')].find(button=>new RegExp('^\\d+\\s*'+name+'$').test(button.textContent.trim()))?.click(),name);};
    const pick=async selector=>{await page.waitForSelector(selector);await page.select(selector,'document:read-person');};
    await step('Ownership');await pick('select[aria-label="Select person"]');
    assert.ok(await page.$eval('article select[aria-label="Select person"]',select=>Boolean(select.compareDocumentPosition(select.closest('article').querySelector('input'))&Node.DOCUMENT_POSITION_FOLLOWING)),'Select person comes before name/identity fields');
    assert.ok(await page.$$eval('select[aria-label="Select person"]',nodes=>nodes.every(select=>select.getBoundingClientRect().width>200)),'Selectors remain full width, not compressed beside linked-role notes');
    assert.ok(await page.$$eval('input',nodes=>nodes.some(node=>node.value==='100')),'Shareholding is not copied from identity');
    const selectors=await page.$$('select[aria-label="Select person"]');
    assert.ok(selectors.length>=2,'Shareholder and UBO must each offer a person dropdown');
    await selectors[1].select('document:read-person');
    await page.screenshot({path:path.join(output,`ownership-${width}.png`),fullPage:true});
    await step('Management');await pick('select[aria-label="Select person"]');
    assert.ok(await page.evaluate(()=>document.body.textContent.includes('Director')),'Keep management position');
    await step('Contact');await pick('select[aria-label="Select person"]');
    assert.ok(await page.$$eval('input',nodes=>nodes.some(node=>node.value==='SYNPA12345')),'Contact gets the chosen passport');
    await page.click('[role="button"]');await page.waitForSelector('[data-searchable-select-menu]');
    await page.evaluate(()=>[...document.querySelectorAll('[data-searchable-select-menu] button')].find(button=>button.textContent.trim()==='CEO').click());
    await page.click('h1');
    const email=async value=>page.$eval('input[type=email]',(input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
    await email('invalid-email');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Update Enquiry')?.click());
    assert.equal(payload,undefined,'Invalid email cannot be saved');
    assert.ok(await page.$eval('#root',root=>root.textContent.includes('Enter a valid email address')));
    await email('sample.person+contact@example.test');
    const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/enquiries/synthetic'&&response.request().method()==='PATCH');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Update Enquiry')?.click());
    await saved;
    await page.waitForFunction(()=>document.getElementById('root').textContent.includes('Enquiry updated successfully.'));
    assert.equal(payload.details.documentPeople[0].row.passportNumber,'SYNPA12345','Save identity pool for reopening draft');
    assert.equal(payload.details.preliminaryKyc.shareholders[0].fullName,person.fullName);
    assert.equal(payload.details.preliminaryKyc.ubos[0].fullName,person.fullName);
    assert.equal(payload.details.preliminaryKyc.management[0].fullName,person.fullName);
    assert.equal(payload.details.preliminaryKyc.management[0].position,'Director');
    assert.equal(payload.keyContactName,person.fullName);
    assert.equal(payload.keyContactEmail,'sample.person+contact@example.test');
    assert.deepEqual(payload.keyContactPosition.split(', '),['Director','CEO'],'Save all selected contact positions');
    assert.equal(payload.details.preliminaryKyc.contact.position,'Director, CEO','Preliminary document data gets both positions');
    const changeType=async label=>{
      await step('Type');
      await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>['Existing Legal Entity','Proposed Company - No Legal Status Yet'].includes(button.textContent.trim())).click());
      await page.waitForSelector('[data-searchable-select-menu]');
      await page.evaluate(label=>[...document.querySelectorAll('[data-searchable-select-menu] button')].find(button=>button.textContent.trim()===label).click(),label);
      await page.waitForFunction(()=>document.getElementById('root').textContent.includes('Attached document details applied to the selected enquiry type.'));
    };
    await changeType('Existing Legal Entity');await step('Details');
    assert.ok(await page.$$eval('input',inputs=>inputs.some(input=>input.value==='Saved Copy Company')),'Apply saved CR to fields for the new type');
    await changeType('Proposed Company - No Legal Status Yet');await step('Details');
    assert.ok(await page.$$eval('input',inputs=>inputs.some(input=>input.value==='Synthetic Company')),'Preserve existing proposed company name');
    assert.equal(copyViews,1,'Saved document fetched through authorized view endpoint only once');
    assert.equal(companyReads,1,'Reuse saved-copy extraction for repeated type switches');
    assert.deepEqual(errors,[]);await page.close();
  }console.log('Uploaded person role checks passed: selector first/full width, collapsible enquiry sidebar, restored draft pool, all role pickers, multiple contact positions, email validation and saved payload at 1920/1440/390px.');}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
