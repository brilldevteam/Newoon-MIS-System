import { useEffect, useState } from 'react';
import { StatCard } from '../components/StatCard';
import { DashboardSummary, getDashboardSummary } from '../services/dashboard.service';

const emptySummary: DashboardSummary = {
  totalTenants: 0,
  totalClients: 0,
  pendingKyc: 0,
  pendingApprovals: 0,
  enabledModules: 0
};

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch(() => setSummary(emptySummary))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Operational summary across tenants and enabled modules.</p>
      </div>
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading dashboard...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Tenants" value={summary.totalTenants} tone="green" />
          <StatCard label="Total Clients" value={summary.totalClients} tone="blue" />
          <StatCard label="Pending KYC" value={summary.pendingKyc} tone="amber" />
          <StatCard label="Pending Approvals" value={summary.pendingApprovals} tone="rose" />
          <StatCard label="Enabled Modules" value={summary.enabledModules} />
        </div>
      )}
    </div>
  );
}
