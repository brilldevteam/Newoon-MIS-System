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
    import {AppLayout} from './frontend/src/layouts/AppLayout';
    import {api} from './frontend/src/services/api';
    import {availableWorkspaceModules,navigationInWorkspace,workspaceForPath} from './frontend/src/utils/workspace-modules';
    import {defaultRouteForUser} from './frontend/src/utils/access-control';
    const user={id:'synthetic',tenantId:'tenant-a',firstName:'Sample',lastName:'User',email:'sample@example.test',roles:['OPERATING_TEAM'],accessControlConfigured:true,permissions:['enquiries.view','kyc.view','screening.view','crrf.view','approvals.view','compliance.view']};
    if(location.search.includes('restricted'))user.permissions=['crrf.view'];
    if(location.search.includes('none'))user.permissions=[];
    api.defaults.adapter=async config=>({data:config.url==='/auth/me'?user:config.url.includes('notifications')?[]:{...user,profile:{}},status:200,statusText:'OK',headers:{},config});
    localStorage.setItem('newoon_token','synthetic-only');
    window.rules={availableWorkspaceModules,navigationInWorkspace,workspaceForPath,defaultRouteForUser,user};
    function Destination(){const {pathname}=useLocation();return <h1 data-destination>{pathname}</h1>}
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/workspace']}><Routes><Route element={<AppLayout/>}><Route path='/workspace' element={<WorkspaceHomePage/>}/><Route path='*' element={<Destination/>}/></Route></Routes></MemoryRouter>);
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
      await page.goto('https://workspace.test'); await page.waitForSelector('main a[href="/enquiries"]');
      assert.equal(await page.$$eval('main a',links=>links.length),3);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.equal(await page.evaluate(()=>window.rules.defaultRouteForUser(window.rules.user)),'/workspace');
      assert.equal(await page.evaluate(()=>window.rules.navigationInWorkspace('/enquiries/abc/edit','/screening')),false);
      assert.equal(await page.evaluate(()=>window.rules.workspaceForPath('/kyc/abc/form')),'kyc');
      await page.screenshot({path:path.join(output,`home-${width}.png`),fullPage:true});
      for(const destination of ['/enquiries','/kyc-workflow','/compliance/clients']) {
        await page.click('main a[href="'+destination+'"]'); await page.waitForSelector('[data-destination]');
        const hrefs=await page.$$eval('aside a',links=>links.map(link=>link.getAttribute('href')));
        if(width<1024) {
          await page.click('button[aria-label="Open menu"]');
          await page.waitForSelector('[role="dialog"][aria-label="Main menu"]');
          const drawer=await page.$$eval('[role="dialog"] nav a',links=>links.map(link=>link.getAttribute('href')));
          assert.ok(drawer.includes(destination));
          if(destination==='/enquiries')assert.ok(!drawer.includes('/screening'));
          await page.keyboard.press('Escape');
          await page.waitForFunction(()=>!document.querySelector('[role="dialog"][aria-label="Main menu"]'));
        }
        if(width>=1024) {
          if(destination==='/enquiries') { assert.ok(hrefs.includes('/enquiries')); assert.ok(!hrefs.includes('/kyc-workflow')); }
          if(destination==='/kyc-workflow') { assert.ok(hrefs.includes('/screening')); assert.ok(!hrefs.includes('/enquiries')); }
          if(destination==='/compliance/clients') { assert.ok(hrefs.includes('/compliance/clients')); assert.ok(!hrefs.includes('/crrf')); }
        }
        if(width===1440)await page.screenshot({path:path.join(output,`${destination.split('/').pop()}.png`),fullPage:true});
        await page.evaluate(()=>document.querySelector('a[href="/workspace"]').click());
        await page.waitForSelector('main a[href="/enquiries"]');
      }
      assert.deepEqual(errors,[]); await page.close();
    }
    for(const scenario of ['restricted','none']) {
      const page=await browser.newPage(); await page.setRequestInterception(true); page.on('request',request=>request.respond({contentType:'text/html',body:html}));
      await page.goto('https://workspace.test?'+scenario);
      if(scenario==='restricted') {await page.waitForSelector('main a[href="/crrf"]'); assert.equal(await page.$$eval('main a',links=>links.length),1);}
      else await page.waitForFunction(()=>document.body.textContent.includes('No module access has been assigned'));
      await page.close();
    }
    console.log('Workspace checks passed: three tiles, contextual menus, deep-link classification, permission-only CRRF landing, no-access state, 1440/768/390/320px. Screenshots: '+output);
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
