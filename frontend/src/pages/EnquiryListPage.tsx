import { Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteEnquiry, Enquiry, listEnquiries } from '../services/kyc-workflow.service';
import { useAuth } from '../hooks/useAuth';
import { hasAnyRole } from '../utils/access-control';
import { kycStatusLabel, kycStatusToneClass } from '../utils/kyc-status-labels';

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

function enquiryStatusToneClass(value: string) {
  if (['READY_FOR_KYC', 'CONVERTED_TO_KYC'].includes(value)) return 'bg-emerald-50 text-emerald-700';
  if (value === 'SUBMITTED_TO_AML_SUPERVISOR') return 'bg-blue-50 text-blue-700';
  if (value === 'RETURNED_TO_BD') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

export function EnquiryListPage() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');
  const canDeleteEnquiries = hasAnyRole(user, ['SUPER_ADMIN']);

  useEffect(() => {
    loadEnquiries();
  }, []);

  function loadEnquiries() {
    setLoading(true);
    setError('');
    listEnquiries()
      .then(setEnquiries)
      .catch((requestError: any) => setError(requestError.response?.data?.message || 'Unable to load enquiries.'))
      .finally(() => setLoading(false));
  }

  async function removeEnquiry(enquiry: Enquiry) {
    const confirmed = window.confirm(`Delete enquiry ${enquiry.enquiryCode}? This will remove the enquiry record and its draft attachments/comments.`);
    if (!confirmed) return;

    setDeletingId(enquiry.id);
    setError('');
    try {
      await deleteEnquiry(enquiry.id);
      setEnquiries((current) => current.filter((item) => item.id !== enquiry.id));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to delete this enquiry.');
    } finally {
      setDeletingId('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Enquiries</h1>
          <p className="mt-1 text-sm text-slate-500">Capture BD enquiries before AML prepares the KYC file.</p>
        </div>
        <Link to="/enquiries/new" className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />
          New Enquiry
        </Link>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          <Search className="h-4 w-4" />
          Enquiry register
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Enquiry</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Requested Services</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>Loading enquiries...</td>
                </tr>
              ) : enquiries.length ? (
                enquiries.map((enquiry) => (
                  <tr key={enquiry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-950">{enquiry.enquiryCode}</td>
                    <td className="px-4 py-3">
                      <Link className="font-medium text-slate-950 hover:text-brand-700" to={`/enquiries/${enquiry.id}`}>
                        {enquiry.companyName || enquiry.proposedCompanyName || enquiry.client?.name || 'Untitled enquiry'}
                      </Link>
                      <p className="text-xs text-slate-500">{enquiry.keyContactName || 'Contact not captured'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{enquiryTypeLabels[enquiry.enquiryType] || enquiry.enquiryType}</td>
                    <td className="max-w-md truncate px-4 py-3 text-slate-600">{enquiry.requestedServices?.join(', ') || 'Not selected'}</td>
                    <td className="px-4 py-3">
                      {enquiry.generatedKycCases?.[0] ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${kycStatusToneClass(enquiry.generatedKycCases[0].status)}`}>
                          {kycStatusLabel(enquiry.generatedKycCases[0].status)}
                        </span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${enquiryStatusToneClass(enquiry.status)}`}>
                          {enquiryStatusLabels[enquiry.status] || enquiry.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`/enquiries/${enquiry.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" title="View">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link to={`/enquiries/${enquiry.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" title="Edit">
                          <Edit3 className="h-4 w-4" />
                        </Link>
                        {canDeleteEnquiries ? (
                          <button type="button" onClick={() => removeEnquiry(enquiry)} disabled={deletingId === enquiry.id} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>No enquiries have been recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
