// Real registered router and login page; synthetic sessions only, no backend/database/account changes.
const assert=require('node:assert/strict');
const fs=require('node:fs'); const path=require('node:path'); const os=require('node:os');
const esbuild=require('esbuild'); const puppeteer=require('puppeteer-core');
async function main(){
  const bundle=esbuild.buildSync({stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider} from 'react-router-dom';
    import {router} from './frontend/src/routes/router';import {ToastProvider} from './frontend/src/components/ToastProvider';import {api} from './frontend/src/services/api';
    const params=new URLSearchParams(location.search);const role=params.get('role')||'OPERATING_TEAM';
    const user={id:'synthetic-user',tenantId:'tenant-a',email:'sample@example.test',firstName:'Sample',lastName:'User',roles:[role],accessControlConfigured:false};
    const session={accessToken:'synthetic-token-only',user};window.calls=[];
    if(params.has('authenticated'))localStorage.setItem('newoon_token',session.accessToken);
    api.defaults.adapter=async config=>{
      window.calls.push(config.url);let data;
      if(config.url==='/auth/login') {
        if(params.has('failure'))throw Object.assign(new Error('Invalid credentials'),{response:{status:401,data:{message:'Invalid email or password'}}});
        data=params.has('otp')?{otpRequired:true,challengeId:'synthetic-challenge',maskedEmail:'s***@example.test',expiresInSeconds:600,resendAfterSeconds:60}:session;
      } else if(config.url==='/auth/login/verify')data=session;
      else if(config.url==='/auth/me')data=user;
      else if(config.url.includes('notifications')||config.url==='/enquiries')data=[];
      else if(config.url.includes('profile'))data={...user,profile:{}};
      else throw new Error('Unexpected endpoint '+config.url);
      return {data,status:200,statusText:'OK',headers:{},config};
    };
    createRoot(document.getElementById('root')).render(<ToastProvider><RouterProvider router={router}/></ToastProvider>);
  `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},logLevel:'error',define:{'import.meta.env':JSON.stringify({VITE_API_URL:'/api',DEV:false,PROD:true})}});
  const css=fs.readdirSync('frontend/dist/assets').find(name=>name.endsWith('.css'));
  const javascript=bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join('frontend/dist/assets',css),'utf8')}</style></head><body><div id="root"></div><script>${javascript}</script></body></html>`;
  const browser=await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox']});
  const output=path.join(os.tmpdir(),'newoon-workspace-login');fs.mkdirSync(output,{recursive:true});
  const createPage=async()=>{
    const page=await browser.newPage();await page.evaluateOnNewDocument(()=>localStorage.clear());await page.setRequestInterception(true);
    page.on('request',request=>{const asset=path.join('frontend/public',new URL(request.url()).pathname);return request.url().includes('/brand/')&&fs.existsSync(asset)?request.respond({contentType:'image/png',body:fs.readFileSync(asset)}):request.respond({contentType:'text/html; charset=utf-8',body:html});});
    return page;
  };
  const waitHome=async page=>{await page.waitForFunction(()=>location.pathname==='/workspace'&&document.querySelector('section[aria-label="Workspaces"]'));await page.waitForSelector('main a[href="/enquiries/dashboard"]');assert.equal(await page.$('aside'),null);assert.ok(await page.$('header a[aria-label="All workspaces"]'));assert.equal(await page.evaluate(()=>window.calls.includes('/dashboard/summary')),false,'Legacy global dashboard must never load');};
  try{
    for(const role of ['SUPER_ADMIN','COMPANY_ADMIN','OPERATING_TEAM','AML_TEAM','AML_SUPERVISOR','DMLRO','MLRO','SEF','CEO','ACCOUNTING_TEAM','HR_TEAM'])for(const otp of [false,true]){
      const page=await createPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('https://login.test/login?role='+role+(otp?'&otp=1':''));
      await page.waitForSelector('#login-email',{timeout:10000}).catch(async error=>{throw new Error(error.message+'; browser errors='+JSON.stringify(errors)+'; body='+await page.$eval('body',node=>node.textContent.slice(0,500)));});await page.type('#login-email','sample@example.test');await page.type('#login-password','Synthetic-test-password-42!');await page.click('button[type=submit]');
      if(otp){await page.waitForSelector('#login-code');assert.equal(new URL(page.url()).pathname,'/login');assert.equal(await page.evaluate(()=>localStorage.getItem('newoon_token')),null);await page.type('#login-code','123456');await page.click('button[type=submit]');}
      await waitHome(page);assert.equal(await page.evaluate(()=>localStorage.getItem('newoon_token')),'synthetic-token-only');
      if(role==='OPERATING_TEAM'&&!otp){
        await page.screenshot({path:path.join(output,'after-login.png'),fullPage:true});
        await page.click('a[href="/enquiries/dashboard"]');await page.waitForSelector('[data-metric]');assert.equal(new URL(page.url()).pathname,'/enquiries/dashboard','Module dashboard remains accessible');await page.click('header a[aria-label="All workspaces"]');await waitHome(page);
      }
      assert.deepEqual(errors,[],role);await page.close();
    }
    for(const route of ['/dashboard','/']){const page=await createPage();await page.goto('https://login.test'+route+'?authenticated=1&role=DMLRO');await waitHome(page);await page.close();}
    const signedOut=await createPage();await signedOut.goto('https://login.test/dashboard');await signedOut.waitForSelector('#login-email');assert.equal(new URL(signedOut.url()).pathname,'/login');await signedOut.close();
    const failure=await createPage();await failure.goto('https://login.test/login?failure=1');await failure.waitForSelector('#login-email');await failure.type('#login-email','sample@example.test');await failure.type('#login-password','Synthetic-test-password-42!');await failure.click('button[type=submit]');await failure.waitForSelector('[role=alert]');assert.equal(new URL(failure.url()).pathname,'/login');assert.equal(await failure.evaluate(()=>localStorage.getItem('newoon_token')),null);await failure.close();
    console.log('Workspace login checks passed: real registered router, password and OTP login for all 11 roles, protected root/legacy redirects, no-session and failed-login guards, module dashboard and workspace return. Synthetic accounts only. Screenshot: '+output);
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
