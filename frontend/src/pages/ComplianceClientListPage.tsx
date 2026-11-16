import { AlertTriangle, CalendarClock, Download, Eye, Search, ShieldAlert, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  CddType,
  cddLabels,
  ComplianceClient,
  ComplianceClientFilters,
  ComplianceClientPage,
  complianceStatusLabels,
  exportComplianceClients,
  jurisdictionLabels,
  listComplianceClients,
  ReviewState,
  riskLabels,
  updateComplianceClient
} from '../services/compliance-clients.service';
import { hasAreaAccess, workflowRoles } from '../utils/access-control';

const PAGE_SIZE = 25;

const riskTone: Record<string, string> = {
  HIGH: 'bg-rose-50 text-rose-700 ring-rose-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING: 'bg-slate-100 text-slate-600 ring-slate-200'
};

const statusTone: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  ON_HOLD: 'bg-amber-50 text-amber-700 ring-amber-200'
};

const reviewTone: Record<ReviewState, { label: string; className: string }> = {
  OVERDUE: { label: 'Overdue', className: 'text-rose-700' },
  DUE_SOON: { label: 'Due soon', className: 'text-amber-700' },
  SCHEDULED: { label: '', className: 'text-slate-600' },
  NOT_SCHEDULED: { label: 'Not scheduled', className: 'text-slate-400' }
};

const selectClass =
  'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

