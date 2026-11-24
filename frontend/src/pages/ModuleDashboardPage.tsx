import { ArrowUpRight, Building2, CalendarDays, ChartNoAxesColumn, ChevronRight, ClipboardCheck, FileText, Inbox, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import { listEnquiries, listKycCases } from '../services/kyc-workflow.service';
import { listComplianceClients } from '../services/compliance-clients.service';
import { hasAnyRole, hasAreaAccess, workflowRoles } from '../utils/access-control';
import { availableWorkspaceModules, workspaceModules } from '../utils/workspace-modules';
import { kycStatusLabel } from '../utils/kyc-status-labels';
import { DashboardBarChart, DashboardDonut, DashboardPoint, dashboardColors, monthlyDashboardPoints } from '../components/DashboardCharts';

type ModuleId = 'enquiry' | 'kyc' | 'compliance';
type Row = { id: string; title: string; reference: string; status: string; to: string };
type Dashboard = { cards: DashboardPoint[]; rows: Row[]; stages: DashboardPoint[]; mix: DashboardPoint[]; dates?: string[]; priorities?: DashboardPoint[] };
const enquiryLabels: Record<string, string> = { DRAFT: 'Draft', SUBMITTED_TO_AML_SUPERVISOR: 'Submitted to AML Supervisor', RETURNED_TO_BD: 'Returned to BD', READY_FOR_KYC: 'Ready for KYC', CONVERTED_TO_KYC: 'Converted to KYC', CLOSED: 'Closed' };
const clientLabels: Record<string, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', ON_HOLD: 'On hold' };

function distribution(statuses: string[], label: (status: string) => string) {
  const counts = new Map<string, number>();
  statuses.forEach(status => counts.set(status, (counts.get(status) || 0) + 1));
  return [...counts].map(([status, value]) => ({ label: label(status), value }));
}

async function loadDashboard(module: ModuleId): Promise<Dashboard> {
  if (module === 'enquiry') {
    const items = await listEnquiries();
    return {
      cards: [{ label: 'Enquiry records', value: items.length }, { label: 'Drafts', value: items.filter(row => row.status === 'DRAFT').length }, { label: 'Returned to BD', value: items.filter(row => row.status === 'RETURNED_TO_BD').length }, { label: 'Converted to KYC', value: items.filter(row => row.status === 'CONVERTED_TO_KYC').length }],
      stages: distribution(items.map(row => row.status), status => enquiryLabels[status] || status),
      mix: distribution(items.map(row => row.enquiryType || 'UNSPECIFIED'), type => (({ EXISTING_LEGAL_ENTITY: 'Existing legal entity', PROPOSED_COMPANY: 'Proposed company', CURRENT_CLIENT_NEW_SERVICES: 'New services', UNSPECIFIED: 'Unspecified' } as Record<string, string>)[type] || type)),
      dates: items.map(row => row.createdAt),
      rows: items.slice(0, 6).map(row => ({ id: row.id, title: row.companyName || row.proposedCompanyName || row.keyContactName || row.enquiryCode, reference: row.enquiryCode, status: enquiryLabels[row.status] || row.status, to: `/enquiries/${row.id}` }))
    };
  }
  if (module === 'kyc') {
    const items = await listKycCases();
    return {
      cards: [{ label: 'KYC cases', value: items.length }, { label: 'Returned to BD', value: items.filter(row => ['RETURNED_TO_BD'].includes(row.status)).length }, { label: 'Final KYC approved', value: items.filter(row => row.status === 'KYC_FINAL_APPROVED').length }, { label: 'Client active', value: items.filter(row => row.status === 'CLIENT_ACTIVE').length }],
      stages: distribution(items.map(row => row.status), kycStatusLabel),
      mix: distribution(items.map(row => row.purpose || 'UNSPECIFIED'), purpose => (({ ONBOARDING: 'Onboarding', REKYC: 'Re-KYC', UNSPECIFIED: 'Unspecified' } as Record<string, string>)[purpose] || purpose)),
      dates: items.map(row => row.createdAt),
      rows: items.slice(0, 6).map(row => ({ id: row.id, title: row.title, reference: row.kycNumber || '-', status: kycStatusLabel(row.status), to: `/kyc/${row.id}` }))
    };
  }
  const { stats, items, access } = await listComplianceClients({ page: 1, pageSize: 6 });
  return {
    cards: [{ label: 'Compliance clients', value: stats.total }, { label: 'Active clients', value: stats.active }, ...(access.level === 'ALLOCATED' ? [{ label: 'Inactive clients', value: stats.inactive }, { label: 'Clients on hold', value: stats.onHold }] : [{ label: 'High risk', value: stats.highRisk }, { label: 'Reviews overdue', value: stats.reviewOverdue }])],
    stages: [{ label: 'Active', value: stats.active }, { label: 'Inactive', value: stats.inactive }, { label: 'On hold', value: stats.onHold }],
    mix: [{ label: 'Active', value: stats.active }, { label: 'Inactive', value: stats.inactive }, { label: 'On hold', value: stats.onHold }],
    priorities: access.level === 'ALLOCATED' ? undefined : [{ label: 'High risk', value: stats.highRisk }, { label: 'Overdue reviews', value: stats.reviewOverdue }, { label: 'Due in 30 days', value: stats.reviewDueSoon }, { label: 'Expiring documents', value: stats.expiringDocuments }],
    rows: items.map(row => ({ id: row.id, title: row.name, reference: row.clientCode || '-', status: clientLabels[row.status] || row.status, to: `/compliance/clients/${row.id}` }))
  };
}

export function ModuleDashboardPage({ module }: { module: ModuleId }) {
  const { user, loading } = useAuth();
  const [result, setResult] = useState<{ key: string; data?: Dashboard; error?: string; loadedAt?: number } | null>(null);
  const [months, setMonths] = useState(6);
  const [refresh, setRefresh] = useState(0);
  const definition = workspaceModules.find(item => item.id === module)!;
  const allowed = availableWorkspaceModules(user).some(item => item.id === module);
  const canViewData = hasAreaAccess(user, module === 'enquiry' ? 'enquiries' : module === 'kyc' ? 'kyc' : 'compliance', false, definition.areas[0].roles);
  const key = JSON.stringify([module, user?.id, user?.tenantId, user?.roles, user?.permissions, user?.accessControlConfigured, refresh]);
  useEffect(() => {
    if (loading || !allowed || !canViewData) return;
    let active = true;
    loadDashboard(module).then(data => { if (active) setResult({ key, data, loadedAt: Date.now() }); }).catch(error => { if (active) setResult({ key, error: getApiErrorMessage(error, 'Unable to load this dashboard.') }); });
    return () => { active = false; };
  }, [key, module, loading, allowed, canViewData]);
  if (loading) return <p role="status">Loading dashboard...</p>;
  if (!allowed) return <Navigate to="/access-denied" replace />;
  const data = result?.key === key ? result.data : undefined;
  const error = result?.key === key ? result.error : undefined;
  const register = module === 'enquiry' ? '/enquiries' : module === 'kyc' ? '/kyc-workflow' : '/compliance/clients';
  const actions = module === 'kyc' ? [
    { label: 'KYC Workflow', to: '/kyc-workflow', area: 'kyc', roles: definition.areas[0].roles },
    { label: 'Screening', to: '/screening', area: 'screening', roles: workflowRoles.screening },
    { label: 'CRRF', to: '/crrf', area: 'crrf', roles: workflowRoles.crrf },
    { label: 'My Review Tasks', to: '/review-tasks', area: 'approvals', roles: workflowRoles.reviewTasks }
  ].filter(action => hasAreaAccess(user, action.area, false, action.roles)) : [{ label: module === 'enquiry' ? 'Enquiry register' : 'Compliance client register', to: register }];
  const canCreate = module === 'enquiry' && hasAnyRole(user, workflowRoles.clientIntake) && hasAreaAccess(user, 'enquiries', true, workflowRoles.clientIntake);
  const accent = module === 'enquiry' ? '#c73543' : module === 'kyc' ? '#159b88' : '#4f85ce';
  const total = data?.cards[0].value || 0;
  const volume = data?.dates ? monthlyDashboardPoints(data.dates, months) : data?.priorities;
  const hasDatedRecords = data?.dates?.some(value => Number.isFinite(Date.parse(value)));
  const updatedAt = result?.key === key && result.loadedAt ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(result.loadedAt) : '';
  return <div className="space-y-6 pb-6">
    <header className="flex flex-wrap items-center justify-between gap-4 pt-1">
      <div><p className="mb-1 text-xs font-semibold uppercase text-slate-400">Newoon / {definition.label}</p><h1 className="text-2xl font-semibold text-slate-950">{definition.label} Dashboard</h1><p className="mt-1 text-sm text-slate-500">{user?.firstName ? `${user.firstName}, here` : 'Here'} is your workspace overview.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {updatedAt && <span className="mr-2 hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex"><CalendarDays className="h-3.5 w-3.5" />Updated {updatedAt}</span>}
        {canCreate && <Link to="/enquiries/new" className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New Enquiry</Link>}
        {canViewData && <button title="Refresh dashboard" aria-label="Refresh dashboard" onClick={() => setRefresh(value => value + 1)} className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-600"><RefreshCw className="h-4 w-4" /></button>}
      </div>
    </header>
    <nav aria-label="Workspace actions" className="flex flex-wrap gap-2 border-b border-slate-200 pb-5">{actions.map(action => <Link key={action.to} to={action.to} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 hover:text-brand-700">{action.label}<ArrowUpRight className="h-3.5 w-3.5" /></Link>)}</nav>
    {canViewData && !data && !error && <p role="status" className="py-8 text-sm text-slate-500">Loading dashboard...</p>}
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {data && <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{data.cards.map((card, index) => {
        const Icon = index === 0 ? (module === 'enquiry' ? Inbox : module === 'kyc' ? ClipboardCheck : Building2) : [Inbox, FileText, ClipboardCheck, Building2][index];
        return <div key={card.label} className={`relative min-w-0 overflow-hidden rounded-lg border p-4 sm:p-5 ${index === 0 ? 'border-transparent text-white' : 'border-slate-200/80 bg-white text-slate-900'}`} style={index === 0 ? { backgroundColor: accent } : undefined}>
          <div className="flex min-h-8 items-start justify-between gap-2"><p className={`min-w-0 text-xs font-medium ${index === 0 ? 'text-white/85' : 'text-slate-500'}`}>{card.label}</p><Icon className={`h-4 w-4 shrink-0 ${index === 0 ? 'text-white/70' : 'text-slate-400'}`} /></div>
          <p className="mt-4 text-3xl font-semibold tabular-nums" data-metric={card.label}>{card.value.toLocaleString()}</p>
          <div className={`mt-4 flex items-center justify-between gap-2 border-t pt-3 text-[11px] ${index === 0 ? 'border-white/20 text-white/80' : 'border-slate-100 text-slate-400'}`}><span>{index === 0 ? 'Current register' : `${total ? Math.round(card.value / total * 100) : 0}% of total`}</span><span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-black/5 sm:block" aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${index === 0 ? 100 : total ? Math.min(100, card.value / total * 100) : 0}%`, backgroundColor: index === 0 ? '#ffffffaa' : dashboardColors[index] }} /></span></div>
        </div>;
      })}</div>
      <div className={`grid items-stretch gap-4 ${volume ? 'xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]' : 'max-w-md'}`}>
        {volume && <section className="min-w-0 rounded-lg border border-slate-200/80 bg-white p-5" aria-label="Volume chart">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">{data.dates ? `${definition.label} volume` : 'Compliance priorities'}</h2><p className="mt-1 text-xs text-slate-400">{data.dates ? `Created records / last ${months} months (UTC)` : 'Current attention counts / categories may overlap'}</p></div>
          {data.dates ? <div role="group" aria-label="Chart period" className="inline-flex rounded-md bg-slate-100 p-1">{[3, 6, 12].map(period => <button key={period} aria-pressed={months === period} onClick={() => setMonths(period)} className={`rounded px-2.5 py-1 text-[11px] font-medium ${months === period ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{period}M</button>)}</div> : <ChartNoAxesColumn className="h-4 w-4 text-slate-400" />}</div>
          {data.dates && !hasDatedRecords ? <div className="flex h-56 items-center justify-center text-sm text-slate-400">No dated records available.</div> : <DashboardBarChart points={volume} color={accent} label={data.dates ? 'Monthly created records' : 'Compliance attention counts'} />}
        </section>}
        <section className="min-w-0 rounded-lg border border-slate-200/80 bg-white p-5" aria-label="Portfolio chart"><div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900">{module === 'enquiry' ? 'Enquiry types' : module === 'kyc' ? 'Case purposes' : 'Client portfolio'}</h2><span className="text-[10px] font-medium text-slate-400">ALL RECORDS</span></div><DashboardDonut points={data.mix} label="Portfolio composition" centerLabel={module === 'compliance' ? 'clients' : 'records'} /></section>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <section className="min-w-0"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-900">Register snapshot <span className="ml-1 text-xs font-normal text-slate-400">({total.toLocaleString()})</span></h2><Link to={register} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700">View all<ChevronRight className="h-3.5 w-3.5" /></Link></div>
          {data.rows.length ? <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200/80 bg-white">{data.rows.map((row, index) => <Link key={row.id} to={row.to} className="flex min-w-0 items-center gap-3 px-4 py-4 hover:bg-slate-50"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-md" style={{ backgroundColor: `${dashboardColors[index % dashboardColors.length]}12`, color: dashboardColors[index % dashboardColors.length] }}><Building2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-slate-800">{row.title}</p><p className="mt-1 break-words text-[11px] text-slate-400">{row.reference}</p><p className="mt-2 break-words text-[10px] font-medium text-slate-500">{row.status}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300" /></Link>)}</div> : <p className="border-y border-slate-200 py-8 text-sm text-slate-500">No records yet.</p>}
        </section>
        <section className="min-w-0"><h2 className="mb-4 text-base font-semibold text-slate-900">Status breakdown</h2><dl className="space-y-5 rounded-lg border border-slate-200/80 bg-white p-5">{data.stages.map((stage, index) => <div key={stage.label}><div className="mb-2 flex items-start justify-between gap-4 text-xs"><dt className="min-w-0 break-words text-slate-500">{stage.label}</dt><dd className="font-semibold tabular-nums text-slate-800">{stage.value.toLocaleString()}</dd></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${total ? stage.value / total * 100 : 0}%`, backgroundColor: dashboardColors[index % dashboardColors.length] }} /></div></div>)}{!data.stages.length && <p className="text-sm text-slate-400">No status data yet.</p>}</dl></section>
      </div>
    </>}
  </div>;
}
