// Synthetic data only: exercise the real production DOCX/PDF export without a database.
// Usage (after `npm run build -w backend`): node backend/scripts/preview-kyc-docx.cjs [--no-pdf]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const PizZip = require('pizzip');
const { createCanvas } = require('@napi-rs/canvas');
const { exportKycDocx, exportKycPdf, exportKycHtml, KycPdfRenderer } = require('../dist/kyc/export');

const root = path.resolve(__dirname, '../../docs/kyc-export-preview');
const generatedAt = new Date('2026-10-05T09:30:00Z');

function signature(label, color = '#1d3a8a') {
  const canvas = createCanvas(520, 180);
  const context = canvas.getContext('2d');
  context.strokeStyle = color;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(30, 120);
  for (let x = 30; x < 470; x += 20) context.quadraticCurveTo(x + 10, 40 + ((x * 7) % 90), x + 20, 110 + ((x * 3) % 30));
  context.stroke();
  context.fillStyle = color;
  context.font = '22px sans-serif';
  context.fillText(label, 40, 165);
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
}

function stamp() {
  const canvas = createCanvas(300, 300);
  const context = canvas.getContext('2d');
  context.strokeStyle = '#8d2428';
  context.lineWidth = 8;
  context.beginPath(); context.arc(150, 150, 130, 0, Math.PI * 2); context.stroke();
  context.beginPath(); context.arc(150, 150, 95, 0, Math.PI * 2); context.stroke();
  context.fillStyle = '#8d2428';
  context.font = 'bold 30px sans-serif';
  context.textAlign = 'center';
  context.fillText('SAMPLE', 150, 160);
  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
}

const person = { id: 'person-1', fullName: 'ALEX MORGAN', shareholderType: 'Individual', nationality: 'France', dateOfBirth: '1980-03-13', identityNumber: 'Passport-SAMPLE123\nQID-SAMPLE456', ownershipPercentage: 100, shareholderPercentage: 100, uboInterestPercentage: 100, residenceAddress: 'Zone No. 38, Street No. 920, Building No. 97, Doha, Qatar', isUbo: true };
const requiredDocuments = [
  ['Commercial Registration / CR Extract', true], ['Entity Card / Computer Card', true], ['Certificate of Incorporation', true], ['Articles of Association', true],
  ['QID / Passport copies', true], ['CR of legal entity parties', false], ['National address certificates', true], ['Latest Audited Financial Statements', false], ['Tax Card', true]
].map(([documentType, isProvided]) => ({ documentType, isProvided, fileName: isProvided ? `${String(documentType).replace(/\W+/g, '-')}-sample.pdf` : '' }));

// Mirrors the scenario of the client's sample form (holding company, single shareholder, low risk) with fictitious data.
const standard = {
  kycCaseId: 'sample-case',
  amlComments: 'The Company is a holding company of an existing client. No adverse media, sanctions, or PEP concerns were identified in respect of the UBO, Director, and SEF. The KYC has been prepared and submitted to the DMLRO for review.',
  sectionA: { date: '2026-08-10', reference: 'KYC-2026-0001', legalName: 'EXAMPLE HOLDINGS LLC', commercialRegistrationNo: '00000(QFC)', taxIdentificationNo: 'T00000', dateOfIncorporation: '2026-04-09', countryOfIncorporation: 'Qatar', legalForm: 'LLC', registeredOfficeAddress: 'QFC Tower 1, Office No. 4, Floor 9, Doha, Qatar', telephone: '+974 0000 0000', email: 'contact@example.test', website: '', businessNature: 'Holding company', licenseActivities: 'To hold subsidiaries and assets, provide intra-group financing, guarantees and security, and undertake related ancillary activities for the benefit of the Holding Company Group.', relatedIndustry: 'Finance', prospectiveService: ['N022 - Temporary Secretary and QFC Compliance Service', 'N025 - Assistant with Company Initial Setup Tasks'] },
  sectionB: { shareholders: [person], ubos: [person], totalOwnershipPercentage: 100, uboDifferentFromShareholders: 'Yes', uboGroupStructureNotes: '' },
  sectionC: { managers: [
    { ...person, entityName: 'EXAMPLE HOLDINGS LLC', position: ['Director', 'SEF', 'Beneficial Person'], address: 'Zone No. 38, Street No. 920, Building No. 97, Doha, Qatar', isAuthorizedSignatory: true },
    { id: 'm2', fullName: 'JORDAN SAMPLE EXAMPLE PERSON', entityName: 'EXAMPLE HOLDINGS LLC', nationality: 'Sri Lanka', address: '', dateOfBirth: '1997-09-17', identityNumber: 'Passport-SAMPLE789\nQID-SAMPLE012', position: 'Secretary', positionOther: '', isAuthorizedSignatory: false }
  ] },
  sectionD: { pepQuestion: 'No', sanctionQuestion: 'No', dualCitizenshipQuestion: 'No' },
  sectionE: { fullName: 'ALEX MORGAN', position: ['Director', 'SEF', 'Authorized Signatory'], nationality: 'France', identityNumber: 'Passport-SAMPLE123\nQID-SAMPLE456', mobileNumber: '+974 0000 0000', email: 'alex@example.test' },
  sectionF: { documents: requiredDocuments, additionalDocuments: [], uploadedFilesNote: '' },
  sectionG: { fullName: 'ALEX MORGAN', position: 'Director', date: '2026-08-10', signatureDataUrl: signature('A. Morgan'), stampDataUrl: stamp() },
  sectionH: { amlAccuracyChecked: true, riskClassification: 'LOW', dueDiligenceType: 'SIMPLIFIED', amlName: 'Sample AML Officer', amlDate: '2026-08-10', amlSignatureDataUrl: signature('AML'), dmlroName: 'Sample DMLRO', dmlroDate: '2026-08-10', dmlroDecision: 'APPROVE', dmlroRiskClassification: 'LOW', dmlroSignatureDataUrl: signature('DMLRO', '#0f5132'), dmlroComments: 'No red flags were identified during screening and risk rating. Client has been classified as low risk and hence simplified due diligence has been performed.', mlroName: 'Sample MLRO', mlroDate: '2026-08-10', mlroDecision: 'APPROVE', mlroSignatureDataUrl: signature('MLRO'), mlroComments: 'Approve to proceed with the EL.\n\nLow Risk.', sefName: '', sefDecision: '' }
};

