import { Edit3, Eye, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmProvider';
import { Avatar, EmptyRow, FilterSelect, IconAction, Pill, QuickTabs, SortHeader, TableCard, TableToolbar, TablePager, TableSkeleton, tableCellClass, tableHeadClass } from '../components/table/TableParts';
import { useServerTable } from '../components/table/useServerTable';
import { useAuth } from '../hooks/useAuth';
import { deleteEnquiry, EnquiryRow, listEnquiryTable } from '../services/kyc-workflow.service';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { canEditEnquiryRecord } from '../utils/enquiry-edit-access';
import { kycStatusLabel, kycStatusOwner, kycStatusToneClass } from '../utils/kyc-status-labels';

const enquiryTypeLabels: Record<string, string> = {
  EXISTING_LEGAL_ENTITY: 'Existing Legal Entity',
  PROPOSED_COMPANY: 'Proposed Company',
  CURRENT_CLIENT_NEW_SERVICES: 'Current Client - New Services'
};

const enquiryStatusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED_TO_AML_SUPERVISOR: 'Submitted to AML Supervisor',
  RETURNED_TO_BD: 'Returned to BD',
  READY_FOR_KYC: 'Ready for KYC',
  CONVERTED_TO_KYC: 'Pending with AML Supervisor',
  CLOSED: 'Closed'
};

const tabs = [
  { value: 'all', label: 'All enquiries' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'With AML Supervisor' },
  { value: 'returned', label: 'Returned to BD' },
  { value: 'ready', label: 'Ready for KYC' },
  { value: 'closed', label: 'Closed' }
];

