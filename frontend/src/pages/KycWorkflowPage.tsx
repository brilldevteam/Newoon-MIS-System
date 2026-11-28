import { Download, Edit3, Eye, FilePlus2, FileText, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmProvider';
import { Avatar, EmptyRow, IconAction, QuickTabs, SortHeader, TableCard, TablePager, TableSkeleton, TableToolbar, tableCellClass, tableHeadClass } from '../components/table/TableParts';
import { useServerTable } from '../components/table/useServerTable';
import { useAuth } from '../hooks/useAuth';
import { deleteKycCase, downloadGeneratedKycDocument, generateKycDocument, KycCaseRow, KycCaseStatus, listKycCaseTable } from '../services/kyc-workflow.service';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { kycStatusLabel, kycStatusOwner, kycStatusToneClass } from '../utils/kyc-status-labels';

function getRequestErrorMessage(error: any, fallback: string) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') {
    return Object.values(message)
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');
  }

  const responseError = error.response?.data?.error;
  return typeof responseError === 'string' ? responseError : fallback;
}

const documentReadyStatuses: KycCaseStatus[] = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'SEF_APPROVED', 'KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ACTIVE'];

const tabs = [
  { value: 'all', label: 'All cases' },
  { value: 'pending-kyc', label: 'KYC preparation' },
  { value: 'pending-approvals', label: 'Approvals' },
  { value: 'completed', label: 'Completed' },
  { value: 'other', label: 'On hold / rejected' }
];

const sortOptions = [
  { value: 'created', label: 'Date created' },
  { value: 'number', label: 'KYC number' },
  { value: 'client', label: 'Client' },
  { value: 'status', label: 'Status' }
];

const rowLink = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700';

