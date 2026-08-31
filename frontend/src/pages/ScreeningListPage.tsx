import { AlertTriangle, CheckCircle2, Clock3, Eye, FileText, Search, SearchCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listScreeningRecords, ScreeningListItem, ScreeningRecordStatus } from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';

const entityTypeLabels: Record<string, string> = {
  CLIENT_COMPANY: 'Client company',
  SHAREHOLDER: 'Shareholder',
  UBO: 'UBO',
  MANAGER: 'Manager / key person',
  MANUAL: 'Manual entry'
};

const statusLabels: Record<ScreeningRecordStatus, string> = {
  DRAFT: 'In progress',
  COMPLETED: 'Completed'
};

function getRequestErrorMessage(error: any, fallback: string) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return typeof error.response?.data?.error === 'string' ? error.response.data.error : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export function ScreeningListPage() {
  const [records, setRecords] = useState<ScreeningListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ScreeningRecordStatus>('ALL');

  useEffect(() => {
    setLoading(true);
    setError('');
    listScreeningRecords()
      .then(setRecords)
      .catch((requestError: any) => setError(getRequestErrorMessage(requestError, 'Unable to load screening records.')))
      .finally(() => setLoading(false));
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus = statusFilter === 'ALL' || record.status === statusFilter;
      const searchable = [
        record.entityName,
        record.identifier,
        record.country,
        record.kycCase.title,
        record.kycCase.client.name,
        record.kycCase.client.registrationNumber,
        record.kycCase.service?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [records, query, statusFilter]);

  const stats = useMemo(() => {
    const completed = records.filter((record) => record.status === 'COMPLETED').length;
    const flagged = records.filter((record) =>
      record.checks.some((check) => ['POTENTIAL_MATCH', 'CONFIRMED_MATCH'].includes(check.resultStatus))
    ).length;

    return {
      total: records.length,
      inProgress: records.length - completed,
      completed,
      flagged
    };
  }, [records]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Screening</h1>
        <p className="mt-1 text-sm text-slate-500">All client, shareholder, UBO, and key-person screening records in one place.</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={SearchCheck} label="Total screening records" value={stats.total} />
        <SummaryCard icon={Clock3} label="In progress" value={stats.inProgress} />
        <SummaryCard icon={CheckCircle2} label="Completed" value={stats.completed} />
        <SummaryCard icon={AlertTriangle} label="Potential / confirmed matches" value={stats.flagged} tone="warning" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entity, client, identifier, or service"
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ScreeningRecordStatus)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Client / KYC case</th>
                <th className="px-4 py-3">Identifier</th>
                <th className="px-4 py-3">Checks</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Loading screening records...
                  </td>
                </tr>
              ) : filteredRecords.length ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{record.entityName}</p>
                      <p className="text-xs text-slate-500">{entityTypeLabels[record.entityType] || record.entityType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{record.kycCase.client.name}</p>
                      <p className="text-xs text-slate-500">
                        {record.kycCase.title} | {record.kycCase.service?.name || 'No service'} | {kycStatusLabel(record.kycCase.status)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.identifier || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.completedChecks}/{record.totalChecks}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {record.documentCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          record.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {statusLabels[record.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          to={`/kyc/${record.kycCase.id}/screening`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          aria-label={`Open screening for ${record.entityName}`}
                          title="Open screening"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    No screening records match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'default'
}: {
  icon: typeof SearchCheck;
  label: string;
  value: number;
  tone?: 'default' | 'warning';
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </section>
  );
}
