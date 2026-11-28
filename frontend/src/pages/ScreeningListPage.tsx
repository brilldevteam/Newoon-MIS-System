import { AlertTriangle, CheckCircle2, Clock3, Eye, FileText, SearchCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, EmptyRow, Pill, QuickTabs, SortHeader, TableCard, TablePager, TableSkeleton, TableToolbar, tableCellClass, tableHeadClass } from '../components/table/TableParts';
import { useServerTable } from '../components/table/useServerTable';
import { listScreeningTable, ScreeningListItem } from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';

const entityTypeLabels: Record<string, string> = {
  CLIENT_COMPANY: 'Client company',
  SHAREHOLDER: 'Shareholder',
  UBO: 'UBO',
  MANAGER: 'Manager / key person',
  MANUAL: 'Manual entry'
};

const statusLabels: Record<string, string> = {
  DRAFT: 'In progress',
  COMPLETED: 'Completed'
};

const tabs = [
  { value: 'all', label: 'All records' },
  { value: 'progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'flagged', label: 'Potential / confirmed matches' }
];

const sortOptions = [
  { value: 'updated', label: 'Last updated' },
  { value: 'entity', label: 'Entity' },
  { value: 'client', label: 'Client' },
  { value: 'status', label: 'Status' }
];

export function ScreeningListPage() {
  const table = useServerTable(listScreeningTable, { defaultSort: 'updated', defaultDir: 'desc' });
  const columns = 7;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Screening</h1>
        <p className="mt-1 text-sm text-slate-500">All client, shareholder, UBO, and key-person screening records in one place.</p>
      </div>

      {table.error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{table.error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={SearchCheck} label="Total screening records" value={table.counts.all ?? 0} />
        <SummaryCard icon={Clock3} label="In progress" value={table.counts.progress ?? 0} />
        <SummaryCard icon={CheckCircle2} label="Completed" value={table.counts.completed ?? 0} />
        <SummaryCard icon={AlertTriangle} label="Potential / confirmed matches" value={table.counts.flagged ?? 0} tone="warning" />
      </div>

      <TableCard>
        <TableToolbar
          query={table.params.q}
          onQuery={table.setQuery}
          placeholder="Search entity, client, identifier, or service"
          sort={table.params.sort}
          dir={table.params.dir}
          sortOptions={sortOptions}
          onSort={table.setSort}
          activeFilterCount={table.activeFilterCount}
          onClearFilters={table.clearFilters}
        />
        <QuickTabs tabs={tabs} active={table.params.tab} counts={table.counts} onChange={table.setTab} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <SortHeader label="Entity" sortKey="entity" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <SortHeader label="Client / KYC case" sortKey="client" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={tableHeadClass}>Identifier</th>
                <th scope="col" className={tableHeadClass}>Checks</th>
                <th scope="col" className={tableHeadClass}>Documents</th>
                <SortHeader label="Status" sortKey="status" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={`${tableHeadClass} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.loading && !table.rows.length ? (
                <TableSkeleton columns={columns} />
              ) : table.rows.length ? (
                table.rows.map((record: ScreeningListItem) => (
                  <tr key={record.id} className={`hover:bg-slate-50/70 ${table.loading ? 'opacity-60' : ''}`}>
                    <td className={tableCellClass}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={record.entityName} />
                        <div className="min-w-0">
                          <Link className="block truncate font-semibold text-slate-950 hover:text-brand-700" to={`/kyc/${record.kycCase.id}/screening`}>{record.entityName}</Link>
                          <p className="text-xs text-slate-500">{entityTypeLabels[record.entityType] || record.entityType}</p>
                        </div>
                      </div>
                    </td>
                    <td className={tableCellClass}>
                      <p className="max-w-[18rem] truncate font-medium text-slate-800">{record.kycCase.client.name}</p>
                      <p className="max-w-[18rem] truncate text-xs text-slate-500">
                        {record.kycCase.title} | {record.kycCase.service?.name || 'No service'} | {kycStatusLabel(record.kycCase.status)}
                      </p>
                    </td>
                    <td className={`${tableCellClass} text-slate-600`}>{record.identifier || '-'}</td>
                    <td className={`${tableCellClass} text-slate-600`}>{record.completedChecks}/{record.totalChecks}</td>
                    <td className={`${tableCellClass} text-slate-600`}>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {record.documentCount}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      <Pill tone={record.status === 'COMPLETED' ? 'green' : 'amber'}>{statusLabels[record.status] || record.status}</Pill>
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex justify-end gap-0.5">
                        <Link
                          to={`/kyc/${record.kycCase.id}/screening`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
                <EmptyRow columns={columns} filtered={table.isFiltered} emptyText="No screening records have been created yet." onReset={table.reset} />
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
