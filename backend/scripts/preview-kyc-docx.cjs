// Synthetic data only: exercise the real production export without a database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { KycService } = require('../dist/kyc/kyc.service');
const PizZip = require('pizzip');
const output = path.resolve(__dirname, '../../docs/kyc-export-preview');
fs.mkdirSync(output, { recursive: true });
const person = { id: 'person-1', fullName: 'Alex Morgan', shareholderType: 'Individual', nationality: 'France', dateOfBirth: '1980-03-13', identityNumber: 'SAMPLE-123456789', ownershipPercentage: 100, shareholderPercentage: 100, uboInterestPercentage: 100, residenceAddress: 'Doha, Qatar', isUbo: true };
const payload = {
  sectionA: { date: '2026-10-04', reference: 'KYC-SAMPLE-0001', legalName: 'Example Consultancy LLC', commercialRegistrationNo: 'SAMPLE-02741', taxIdentificationNo: 'SAMPLE-T02741', dateOfIncorporation: '2024-09-24', countryOfIncorporation: 'Qatar', legalForm: 'LLC', registeredOfficeAddress: 'Floor 1, Office 233, Business Centre, Doha, Qatar', telephone: '+974 0000 0000', email: 'contact@example.test', website: 'https://example.test', businessNature: 'Project Management', licenseActivities: 'Project and programme management services. Providing project management support to corporate clients.', relatedIndustry: 'Professional Services', prospectiveService: ['Secretary and QFC Compliance Service', 'Immigration signatory services'] },
  sectionB: { shareholders: [person], ubos: [person], totalOwnershipPercentage: 100, uboDifferentFromShareholders: 'No', uboGroupStructureNotes: 'Direct ownership by the beneficial owner.' },
  sectionC: { managers: [{ ...person, entityName: 'Example Consultancy LLC', position: 'Director', address: 'Doha, Qatar', isAuthorizedSignatory: true }] },
  sectionD: { pepQuestion: 'No', sanctionQuestion: 'No', dualCitizenshipQuestion: 'No' },
  sectionE: { fullName: 'Alex Morgan', position: 'Director', nationality: 'France', identityNumber: 'SAMPLE-123456789', mobileNumber: '+974 0000 0000', email: 'alex@example.test' },
  sectionF: { documents: ['Commercial Registration', 'Certificate of Incorporation', 'QID / Passport copies', 'Articles of Association'].map(documentType => ({ documentType, isProvided: true, fileName: `${documentType.replace(/\W+/g, '-')}-sample.pdf` })), additionalDocuments: [{ fileName: 'National-address-sample.pdf' }], uploadedFilesNote: 'Sample supporting documents for visual quality assurance.' },
  sectionG: { fullName: 'Alex Morgan', position: 'Director', date: '2026-10-04' },
  sectionH: { amlAccuracyChecked: true, riskClassification: 'MEDIUM', dueDiligenceType: 'REGULAR', amlName: 'Sample Reviewer', amlDate: '2026-10-04', dmlroName: 'Sample DMLRO', dmlroDecision: 'APPROVED', mlroName: 'Sample MLRO', mlroDecision: 'APPROVED', sefName: 'Sample SEF', sefDecision: 'APPROVED' }
};
const buffer = new KycService({}).buildDocx(payload);
const zip = new PizZip(buffer);
const xml = zip.file('word/document.xml').asText();
assert(!xml.includes('__KYC_IMAGE_'));
assert(xml.includes('<w:drawing>'));
const ids = [...xml.matchAll(/<wp:docPr id="(\d+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length);
for (const grid of xml.matchAll(/<w:tblGrid>(.*?)<\/w:tblGrid>/g)) {
  assert.equal([...grid[1].matchAll(/w:w="(\d+)"/g)].reduce((total, item) => total + Number(item[1]), 0), 10206);
}
fs.writeFileSync(path.join(output, 'kyc-sample.docx'), buffer);
const diagram = zip.file('word/media/kyc-signature-ownershipStructure.png').asNodeBuffer();
assert.equal(diagram.readUInt32BE(16), 1200);
assert(diagram.readUInt32BE(20) < 700, 'Simple diagram should not have excessive whitespace');
fs.writeFileSync(path.join(output, 'ownership-diagram.png'), diagram);
console.log(`DOCX checks passed. Sample: ${output}`);
