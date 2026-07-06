const plannedModules = [
  'KYC & Engagement Workflow',
  'Client Management',
  'Document Management',
  'Approval Workflow',
  'Notifications',
  'Accounting',
  'Payroll',
  'Document Expiry Tracking',
  'Reports'
];

export function ModulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Modules</h1>
        <p className="mt-1 text-sm text-slate-500">Placeholder for tenant module enablement.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plannedModules.map((moduleName) => (
          <div key={moduleName} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{moduleName}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Ready</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Tenant toggle UI will connect to the tenant-module assignment API.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
