// One open enquiry per company / client: duplicates are refused (409) with a message naming the existing enquiry.
// Build first (npm run build), then: node backend/scripts/check-enquiry-duplicates.cjs
const assert = require('node:assert/strict');
const { EnquiriesService } = require('../dist/enquiries/enquiries.service');

function harness(rows) {
  let created = 0;
  const tx = {
    $executeRaw: async () => 1,
    enquiry: {
      findMany: async ({ where }) => rows.filter((row) =>
        row.tenantId === where.tenantId && (where.enquiryType.in ? where.enquiryType.in.includes(row.enquiryType) : row.enquiryType === where.enquiryType) && row.status !== where.status.not &&
        (!where.id || row.id !== where.id.not) && (!where.clientId || row.clientId === where.clientId)),
      findFirst: async () => null,
      create: async () => { created += 1; throw new Error('CREATE_REACHED'); }
    }
  };
  const service = new EnquiriesService({ $transaction: async (callback) => callback(tx), ...tx }, {});
  service.assertClientTenant = async () => {};
  service.logCreateFailure = () => {};
  return { service, created: () => created };
}

const user = { id: 'ops', tenantId: 't1', roles: ['OPERATING_TEAM'] };
const row = (overrides) => ({ id: 'e1', tenantId: 't1', enquiryCode: 'ENQ-2026-0011', enquiryType: 'EXISTING_LEGAL_ENTITY', status: 'DRAFT', companyName: 'Nuclei', proposedCompanyName: null, clientId: null, generatedKycCases: [], ...overrides });

async function main() {
  // Same company, different spacing/case/punctuation -> refused with the existing code in the message.
  {
    const { service, created } = harness([row({ companyName: 'Nuclei W.L.L.' })]);
    await assert.rejects(service.create(user, { enquiryType: 'EXISTING_LEGAL_ENTITY', companyName: '  nuclei wll ' }), (error) => {
      assert.equal(error.getStatus(), 409);
      assert.match(error.message, /already exists: ENQ-2026-0011 \(it is a draft\)/);
      return true;
    });
    assert.equal(created(), 0);
  }
  // Converted enquiry whose KYC is still running blocks; a finished one (client active / rejected) does not.
  {
    const { service } = harness([row({ status: 'CONVERTED_TO_KYC', generatedKycCases: [{ status: 'LEGAL_DOCUMENTS_UPLOADED' }] })]);
    await assert.rejects(service.create(user, { enquiryType: 'EXISTING_LEGAL_ENTITY', companyName: 'Nuclei' }), /its KYC is in progress/);
  }
  for (const finished of ['CLIENT_ACTIVE', 'CLIENT_REJECTED', 'MLRO_REJECTED', 'SEF_REJECTED']) {
    const { service } = harness([row({ status: 'CONVERTED_TO_KYC', generatedKycCases: [{ status: finished }] })]);
    await assert.rejects(service.create(user, { enquiryType: 'EXISTING_LEGAL_ENTITY', companyName: 'Nuclei' }), /CREATE_REACHED/, finished);
  }
  // Closed enquiries, other companies, other tenants and new-services enquiries do not block a company name.
  {
    const { service } = harness([row({ status: 'CLOSED' }), row({ id: 'e2', companyName: 'Other Co' }), row({ id: 'e3', tenantId: 't2' }), row({ id: 'e4', enquiryType: 'CURRENT_CLIENT_NEW_SERVICES', companyName: 'Nuclei', clientId: 'c9' })]);
    await assert.rejects(service.create(user, { enquiryType: 'EXISTING_LEGAL_ENTITY', companyName: 'Nuclei' }), /CREATE_REACHED/);
  }
  // The same name as a proposed company counts as the same company (and the other way round).
  {
    const { service } = harness([row({ enquiryType: 'PROPOSED_COMPANY', companyName: null, proposedCompanyName: 'ABCT TEST' })]);
    await assert.rejects(service.create(user, { enquiryType: 'EXISTING_LEGAL_ENTITY', companyName: 'abct test' }), /"ABCT TEST" already exists/);
  }
  // Proposed companies compare the proposed name; new-services enquiries compare the client.
  {
    const { service } = harness([row({ enquiryType: 'PROPOSED_COMPANY', companyName: null, proposedCompanyName: 'Pearl Holding' })]);
    await assert.rejects(service.create(user, { enquiryType: 'PROPOSED_COMPANY', proposedCompanyName: 'PEARL HOLDING' }), /"Pearl Holding" already exists/);
  }
  {
    const { service } = harness([row({ enquiryType: 'CURRENT_CLIENT_NEW_SERVICES', companyName: null, clientId: 'c1' })]);
    await assert.rejects(service.create(user, { enquiryType: 'CURRENT_CLIENT_NEW_SERVICES', clientId: 'c1' }), /this client already exists/);
    await assert.rejects(service.create(user, { enquiryType: 'CURRENT_CLIENT_NEW_SERVICES', clientId: 'c2' }), /CREATE_REACHED/);
  }
  // The live check used by the form excludes the enquiry being edited.
  {
    const { service } = harness([row({})]);
    assert.equal((await service.findOpenDuplicate(user, { enquiryType: 'EXISTING_LEGAL_ENTITY', name: 'Nuclei', excludeId: 'e1' })).duplicate, null);
    const found = (await service.findOpenDuplicate(user, { enquiryType: 'EXISTING_LEGAL_ENTITY', name: 'NUCLEI' })).duplicate;
    assert.equal(found.enquiryCode, 'ENQ-2026-0011');
    assert.equal((await service.findOpenDuplicate(user, { enquiryType: 'BOGUS', name: 'Nuclei' })).duplicate, null);
  }
  console.log('Enquiry duplicate checks passed: name matching ignores case/spacing/punctuation, open and in-KYC enquiries block, finished/closed/other-tenant ones do not, client match for new services, form check excludes itself (mocked persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
