// Isolated mocks only. Does not initialize Nest, read .env or connect to a database.
const assert = require('node:assert/strict');
const { RolesGuard } = require('../../backend/dist/common/guards/roles.guard');
const { TenantsService } = require('../../backend/dist/tenants/tenants.service');
const { KycService } = require('../../backend/dist/kyc/kyc.service');
const { CrrfService } = require('../../backend/dist/crrf/crrf.service');

async function main() {
  class TenantsController {}
  const context = {
    getHandler: () => function findAll() {}, getClass: () => TenantsController,
    switchToHttp: () => ({ getRequest: () => ({ method: 'GET', user: { roles: ['COMPANY_ADMIN'] } }) })
  };
  const guard = new RolesGuard({ getAllAndOverride: () => ['SUPER_ADMIN'] }, { allows: async () => true });
  assert.equal(await guard.canActivate(context), true, 'F-01: configured area grant overrides SUPER_ADMIN decorator');
  const noRolesGuard = new RolesGuard({ getAllAndOverride: () => undefined }, { allows: async () => { throw new Error('Area should not be consulted'); } });
  assert.equal(await noRolesGuard.canActivate(context), true, 'F-01: missing role metadata bypasses area check');

  let query;
  const tenants = new TenantsService({ tenant: { findUniqueOrThrow: async (input) => { query = input; return {}; } } });
  await tenants.findOne('synthetic-tenant');
  assert.equal(query.include.users, true, 'F-02: full nested user relation selected');

  const service = Object.create(KycService.prototype);
  const saved = [];
  service.saveSectionData = async (...args) => { saved.push(args[2]); };
  service.saveOwnership = async () => { throw new Error('Synthetic invalid ownership'); };
  await assert.rejects(service.autoSaveForm({}, 'synthetic-case', { sectionA: { legalName: 'Changed' }, sectionB: { shareholders: [] } }), /invalid ownership/);
  assert.equal(saved.length, 1, 'F-04: earlier save runs before later failure');

  service.findOne = async () => ({ id: 'case', clientId: 'client', status: 'KYC_FINAL_APPROVED', legalDocuments: [{ documentType: 'Signed Engagement Letter', storagePath: 'synthetic-path' }] });
  let clientChanged = false;
  service.prisma = { client: { update: async () => { clientChanged = true; } } };
  service.updateStatus = async () => { throw new Error('Synthetic status failure'); };
  await assert.rejects(service.completeEngagementDecision({ roles: ['OPERATING_TEAM'] }, 'case', { decision: 'CONVERT_TO_CLIENT' }), /status failure/);
  assert.equal(clientChanged, true, 'F-05: client write precedes failing status operation');

  const crrf = Object.create(CrrfService.prototype);
  crrf.findCase = async () => ({ id: 'case', status: 'MLRO_REVIEW_PENDING', tenantId: 'tenant' });
  crrf.ensureRecord = async () => ({ id: 'crrf', documents: [{ id: 'file' }] });
  let riskWritten = false;
  crrf.prisma = { crrfRecord: { update: async () => { riskWritten = true; } } };
  crrf.getWorkspace = async () => ({});
  await crrf.saveWorkspace({ roles: ['AML_SUPERVISOR'] }, 'case', { riskRating: 'LOW' });
  assert.equal(riskWritten, true, 'F-03: CRRF service does not reject downstream review status');
  console.log('Evaluation probes passed: reproduced F-01, F-02 query selection, F-03 CRRF, F-04 sequencing and F-05 sequencing using mocks. No live exploit or DB test.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