// Wide, three-layer structure with long, accented and Arabic names, an orphaned row and missing values.
const party = (id, parentRowId, fullName, shareholderType, percent, nationality, isUbo = false) => ({ id, parentRowId, fullName, shareholderType, ownershipPercentage: percent, shareholderPercentage: percent, uboInterestPercentage: isUbo ? percent : undefined, nationality, identityNumber: `ID-${id.toUpperCase()}-2026-000${id.length}`, dateOfBirth: shareholderType === 'Individual' ? '1975-06-0' + (id.length % 9 + 1) : '2010-01-15', residenceAddress: 'Building 12, Street 840, Zone 66, West Bay, Doha, State of Qatar', isUbo });
const complexParties = [
  party('h1', '', 'Gulf Horizon Strategic Holdings and Investments W.L.L.', 'Corporate', 60, 'Qatar'),
  party('h2', '', 'Société Générale de Participations Européennes S.à r.l.', 'Corporate', 25, 'Luxembourg'),
  party('i1', '', 'محمد بن عبدالله آل ثاني', 'Individual', 15, 'Qatar', true),
  party('i2', 'h1', 'Johnathan Alexander Montgomery-Fitzgerald III', 'Individual', 40, 'United Kingdom', true),
  party('i3', 'h1', 'Priya Raghunathan Venkataraman', 'Individual', 35, 'India', true),
  party('c3', 'h1', 'Desert Pearl Family Trust Company Limited', 'Corporate', 25, 'Cayman Islands'),
  party('i4', 'c3', 'Élodie Marchand-Dubois', 'Individual', 50, 'France', true),
  party('i5', 'c3', 'Kenji Watanabe', 'Individual', 50, 'Japan'),
  party('i6', 'h2', 'Lukas Schneider', 'Individual', 100, 'Germany', true),
  party('i7', 'missing-parent', 'Orphaned Row Example (parent removed)', 'Individual', 5, 'Oman')
];
const managers = ['Chief Executive Officer', 'Director', 'Company Secretary', 'Authorised Signatory', 'Finance Director', 'Director'].map((position, index) => ({
  id: `m${index}`, fullName: ['Johnathan Alexander Montgomery-Fitzgerald III', 'Priya Raghunathan Venkataraman', 'محمد بن عبدالله آل ثاني', 'Lukas Schneider', 'Élodie Marchand-Dubois', ''][index],
  position, entityName: 'Gulf Horizon Strategic Holdings and Investments W.L.L.', nationality: ['United Kingdom', 'India', 'Qatar', 'Germany', 'France', ''][index], address: index % 2 ? 'Doha, Qatar' : 'Tower 3, Floor 41, The Pearl, Doha', dateOfBirth: index === 5 ? '' : '1979-11-2' + index, identityNumber: index === 5 ? '' : `PASSPORT-${'X'.repeat(index + 2)}-00${index}`, isAuthorizedSignatory: index % 2 === 0
}));
const complex = {
  ...standard,
  sectionA: { ...standard.sectionA, reference: 'KYC-2026-0042', legalName: 'Gulf Horizon Strategic Holdings and Investments W.L.L. (Qatar Financial Centre Branch)', taxIdentificationNo: '', website: '', licenseActivities: 'Holding company activities; management consultancy; investment advisory to affiliated entities; real estate holding; procurement and logistics coordination for group companies across the GCC and Europe.\nSecond line entered by the user.' },
  sectionB: { shareholders: complexParties, ubos: [], totalOwnershipPercentage: 105, uboDifferentFromShareholders: 'Yes', uboGroupStructureNotes: 'Ultimate control is exercised through Gulf Horizon Strategic Holdings and a family trust company.' },
  sectionC: { managers },
  sectionD: { pepQuestion: 'Yes', pepDetails: 'One beneficial person holds a senior government advisory role.', pepDocumentFileNames: ['PEP-declaration.pdf', 'Source-of-wealth-letter.pdf'], sanctionQuestion: '', dualCitizenshipQuestion: 'Yes', dualCitizenshipDetails: 'United Kingdom and Ireland.', dualCitizenshipPassportFileNames: ['Second-passport.pdf'] },
  sectionE: { fullName: 'Priya Raghunathan Venkataraman', position: 'Other', positionOther: 'Head of Group Compliance', nationality: 'India', identityNumber: '', mobileNumber: '+974 5555 1234', email: 'priya.venkataraman@gulf-horizon.example.test' },
  sectionG: { fullName: 'Johnathan Alexander Montgomery-Fitzgerald III', position: 'Director', date: '2026-10-05', signatureFileName: 'signature-on-file.png' },
  sectionH: { ...standard.sectionH, riskClassification: 'HIGH', dueDiligenceType: 'ENHANCED', dmlroSignatureDataUrl: signature('DMLRO', '#0f5132'), dmlroComments: 'PEP exposure confirmed; enhanced due diligence applied. Source of wealth evidence reviewed and accepted.', mlroDecision: 'SEND_TO_SEF', mlroFinalRiskClassification: 'HIGH', mlroRiskReasonCategory: 'PEP_EXPOSURE', mlroRiskExplanation: 'Beneficial person is a domestic PEP.', mlroSignatureDataUrl: signature('MLRO'), sefName: 'Sample SEF Member', sefDate: '2026-10-05', sefDecision: 'APPROVE', sefComments: 'Approved subject to annual review.', sefSignatureDataUrl: signature('SEF', '#5b2c83') }
};