export function KycWorkflowPage() {
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const table = useServerTable(listKycCaseTable, { defaultSort: 'created', defaultDir: 'desc' });
  const [deletingId, setDeletingId] = useState('');
  const [generatingKey, setGeneratingKey] = useState('');
  const [actionError, setActionError] = useState('');
  const canCreateCases = hasAnyRole(user, workflowRoles.caseCreation);
  const canEditOrDeleteCases = hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN']);

  // The dashboard links here with ?filter=pending-kyc / pending-approvals; those are now the quick tabs.
  useEffect(() => {
    const legacy = searchParams.get('filter');
    if (!legacy) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('filter');
      if (tabs.some((tab) => tab.value === legacy)) next.set('tab', legacy);
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  async function removeCase(kycCase: KycCaseRow) {
    const confirmed = await confirm({ title: 'Delete this KYC case?', message: `Delete ${kycCase.title}? This will permanently remove the KYC case and related workflow records.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;

    setDeletingId(kycCase.id);
    setActionError('');
    try {
      await deleteKycCase(kycCase.id);
      table.removeRow((row) => row.id === kycCase.id);
      table.reload();
    } catch (requestError: any) {
      setActionError(getRequestErrorMessage(requestError, 'Unable to delete this KYC case.'));
    } finally {
      setDeletingId('');
    }
  }

  async function downloadDocument(kycCase: KycCaseRow, type: 'docx' | 'pdf') {
    const key = `${kycCase.id}-${type}`;
    setGeneratingKey(key);
    setActionError('');
    try {
      const document = await generateKycDocument(kycCase.id, type);
      await downloadGeneratedKycDocument(kycCase.id, document.id, document.fileName);
    } catch (requestError: any) {
      setActionError(getRequestErrorMessage(requestError, `Unable to generate ${type.toUpperCase()} document.`));
    } finally {
      setGeneratingKey('');
    }
  }

  const error = actionError || table.error;
  const columns = 6;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">KYC Workflow</h1>
          <p className="mt-1 text-sm text-slate-500">Client intake cases from inquiry through AML handoff.</p>
        </div>
        {canCreateCases ? (
          <Link
            to="/kyc/new"
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FilePlus2 className="h-4 w-4" />
            Create KYC Case
          </Link>
        ) : null}
      </div>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <TableCard>
        <TableToolbar
          query={table.params.q}
          onQuery={table.setQuery}
          placeholder="Search by KYC number, client, case or service"
          sort={table.params.sort}
          dir={table.params.dir}
          sortOptions={sortOptions}
          onSort={table.setSort}
        />
        <QuickTabs tabs={tabs} active={table.params.tab} counts={table.counts} onChange={table.setTab} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <SortHeader label="Client" sortKey="client" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <SortHeader label="KYC number" sortKey="number" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={tableHeadClass}>Service</th>
                <th scope="col" className={`${tableHeadClass} text-right`}>Documents</th>
                <SortHeader label="Status" sortKey="status" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={`${tableHeadClass} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.loading && !table.rows.length ? (
                <TableSkeleton columns={columns} />
              ) : table.rows.length ? (
                table.rows.map((kycCase) => (
                  <tr key={kycCase.id} className={`hover:bg-slate-50/70 ${table.loading ? 'opacity-60' : ''}`}>
                    <td className={tableCellClass}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={kycCase.client.name} />
                        <div className="min-w-0">
                          <Link className="block truncate font-semibold text-slate-950 hover:text-brand-700" to={`/kyc/${kycCase.id}`}>{kycCase.client.name}</Link>
                          <p className="max-w-[16rem] truncate text-xs text-slate-500" title={kycCase.title}>{kycCase.title}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap font-medium text-slate-800`}>{kycCase.kycNumber || '-'}</td>
                    <td className={`${tableCellClass} text-slate-600`}>{kycCase.service?.name || 'Not selected'}</td>
                    <td className={`${tableCellClass} text-right tabular-nums text-slate-600`}>{kycCase._count.legalDocuments}</td>
                    <td className={tableCellClass}>
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${kycStatusToneClass(kycCase.status)}`}>{kycStatusLabel(kycCase.status)}</span>
                      {kycStatusOwner(kycCase.status) ? <p className="mt-1 text-[11px] font-medium text-slate-500">Now with: {kycStatusOwner(kycCase.status)}</p> : null}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex justify-end gap-0.5">
                        <Link to={`/kyc/${kycCase.id}`} className={rowLink} aria-label={`View ${kycCase.title}`} title="View"><Eye className="h-4 w-4" /></Link>
                        {documentReadyStatuses.includes(kycCase.status) ? (
                          <>
                            <IconAction label={`Download DOCX for ${kycCase.title}`} onClick={() => downloadDocument(kycCase, 'docx')} disabled={generatingKey === `${kycCase.id}-docx`}><FileText className="h-4 w-4" /></IconAction>
                            <IconAction label={`Download PDF for ${kycCase.title}`} onClick={() => downloadDocument(kycCase, 'pdf')} disabled={generatingKey === `${kycCase.id}-pdf`}><Download className="h-4 w-4" /></IconAction>
                          </>
                        ) : null}
                        {canEditOrDeleteCases ? (
                          <>
                            <Link to={`/kyc/${kycCase.id}/edit`} className={rowLink} aria-label={`Edit ${kycCase.title}`} title="Edit"><Edit3 className="h-4 w-4" /></Link>
                            <IconAction label={`Delete ${kycCase.title}`} tone="danger" onClick={() => removeCase(kycCase)} disabled={deletingId === kycCase.id}><Trash2 className="h-4 w-4" /></IconAction>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow columns={columns} filtered={table.isFiltered} emptyText="No KYC cases have been opened yet." onReset={table.reset} />
              )}
            </tbody>
          </table>
        </div>
        <TablePager page={table.params.page} pageSize={table.params.pageSize} total={table.total} onPage={table.setPage} onPageSize={table.setPageSize} loading={table.loading} />
      </TableCard>
    </div>
  );
}
