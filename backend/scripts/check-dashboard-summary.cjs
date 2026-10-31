const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DashboardService } = require('../dist/dashboard/dashboard.service');
const { ClientsService } = require('../dist/clients/clients.service');
const { KycCaseStatus } = require('@prisma/client');

// Synthetic persistence only: never connects to the configured database.
async function main() {
  const rows = {
    tenant: [{ id: 'a' }, { id: 'b' }],
    client: [
      { id: 'prospect', tenantId: 'a', status: 'PROSPECT' },
      { id: 'active-a', tenantId: 'a', status: 'ACTIVE' },
      { id: 'inactive', tenantId: 'a', status: 'INACTIVE' },
      { id: 'active-b', tenantId: 'b', status: 'ACTIVE' }
    ],
    enquiry: ['DRAFT', 'SUBMITTED_TO_AML_SUPERVISOR', 'RETURNED_TO_BD', 'READY_FOR_KYC', 'CONVERTED_TO_KYC'].map((status) => ({ tenantId: 'a', status })),
    kycCase: Object.values(KycCaseStatus).flatMap((status) => ['a', 'b'].map((tenantId) => ({ tenantId, status }))),
    tenantModule: [{ tenantId: 'a', isEnabled: true }, { tenantId: 'a', isEnabled: false }, { tenantId: 'b', isEnabled: true }]
  };
  const queries = [];
  const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => value && typeof value === 'object' ? value.in.includes(row[key]) : row[key] === value);
  const prisma = Object.fromEntries(Object.entries(rows).map(([model, records]) => [model, {
    count: async ({ where } = {}) => { queries.push({ model, where }); return records.filter((row) => matches(row, where)).length; },
    findMany: async ({ where }) => records.filter((row) => matches(row, where))
  }]));
  const dashboard = new DashboardService(prisma);
  const clients = new ClientsService(prisma);
  const actor = { id: 'operator', email: 'synthetic@example.invalid', tenantId: 'a', roles: ['OPERATING_TEAM'] };
  const summary = await dashboard.summary(actor);
  assert.equal(summary.totalClients, (await clients.findAll(actor)).length);
  assert.equal(summary.totalClients, 1);
  rows.client[1].status = 'PROSPECT';
  assert.equal((await dashboard.summary(actor)).totalClients, 0, 'Prospect-only intake must not appear as active clients');
  assert.equal((await clients.findAll(actor)).length, 0);
  rows.client[1].status = 'ACTIVE';
  assert.equal(summary.totalTenants, 1);
  assert.equal(summary.openEnquiries, 4);
  assert.equal(summary.enabledModules, 1);
  const groups = queries.filter((query) => query.model === 'kycCase').slice(0, 3).map((query) => query.where.status.in);
  assert.equal(summary.pendingKyc, groups[0].length);
  assert.equal(summary.pendingApprovals, groups[1].length);
  assert.equal(summary.approvedKyc, 3);
  assert.equal(new Set(groups.flat()).size, groups.flat().length, 'KYC groups must not double count');
  const workflow = fs.readFileSync('frontend/src/pages/KycWorkflowPage.tsx', 'utf8');
  for (const [index, filter] of ['pending-kyc', 'pending-approvals'].entries()) {
    const line = workflow.split('\n').find((line) => line.includes(`activeFilter === '${filter}'`));
    const statuses = [...line.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
    assert.deepEqual(statuses, groups[index], `${filter} link must show exactly the counted statuses`);
  }
  assert.equal((await dashboard.summary({ ...actor, tenantId: 'missing' })).totalTenants, 0);
  assert.equal((await dashboard.summary({ ...actor, tenantId: 'missing' })).totalClients, 0);
  await assert.rejects(dashboard.summary({ ...actor, tenantId: null }), /not assigned to a tenant/);
  const global = await dashboard.summary({ ...actor, tenantId: null, roles: ['SUPER_ADMIN'] });
  assert.equal(global.totalTenants, 2);
  assert.equal(global.totalClients, (await clients.findAll({ ...actor, roles: ['SUPER_ADMIN'] })).length);
  assert.equal(global.enabledModules, 2);
  assert.equal(global.pendingKyc, summary.pendingKyc * 2);
  await assert.rejects(new DashboardService({ ...prisma, client: { count: async () => { throw new Error('Synthetic query failure'); } } }).summary(actor), /Synthetic query failure/);
  console.log('Dashboard summary checks passed: active-client list parity, tenant isolation, status/link parity, live counts and query failure propagation (synthetic persistence).');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
