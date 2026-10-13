import { beneficialOwners } from '../common/ownership';

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const value = (item: unknown) => escape(item || '-');
const table = (title: string, headers: string[], data: unknown[][]) => `<section><h3>${escape(title)}</h3><table><thead><tr>${headers.map((header) => `<th${header === 'No.' ? ' style="width:5%"' : ''}>${escape(header)}</th>`).join('')}</tr></thead><tbody>${data.length ? data.map((row) => `<tr>${row.map((cell) => `<td>${value(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">-</td></tr>`}</tbody></table></section>`;
const artwork = (input: unknown) => typeof input === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(input) ? `<img src="${escape(input)}" alt="Declaration artwork">` : '-';

export function preliminaryPdfHtml(data: Row): string {
  const shareholders = rows(data.shareholders);
  const ubos = beneficialOwners(shareholders, rows(data.ubos));
  const contact = object(data.contact);
  const declaration = object(data.declaration);
  const total = (items: Row[]) => items.reduce((sum, row) => sum + (Number(row.ownershipPercentage) || 0), 0).toFixed(2);
  const parties = (items: Row[]) => items.map((row, index) => [index + 1, row.fullName, row.identityNumber, row.nationality, row.address, row.ownershipPercentage]);
  const contactEntries = [['Full Name', contact.fullName], ['Position', contact.position], ['Nationality', contact.nationality], ['Passport Number', contact.passportNumber], ['Passport Expiry Date', contact.passportExpiryDate], ['QID Number', contact.qidNumber], ['QID Expiry Date', contact.qidExpiryDate], ['Mobile Number', contact.mobileNumber], ['Email', contact.email]].filter(([, item]) => String(item ?? '').trim() && String(item).trim() !== '-');
  const date = data.completedAt ? new Date(String(data.completedAt)).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '-';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:10px/1.4 Arial,sans-serif;color:#000;margin:0}h2{text-align:center;font-size:11px;text-decoration:underline;margin:12px 0 8px}h3{font-size:10px;border-bottom:4px solid #dce9f7;margin:16px 0 4px;break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:2px 4px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}p{margin:4px 0}img{display:block;width:260px;max-width:100%;height:112px;object-fit:contain;object-position:left center}section{margin:0}
  </style></head><body><p>Date: ${escape(date)}</p><h2>Prospective Customer Information &amp; Preliminary Due Diligence form</h2><p>This form is completed prior to the establishment of a business relationship and before incorporation of the proposed entity.</p>
  ${table('Section A: Basic Client Details', ['No.', 'Details'], [
    [1, `Proposed Company Name: ${data.companyName || '-'}`], [2, `Proposed Legal Form: ${data.proposedLegalForm || '-'}`], [3, `Jurisdiction of Registration: ${data.jurisdiction || '-'}`], [4, 'Country of incorporation: -'], [5, `Proposed Registered Office Address: ${data.registeredOfficeAddress || '-'}`], [6, `Proposed Business Activity: ${data.businessActivity || '-'}`], [7, `Expected Source of Initial Capital: ${data.sourceOfFunds || '-'}`], [8, `Expected Business from Newoon: ${Array.isArray(data.expectedBusiness) ? data.expectedBusiness.join(', ') : data.expectedBusiness || '-'}`]
  ])}
  ${table('Section B: Proposed Shareholders', ['No.', 'Name', 'Passport/QID/CR', 'Nationality', 'Residence', 'Ownership %'], parties(shareholders))}<p><strong>Total ownership %: ${total(shareholders)}%</strong></p>
  ${table('Ultimate Beneficial Owners (Natural Person Only)', ['No.', 'Name', 'Passport/QID', 'Nationality', 'Residence', 'UBO %'], parties(ubos))}<p><strong>Total UBO %: ${total(ubos)}%</strong></p>
  ${table('Section C: Proposed Management & Control Persons', ['No.', 'Name', 'Passport / QID', 'Nationality', 'Position'], rows(data.management).map((row, index) => [index + 1, row.fullName, row.identityNumber, row.nationality, Array.isArray(row.positions) && row.positions.length ? row.positions.join(', ') : row.position]))}
  ${table('Section D: Required Documents', ['Document', 'Available'], rows(data.documents).map((row) => [row.documentType, row.available ? 'Yes' : 'No']))}
  ${table('Section E: Key Contact Person', ['No.', 'Field', 'Details'], contactEntries.map(([label, item], index) => [index + 1, label, item]))}
  <h3>Section F: Client Declaration</h3><p>By signing this document, I hereby confirm that all information and documents provided are true, complete, and up to date. I am authorised to represent and sign this document on behalf of the proposed entity.</p>
  <table><tbody>${[['Full Name', declaration.fullName], ['Position', declaration.position], ['Date', declaration.date]].map(([label, item]) => `<tr><th style="width:33%">${escape(label)}</th><td>${value(item)}</td></tr>`).join('')}<tr><th>Authorised signature</th><td>${artwork(declaration.authorizedSignatureDataUrl)}</td></tr><tr><th>Company Stamp</th><td>${artwork(declaration.companyStampDataUrl)}</td></tr></tbody></table></body></html>`;
}
