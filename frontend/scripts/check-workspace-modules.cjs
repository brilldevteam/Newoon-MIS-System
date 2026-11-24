// Synthetic browser navigation checks; never connects to an application database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer-core');

async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
    import {WorkspaceHomePage} from './frontend/src/pages/WorkspaceHomePage';
    import {ModuleDashboardPage} from './frontend/src/pages/ModuleDashboardPage';
    import {AppLayout} from './frontend/src/layouts/AppLayout';
    import {api} from './frontend/src/services/api';
    import {availableWorkspaceModules,navigationInWorkspace,workspaceForPath} from './frontend/src/utils/workspace-modules';
    import {defaultRouteForUser} from './frontend/src/utils/access-control';
    import {monthlyDashboardPoints} from './frontend/src/components/DashboardCharts';
    const user={id:'synthetic',tenantId:'tenant-a',firstName:'Sample',lastName:'User',email:'sample@example.test',roles:['OPERATING_TEAM'],accessControlConfigured:true,permissions:['enquiries.view','kyc.view','screening.view','crrf.view','approvals.view','compliance.view']};
    if(location.search.includes('restricted'))user.permissions=['crrf.view'];
    if(location.search.includes('none'))user.permissions=[];
    const calls=[];window.apiCalls=calls;
    api.defaults.adapter=async config=>{
      calls.push(config.url);
      if(location.search.includes('failure')&&config.url==='/enquiries')throw new Error('Synthetic service failure');
      let data=config.url==='/auth/me'?user:config.url.includes('notifications')?[]:{...user,profile:{}};
      const date=(months)=>new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()-months,1)).toISOString();
      if(config.url==='/enquiries')data=[{id:'enq-1',enquiryCode:'ENQ-SAMPLE-1',companyName:'Sample Enquiry',status:'DRAFT',enquiryType:'PROPOSED_COMPANY',createdAt:date(0)},{id:'enq-2',enquiryCode:'ENQ-SAMPLE-2',companyName:'Returned Enquiry',status:'RETURNED_TO_BD',enquiryType:'EXISTING_LEGAL_ENTITY',createdAt:date(1)},{id:'enq-3',enquiryCode:'ENQ-SAMPLE-3',companyName:'Converted Enquiry',status:'CONVERTED_TO_KYC',enquiryType:'CURRENT_CLIENT_NEW_SERVICES',createdAt:date(2)}];
      if(config.url==='/kyc')data=[{id:'case-1',kycNumber:'KYC-SAMPLE-1',title:'Sample KYC',status:'KYC_FINAL_APPROVED',purpose:'ONBOARDING',createdAt:date(0)},{id:'case-2',kycNumber:'KYC-SAMPLE-2',title:'Active KYC',status:'CLIENT_ACTIVE',purpose:'REKYC',createdAt:date(1)}];
      if(config.url==='/compliance/clients')data={access:{level:location.search.includes('allocated')?'ALLOCATED':'FULL'},items:[{id:'client-1',clientCode:'CL-SAMPLE-1',name:'Sample Compliance Client',status:'ACTIVE'}],stats:{total:25,active:20,inactive:3,onHold:2,highRisk:4,reviewOverdue:2,reviewDueSoon:1,expiringDocuments:3}};
      if(location.search.includes('empty')&&config.url==='/enquiries')data=[];
      return {data,status:200,statusText:'OK',headers:{},config};
    };
    localStorage.setItem('newoon_token','synthetic-only');
    window.rules={availableWorkspaceModules,navigationInWorkspace,workspaceForPath,defaultRouteForUser,monthlyDashboardPoints,user};
    function Destination(){const {pathname}=useLocation();return <h1 data-destination>{pathname}</h1>}
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/workspace']}><Routes><Route element={<AppLayout/>}><Route path='/workspace' element={<WorkspaceHomePage/>}/><Route path='/enquiries/dashboard' element={<ModuleDashboardPage module='enquiry'/>}/><Route path='/kyc-workflow/dashboard' element={<ModuleDashboardPage module='kyc'/>}/><Route path='/compliance/dashboard' element={<ModuleDashboardPage module='compliance'/>}/><Route path='*' element={<Destination/>}/></Route></Routes></MemoryRouter>);
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') }, logLevel: 'error' });
  const css = fs.readdirSync('frontend/dist/assets').find(name => name.endsWith('.css'));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join('frontend/dist/assets',css),'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text}</script></body></html>`;
  const output = path.join(os.tmpdir(),'newoon-workspace-modules'); fs.mkdirSync(output,{recursive:true});
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless:true,args:['--no-sandbox'] });
  try {
    for(const width of [1440,768,390,320]) {
      const page=await browser.newPage(); const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await page.setViewport({width,height:960}); await page.setRequestInterception(true);
      page.on('request',request=>{
        const asset=path.join('frontend/public',new URL(request.url()).pathname);
        if(request.url().includes('/brand/') && fs.existsSync(asset)) return request.respond({contentType:'image/png',body:fs.readFileSync(asset)});
        return request.respond({contentType:'text/html',body:html});
      });
      await page.goto('https://workspace.test'); await page.waitForSelector('main a[href="/enquiries/dashboard"]');
      assert.equal(await page.$('aside'),null,'Tile home must not render a sidebar');
      assert.equal(await page.$('button[aria-label="Open menu"]'),null,'Tile home must not show a menu toggle');
      assert.ok(await page.$('header a[aria-label="All workspaces"]'),'Workspace shortcut must remain in the header');
      assert.equal(await page.$eval('header',element=>element.getBoundingClientRect().x),0,'Home header must span the viewport');
      assert.equal(await page.$$eval('main a',links=>links.length),3);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.equal(await page.evaluate(()=>window.rules.defaultRouteForUser(window.rules.user)),'/workspace');
      assert.equal(await page.evaluate(()=>window.rules.navigationInWorkspace('/enquiries/abc/edit','/screening')),false);
      assert.equal(await page.evaluate(()=>window.rules.workspaceForPath('/kyc/abc/form')),'kyc');
      assert.deepEqual(await page.evaluate(()=>window.rules.monthlyDashboardPoints(['2026-10-12T10:00:00Z','2026-11-01T00:00:00Z','2026-12-01T00:00:00Z','invalid'],3,new Date('2026-11-24T12:00:00Z'))),[{label:'Sep',value:0},{label:'Oct',value:1},{label:'Nov',value:1}],'Monthly series must bucket actual timestamps and exclude invalid/future dates');
      await page.screenshot({path:path.join(output,`home-${width}.png`),fullPage:true});
      for(const destination of ['/enquiries/dashboard','/kyc-workflow/dashboard','/compliance/dashboard']) {
        const before=await page.evaluate(()=>window.apiCalls.length);
        await page.click('main a[href="'+destination+'"]'); await page.waitForSelector('[data-metric]');
        const metrics=await page.$$eval('[data-metric]',nodes=>Object.fromEntries(nodes.map(node=>[node.getAttribute('data-metric'),node.textContent])));
        const calls=await page.evaluate(before=>window.apiCalls.slice(before).filter(url=>['/enquiries','/kyc','/compliance/clients','/dashboard/summary'].includes(url)),before);
        if(destination.startsWith('/enquiries')) {assert.equal(metrics['Enquiry records'],'3');assert.equal(metrics['Drafts'],'1');assert.deepEqual(calls,['/enquiries']);}
        if(destination.startsWith('/kyc-workflow')) {assert.equal(metrics['KYC cases'],'2');assert.equal(metrics['Final KYC approved'],'1');assert.deepEqual(calls,['/kyc']);}
        if(destination.startsWith('/compliance')) {assert.equal(metrics['Compliance clients'],'25','Must use authoritative stats, not current page length');assert.equal(metrics['High risk'],'4');assert.deepEqual(calls,['/compliance/clients']);}
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Dashboard must fit the viewport');
        assert.ok(await page.$('aside a[href="'+destination+'"]'),'Sidebar Dashboard must link to this module');
        assert.ok(await page.$('[data-chart="bars"]'),'Show a real module bar chart');
        const mixTotal=await page.$$eval('[data-chart="donut"] circle[data-chart-value]',nodes=>nodes.reduce((sum,node)=>sum+Number(node.getAttribute('data-chart-value')),0));
        assert.equal(mixTotal,Number(Object.values(metrics)[0]),'Exclusive donut categories must equal the authoritative module total');
        assert.ok(await page.$$eval('[data-chart-value]',nodes=>nodes.every(node=>Number.isFinite(Number(node.getAttribute('data-chart-value'))))),'Every plotted value must be a real finite count');
        if(!destination.startsWith('/compliance')) {
          await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='12M').click());
          await page.waitForFunction(()=>document.querySelectorAll('[data-chart="bars"] [data-chart-value]').length===12);
          await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='6M').click());
          await page.waitForFunction(()=>document.querySelectorAll('[data-chart="bars"] [data-chart-value]').length===6);
        }
        const requestCount=await page.evaluate(()=>window.apiCalls.length);
        await page.click('button[aria-label="Refresh dashboard"]');
        await page.waitForFunction(before=>window.apiCalls.length>before,{},requestCount);
        await page.waitForSelector('[data-metric]');
        const hrefs=await page.$$eval('aside a',links=>links.map(link=>link.getAttribute('href')));
        if(width<1024) {
          await page.click('button[aria-label="Open menu"]');
          await page.waitForSelector('[role="dialog"][aria-label="Main menu"]');
          const drawer=await page.$$eval('[role="dialog"] nav a',links=>links.map(link=>link.getAttribute('href')));
          assert.ok(drawer.includes(destination));
          if(destination==='/enquiries/dashboard')assert.ok(!drawer.includes('/screening'));
          await page.keyboard.press('Escape');
          await page.waitForFunction(()=>!document.querySelector('[role="dialog"][aria-label="Main menu"]'));
        }
        if(width>=1024) {
          if(destination==='/enquiries/dashboard') { assert.ok(hrefs.includes('/enquiries')); assert.ok(!hrefs.includes('/kyc-workflow')); }
          if(destination==='/kyc-workflow/dashboard') { assert.ok(hrefs.includes('/screening')); assert.ok(!hrefs.includes('/enquiries')); }
          if(destination==='/compliance/dashboard') { assert.ok(hrefs.includes('/compliance/clients')); assert.ok(!hrefs.includes('/crrf')); }
        }
        await page.screenshot({path:path.join(output,`${destination.split('/')[1]}-${width}.png`),fullPage:true});
        await page.click('header a[aria-label="All workspaces"]');
        await page.waitForSelector('main a[href="/enquiries/dashboard"]');
        assert.equal(await page.$('aside'),null,'Returning to the tile screen must remove sidebar');
      }
      assert.deepEqual(errors,[]); await page.close();
    }
    for(const scenario of ['restricted','none','failure','allocated','empty']) {
      const page=await browser.newPage(); await page.setRequestInterception(true); page.on('request',request=>request.respond({contentType:'text/html',body:html}));
      await page.goto('https://workspace.test?'+scenario);
      if(scenario==='restricted') {
        await page.waitForSelector('main a[href="/kyc-workflow/dashboard"]'); assert.equal(await page.$$eval('main a',links=>links.length),1);
        await page.click('main a[href="/kyc-workflow/dashboard"]'); await page.waitForSelector('main a[href="/crrf"]');
        assert.equal(await page.$('[data-metric]'),null);
        assert.equal(await page.evaluate(()=>window.apiCalls.includes('/kyc')),false,'CRRF-only user must not fetch KYC cases');
      } else if(scenario==='failure') {
        await page.waitForSelector('main a[href="/enquiries/dashboard"]'); await page.click('main a[href="/enquiries/dashboard"]'); await page.waitForSelector('[role=alert]');
        assert.equal(await page.$('[data-metric]'),null,'Failed requests must not produce fake zeros');
      } else if(scenario==='empty') {
        await page.waitForSelector('main a[href="/enquiries/dashboard"]'); await page.click('main a[href="/enquiries/dashboard"]'); await page.waitForSelector('[data-metric]');
        assert.equal(await page.$eval('[data-metric="Enquiry records"]',node=>node.textContent),'0');
        assert.ok(await page.evaluate(()=>document.querySelector('main').textContent.includes('No records yet.')));
      } else if(scenario==='allocated') {
        await page.waitForSelector('main a[href="/compliance/dashboard"]'); await page.click('main a[href="/compliance/dashboard"]'); await page.waitForSelector('[data-metric]');
        assert.equal(await page.$('[data-metric="High risk"]'),null,'Allocated staff must not see hidden AML statistics');
        assert.ok(await page.$('[data-metric="Inactive clients"]'));
        assert.equal(await page.$('[data-chart="bars"]'),null,'Allocated staff must not see hidden compliance attention charts');
      } else await page.waitForFunction(()=>document.body.textContent.includes('No module access has been assigned'));
      await page.close();
    }
    console.log('Workspace dashboard checks passed: three module dashboards, isolated data sources and counts, authoritative compliance stats, contextual menus, restricted/allocated access, errors without fake zeros and 1440/768/390/320px. Screenshots: '+output);
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
