import { ArrowRight, Building2, CheckCircle2, ClipboardCheck, FileCheck2, Layers, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { useAuth } from '../hooks/useAuth';
import { DashboardSummary, getDashboardSummary } from '../services/dashboard.service';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { formatNumber } from '../utils/format';

const emptySummary: DashboardSummary = {
  totalTenants: 0,
  totalClients: 0,
  pendingKyc: 0,
  pendingApprovals: 0,
  enabledModules: 0
};

const workflowStages = [
  { label: 'Enquiry', helper: 'BD intake', value: 82, tone: 'bg-sky-500' },
  { label: 'KYC Prep', helper: 'AML form', value: 64, tone: 'bg-brand-600' },
  { label: 'Review', helper: 'DMLRO and MLRO', value: 48, tone: 'bg-amber-500' },
  { label: 'Approved', helper: 'Client ready', value: 36, tone: 'bg-emerald-500' }
];

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const canCreateEnquiry = hasAnyRole(user, workflowRoles.clientIntake);

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch(() => setSummary(emptySummary))
      .finally(() => setLoading(false));
  }, []);

  const healthScore = useMemo(() => {
    const totalOpen = summary.pendingKyc + summary.pendingApprovals;
    if (!summary.totalClients) return 0;
    return Math.max(18, Math.min(96, Math.round(((summary.totalClients - totalOpen) / Math.max(summary.totalClients, 1)) * 100)));
  }, [summary.pendingApprovals, summary.pendingKyc, summary.totalClients]);

  const pendingTotal = summary.pendingKyc + summary.pendingApprovals;

  if (loading) {
    return (
      <div className="space-y-6">
        <DashboardHeader canCreateEnquiry={canCreateEnquiry} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader canCreateEnquiry={canCreateEnquiry} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Tenants" value={summary.totalTenants} detail="Configured workspaces" trend="Live" tone="green" icon={Building2} />
        <StatCard label="Clients" value={summary.totalClients} detail="Client intake register" trend="Active" tone="blue" icon={UsersRound} />
        <StatCard label="Pending KYC" value={summary.pendingKyc} detail="Files in preparation" trend="Open" tone="amber" icon={ClipboardCheck} />
        <StatCard label="Approvals" value={summary.pendingApprovals} detail="Waiting for review" trend="Queue" tone="rose" icon={ShieldCheck} />
        <StatCard label="Modules" value={summary.enabledModules} detail="Enabled capabilities" trend="Ready" icon={Layers} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Workflow Performance</h2>
              <p className="mt-1 text-sm text-slate-500">A quick read of active intake, preparation, and approval work.</p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {formatNumber(pendingTotal)} open actions
            </span>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Operational Health</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{healthScore}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current focus</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{summary.pendingApprovals ? 'Approval queue' : 'KYC preparation'}</p>
                </div>
              </div>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${healthScore}%` }} />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MiniMetric label="KYC waiting" value={summary.pendingKyc} />
                <MiniMetric label="Approvals waiting" value={summary.pendingApprovals} />
                <MiniMetric label="Enabled modules" value={summary.enabledModules} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-950">Stage Mix</h3>
                <FileCheck2 className="h-4 w-4 text-brand-600" />
              </div>
              <div className="mt-5 space-y-4">
                {workflowStages.map((stage) => (
                  <div key={stage.label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700">{stage.label}</span>
                      <span className="text-slate-400">{stage.helper}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${stage.tone}`} style={{ width: `${stage.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Readiness</h2>
              <p className="mt-1 text-sm text-slate-500">Key system areas at a glance.</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6 space-y-3">
            <ReadinessRow label="Client intake" value={summary.totalClients ? 'Available' : 'No clients yet'} ready={summary.totalClients > 0} />
            <ReadinessRow label="KYC preparation" value={summary.pendingKyc ? 'In progress' : 'Clear'} ready />
            <ReadinessRow label="Approval workflow" value={summary.pendingApprovals ? 'Action needed' : 'No pending approvals'} ready={!summary.pendingApprovals} />
            <ReadinessRow label="Modules" value={`${formatNumber(summary.enabledModules)} enabled`} ready={summary.enabledModules > 0} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-950">Quick Workflow Actions</h2>
            <p className="mt-1 text-sm text-slate-500">Jump into the highest frequency operational areas.</p>
          </div>
          <div className="divide-y divide-slate-100">
            <QuickAction to="/enquiries" title="Open enquiry register" description="Review BD enquiries and prepare files for KYC." />
            <QuickAction to="/kyc-workflow" title="Review KYC workflow" description="Track document collection, approvals, and final status." />
            <QuickAction to="/review-tasks" title="Open my review tasks" description="Go directly to role-specific DMLRO, MLRO, or SEF actions." />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm shadow-slate-300/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Newoon Control Panel</h2>
              <p className="mt-1 text-sm text-slate-300">Designed for KYC intake and approval visibility.</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next best action</p>
            <p className="mt-2 text-2xl font-semibold">{pendingTotal ? `${formatNumber(pendingTotal)} files need attention` : 'Workspace is clear'}</p>
            <p className="mt-2 text-sm text-slate-300">
              {pendingTotal ? 'Start from the KYC workflow queue and resolve pending preparation or approval items.' : 'New enquiries and KYC cases will appear here as they move through the workflow.'}
            </p>
          </div>
          <Link
            to="/kyc-workflow"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Open KYC Workflow
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function DashboardHeader({ canCreateEnquiry }: { canCreateEnquiry: boolean }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-200/60 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Newoon MIS</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">Operational overview for enquiries, KYC preparation, approvals, and enabled modules.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canCreateEnquiry ? (
          <Link
            to="/enquiries/new"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New Enquiry
          </Link>
        ) : null}
        <Link
          to="/kyc-workflow"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ClipboardCheck className="h-4 w-4" />
          KYC Workflow
        </Link>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{formatNumber(value)}</p>
    </div>
  );
}

function ReadinessRow({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`text-sm font-semibold ${ready ? 'text-brand-700' : 'text-amber-700'}`}>{value}</span>
    </div>
  );
}

function QuickAction({ to, title, description }: { to: string; title: string; description: string }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50">
      <div className="min-w-0">
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600">
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