async function main() {
  complex.sectionH.mlroComments = '<p><strong>Enhanced due diligence completed.</strong> <mark>Annual review required.</mark></p><p>Source of wealth and ownership documentation were reviewed. This paragraph must use the full available width.</p><ul><li>Monitor changes in ownership.</li><li><em>Escalate material risk changes.</em></li></ul>';
  const withPdf = !process.argv.includes('--no-pdf');
  const renderer = withPdf ? new KycPdfRenderer() : null;
  try {
    for (const [name, payload] of [['standard', standard], ['complex', complex]]) {
      const output = path.join(root, name);
      fs.mkdirSync(output, { recursive: true });
      const docx = await exportKycDocx(payload, 3, generatedAt);
      const xml = new PizZip(docx).file('word/document.xml').asText();
      assert(xml.includes('<w:drawing>'), 'DOCX should contain images');
      assert(!xml.includes('Accuracy confirmed'), 'Removed accuracy field must not be exported');
      const ids = [...xml.matchAll(/<wp:docPr id="(\d+)"/g)].map((match) => match[1]);
      assert.equal(new Set(ids).size, ids.length, 'Drawing ids must be unique');
      fs.writeFileSync(path.join(output, 'kyc-sample.docx'), docx);
      const html = await exportKycHtml(payload, 3, generatedAt);
      assert(!/(?:src|href)="https?:|url\(['"]?https?:/.test(html), 'PDF source must not load external resources');
      if (renderer) {
        const pdf = await exportKycPdf(payload, 3, renderer, generatedAt);
        assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
        fs.writeFileSync(path.join(output, 'kyc-chromium.pdf'), pdf);
      }
      console.log(`${name}: DOCX${renderer ? ' + PDF' : ''} written to ${output}`);
    }
  } finally {
    await renderer?.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
