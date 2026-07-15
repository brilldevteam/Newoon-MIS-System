import { Eye, FileText, MessageSquare, Send, Trash2, Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  addWorkflowComment,
  assignService,
  deleteLegalDocument,
  getKycCase,
  KycCase,
  ProposalStatus,
  KycCaseStatus,
  updateProposalStatus,
  viewLegalDocument
} from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';
import { hasAnyRole, workflowRoles } from '../utils/access-control';

const steps: KycCaseStatus[] = [
  'INQUIRY_RECEIVED',
  'PROPOSAL_OPTIONAL',
  'LEGAL_DOCUMENTS_PENDING',
  'LEGAL_DOCUMENTS_UPLOADED',
  'SUBMITTED_TO_AML',
  'AML_REVIEW_STARTED'
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function KycCaseDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>('NOT_REQUIRED');
  const [comment, setComment] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [deletingDocumentId, setDeletingDocumentId] = useState('');

  useEffect(() => {
    if (id) {
      getKycCase(id).then((item) => {
        setKycCase(item);
        setServiceName(item.service?.name || '');
        setProposalStatus(item.proposalStatus);
      });
    }
  }, [id]);

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !serviceName) return;
    setKycCase(await assignService(id, { serviceName }));
  }

  async function saveProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setKycCase(await updateProposalStatus(id, proposalStatus));
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !comment.trim()) return;
    setKycCase(await addWorkflowComment(id, comment.trim()));
    setComment('');
  }

  async function openDocument(document: KycCase['legalDocuments'][number]) {
    if (!id) return;
    setDocumentError('');
    try {
      await viewLegalDocument(id, document);
    } catch (requestError: any) {
      setDocumentError(requestError.response?.data?.message || 'Unable to open uploaded document.');
    }
  }

  async function removeDocument(document: KycCase['legalDocuments'][number]) {
    if (!id || !window.confirm(`Delete ${document.fileName}?`)) return;
    setDocumentError('');
    setDeletingDocumentId(document.id);
    try {
      setKycCase(await deleteLegalDocument(id, document.id));
    } catch (requestError: any) {
      setDocumentError(requestError.response?.data?.message || 'Unable to delete uploaded document.');
    } finally {
      setDeletingDocumentId('');
    }
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading KYC case...</p>;
  }

  const currentStep = steps.indexOf(kycCase.status);
  const canSubmitToAml = kycCase.legalDocuments.length > 0 && kycCase.status !== 'SUBMITTED_TO_AML' && kycCase.status !== 'AML_REVIEW_STARTED';
  const canOpenInternalReview = hasAnyRole(user, workflowRoles.amlDashboard);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{kycCase.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {kycCase.client.name} | {kycCase.service?.name || 'Service not selected'}
          </p>
        </div>
        <span className="w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          {kycStatusLabel(kycCase.status)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/kyc/${kycCase.id}/form`}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <FileText className="h-4 w-4" />
          Open KYC Part 1
        </Link>
        {canOpenInternalReview ? (
          <Link
            to={`/kyc/${kycCase.id}/internal-review`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" />
            Internal Review
          </Link>
        ) : null}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Workflow Progress</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`rounded-md border p-3 ${
                index <= currentStep ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-500'
              }`}
            >
              <p className="text-xs font-semibold">Step {index + 1}</p>
              <p className="mt-1 text-sm font-medium">{kycStatusLabel(step)}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Service & Proposal</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <form onSubmit={saveService} className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Requested service
                  <input
                    value={serviceName}
                    onChange={(event) => setServiceName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Save Service
                </button>
              </form>
              <form onSubmit={saveProposal} className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Proposal status
                  <select
                    value={proposalStatus}
                    onChange={(event) => setProposalStatus(event.target.value as ProposalStatus)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="NOT_REQUIRED">Not required</option>
                    <option value="REQUIRED">Required</option>
                    <option value="SENT">Sent</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </label>
                <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Save Proposal
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Legal Documents</h2>
              <Link
                to={`/kyc/${kycCase.id}/documents`}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {documentError ? <p className="px-5 py-3 text-sm text-red-600">{documentError}</p> : null}
              {kycCase.legalDocuments.length ? (
                kycCase.legalDocuments.map((document) => (
                  <div key={document.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">{document.documentType}</p>
                      <p className="truncate text-sm text-slate-500">{document.fileName}</p>
                    </div>
                    <div className="flex w-fit items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDocument(document)}
                        title="View document"
                        aria-label={`View ${document.fileName}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDocument(document)}
                        disabled={deletingDocumentId === document.id}
                        title="Delete document"
                        aria-label={`Delete ${document.fileName}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-5 py-6 text-sm text-slate-500">No legal document metadata uploaded yet.</p>
              )}
            </div>
          </section>

          {canSubmitToAml ? (
            <Link
              to={`/kyc/${kycCase.id}/submit`}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Send className="h-4 w-4" />
              Submit to AML
            </Link>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Timeline</h2>
            <div className="mt-4 space-y-4">
              {kycCase.statusHistory.map((item) => (
                <div key={item.id} className="border-l-2 border-brand-200 pl-3">
                  <p className="text-sm font-medium text-slate-950">{kycStatusLabel(item.toStatus)}</p>
                  <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                  {item.note ? <p className="mt-1 text-sm text-slate-600">{item.note}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Comments</h2>
            <form onSubmit={submitComment} className="mt-4 space-y-3">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <MessageSquare className="h-4 w-4" />
                Add Comment
              </button>
            </form>
            <div className="mt-5 space-y-3">
              {kycCase.comments.map((item) => (
                <div key={item.id} className="rounded-md bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">{item.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.author ? `${item.author.firstName} ${item.author.lastName}` : 'System'} | {formatDate(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
