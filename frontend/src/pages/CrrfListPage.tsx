import { AlertTriangle, CheckCircle2, Eye, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, EmptyRow, FilterSelect, Pill, QuickTabs, SortHeader, TableCard, TablePager, TableSkeleton, TableToolbar, tableCellClass, tableHeadClass } from '../components/table/TableParts';
import { useServerTable } from '../components/table/useServerTable';
import { CrrfRiskRating, listCrrfTable } from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';

const riskLabels: Record<CrrfRiskRating, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High'
};

const tabs = [
  { value: 'all', label: 'All records' },
  { value: 'rated', label: 'Risk rated' },
  { value: 'pending', label: 'Not rated' },
  { value: 'high', label: 'High risk' }
];

const sortOptions = [
  { value: 'updated', label: 'Last updated' },
  { value: 'client', label: 'Client' },
  { value: 'case', label: 'KYC case' },
  { value: 'risk', label: 'Risk rating' },
  { value: 'documents', label: 'Documents' }
];

const filterKeys = ['risk'];

function riskTone(value?: CrrfRiskRating | null) {
  if (value === 'HIGH') return 'red' as const;
  if (value === 'MEDIUM') return 'amber' as const;
  if (value === 'LOW') return 'green' as const;
  return 'slate' as const;
}

export function CrrfListPage() {
  const table = useServerTable(listCrrfTable, { defaultSort: 'updated', defaultDir: 'desc', filterKeys });
  const columns = 6;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">CRRF</h1>
        <p className="mt-1 text-sm text-slate-500">All client risk rating records and uploaded CRRF files.</p>
      </div>

      {table.error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{table.error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={FileSpreadsheet} label="Total CRRF records" value={table.counts.all} />
        <SummaryCard icon={CheckCircle2} label="Risk ratings saved" value={table.counts.rated} />
        <SummaryCard icon={AlertTriangle} label="High risk" value={table.counts.high} tone="warning" />
        <SummaryCard icon={FileSpreadsheet} label="Uploaded documents" value={table.counts.documents} />
      </div>

      <TableCard>
        <TableToolbar
          query={table.params.q}
          onQuery={table.setQuery}
          placeholder="Search client, CR number, case, service, or risk"
          sort={table.params.sort}
          dir={table.params.dir}
          sortOptions={sortOptions}
          onSort={table.setSort}
          activeFilterCount={table.activeFilterCount}
          onClearFilters={table.clearFilters}
          filters={<FilterSelect label="Risk rating" value={table.params.filters.risk || ''} onChange={(value) => table.setFilter('risk', value)} options={Object.entries(riskLabels).map(([value, label]) => ({ value, label }))} />}
        />
        <QuickTabs tabs={tabs} active={table.params.tab} counts={table.counts} onChange={table.setTab} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <SortHeader label="Client" sortKey="client" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={tableHeadClass}>CR number</th>
                <SortHeader label="KYC case" sortKey="case" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <SortHeader label="Risk rating" sortKey="risk" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <SortHeader label="Documents" sortKey="documents" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={`${tableHeadClass} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.loading && !table.rows.length ? (
                <TableSkeleton columns={columns} />
              ) : table.rows.length ? (
                table.rows.map((record) => (
                  <tr key={record.id} className={`hover:bg-slate-50/70 ${table.loading ? 'opacity-60' : ''}`}>
                    <td className={tableCellClass}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={record.clientInfo.clientName} />
                        <div className="min-w-0">
                          <Link className="block truncate font-semibold text-slate-950 hover:text-brand-700" to={`/kyc/${record.kycCaseId}/crrf`}>{record.clientInfo.clientName}</Link>
                          <p className="text-xs text-slate-500">{record.clientInfo.clientCode || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tableCellClass} text-slate-600`}>{record.clientInfo.crNumber || '-'}</td>
                    <td className={tableCellClass}>
                      <p className="max-w-[18rem] truncate font-medium text-slate-700">{record.clientInfo.caseTitle}</p>
                      <p className="text-xs text-slate-500">{record.clientInfo.serviceName || 'No service'} | {kycStatusLabel(record.kycCase.status)}</p>
                    </td>
                    <td className={tableCellClass}>
                      <Pill tone={riskTone(record.riskRating)}>{record.riskRating ? riskLabels[record.riskRating] : 'Not selected'}</Pill>
                    </td>
                    <td className={`${tableCellClass} text-slate-600`}>{record.documentCount}</td>
                    <td className={tableCellClass}>
                      <div className="flex justify-end gap-0.5">
                        <Link
                          to={`/kyc/${record.kycCaseId}/crrf`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                <EmptyRow columns={columns} filtered={table.isFiltered} emptyText="No CRRF records have been created yet." onReset={table.reset} />
              )}
            </tbody>
          </table>
        </div>
        <TablePager page={table.params.page} pageSize={table.params.pageSize} total={table.total} onPage={table.setPage} onPageSize={table.setPageSize} loading={table.loading} />
      </TableCard>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'default'
}: {
  icon: typeof FileSpreadsheet;
  label: string;
  value?: number;
  tone?: 'default' | 'warning';
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value ?? 0}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-brand-50 text-brand-700'}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </section>
  );
}
