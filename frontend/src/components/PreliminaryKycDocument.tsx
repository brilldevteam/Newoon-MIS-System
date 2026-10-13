import { mergeBeneficialOwners } from '../utils/ownership';
import { filledContactRows } from '../utils/contact-preview';

export function PreliminaryKycDocument({ data, embedded = false }: { data: Record<string, any>; embedded?: boolean }) {
  const rows = (value: unknown) => Array.isArray(value) ? value as Array<Record<string, any>> : [];
  const value = (item: unknown) => String(item || '-');
  const totalOwnership = (items: Array<Record<string, any>>) => items.reduce((total, item) => total + (Number.parseFloat(String(item.ownershipPercentage || '')) || 0), 0).toFixed(2);
  const expectedBusiness = Array.isArray(data.expectedBusiness) ? data.expectedBusiness.filter(Boolean).join(', ') : data.expectedBusiness;
  const contact = data.contact && typeof data.contact === 'object' ? data.contact as Record<string, any> : {};
  const declaration = data.declaration && typeof data.declaration === 'object' ? data.declaration as Record<string, any> : {};
  return <section id="preliminary-kyc-form" className={embedded ? 'min-w-0' : 'scroll-mt-6 max-h-[calc(100vh-150px)] min-w-0 overflow-auto rounded-lg border border-slate-200 bg-slate-200 p-4'}>
    <article className="mx-auto max-w-[794px] bg-white p-6 text-[10px] leading-[1.4] text-black shadow-sm sm:p-8">
      <p>Date: {data.completedAt ? new Date(data.completedAt).toLocaleDateString('en-GB') : '-'}</p>
      <h2 className="mt-3 text-center text-[11px] font-bold underline">Prospective Customer Information &amp; Preliminary Due Diligence form</h2>
      <p className="mt-2">This form is completed prior to the establishment of a business relationship and before incorporation of the proposed entity.</p>
      <PreliminaryTable title="Section A: Basic Client Details" headers={['No.', 'Details']} rows={[
        ['1', `Proposed Company Name: ${value(data.companyName)}`], ['2', `Proposed Legal Form: ${value(data.proposedLegalForm)}`],
        ['3', `Jurisdiction of Registration: ${value(data.jurisdiction)}`], ['4', 'Country of incorporation: -'],
        ['5', `Proposed Registered Office Address: ${value(data.registeredOfficeAddress)}`], ['6', `Proposed Business Activity: ${value(data.businessActivity)}`],
        ['7', `Expected Source of Initial Capital: ${value(data.sourceOfFunds)}`], ['8', `Expected Business from Newoon: ${value(expectedBusiness)}`]
      ]} />
      <PreliminaryTable title="Section B: Proposed Shareholders" headers={['No.', 'Name', 'Passport/QID/CR', 'Nationality', 'Residence', 'Ownership %']} rows={rows(data.shareholders).map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.address), value(row.ownershipPercentage)])} />
      <p className="mt-1 font-bold">Total ownership %: {totalOwnership(rows(data.shareholders))}%</p>
      <PreliminaryTable title="Ultimate Beneficial Owners (Natural Person Only)" headers={['No.', 'Name', 'Passport/QID', 'Nationality', 'Residence', 'UBO %']} rows={mergeBeneficialOwners(rows(data.shareholders), rows(data.ubos)).map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.address), value(row.ownershipPercentage)])} />
      <p className="mt-1 font-bold">Total UBO %: {totalOwnership(mergeBeneficialOwners(rows(data.shareholders), rows(data.ubos)))}%</p>
      <PreliminaryTable title="Section C: Proposed Management & Control Persons" headers={['No.', 'Name', 'Passport / QID', 'Nationality', 'Position']} rows={rows(data.management).map((row, index) => [String(index + 1), value(row.fullName), value(row.identityNumber), value(row.nationality), value(row.positions?.join(', ') || row.position)])} />
      <PreliminaryTable title="Section D: Required Documents" headers={['Document', 'Available']} rows={rows(data.documents).map((row) => [value(row.documentType), row.available ? 'Yes' : 'No'])} />
      <PreliminaryTable title="Section E: Key Contact Person" headers={['No.', 'Field', 'Details']} rows={filledContactRows([
        ['1', 'Full Name', value(contact.fullName)], ['2', 'Position', value(contact.position)], ['3', 'Nationality', value(contact.nationality)],
        ['4', 'Passport Number', value(contact.passportNumber)], ['5', 'Passport Expiry Date', value(contact.passportExpiryDate)],
        ['6', 'QID Number', value(contact.qidNumber)], ['7', 'QID Expiry Date', value(contact.qidExpiryDate)],
        ['8', 'Mobile Number', value(contact.mobileNumber)], ['9', 'Email', value(contact.email)]
      ])} />
      <section className="mt-4"><h3 className="border-b-4 border-[#dce9f7] pb-0.5 text-[10px] font-bold">Section F: Client Declaration</h3><p className="mt-1">By signing this document, I hereby confirm that all information and documents provided are true, complete, and up to date. I am authorised to represent and sign this document on behalf of the proposed entity.</p></section>
      <table className="mt-1 w-full border-collapse text-left"><tbody>
        <tr><th className="w-1/3 border border-black px-1 py-0.5">Full Name</th><td className="border border-black px-1 py-0.5">{value(declaration.fullName)}</td></tr>
        <tr><th className="border border-black px-1 py-0.5">Position</th><td className="border border-black px-1 py-0.5">{value(declaration.position)}</td></tr>
        <tr><th className="border border-black px-1 py-0.5">Date</th><td className="border border-black px-1 py-0.5">{value(declaration.date)}</td></tr>
        <tr><th className="border border-black px-1 py-0.5">Authorised signature</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview label="Authorised signature" dataUrl={declaration.authorizedSignatureDataUrl} /></td></tr>
        <tr><th className="border border-black px-1 py-0.5">Company Stamp</th><td className="border border-black px-1 py-0.5"><PreliminaryUploadPreview label="Company stamp" dataUrl={declaration.companyStampDataUrl} /></td></tr>
      </tbody></table>
    </article>
  </section>;
}

function PreliminaryTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <section className="mt-4"><h3 className="border-b-4 border-[#dce9f7] pb-0.5 text-[10px] font-bold">{title}</h3><table className="mt-1 w-full border-collapse text-left"><thead><tr>{headers.map((header) => <th key={header} className="border border-black px-1 py-0.5">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((item, cellIndex) => <td key={cellIndex} className="border border-black px-1 py-0.5 align-top">{item}</td>)}</tr>) : <tr><td colSpan={headers.length} className="border border-black px-1 py-1">-</td></tr>}</tbody></table></section>;
}

function PreliminaryUploadPreview({ dataUrl, label }: { dataUrl?: string; label: string }) {
  if (!dataUrl?.startsWith('data:image/')) return <>-</>;
  return <div className="max-w-full py-2" style={{ breakInside: 'avoid' }}><img src={dataUrl} alt={label} style={{ display: 'block', width: '260px', maxWidth: '100%', height: '112px', objectFit: 'contain', objectPosition: 'left center' }} /></div>;
}
