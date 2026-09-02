import { AlertTriangle, CheckCircle2, Eye, FileSpreadsheet, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CrrfListItem, CrrfRiskRating, listCrrfRecords } from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';

const riskLabels: Record<CrrfRiskRating, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High'
};

function errorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' ? message : fallback;
}

export function CrrfListPage() {
  const [records, setRecords] = useState<CrrfListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    listCrrfRecords()
      .then(setRecords)
      .catch((requestError) => setError(errorMessage(requestError, 'Unable to load CRRF records.')))
      .finally(() => setLoading(false));
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const searchable = [
        record.clientInfo.clientName,
        record.clientInfo.clientCode,
        record.clientInfo.crNumber,
        record.clientInfo.caseTitle,
        record.clientInfo.serviceName,
        record.riskRating
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return !normalizedQuery || searchable.includes(normalizedQuery);
    });
  }, [records, query]);

  const stats = useMemo(
    () => ({
      total: records.length,
      completed: records.filter((record) => Boolean(record.riskRating)).length,
      highRisk: records.filter((record) => record.riskRating === 'HIGH').length,
      documents: records.reduce((sum, record) => sum + record.documentCount, 0)
    }),
    [records]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">CRRF</h1>
        <p className="mt-1 text-sm text-slate-500">All client risk rating records, compliance comments, and uploaded CRRF files.</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={FileSpreadsheet} label="Total CRRF records" value={stats.total} />
        <SummaryCard icon={CheckCircle2} label="Risk ratings saved" value={stats.completed} />
        <SummaryCard icon={AlertTriangle} label="High risk" value={stats.highRisk} tone="warning" />
        <SummaryCard icon={FileSpreadsheet} label="Uploaded documents" value={stats.documents} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client, CR number, case, service, or risk"
              className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">CR number</th>
                <th className="px-4 py-3">KYC case</th>
                <th className="px-4 py-3">Risk rating</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Loading CRRF records...
                  </td>
                </tr>
              ) : filteredRecords.length ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{record.clientInfo.clientName}</p>
                      <p className="text-xs text-slate-500">{record.clientInfo.clientCode || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.clientInfo.crNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{record.clientInfo.caseTitle}</p>
                      <p className="text-xs text-slate-500">{record.clientInfo.serviceName || 'No service'} | {kycStatusLabel(record.kycCase.status)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskTone(record.riskRating)}`}>
                        {record.riskRating ? riskLabels[record.riskRating] : 'Not selected'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.documentCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          to={`/kyc/${record.kycCaseId}/crrf`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          aria-label={`Open CRRF for ${record.clientInfo.clientName}`}
                          title="Open CRRF"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No CRRF records match this view.
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

function riskTone(value?: CrrfRiskRating | null) {
  if (value === 'HIGH') return 'bg-red-50 text-red-700';
  if (value === 'MEDIUM') return 'bg-amber-50 text-amber-700';
  if (value === 'LOW') return 'bg-emerald-50 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'default'
}: {
  icon: typeof FileSpreadsheet;
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
