import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import PizZip from 'pizzip';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, 'source', 'Blank Format.docx');
const output = join(root, 'kyc-part-1-template.docx');

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function runText(text, options = {}) {
  const font = options.font || 'Times New Roman';
  const size = options.size || '18';
  const textParts = String(text ?? '').split('\n');
  const body = textParts
    .map((part, index) => `${index > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(part)}</w:t>`)
    .join('');
  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>${body}</w:r>`;
}

function paragraph(text, options = {}) {
  const pPr = options.pPr || '';
  return `<w:p>${pPr}${runText(text, options)}</w:p>`;
}

function paragraphWithText(paragraphXml, text) {
  const pPr = paragraphXml.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] || '';
  const rPr = paragraphXml.match(/<w:r(?:\s[^>]*)?>\s*(<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>)/)?.[1] || '';
  const textParts = String(text ?? '').split('\n');
  const body = textParts
    .map((part, index) => `${index > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(part)}</w:t>`)
    .join('');
  return `<w:p>${pPr}<w:r>${rPr}${body}</w:r></w:p>`;
}

function replaceRange(value, start, end, replacement) {
  return `${value.slice(0, start)}${replacement}${value.slice(end)}`;
}

function matches(value, pattern) {
  return [...value.matchAll(pattern)];
}

function paragraphPlainText(paragraphXml) {
  return matches(paragraphXml, /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)
    .map((item) => item[1])
    .join('');
}

function cellText(cellXml, text) {
  const openingTag = cellXml.match(/^<w:tc(?:\s[^>]*)?>/)?.[0] || '<w:tc>';
  const props = cellXml.match(/<w:tcPr(?:\s[^>]*)?(?:\/[ ]*>|>[\s\S]*?<\/w:tcPr>)/)?.[0] || '';
  const firstParagraph = matches(cellXml, /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)[0]?.[0];
  return `${openingTag}${props}${firstParagraph ? paragraphWithText(firstParagraph, text) : paragraph(text)}</w:tc>`;
}

function replaceCell(rowXml, columnIndex, text) {
  const cells = matches(rowXml, /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g);
  const cell = cells[columnIndex];
  if (!cell) return rowXml;
  return replaceRange(rowXml, cell.index, cell.index + cell[0].length, cellText(cell[0], text));
}

function replaceTableCell(tableXml, rowIndex, columnIndex, text) {
  const rows = matches(tableXml, /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g);
  const row = rows[rowIndex];
  if (!row) return tableXml;
  const newRow = replaceCell(row[0], columnIndex, text);
  return replaceRange(tableXml, row.index, row.index + row[0].length, newRow);
}

function removeTableRows(tableXml, rowIndexes) {
  const rows = matches(tableXml, /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g);
  return [...rowIndexes]
    .sort((a, b) => b - a)
    .reduce((current, rowIndex) => {
      const row = rows[rowIndex];
      return row ? replaceRange(current, row.index, row.index + row[0].length, '') : current;
    }, tableXml);
}

function updateTable(documentXml, tableIndex, updater) {
  const tables = matches(documentXml, /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g);
  const table = tables[tableIndex];
  if (!table) return documentXml;
  const nextTable = updater(table[0]);
  return replaceRange(documentXml, table.index, table.index + table[0].length, nextTable);
}

function replaceParagraphContaining(documentXml, searchText, text) {
  const paragraphs = matches(documentXml, /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g);
  const match = paragraphs.find((item) => paragraphPlainText(item[0]).includes(searchText));
  if (!match) return documentXml;
  return replaceRange(documentXml, match.index, match.index + match[0].length, paragraphWithText(match[0], text));
}

function replaceParagraphMatching(documentXml, predicate, text) {
  const paragraphs = matches(documentXml, /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g);
  const match = paragraphs.find((item) => predicate(paragraphPlainText(item[0])));
  if (!match) return documentXml;
  return replaceRange(documentXml, match.index, match.index + match[0].length, paragraphWithText(match[0], text));
}

function removeParagraphMatching(documentXml, predicate) {
  const paragraphs = matches(documentXml, /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g);
  const match = paragraphs.find((item) => predicate(paragraphPlainText(item[0])));
  if (!match) return documentXml;
  return replaceRange(documentXml, match.index, match.index + match[0].length, '');
}

function insertParagraphAfterContaining(documentXml, searchText, text) {
  const paragraphs = matches(documentXml, /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g);
  const match = paragraphs.find((item) => paragraphPlainText(item[0]).includes(searchText));
  if (!match) return documentXml;
  return replaceRange(documentXml, match.index + match[0].length, match.index + match[0].length, paragraphWithText(match[0], text));
}

function replaceFirstParagraphText(documentXml, searchText, replacement) {
  const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(<w:t[^>]*>)${escapedSearch}(<\\/w:t>)`);
  return documentXml.replace(pattern, `$1${escapeXml(replacement)}$2`);
}