const sortOptions = [
  { value: 'created', label: 'Date created' },
  { value: 'code', label: 'Code' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' }
];

const filterKeys = ['type'];

function enquiryStatusTone(value: string) {
  if (['READY_FOR_KYC', 'CONVERTED_TO_KYC'].includes(value)) return 'green' as const;
  if (value === 'SUBMITTED_TO_AML_SUPERVISOR') return 'blue' as const;
  if (value === 'RETURNED_TO_BD') return 'amber' as const;
  return 'slate' as const;
}

const formatDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const enquiryName = (enquiry: EnquiryRow) => enquiry.companyName || enquiry.proposedCompanyName || enquiry.client?.name || 'Untitled enquiry';

export function EnquiryListPage() {
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const table = useServerTable(listEnquiryTable, { defaultSort: 'created', defaultDir: 'desc', filterKeys });
  const [deletingId, setDeletingId] = useState('');
  const [actionError, setActionError] = useState('');
  // Super Admin can delete any enquiry; Operations and Company Admin only drafts / returned enquiries with no KYC case.
  const canDeleteEnquiry = (enquiry: EnquiryRow) =>
    hasAnyRole(user, ['SUPER_ADMIN']) ||
    (hasAnyRole(user, ['OPERATING_TEAM', 'COMPANY_ADMIN']) && ['DRAFT', 'RETURNED_TO_BD'].includes(enquiry.status) && !enquiry.generatedKycCases?.length);
  const canCreateEnquiry = hasAnyRole(user, workflowRoles.clientIntake);

  async function removeEnquiry(enquiry: EnquiryRow) {
    const confirmed = await confirm({ title: 'Delete this enquiry?', message: `Delete enquiry ${enquiry.enquiryCode}? This will remove the enquiry record and its draft attachments/comments.`, confirmLabel: 'Delete', tone: 'danger' });
    if (!confirmed) return;

    setDeletingId(enquiry.id);
    setActionError('');
    try {
      await deleteEnquiry(enquiry.id);
      table.removeRow((row) => row.id === enquiry.id);
      table.reload();
    } catch (requestError: any) {
      setActionError(requestError.response?.data?.message || 'Unable to delete this enquiry.');
    } finally {
      setDeletingId('');
    }
  }

  const error = actionError || table.error;
  const columns = 7;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Enquiries</h1>
          <p className="mt-1 text-sm text-slate-500">Capture BD enquiries before AML prepares the KYC file.</p>
        </div>
        {canCreateEnquiry ? (
          <Link to="/enquiries/new" className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />
            New Enquiry
          </Link>
        ) : null}
      </div>

      {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <TableCard>
        <TableToolbar
          query={table.params.q}
          onQuery={table.setQuery}
          placeholder="Search by code, company, contact or email"
          sort={table.params.sort}
          dir={table.params.dir}
          sortOptions={sortOptions}
          onSort={table.setSort}
          activeFilterCount={table.activeFilterCount}
          onClearFilters={table.clearFilters}
          filters={<FilterSelect label="Enquiry type" value={table.params.filters.type || ''} onChange={(value) => table.setFilter('type', value)} options={Object.entries(enquiryTypeLabels).map(([value, label]) => ({ value, label }))} />}
        />
        <QuickTabs tabs={tabs} active={table.params.tab} counts={table.counts} onChange={table.setTab} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <SortHeader label="Enquiry" sortKey="name" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={tableHeadClass}>Primary contact</th>
                <th scope="col" className={tableHeadClass}>Type</th>
                <th scope="col" className={tableHeadClass}>Requested services</th>
                <SortHeader label="Status" sortKey="status" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <SortHeader label="Created" sortKey="created" sort={table.params.sort} dir={table.params.dir} onSort={table.toggleSort} />
                <th scope="col" className={`${tableHeadClass} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.loading && !table.rows.length ? (
                <TableSkeleton columns={columns} />
              ) : table.rows.length ? (
                table.rows.map((enquiry) => {
                  const kycCase = enquiry.generatedKycCases?.[0];
                  return (
                    <tr key={enquiry.id} className={`hover:bg-slate-50/70 ${table.loading ? 'opacity-60' : ''}`}>
                      <td className={tableCellClass}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={enquiryName(enquiry)} />
                          <div className="min-w-0">
                            <Link className="block truncate font-semibold text-slate-950 hover:text-brand-700" to={`/enquiries/${enquiry.id}`}>{enquiryName(enquiry)}</Link>
                            <p className="text-xs text-slate-500">{enquiry.enquiryCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <p className="max-w-[14rem] truncate font-medium text-slate-800">{enquiry.keyContactName || 'Contact not captured'}</p>
                        <p className="max-w-[14rem] truncate text-xs text-slate-500">{enquiry.keyContactEmail || 'No email'}</p>
                      </td>
                      <td className={tableCellClass}><span className="whitespace-nowrap text-slate-600">{enquiryTypeLabels[enquiry.enquiryType] || enquiry.enquiryType}</span></td>
                      <td className={`${tableCellClass} max-w-xs`}><p className="truncate text-slate-600" title={enquiry.requestedServices?.join(', ')}>{enquiry.requestedServices?.join(', ') || 'Not selected'}</p></td>
                      <td className={tableCellClass}>
                        {kycCase ? (
                          <>
                            <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${kycStatusToneClass(kycCase.status)}`}>{kycStatusLabel(kycCase.status)}</span>
                            {kycStatusOwner(kycCase.status) ? <p className="mt-1 text-[11px] font-medium text-slate-500">Now with: {kycStatusOwner(kycCase.status)}</p> : null}
                          </>
                        ) : (
                          <Pill tone={enquiryStatusTone(enquiry.status)}>{enquiryStatusLabels[enquiry.status] || enquiry.status}</Pill>
                        )}
                      </td>
                      <td className={`${tableCellClass} whitespace-nowrap text-slate-600`}>{formatDate(enquiry.createdAt)}</td>
                      <td className={tableCellClass}>
                        <div className="flex justify-end gap-0.5">
                          <Link to={`/enquiries/${enquiry.id}`} aria-label={`View ${enquiry.enquiryCode}`} title="View" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Eye className="h-4 w-4" /></Link>
                          {canEditEnquiryRecord(user, enquiry) ? (
                            <Link to={`/enquiries/${enquiry.id}/edit`} aria-label={`Edit ${enquiry.enquiryCode}`} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit3 className="h-4 w-4" /></Link>
                          ) : null}
                          {canDeleteEnquiry(enquiry) ? (
                            <IconAction label={`Delete ${enquiry.enquiryCode}`} tone="danger" onClick={() => removeEnquiry(enquiry)} disabled={deletingId === enquiry.id}><Trash2 className="h-4 w-4" /></IconAction>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <EmptyRow columns={columns} filtered={table.isFiltered} emptyText="No enquiries have been recorded yet." onReset={table.reset} />
              )}
            </tbody>
          </table>
        </div>
        <TablePager page={table.params.page} pageSize={table.params.pageSize} total={table.total} onPage={table.setPage} onPageSize={table.setPageSize} loading={table.loading} />
      </TableCard>
    </div>
  );
}
