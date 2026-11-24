const assert = require('node:assert/strict');
const { identityReading } = require('../dist/common/identity-reading');
const { KycService } = require('../dist/kyc/kyc.service');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');

// "Fill from a copy" on the KYC form and the enquiry form (2026-11-24): the read endpoints store nothing, read a CR
// with the case's company (AI service or this server) and a passport / QID on this server, and on the KYC form only
// while the case can be edited by that user's company.
// Synthetic persistence and readers only: never connects to a database, never reads real documents, never calls OpenAI.
// Run from the repository root after `npm run build`: node backend/scripts/check-document-fill.cjs

const png = () => ({ originalname: 'copy.png', mimetype: 'image/png', size: 16, buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]) });
const exe = () => ({ originalname: 'copy.exe', mimetype: 'application/octet-stream', size: 4, buffer: Buffer.from('MZ..') });
const aml = { id: 'aml-1', email: 'aml@example.invalid', tenantId: 'tenant-a', roles: ['AML_SUPERVISOR'] };
const otherCompany = { ...aml, id: 'aml-2', tenantId: 'tenant-b' };

const passport = { format: 'TD3', documentType: 'P', issuingCountry: 'QAT', documentNumber: 'P1234567', documentNumberCheck: 'OK', expiryDate: '2031-05-20', expiryValid: true, dateOfBirth: '1985-02-01', surname: 'SALEH', givenNames: 'SAMER', nationality: 'JOR' };
const qid = { ...passport, format: 'TD1', documentType: 'ID', documentNumber: '28240002378', expiryDate: '2028-07-26' };

function checkIdentityReading() {
  assert.deepEqual(identityReading(null, 'PASSPORT'), { found: false, message: 'The details could not be read from this file. Enter them from the document.' });
  assert.equal(identityReading({ ...passport, documentNumber: null, expiryDate: null }, 'PASSPORT').found, false, 'Nothing useful read');
  const read = identityReading(passport, 'PASSPORT');
  assert.equal(read.identityType, 'PASSPORT');
  assert.equal(read.typeMatches, true);
  assert.equal(read.expiryDate, '2031-05-20');
  assert.equal(read.nameOnDocument, 'SAMER SALEH');
  const wrong = identityReading(qid, 'PASSPORT');
  assert.equal(wrong.identityType, 'QID', 'The detected type wins');
  assert.equal(wrong.typeMatches, false, 'A QID read as a passport is flagged');
}

function kycService(status, readers) {
  const calls = { company: [], identity: 0 };
  const prisma = {
    kycCase: {
      findFirst: async ({ where }) => (where.id === 'case-1' && (!where.tenantId || where.tenantId === 'tenant-a') ? { id: 'case-1', tenantId: 'tenant-a', status } : null)
    },
    kycForm: { findFirst: async () => null }
  };
  const documentReader = { read: async (tenantId, typeKey, file) => { calls.company.push({ tenantId, typeKey, name: file.originalname }); return { method: 'LOCAL', message: 'read', aiConfigured: false, document: {}, company: { legalName: 'Synthetic LLC' }, people: [] }; } };
  const idReader = { read: async () => { calls.identity += 1; if (readers?.idFails) throw new Error('OCR failed'); return passport; } };
  return { service: new KycService(prisma, {}, documentReader, idReader), calls };
}