function buildTemplate() {
  const zip = new PizZip(fs.readFileSync(source));
  let xml = zip.file('word/document.xml').asText();

  xml = replaceFirstParagraphText(xml, 'Date:', 'Date: {date}');
  xml = replaceFirstParagraphText(xml, 'Reference:', 'Reference: {reference}');

  xml = updateTable(xml, 0, (table) => {
    let next = table;
    next = replaceTableCell(next, 0, 2, '{legalName}');
    next = replaceTableCell(next, 1, 2, '{commercialRegistrationNo}');
    next = replaceTableCell(next, 2, 2, '{taxIdentificationNo}');
    next = replaceTableCell(next, 3, 2, 'Date: {dateOfIncorporation}\nCountry: {countryOfIncorporation}');
    next = replaceTableCell(next, 4, 2, '{legalForm}');
    next = replaceTableCell(next, 5, 2, '{registeredOfficeAddress}');
    next = replaceTableCell(next, 6, 2, '{telephone}');
    next = replaceTableCell(next, 7, 2, '{email}');
    next = replaceTableCell(next, 8, 2, '{website}');
    next = replaceTableCell(next, 9, 2, '{businessNature}');
    next = replaceTableCell(next, 10, 2, '{licenseActivities}');
    next = replaceTableCell(next, 11, 2, '{relatedIndustry}');
    next = replaceTableCell(next, 12, 2, '{prospectiveService}');
    return next;
  });

  xml = updateTable(xml, 1, (table) => {
    let next = removeTableRows(table, [7, 6, 5, 4, 3, 2]);
    const placeholders = [
      '{#shareholders}{shareholderNo}',
      '{shareholderFullName}',
      '{shareholderNationality}',
      '{shareholderDateOfBirth}',
      '{shareholderIdentityNumber}',
      '{shareholderOwnershipPercentage}',
      '{shareholderResidenceAddress}{/shareholders}'
    ];
    placeholders.forEach((value, index) => {
      next = replaceTableCell(next, 1, index, value);
    });
    next = replaceTableCell(next, 2, 5, '{totalOwnershipPercentage}');
    return next;
  });

  xml = replaceParagraphContaining(xml, 'Yes ☐No ☐', 'Yes {uboDifferentYes}    No {uboDifferentNo}');
  xml = replaceParagraphContaining(xml, 'If yes, please provide UBOs/Group structure and details. UBOs/ Group structure:', 'If yes, please provide UBOs/Group structure and details. UBOs/ Group structure: {uboGroupStructureNotes}');
  xml = insertParagraphAfterContaining(xml, 'If yes, please provide UBOs/Group structure and details. UBOs/ Group structure: {uboGroupStructureNotes}', 'Auto-generated ownership structure:\n{ownershipStructureText}');

  xml = updateTable(xml, 2, (table) => {
    let next = removeTableRows(table, [7, 6, 5, 4, 3, 2]);
    const placeholders = [
      '{#ubos}{uboNo}',
      '{uboFullName}',
      '{uboNationality}',
      '{uboDateOfBirth}',
      '{uboIdentityNumber}',
      '{uboOwnershipPercentage}',
      '{uboResidenceAddress}{/ubos}'
    ];
    placeholders.forEach((value, index) => {
      next = replaceTableCell(next, 1, index, value);
    });
    next = replaceTableCell(next, 2, 5, '{totalUboPercentage}');
    return next;
  });

  xml = updateTable(xml, 3, (table) => {
    let next = removeTableRows(table, [4, 3]);
    const placeholders = [
      '{#managers}{managerNo}',
      '{managerFullName}',
      '{managerPosition}',
      '{managerEntityName}',
      '{managerNationality}',
      '{managerAddress}',
      '{managerDateOfBirth}',
      '{managerIdentityNumber}',
      '{managerAuthorizedSignatory}{/managers}'
    ];
    placeholders.forEach((value, index) => {
      next = replaceTableCell(next, 2, index, value);
    });
    return next;
  });

  xml = replaceParagraphContaining(xml, 'Are any of the following people considered as Politically Exposed Persons (PEPs):', '1. Are any of the following people considered as Politically Exposed Persons (PEPs):');
  xml = replaceParagraphContaining(xml, 'Yes, if yes, please provide full details:', 'Yes {pepQuestion}    No {pepNo}');
  xml = insertParagraphAfterContaining(xml, 'Yes {pepQuestion}    No {pepNo}', '{pepDetails}');
  xml = replaceParagraphContaining(xml, 'Has any of the individuals or entities referred above have ever been sanctioned', '2. Has any of the individuals or entities referred above have ever been sanctioned by any government or regulatory body including but not limited to the NCTC, United Nations, U.S.A., E.U, U.K, Qatar and FATF member countries?');
  xml = replaceParagraphContaining(xml, 'Yes, if yes, please provide full details of any sanctions applied and the current state of such sanctions:', 'Yes {sanctionQuestion}    No {sanctionNo}');
  xml = insertParagraphAfterContaining(xml, 'Yes {sanctionQuestion}    No {sanctionNo}', '{sanctionDetails}');
  xml = replaceParagraphContaining(xml, 'Whether the beneficial owners or key management having dual citizenship?', '3. Whether the beneficial owners or key management having dual citizenship?');
  xml = replaceParagraphContaining(xml, 'Yes, if yes, please provide details and passport copy:', 'Yes {dualCitizenshipQuestion}    No {dualCitizenshipNo}');
  xml = insertParagraphAfterContaining(xml, 'Yes {dualCitizenshipQuestion}    No {dualCitizenshipNo}', '{dualCitizenshipDetails}\nPassport copy: {dualCitizenshipPassportFileName}');
  for (let index = 0; index < 3; index += 1) {
    xml = removeParagraphMatching(xml, (text) => text.trim() === 'No');
  }

  xml = updateTable(xml, 4, (table) => {
    let next = table;
    [
      '{communicationFullName}',
      '{communicationPosition}',
      '{communicationNationality}',
      '{communicationIdentityNumber}',
      '{communicationMobile}',
      '{communicationEmail}'
    ].forEach((value, index) => {
      next = replaceTableCell(next, index, 2, value);
    });
    return next;
  });

  [
    ['Commercial Registration or the CR Extraction of the concern entity (CR).', '{docCommercialRegistration}'],
    ['Entity Card/Computer card of the concern entity.', '{docEntityCard}'],
    ['Certificate of Incorporation of the Concern entity.', '{docCertificateOfIncorporation}'],
    ['Articles of Association of the Concern Entity.', '{docArticlesOfAssociation}'],
    ['Qatar IDs/passport copies of all-natural person, direct and indirect, shareholders, UBOs, Directors, SEF, Secretory and authorized signatories up to and including its ultimate beneficial owners.', '{docIdentityCopies}'],
    ['If Shareholders are legal entities not the natural persons, please provide the CR of all legal entities until natural persons', '{docLegalEntityShareholderCr}'],
    ['National address certificates for the legal entities and natural persons residents in the state of Qatar.', '{docNationalAddressCertificates}'],
    ['Latest Audited Financial Statements.', '{docAuditedFinancialStatements}'],
    ['Tax Card of the concern entity.', '{docTaxCard}']
  ].forEach(([searchText, mark]) => {
    xml = replaceParagraphContaining(xml, searchText, `${mark} ${searchText}`);
  });
  xml = insertParagraphAfterContaining(xml, 'Tax Card of the concern entity.', 'Additional documents: {additionalDocumentsText}');
  xml = insertParagraphAfterContaining(xml, 'Additional documents: {additionalDocumentsText}', 'Additional notes for KYC preparation documents: {uploadedFilesNote}');

  xml = updateTable(xml, 5, (table) => {
    let next = table;
    next = replaceTableCell(next, 0, 1, '{declarationFullName}');
    next = replaceTableCell(next, 1, 1, '{declarationPosition}');
    next = replaceTableCell(next, 2, 1, '{declarationDate}');
    next = replaceTableCell(next, 3, 1, '{signatureFileName}');
    next = replaceTableCell(next, 4, 1, '{stampFileName}');
    return next;
  });

  xml = replaceParagraphContaining(xml, 'Yes ☐No ☐', 'Yes {amlAccuracyYes}    No {amlAccuracyNo}');
  xml = replaceParagraphContaining(xml, 'If No, please provide clarification and findings.', 'If No, please provide clarification and findings: {amlClarificationFindings}');
  xml = replaceParagraphMatching(xml, (text) => text.includes('High Risk') && text.includes('Medium Risk') && text.includes('Low Risk'), 'High Risk {riskHigh}    Medium Risk {riskMedium}    Low Risk {riskLow}');
  xml = replaceParagraphMatching(xml, (text) => text.includes('Simplified Due Diligence') && text.includes('Regular Due Diligence') && text.includes('Enhanced Due Diligence'), 'Simplified Due Diligence {dueSimplified}    Regular Due Diligence {dueRegular}    Enhanced Due Diligence {dueEnhanced}');

  xml = updateTable(xml, 6, (table) => {
    let next = table;
    next = replaceTableCell(next, 0, 1, '{amlName}');
    next = replaceTableCell(next, 1, 1, '{amlSignatureFileName}');
    next = replaceTableCell(next, 2, 1, '{amlDate}');
    next = replaceTableCell(next, 3, 1, '{amlComments}');
    return next;
  });

  xml = updateTable(xml, 7, (table) => {
    let next = table;
    next = replaceTableCell(next, 0, 1, '{dmlroName}');
    next = replaceTableCell(next, 1, 1, '{dmlroSignatureFileName}');
    next = replaceTableCell(next, 2, 1, '{dmlroDate}');
    next = replaceTableCell(next, 3, 1, '{dmlroComments}');
    return next;
  });

  xml = updateTable(xml, 8, (table) => {
    let next = table;
    next = replaceTableCell(next, 0, 1, '{mlroName}');
    next = replaceTableCell(next, 1, 1, '{mlroSignatureFileName}');
    next = replaceTableCell(next, 2, 1, '{mlroDate}');
    next = replaceTableCell(next, 3, 1, '{mlroComments}');
    return next;
  });

  xml = updateTable(xml, 9, (table) => {
    let next = table;
    next = replaceTableCell(next, 0, 1, '{sefName}');
    next = replaceTableCell(next, 1, 1, '{sefSignatureFileName}');
    next = replaceTableCell(next, 2, 1, '{sefDate}');
    next = replaceTableCell(next, 3, 1, '{sefComments}');
    return next;
  });

  zip.file('word/document.xml', xml);
  fs.writeFileSync(output, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log(output);
}

buildTemplate();
