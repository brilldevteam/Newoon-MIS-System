import { Download, Edit3, Eye, FilePlus2, FileText, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { deleteKycCase, downloadGeneratedKycDocument, generateKycDocument, KycCase, KycCaseStatus, listKycCases } from '../services/kyc-workflow.service';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { kycStatusLabel } from '../utils/kyc-status-labels';

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

const documentReadyStatuses: KycCaseStatus[] = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ACTIVE'];

export function KycWorkflowPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<KycCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [generatingKey, setGeneratingKey] = useState('');
  const [error, setError] = useState('');
  const canManageCases = hasAnyRole(user, workflowRoles.caseCreation);

  useEffect(() => {
    loadCases();
  }, []);

  function loadCases() {
    setLoading(true);
    setError('');
    listKycCases()
      .then(setCases)
      .catch((requestError: any) => {
        setError(getRequestErrorMessage(requestError, 'Unable to load KYC cases.'));
      })
      .finally(() => setLoading(false));
  }

  async function removeCase(kycCase: KycCase) {
    const confirmed = window.confirm(`Delete ${kycCase.title}? This will permanently remove the KYC case and related workflow records.`);
    if (!confirmed) return;

    setDeletingId(kycCase.id);
    setError('');
    try {
      await deleteKycCase(kycCase.id);
      setCases((current) => current.filter((item) => item.id !== kycCase.id));
    } catch (requestError: any) {
      setError(getRequestErrorMessage(requestError, 'Unable to delete this KYC case.'));
    } finally {
      setDeletingId('');
    }
  }

  async function downloadDocument(kycCase: KycCase, type: 'docx' | 'pdf') {
    const key = `${kycCase.id}-${type}`;
    setGeneratingKey(key);
    setError('');
    try {
      const document = await generateKycDocument(kycCase.id, type);
      await downloadGeneratedKycDocument(kycCase.id, document.id, document.fileName);
    } catch (requestError: any) {
      setError(getRequestErrorMessage(requestError, `Unable to generate ${type.toUpperCase()} document.`));
    } finally {
      setGeneratingKey('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">KYC Workflow</h1>
          <p className="mt-1 text-sm text-slate-500">Client intake cases from inquiry through AML handoff.</p>
        </div>
        {canManageCases ? (
          <Link
            to="/kyc/new"
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FilePlus2 className="h-4 w-4" />
            Create KYC Case
          </Link>
        ) : null}
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Loading KYC cases...
                  </td>
                </tr>
              ) : cases.length ? (
                cases.map((kycCase) => (
                  <tr key={kycCase.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link className="font-medium text-brand-700 hover:text-brand-800" to={`/kyc/${kycCase.id}`}>
                        {kycCase.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{kycCase.client.name}</td>
                    <td className="px-4 py-3 text-slate-600">{kycCase.service?.name || 'Not selected'}</td>
                    <td className="px-4 py-3 text-slate-600">{kycCase.legalDocuments.length}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                        {kycStatusLabel(kycCase.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/kyc/${kycCase.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          aria-label={`View ${kycCase.title}`}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {documentReadyStatuses.includes(kycCase.status) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => downloadDocument(kycCase, 'docx')}
                              disabled={generatingKey === `${kycCase.id}-docx`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              aria-label={`Download DOCX for ${kycCase.title}`}
                              title="Download DOCX"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadDocument(kycCase, 'pdf')}
                              disabled={generatingKey === `${kycCase.id}-pdf`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              aria-label={`Download PDF for ${kycCase.title}`}
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                        {canManageCases ? (
                          <>
                            <Link
                              to={`/kyc/${kycCase.id}/edit`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                              aria-label={`Edit ${kycCase.title}`}
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeCase(kycCase)}
                              disabled={deletingId === kycCase.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              aria-label={`Delete ${kycCase.title}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No KYC cases have been opened yet.
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