async function checkKycRead() {
  const { service, calls } = kycService('LEGAL_DOCUMENTS_PENDING');
  const company = await service.readFormDocument(aml, 'case-1', 'COMPANY', [png()]);
  assert.equal(company.company.legalName, 'Synthetic LLC');
  assert.deepEqual(calls.company, [{ tenantId: 'tenant-a', typeKey: 'CR_EXTRACT_EN', name: 'copy.png' }], "Read as a CR with the case's company settings");
  const id = await service.readFormDocument(aml, 'case-1', 'PASSPORT', [png()]);
  assert.equal(id.found, true);
  assert.equal(id.documentNumber, 'P1234567');

  await assert.rejects(service.readFormDocument(aml, 'case-1', 'OTHER', [png()]), /COMPANY, PASSPORT or QID/);
  await assert.rejects(service.readFormDocument(aml, 'case-1', 'COMPANY', []), /Select one file/);
  await assert.rejects(service.readFormDocument(aml, 'case-1', 'COMPANY', [png(), png()]), /Select one file/);
  await assert.rejects(service.readFormDocument(aml, 'case-1', 'COMPANY', [exe()]), (error) => error.status === 400, 'Executables are refused');
  await assert.rejects(service.readFormDocument(otherCompany, 'case-1', 'COMPANY', [png()]), (error) => error.status === 404, "Another company's case is not found");

  // A file already uploaded to the case is read through the case's own document access.
  const storedCase = kycService('LEGAL_DOCUMENTS_UPLOADED');
  const fetched = [];
  storedCase.service.getLegalDocumentFile = async (user, caseId, documentId) => { fetched.push([user.tenantId, caseId, documentId]); return { fileName: 'stored-cr.png', mimeType: 'image/png', content: png().buffer }; };
  await storedCase.service.readFormDocument(aml, 'case-1', 'COMPANY', [], 'doc-7');
  assert.deepEqual(fetched, [['tenant-a', 'case-1', 'doc-7']]);
  assert.equal(storedCase.calls.company[0].name, 'stored-cr.png', 'The stored file is read');
  const storedId = await storedCase.service.readFormDocument(aml, 'case-1', 'QID', [], 'doc-8');
  assert.equal(storedId.found, true);
  storedCase.service.getLegalDocumentFile = async () => ({ fileName: 'tool.exe', mimeType: 'application/octet-stream', content: Buffer.from('MZ..') });
  await assert.rejects(storedCase.service.readFormDocument(aml, 'case-1', 'COMPANY', [], 'doc-9'), (error) => error.status === 400, 'A stored file goes through the same file-type checks');

  const locked = kycService('DMLRO_REVIEW_PENDING');
  locked.service.getLegalDocumentFile = async () => { throw new Error('must not read a stored file on a locked case'); };
  await assert.rejects(locked.service.readFormDocument(aml, 'case-1', 'COMPANY', [], 'doc-7'), /locked/);
  await assert.rejects(locked.service.readFormDocument(aml, 'case-1', 'COMPANY', [png()]), /locked/, 'Nothing is read while the case is under review');
  assert.equal(locked.calls.company.length, 0);

  const failing = kycService('LEGAL_DOCUMENTS_UPLOADED', { idFails: true });
  const unread = await failing.service.readFormDocument(aml, 'case-1', 'QID', [png()]);
  assert.equal(unread.found, false, 'A reader failure falls back to manual entry');

  const noReader = new KycService(kycService('LEGAL_DOCUMENTS_PENDING').service.prisma, {});
  await assert.rejects(noReader.readFormDocument(aml, 'case-1', 'COMPANY', [png()]), /not available/);
}

async function checkEnquiryRead() {
  const seen = [];
  const documentReader = { read: async (tenantId, typeKey) => { seen.push([tenantId, typeKey]); return { method: 'NONE', message: 'none', aiConfigured: false, document: {}, company: {}, people: [] }; } };
  const service = new EnquiriesService({}, {}, undefined, documentReader);
  await service.readCompanyDocument({ ...aml, roles: ['OPERATING_TEAM'] }, [png()]);
  assert.deepEqual(seen, [['tenant-a', 'CR_EXTRACT_EN']], "The user's company settings are used");
  await assert.rejects(service.readCompanyDocument(aml, [png(), png()]), /Select one file/);
  await assert.rejects(service.readCompanyDocument(aml, [exe()]), (error) => error.status === 400);
  const id = await new EnquiriesService({}, {}, { read: async () => qid }).readIdentityDocument('QID', [png()]);
  assert.equal(id.identityType, 'QID');
  assert.equal(id.documentNumber, '28240002378');
}

async function main() {
  checkIdentityReading();
  await checkKycRead();
  await checkEnquiryRead();
  console.log('Document fill checks passed: passport / QID reading shape and type warning, KYC CR and ID reads with the case company, one-file and file-type limits, tenant scoping, locked review cases refused, reader failures fall back to manual entry, enquiry CR read with the user company (synthetic readers).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
