import { ArrowUpRight, Building2, CalendarDays, ChartNoAxesColumn, ChevronRight, ClipboardCheck, FileText, Inbox, Plus, RefreshCw } from 'lucide-react';
import { CSSProperties, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import { listEnquiries, listKycCases } from '../services/kyc-workflow.service';
import { listComplianceClients } from '../services/compliance-clients.service';
import { hasAnyRole, hasAreaAccess, workflowRoles } from '../utils/access-control';
import { availableWorkspaceModules, workspaceModules } from '../utils/workspace-modules';
import { kycStatusLabel } from '../utils/kyc-status-labels';
import { DashboardBarChart, DashboardDonut, DashboardPoint, dashboardColors, monthlyDashboardPoints } from '../components/DashboardCharts';
import { DashboardAreaChart } from '../components/DashboardAreaChart';
import './module-dashboard.css';

type ModuleId = 'enquiry' | 'kyc' | 'compliance';
type Row = { id: string; title: string; reference: string; status: string; to: string };
type Dashboard = { cards: DashboardPoint[]; rows: Row[]; stages: DashboardPoint[]; mix: DashboardPoint[]; dates?: string[]; priorities?: DashboardPoint[] };
const enquiryLabels: Record<string, string> = { DRAFT: 'Draft', SUBMITTED_TO_AML_SUPERVISOR: 'Submitted to AML Supervisor', RETURNED_TO_BD: 'Returned to BD', READY_FOR_KYC: 'Ready for KYC', CONVERTED_TO_KYC: 'Converted to KYC', CLOSED: 'Closed' };
const clientLabels: Record<string, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', ON_HOLD: 'On hold' };

function statusTone(status: string) {
  if (/reject/i.test(status)) return 'danger';
  if (/return|required|hold/i.test(status)) return 'warning';
  if (/pending|progress|review/i.test(status)) return 'review';
  if (/inactive|draft|closed/i.test(status)) return 'neutral';
  return /approved|active|clear|converted/i.test(status) ? 'success' : 'neutral';
}

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
  const accent = module === 'enquiry' ? '#c75a68' : module === 'kyc' ? '#5c9e96' : '#668bc0';
  const total = data?.cards[0].value || 0;
  const volume = data?.dates ? monthlyDashboardPoints(data.dates, months) : data?.priorities;
  const hasDatedRecords = data?.dates?.some(value => Number.isFinite(Date.parse(value)));
  const updatedAt = result?.key === key && result.loadedAt ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(result.loadedAt) : '';
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const chartTotal = data?.dates ? volume?.reduce((sum, point) => sum + point.value, 0) || 0 : total;
  return <div className="module-dashboard">
    <header className="dashboard-heading">
      <div><p className="dashboard-eyebrow">Newoon Operations</p><h1>{definition.label} Dashboard</h1><p className="dashboard-date">{user?.firstName ? `${user.firstName} / ` : ''}{today}</p></div>
      <div className="dashboard-actions">
        <nav aria-label="Workspace actions" className="dashboard-actions">{actions.map(action => <Link key={action.to} to={action.to} className="dashboard-command">{action.label}<ArrowUpRight className="h-3 w-3" /></Link>)}</nav>
        {canCreate && <Link to="/enquiries/new" className="dashboard-command dashboard-command-primary"><Plus className="h-3.5 w-3.5" />New Enquiry</Link>}
        {canViewData && <button title={updatedAt ? `Refresh dashboard / updated ${updatedAt}` : 'Refresh dashboard'} aria-label="Refresh dashboard" onClick={() => setRefresh(value => value + 1)} className="dashboard-command !p-2.5"><RefreshCw className="h-3.5 w-3.5" /></button>}
      </div>
    </header>
    {canViewData && !data && !error && <p role="status" className="py-8 text-sm text-slate-500">Loading dashboard...</p>}
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {data && <>
      <div className="dashboard-metrics">{data.cards.map((card, index) => {
        const Icon = index === 0 ? (module === 'enquiry' ? Inbox : module === 'kyc' ? ClipboardCheck : Building2) : [Inbox, FileText, ClipboardCheck, Building2][index];
        return <div key={card.label} className="dashboard-metric" style={{ '--metric-color': ['#4d6f9f', '#3e8074', '#8c6a2b', '#9e5e6d'][index], '--metric-wash': ['#f2f5ff', '#eff8f4', '#fff8ee', '#fff2f4'][index] } as CSSProperties}>
          <div className="dashboard-metric-heading"><p>{card.label}</p><span className="dashboard-metric-icon" style={{ color: dashboardColors[index] }}><Icon className="h-3.5 w-3.5" /></span></div>
          <p className="dashboard-metric-value" data-metric={card.label}>{card.value.toLocaleString()}</p>
          <div className="dashboard-metric-footer"><span>{index === 0 ? 'Current register' : 'Share of register'}</span><span className="dashboard-share"><span className="dashboard-share-dot" aria-hidden="true" />{index === 0 ? 'Total' : `${total ? Math.round(card.value / total * 100) : 0}%`}</span></div>
        </div>;
      })}</div>
      <div className={volume ? 'dashboard-charts' : 'dashboard-charts !grid-cols-1 max-w-md'}>
        {volume && <section className="dashboard-surface" aria-label="Volume chart">
          <div className="dashboard-surface-head"><div><h2>{data.dates ? `${definition.label} volume overview` : 'Compliance overview'}</h2><p className="dashboard-caption">{data.dates ? `Created records / last ${months} months (UTC)` : 'Current attention counts / categories may overlap'}</p></div>
          {data.dates ? <div role="group" aria-label="Chart period" className="dashboard-period">{[3, 6, 12].map(period => <button key={period} aria-pressed={months === period} onClick={() => setMonths(period)}>{period}M</button>)}</div> : <ChartNoAxesColumn className="h-4 w-4 text-slate-300" />}</div>
          <div className="dashboard-chart-summary"><strong>{chartTotal.toLocaleString()}</strong><span>{data.dates ? 'new records in selected period' : 'clients in register'}</span></div>
          <div className="dashboard-chart-body">{data.dates && !hasDatedRecords ? <div className="flex h-60 items-center justify-center text-sm text-slate-400">No dated records available.</div> : data.dates ? <DashboardAreaChart points={volume} color={accent} label="Monthly created records" /> : <DashboardBarChart points={volume} color={accent} label="Compliance attention counts" />}</div>
        </section>}
        <section className="dashboard-surface" aria-label="Portfolio chart"><div className="dashboard-surface-head"><div><h2>{module === 'enquiry' ? 'Enquiry mix' : module === 'kyc' ? 'Case composition' : 'Client portfolio'}</h2><p className="dashboard-caption">Current register distribution</p></div><ClipboardCheck className="h-3.5 w-3.5 text-slate-300" /></div><div className="dashboard-portfolio"><DashboardDonut points={data.mix} label="Portfolio composition" centerLabel={module === 'compliance' ? 'clients' : 'records'} /><p className="dashboard-portfolio-note"><span>Across permitted records</span><span>{total.toLocaleString()} total</span></p></div></section>
      </div>
      <div className="dashboard-records-grid">
        <section className="dashboard-surface"><div className="dashboard-record-heading"><h2>Register snapshot <span className="ml-1 text-[10px] font-normal text-slate-400">({total.toLocaleString()})</span></h2><Link to={register}>View all<ChevronRight className="h-3 w-3" /></Link></div>
          {data.rows.length ? <><div className="dashboard-table-head" aria-hidden="true"><span>{module === 'kyc' ? 'Case' : 'Client / company'}</span><span>Reference</span><span>Current status</span><span /></div><div>{data.rows.map(row => <Link key={row.id} to={row.to} className="dashboard-record"><span className="dashboard-record-name"><span className="dashboard-record-icon"><Building2 className="h-3.5 w-3.5" /></span>{row.title}</span><span className="dashboard-record-reference">{row.reference}</span><span className="dashboard-status" data-tone={statusTone(row.status)}>{row.status}</span><ArrowUpRight className="h-3.5 w-3.5 text-slate-300" /></Link>)}</div></> : <p className="px-5 py-8 text-sm text-slate-400">No records yet.</p>}
        </section>
        <section className="dashboard-surface"><div className="dashboard-record-heading"><h2>Status overview</h2><CalendarDays className="h-3.5 w-3.5 text-slate-300" /></div><dl className="dashboard-status-list">{data.stages.map((stage, index) => <div key={stage.label}><div className="flex items-start justify-between gap-4"><dt className="min-w-0 break-words">{stage.label}</dt><dd>{stage.value.toLocaleString()}</dd></div><div className="dashboard-status-track" aria-hidden="true"><div style={{ width: `${total ? stage.value / total * 100 : 0}%`, backgroundColor: dashboardColors[index % dashboardColors.length] }} /></div></div>)}{!data.stages.length && <p className="text-sm text-slate-400">No status data yet.</p>}</dl></section>
      </div>
    </>}
  </div>;
}
