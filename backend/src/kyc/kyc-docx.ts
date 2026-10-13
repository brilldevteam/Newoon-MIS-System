import PizZip from 'pizzip';

// Build native Word tables with automatic heights, rather than inheriting template geometry.
export function buildKycDocx(data: Record<string, any>, payload: Record<string, any>, letterheadTemplate?: Buffer) {
  const xml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const p = (value: unknown, heading = false, bold = false) => `<w:p><w:pPr><w:keepNext w:val="${heading ? 1 : 0}"/><w:keepLines/><w:spacing w:before="${heading ? 180 : 0}" w:after="${heading ? 90 : 40}" w:line="240" w:lineRule="auto"/>${heading ? '<w:shd w:fill="8D2428"/>' : ''}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${heading ? 22 : 20}"/><w:b w:val="${heading || bold ? 1 : 0}"/><w:color w:val="${heading ? 'FFFFFF' : '172033'}"/></w:rPr><w:t xml:space="preserve">${xml(value === null || value === undefined || value === '' ? '-' : value)}</w:t></w:r></w:p>`;
  const table = (headers: string[], rows: unknown[][], widths: number[], grouped = false) => {
    if (widths.reduce((sum, width) => sum + width, 0) !== 10206) throw new Error('KYC table columns must match the printable page width');
    const row = (cells: unknown[], header = false) => `<w:tr><w:trPr><w:cantSplit/>${header ? '<w:tblHeader/>' : ''}</w:trPr>${cells.map((cell, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:vAlign w:val="top"/>${header ? '<w:shd w:fill="E8EDF2"/>' : ''}</w:tcPr>${String(cell ?? '-').split('\n').map((line, index) => {
      const paragraph = p(line, false, header || (grouped && index === 0));
      return header ? paragraph.replace('<w:keepNext w:val="0"/>', '<w:keepNext/>') : paragraph;
    }).join('')}</w:tc>`).join('')}</w:tr>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="10206" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(edge => `<w:${edge} w:val="single" w:sz="4" w:color="94A3B8"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${row(headers, true)}${rows.map(cells => row(cells)).join('')}</w:tbl>${p(' ')}`;
  };
  const fields = (pairs: string[][]) => {
    const rows: string[][] = [];
    for (let index = 0; index < pairs.length; index += 2) {
      const cells = pairs.slice(index, index + 2).map(([label, key]) => `${label}:\n${data[key] || '-'}`);
      if (cells.length === 1) cells.push(' ');
      rows.push(cells);
    }
    return table(['', ''], rows, [5103, 5103], true).replace(/<w:tr><w:trPr><w:cantSplit\/><w:tblHeader\/>[\s\S]*?<\/w:tr>/, '');
  };
  const a = payload.sectionA || {}, b = payload.sectionB || {}, d = payload.sectionD || {}, f = payload.sectionF || {};
  data = { ...data, amlAccuracyChecked: payload.sectionH?.amlAccuracyChecked === true ? 'Yes' : payload.sectionH?.amlAccuracyChecked === false ? 'No' : 'Not recorded' };
  const people = (rows: any[], prefix: string) => table(['Full name','Nationality','Birth date','Identity number','Interest %','Address'], rows.map(r => [r[`${prefix}FullName`],r[`${prefix}Nationality`],r[`${prefix}DateOfBirth`],r[`${prefix}IdentityNumber`],r[`${prefix}OwnershipPercentage`],r[`${prefix}ResidenceAddress`]]), [2100,1400,1400,1900,1000,2406]);
  const parts = [p(`Date: ${data.date || '-'}    Reference: ${data.reference || '-'}`),
    `<w:p><w:pPr><w:jc w:val="center"/><w:keepNext/><w:spacing w:before="160" w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="28"/></w:rPr><w:t>Know Your Client (KYC)</w:t></w:r></w:p>`,
    p('Newoon LLC, as a registered business support services provider in the Qatar Financial Centre (QFC), is required to obtain, maintain and keep up to date Know Your Client information for all clients in line with applicable regulatory and compliance requirements. We request the following information and supporting documentation to understand your business and complete our due diligence.'),
    p('A. General Company Information',true),fields([['Legal name','legalName'],['Commercial registration number','commercialRegistrationNo'],['Tax identification number','taxIdentificationNo'],['Date of incorporation','dateOfIncorporation'],['Country of incorporation','countryOfIncorporation'],['Legal form','legalForm'],['Registered office address','registeredOfficeAddress'],['Telephone','telephone'],['Email','email'],['Website','website'],['Business nature','businessNature'],['License activities','licenseActivities'],['Related industry','relatedIndustry'],['Requested services','prospectiveService']]),
    p('B. Ownership and Beneficial Owners',true),people(data.shareholders || [],'shareholder'),p(`Total shareholder ownership: ${data.totalOwnershipPercentage || '0'}%`),p('Ultimate Beneficial Owners',true),people(data.ubos || [],'ubo'),p(`Total UBO ownership: ${data.totalUboPercentage || '0'}%`),p(`Beneficial owners differ from shareholders: ${b.uboDifferentFromShareholders || '-'}`),p(b.uboGroupStructureNotes),
    p('Ownership Structure',true),p('__KYC_IMAGE_ownershipStructure__'),
    table(['Party','Parent entity','Ownership %','Beneficial person'],(b.shareholders || []).map((r: any) => [r.fullName,(b.shareholders || []).find((parent: any) => parent.id === r.parentRowId)?.fullName || a.legalName,r.shareholderPercentage ?? r.ownershipPercentage,r.isUbo ? 'Yes' : 'No']),[3000,3000,1600,2606]),
    p('C. Managers Directors Secretary and Signatories',true)];
  parts.push(table(['Full name','Position','Entity','Nation','Address','Birth date','ID No.','Signer'], (data.managers || []).map((r: any) => [r.managerFullName,r.managerPosition,r.managerEntityName,r.managerNationality,r.managerAddress,r.managerDateOfBirth,r.managerIdentityNumber,r.managerAuthorizedSignatory]), [1700,1200,1500,1000,1200,1300,1500,806]));
  parts.push(p('D. Compliance and Risk Information',true),table(['Question','Response','Details / supporting documents'],[['Politically exposed person exposure',d.pepQuestion || 'Not recorded',[d.pepDetails,data.pepDocumentFileNames].filter(Boolean).join('\n')],['Sanction exposure',d.sanctionQuestion || 'Not recorded',[d.sanctionDetails,data.sanctionDocumentFileNames].filter(Boolean).join('\n')],['Dual citizenship',d.dualCitizenshipQuestion || 'Not recorded',[d.dualCitizenshipDetails,data.dualCitizenshipPassportFileNames].filter(Boolean).join('\n')]],[3000,1800,5406]),
    p('E. Key Communication Person',true),fields([['Full name','communicationFullName'],['Position','communicationPosition'],['Nationality','communicationNationality'],['QID / Passport','communicationIdentityNumber'],['Mobile number','communicationMobile'],['Email','communicationEmail']]),
    p('F. Required Documents',true),table(['Document','Received','Uploaded files'],(f.documents || []).map((r: any) => [r.documentType,r.isProvided ? 'Yes' : 'No',r.fileName]),[3800,1300,5106]),p('Additional Documents',true),...(f.additionalDocuments || []).map((r: any) => p(r.fileName)),p(data.uploadedFilesNote),
    p('G. Client Declaration',true),p('I confirm that the information and documents provided are true, complete and up to date, and that I am authorised to represent the entity.'),fields([['Full name','declarationFullName'],['Position','declarationPosition'],['Date','declarationDate'],['Authorized signature','signatureFileName'],['Company stamp','stampFileName']]),
    p('H. Internal Use Only',true),fields([['Accuracy confirmed','amlAccuracyChecked'],['Clarification / findings','amlClarificationFindings'],['Risk classification','riskClassification'],['Due diligence type','dueDiligenceType']]));
  // Stage conclusion text already contains decisions, conditions and risk findings.
  for (const [prefix,label] of [['aml','AML Supervisor'],['dmlro','DMLRO'],['mlro','MLRO'],['sef','SEF']]) parts.push(p(label,true),fields([['Name',`${prefix}Name`],['Signature',`${prefix}SignatureFileName`],['Date',`${prefix}Date`],['Review findings',`${prefix}Comments`]]));
  const zip = letterheadTemplate ? new PizZip(letterheadTemplate) : new PizZip();
  if (letterheadTemplate) {
    zip.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="172033"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:spacing w:val="0"/><w:w w:val="100"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="40" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>');
    zip.file('word/settings.xml', '<?xml version="1.0" encoding="UTF-8"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>');
  }
  // Retain the original artwork, but remove its fragile floating text-box layout.
  const letterheadPart = (kind: 'header' | 'footer', id: number, height: number, top: number, bottom: number) => {
    const tag = kind === 'header' ? 'hdr' : 'ftr';
    return `<?xml version="1.0" encoding="UTF-8"?><w:${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="6480000" cy="${height}"/><wp:docPr id="${id}" name="Newoon ${kind}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Newoon ${kind}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:srcRect t="${top}" b="${bottom}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="6480000" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:${tag}>`;
  };
  if (zip.file('word/media/image1.png')) zip.file('word/header1.xml', letterheadPart('header', 20001, 1020000, 0, 67000));
  if (zip.file('word/media/image3.png')) zip.file('word/footer1.xml', letterheadPart('footer', 20002, 370000, 86000, 0));
  if (!letterheadTemplate) zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  let refs = '';
  let relationships = zip.file('word/_rels/document.xml.rels')?.asText() || '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  for (const kind of ['header', 'footer']) {
    if (!zip.file(`word/${kind}1.xml`)) continue;
    const id = `rIdKycLetterhead${kind}`;
    relationships = relationships.replace(new RegExp(`<Relationship\\b[^>]*Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}"[^>]*/>`, 'g'), '');
    relationships = relationships.replace('</Relationships>', `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}" Target="${kind}1.xml"/></Relationships>`);
    refs += `<w:${kind}Reference w:type="default" r:id="${id}"/>`;
  }
  zip.file('word/_rels/document.xml.rels', relationships);
  zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${parts.join('')}<w:sectPr>${refs}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2000" w:right="850" w:bottom="1000" w:left="850" w:header="300" w:footer="535"/></w:sectPr></w:body></w:document>`);
  return zip;
}