// Small inline markers for items needing attention on a register row.
function RowFlags({ client }: { client: ComplianceClient }) {
  const flags: Array<{ label: string; className: string }> = [];
  if (client.pendingRiskChange) flags.push({ label: `Risk → ${riskLabels[client.pendingRiskChange.proposedRisk]} pending`, className: 'bg-amber-50 text-amber-700' });
  if (client.latestScreening?.result === 'ALERT') flags.push({ label: 'Screening alert', className: 'bg-rose-50 text-rose-700' });
  if (client.latestScreening?.result === 'REVIEW') flags.push({ label: 'Screening review', className: 'bg-amber-50 text-amber-700' });
  if (client.nearestExpiry?.state === 'EXPIRED') flags.push({ label: 'Document expired', className: 'bg-rose-50 text-rose-700' });
  else if (client.nearestExpiry?.state === 'DUE_30') flags.push({ label: 'Document expiring', className: 'bg-amber-50 text-amber-700' });
  if (client.reviewInProgress) flags.push({ label: 'Review in progress', className: 'bg-brand-50 text-brand-700' });
  if (!flags.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {flags.map((flag) => <span key={flag.label} className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${flag.className}`}>{flag.label}</span>)}
    </span>
  );
}

function Badge({ className, children }: { className: string; children: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>{children}</span>;
}

export function ComplianceClientListPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const canEdit = hasAreaAccess(user, 'compliance', true, workflowRoles.complianceEdit);
  const canOpenKyc = hasAreaAccess(user, 'kyc', false, [...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks]);

  const [filters, setFilters] = useState<ComplianceClientFilters>({ status: 'ALL', riskLevel: 'ALL', cddType: 'ALL', jurisdiction: 'ALL', review: 'ALL', attention: 'ALL', page: 1, pageSize: PAGE_SIZE });
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<ComplianceClientPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deactivating, setDeactivating] = useState<ComplianceClient | null>(null);

  const load = useCallback((current: ComplianceClientFilters) => {
    setLoading(true);
    setError('');
    listComplianceClients(current)
      .then(setData)
      .catch((requestError) => setError(getApiErrorMessage(requestError, 'Unable to load compliance clients.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  // Debounce free-text search so each keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.search === (searchInput.trim() || undefined) ? current : { ...current, search: searchInput.trim() || undefined, page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  function setFilter(key: keyof ComplianceClientFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  function replaceItem(updated: ComplianceClient) {
    setData((current) => (current ? { ...current, items: current.items.map((item) => (item.id === updated.id ? updated : item)) } : current));
  }

  async function changeCdd(client: ComplianceClient, value: string) {
    setSavingId(client.id);
    try {
      replaceItem(await updateComplianceClient(client.id, { cddType: (value || 'NONE') as CddType | 'NONE' }));
      showToast(`CDD type updated for ${client.name}.`, 'success');
      load(filters);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to update the CDD type.'), 'error');
    } finally {
      setSavingId('');
    }
  }

  async function changeStatus(client: ComplianceClient, status: 'ACTIVE' | 'INACTIVE', statusReason?: string) {
    setSavingId(client.id);
    try {
      await updateComplianceClient(client.id, { status, statusReason });
      showToast(status === 'INACTIVE' ? `${client.name} marked inactive.` : `${client.name} reactivated.`, 'success');
      setDeactivating(null);
      load(filters);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to change the client status.'), 'error');
    } finally {
      setSavingId('');
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const result = await exportComplianceClients(filters);
      if (result.truncated) showToast('The export was limited to the first 5,000 clients. Narrow the filters to export the rest.', 'info');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to export compliance clients.'), 'error');
    } finally {
      setExporting(false);
    }
  }

  const stats = data?.stats;
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Compliance Clients</h1>
          <p className="mt-1 text-sm text-slate-500">Onboarded clients with their risk level, CDD type and periodic review schedule.</p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total clients" value={stats?.total ?? 0} detail="Active, inactive and on hold" icon={ShieldCheck} tone="blue" />
        <StatCard label="Active" value={stats?.active ?? 0} detail={`${stats?.onHold ?? 0} on hold`} icon={UserCheck} tone="green" />
        <StatCard label="Inactive" value={stats?.inactive ?? 0} icon={UserX} tone="slate" />
        <StatCard label="EDD clients" value={stats?.edd ?? 0} detail={`${stats?.highRisk ?? 0} high risk`} icon={ShieldAlert} tone="rose" />
        <StatCard label="Reviews overdue" value={stats?.reviewOverdue ?? 0} detail="Active clients past next review" icon={AlertTriangle} tone="rose" />
        <StatCard label="Due in 30 days" value={stats?.reviewDueSoon ?? 0} detail={`${stats?.riskPending ?? 0} with risk pending`} icon={CalendarClock} tone="amber" />
      </div>

      {stats ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="font-medium text-slate-700">Needs attention:</span>
          {[
            { key: 'RISK_APPROVAL', label: 'Risk changes awaiting approval', count: stats.riskApprovals, tone: 'amber' },
            { key: 'SCREENING_ALERT', label: 'Open screening alerts', count: stats.screeningAlerts, tone: 'rose' },
            { key: 'EXPIRING', label: 'Documents expiring in 30 days', count: stats.expiringDocuments, tone: 'rose' },
            { key: 'REVIEW_IN_PROGRESS', label: 'Reviews in progress', count: stats.reviewsInProgress, tone: 'brand' }
          ].map((item) => {
            const active = filters.attention === item.key;
            const tone = item.count === 0 ? 'border-slate-200 text-slate-400' : item.tone === 'rose' ? 'border-rose-200 text-rose-700' : item.tone === 'amber' ? 'border-amber-200 text-amber-700' : 'border-brand-200 text-brand-700';
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter('attention', active ? 'ALL' : item.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tone} ${active ? 'bg-slate-900 !text-white' : 'bg-white hover:bg-slate-50'}`}
              >
                <span className="font-semibold">{item.count}</span>
                {item.label}
              </button>
            );
          })}
          {filters.attention && filters.attention !== 'ALL' ? (
            <button type="button" onClick={() => setFilter('attention', 'ALL')} className="text-xs font-medium text-slate-500 hover:text-slate-700">Clear</button>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, code, CR/QFC no., email, contact, engagement or KYC no."
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select aria-label="Status" value={filters.status} onChange={(event) => setFilter('status', event.target.value)} className={selectClass}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ON_HOLD">On hold</option>
            </select>
            <select aria-label="Risk level" value={filters.riskLevel} onChange={(event) => setFilter('riskLevel', event.target.value)} className={selectClass}>
              <option value="ALL">All risk</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="PENDING">Pending</option>
            </select>
            <select aria-label="CDD type" value={filters.cddType} onChange={(event) => setFilter('cddType', event.target.value)} className={selectClass}>
              <option value="ALL">All CDD</option>
              <option value="SIMPLIFIED">SDD</option>
              <option value="REGULAR">RDD</option>
              <option value="ENHANCED">EDD</option>
              <option value="NONE">Not set</option>
            </select>
            <select aria-label="Jurisdiction" value={filters.jurisdiction} onChange={(event) => setFilter('jurisdiction', event.target.value)} className={selectClass}>
              <option value="ALL">All jurisdictions</option>
              <option value="QFC">QFC</option>
              <option value="MOCI">MOCI</option>
              <option value="QFZ">QFZ</option>
              <option value="OTHER">Other</option>
              <option value="NONE">Not set</option>
            </select>
            <select aria-label="Review" value={filters.review} onChange={(event) => setFilter('review', event.target.value)} className={selectClass}>
              <option value="ALL">All reviews</option>
              <option value="OVERDUE">Overdue</option>
              <option value="DUE_SOON">Due in 30 days</option>
              <option value="NOT_SCHEDULED">Not scheduled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">CR / QFC No.</th>
                <th className="px-4 py-3">CDD Type</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Review</th>
                <th className="px-4 py-3">Next Review</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>Loading compliance clients...</td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((client) => {
                  const review = reviewTone[client.reviewState];
                  const busy = savingId === client.id;
                  return (
                    <tr key={client.id} className={`hover:bg-slate-50 ${loading ? 'opacity-60' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{client.clientCode ?? '—'}</td>
                      <td className="max-w-xs px-4 py-3">
                        <Link to={`/compliance/clients/${client.id}`} className="font-medium text-brand-700 hover:text-brand-800">{client.name}</Link>
                        <RowFlags client={client} />
                        <p className="truncate text-xs text-slate-500" title={client.latestEngagement?.serviceName || ''}>
                          {client.latestEngagement
                            ? `${client.latestEngagement.engagementNumber} · ${client.latestEngagement.serviceName}`
                            : client.email || client.primaryContactName || 'No engagement recorded'}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {client.registrationNumber || '—'}
                        {client.jurisdiction ? <span className="ml-1 text-xs text-slate-400">({jurisdictionLabels[client.jurisdiction]})</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <select
                            aria-label={`CDD type for ${client.name}`}
                            value={client.cddType || ''}
                            disabled={busy}
                            onChange={(event) => changeCdd(client, event.target.value)}
                            className={`${selectClass} py-1 text-xs ${client.cddType ? '' : 'border-amber-300 text-amber-700'}`}
                          >
                            <option value="">Not set</option>
                            <option value="SIMPLIFIED">SDD</option>
                            <option value="REGULAR">RDD</option>
                            <option value="ENHANCED">EDD</option>
                          </select>
                        ) : (
                          <span className="text-slate-600">{client.cddType ? cddLabels[client.cddType] : 'Not set'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={riskTone[client.riskLevel || 'PENDING']}>{client.riskLevel ? riskLabels[client.riskLevel] : 'Pending'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusTone[client.status] || statusTone.INACTIVE}>{complianceStatusLabels[client.status] || client.status}</Badge>
                        {client.statusReason ? <p className="mt-1 max-w-[12rem] truncate text-xs text-slate-500" title={client.statusReason}>{client.statusReason}</p> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(client.lastReviewDate)}</td>
                      <td className={`whitespace-nowrap px-4 py-3 ${review.className}`}>
                        {formatDate(client.nextReviewDate)}
                        {review.label && client.nextReviewDate ? <p className="text-xs font-semibold">{review.label}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/compliance/clients/${client.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            title={`View ${client.name}`}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                          {canOpenKyc && client.latestKycCase ? (
                            <Link
                              to={`/kyc/${client.latestKycCase.id}`}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                              title={`Open KYC ${client.latestKycCase.kycNumber}`}
                            >
                              KYC
                            </Link>
                          ) : null}
                          {canEdit && client.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDeactivating(client)}
                              className="inline-flex h-8 items-center rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Mark inactive
                            </button>
                          ) : null}
                          {canEdit && client.status === 'INACTIVE' ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => changeStatus(client, 'ACTIVE')}
                              className="inline-flex h-8 items-center rounded-md border border-emerald-200 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              Reactivate
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    No compliance clients match these filters. Clients appear here once their KYC engagement decision activates them.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 ? (
          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setFilters((current) => ({ ...current, page: pagination.page - 1 }))}
                className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setFilters((current) => ({ ...current, page: pagination.page + 1 }))}
                className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {deactivating ? (
        <DeactivateDialog
          client={deactivating}
          saving={savingId === deactivating.id}
          onCancel={() => setDeactivating(null)}
          onConfirm={(reason) => changeStatus(deactivating, 'INACTIVE', reason)}
        />
      ) : null}
    </div>
  );
}

function DeactivateDialog({ client, saving, onCancel, onConfirm }: { client: ComplianceClient; saving: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim()) onConfirm(reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" role="dialog" aria-modal="true" aria-labelledby="deactivate-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 id="deactivate-title" className="text-lg font-semibold text-slate-950">Mark client inactive</h2>
        <p className="mt-1 text-sm text-slate-500">{client.name} will stay in the register as inactive. The reason is recorded in the audit log.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="deactivate-reason">Reason</label>
        <textarea
          id="deactivate-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          rows={3}
          autoFocus
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="For example: engagement ended, company liquidated"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !reason.trim()}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Mark inactive'}
          </button>
        </div>
      </form>
    </div>
  );
}
