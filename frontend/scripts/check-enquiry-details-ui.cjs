// Synthetic: the enquiry details page shows the company details, key contact, people with positions, the required
// document checklist and the status actions beside the timeline, without horizontal overflow.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const esbuild = require('esbuild'); const puppeteer = require('puppeteer-core');
async function main() {
  const bundle = esbuild.buildSync({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter,Routes,Route} from 'react-router-dom'; import {AppLayout} from './frontend/src/layouts/AppLayout'; import {ToastProvider} from './frontend/src/components/ToastProvider'; import {EnquiryDetailsPage} from './frontend/src/pages/EnquiryDetailsPage';
    localStorage.setItem('newoon_token','synthetic');
    createRoot(document.getElementById('root')).render(<ToastProvider><MemoryRouter initialEntries={['/enquiries/synthetic']}><Routes><Route element={<AppLayout/>}><Route path='/enquiries/:id' element={<EnquiryDetailsPage/>}/></Route></Routes></MemoryRouter></ToastProvider>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'import.meta.env.VITE_API_URL': JSON.stringify('/api') } });
  const assets = 'frontend/dist/assets'; const css = fs.readdirSync(assets).find((name) => name.endsWith('.css'));
  const html = `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(path.join(assets, css), 'utf8')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
  const enquiry = {
    id: 'synthetic', enquiryCode: 'ENQ-SYNTHETIC', enquiryType: 'EXISTING_LEGAL_ENTITY', status: 'DRAFT', companyName: 'SAMPLE TRADING SERVICES', requestedServices: ['N002 - Address Service', 'N004 - Open Bank Account - Personal / Corporate'],
    keyContactName: 'Sample Contact', keyContactPosition: 'UBO, Director', keyContactPhone: '+97412345678', headOfficeCountry: 'Qatar', branchCountry: 'Qatar', areaOfOperation: 'Qatar', notes: 'A note.',
    details: { keyContactNationality: 'NEPAL', keyContactPassportNumber: 'PA0000001', keyContactQidNumber: '20000000001', companyProfile: { commercialRegistrationNo: '100001', legalForm: 'LLC', shareCapital: '200000', taxIdentificationNo: '5000000001', licenseActivities: 'Performing arts (854213); Salon (960922)', dateOfIncorporation: '2022-02-23' },
      documentPeople: [{ id: 'a', files: ['qid.jpeg'], kinds: { 'qid.jpeg': 'QID' }, row: { fullName: 'ALPHA OWNER ONE', qidNumber: '29000000001', nationality: 'Qatar', ownershipPercentage: '51' }, positions: ['Shareholder', 'Manager'] }, { id: 'b', files: [], row: { fullName: 'BETA OWNER TWO', nationality: 'Philippines' }, positions: [] }] },
    attachments: [{ id: '1', documentType: 'Commercial Registration / CR Extract', fileName: 'Commercial Registration.pdf', storagePath: 'x' }, { id: '2', documentType: 'QID / Passport copies', fileName: 'qid.jpeg', storagePath: 'y' }],
    statusHistory: [{ id: 'h1', toStatus: 'DRAFT', createdAt: '2026-11-28T09:00:00Z', changedBy: { firstName: 'Operating', lastName: 'Team', email: 'o@example.test' }, note: 'Enquiry created' }], comments: []
  };
  const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const output = path.join(os.tmpdir(), 'newoon-enquiry-details'); fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage(); await page.setViewport({ width, height: 1000 }); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const url = new URL(request.url()); let data;
        if (url.pathname === '/api/auth/me') data = { id: 'operator', tenantId: 'synthetic', roles: ['OPERATING_TEAM'], accessControlConfigured: true, permissions: ['enquiries.view', 'enquiries.edit'] };
        else if (url.pathname === '/api/enquiries/synthetic/status') data = { ...enquiry, status: 'SUBMITTED_TO_AML_SUPERVISOR' };
        else if (url.pathname === '/api/enquiries/synthetic') data = enquiry;
        else if (url.pathname.startsWith('/api/')) data = [];
        else return request.respond({ contentType: 'text/html; charset=utf-8', body: html });
        return request.respond({ contentType: 'application/json', body: JSON.stringify(data) });
      });
      await page.goto('https://details.test/enquiries/synthetic'); await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('SAMPLE TRADING SERVICES'));
      const text = await page.$eval('#root', (n) => n.textContent);
      for (const expected of ['Company details', '100001', 'LLC', 'Key contact', 'People', 'ALPHA OWNER ONE', 'Shareholder', 'Manager', 'No position', 'qid.jpeg', '2 of 10 required provided', 'Not provided', 'Status Actions', 'Submit to AML Supervisor', 'Timeline']) assert.ok(text.includes(expected), `Details page shows ${expected}`);
      const attachmentRow = await page.evaluate(() => [...document.querySelectorAll('li')].find((li) => li.textContent.includes('qid.jpeg') && li.querySelector('button[aria-label^="View"]'))?.textContent || '');
      assert.ok(attachmentRow.includes('ALPHA OWNER ONE') && attachmentRow.includes('QID'), 'The QID copy shows the person name and type, with the file name beneath');
      assert.ok(await page.$('a[href="/enquiries/synthetic/edit"]'), 'Edit Enquiry stays available');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      await page.screenshot({ path: path.join(output, `details-${width}.png`), fullPage: true });
      if (width === 1440) {
        // Submitting shows a success toast and the new status.
        await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Submit to AML Supervisor')?.click());
        await page.waitForSelector('[role="status"]');
        await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some((n) => n.textContent.includes('Enquiry submitted to the AML Supervisor.')));
      }
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('Enquiry details UI checks passed on desktop and mobile. Screenshots: ' + output);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
