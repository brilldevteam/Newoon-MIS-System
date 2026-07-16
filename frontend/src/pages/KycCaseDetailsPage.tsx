import { Download, Eye, FileText, MessageSquare, Send, Trash2, Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SearchableMultiSelect } from '../components/SearchableSelect';
import { useAuth } from '../hooks/useAuth';
import {
  addWorkflowComment,
  assignService,
  deleteLegalDocument,
  downloadGeneratedKycDocument,
  generateKycDocument,
  getKycCase,
  KycCase,
  ProposalStatus,
  KycCaseStatus,
  updateProposalStatus,
  uploadLegalDocumentFile,
  viewLegalDocument
} from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';
import { newoonServiceOptions, serviceListText, serviceListValue } from '../utils/newoon-services';
import { hasAnyRole, workflowRoles } from '../utils/access-control';

const steps: KycCaseStatus[] = [
  'INQUIRY_RECEIVED',
  'PROPOSAL_OPTIONAL',
  'LEGAL_DOCUMENTS_PENDING',
  'LEGAL_DOCUMENTS_UPLOADED',
  'DMLRO_REVIEW_PENDING',
  'DMLRO_REVIEW_COMPLETED',
  'MLRO_REVIEW_PENDING',
  'MLRO_APPROVED'
];

const approvedStatuses: KycCaseStatus[] = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ACTIVE'];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function workflowNoteLabel(value: string) {
  return value
    .replace('Legal document metadata uploaded', 'Documents required for KYC preparation uploaded')
    .replace('legal document metadata uploaded', 'documents required for KYC preparation uploaded');
}

export function KycCaseDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>('NOT_REQUIRED');
  const [comment, setComment] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [deletingDocumentId, setDeletingDocumentId] = useState('');
  const [uploadingDocumentId, setUploadingDocumentId] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [generatingType, setGeneratingType] = useState<'docx' | 'pdf' | ''>('');

  useEffect(() => {
    if (id) {
      getKycCase(id).then((item) => {
        setKycCase(item);
        setServices(serviceListValue(item.service?.name));
        setProposalStatus(item.proposalStatus);
      });
    }
  }, [id]);

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const serviceName = serviceListText(services);
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
    if (!document.storagePath) {
      setDocumentError('This document row has no stored file yet. Reupload the file once to make it viewable.');
      return;
    }
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

  async function downloadFinalDocument(type: 'docx' | 'pdf') {
    if (!id) return;
    setDownloadError('');
    setGeneratingType(type);
    try {
      const document = await generateKycDocument(id, type);
      await downloadGeneratedKycDocument(id, document.id, document.fileName);
      setKycCase(await getKycCase(id));
    } catch (requestError: any) {
      const message = requestError.response?.data?.message;
      setDownloadError(typeof message === 'string' ? message : `Unable to generate ${type.toUpperCase()} document.`);
    } finally {
      setGeneratingType('');
    }
  }

  async function replaceDocumentFile(document: KycCase['legalDocuments'][number], file: File | null) {
    if (!id || !file) return;
    setDocumentError('');
    setUploadingDocumentId(document.id);
    try {
      setKycCase(await uploadLegalDocumentFile(id, { documentType: document.documentType, file }));
    } catch (requestError: any) {
      setDocumentError(requestError.response?.data?.message || 'Unable to upload replacement file.');
    } finally {
      setUploadingDocumentId('');
    }
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading KYC case...</p>;
  }

  const currentStep = steps.indexOf(kycCase.status);
  const canPrepareKyc = hasAnyRole(user, workflowRoles.kycPreparation);
  const canOpenKycForm = hasAnyRole(user, workflowRoles.kycFormBuilder);
  const canSubmitToAml = canPrepareKyc && kycCase.legalDocuments.length > 0 && ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED'].includes(kycCase.status);
  const canOpenInternalReview = hasAnyRole(user, workflowRoles.userAdmin);
  const isApproved = approvedStatuses.includes(kycCase.status);
  const primaryContact = kycCase.client.contacts.find((contact) => contact.isPrimary) || kycCase.client.contacts[0];

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
        {canOpenKycForm ? (
          <Link
            to={`/kyc/${kycCase.id}/form`}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FileText className="h-4 w-4" />
            Open KYC Part 1
          </Link>
        ) : null}
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

      {isApproved ? (
        <section className="rounded-lg border border-brand-200 bg-brand-50 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-base font-semibold text-brand-900">KYC fully approved and ready for activation</p>
              <p className="mt-1 text-sm text-brand-700">
                Client details, KYC Part 1 data, approval signatures, uploaded preparation documents, workflow comments, and generated documents are stored against this case.
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="font-semibold text-brand-900">Client</dt>
                  <dd className="text-brand-700">{kycCase.client.name}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-brand-900">Primary contact</dt>
                  <dd className="text-brand-700">{primaryContact?.name || 'Not assigned'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-brand-900">Uploaded documents</dt>
                  <dd className="text-brand-700">{kycCase.legalDocuments.length}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-brand-900">Current status</dt>
                  <dd className="text-brand-700">{kycStatusLabel(kycCase.status)}</dd>
                </div>
              </dl>
              {downloadError ? <p className="mt-3 text-sm text-red-700">{downloadError}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadFinalDocument('docx')}
                disabled={Boolean(generatingType)}
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {generatingType === 'docx' ? 'Preparing DOCX...' : 'Download DOCX'}
              </button>
              <button
                type="button"
                onClick={() => downloadFinalDocument('pdf')}
                disabled={Boolean(generatingType)}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {generatingType === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

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
          {canPrepareKyc ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">Service & Proposal</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <form onSubmit={saveService} className="space-y-3">
                  <SearchableMultiSelect
                    label="Requested services"
                    value={services}
                    options={newoonServiceOptions}
                    onChange={setServices}
                    placeholder="Select requested services"
                  />
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
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Documents Required for KYC Preparation</h2>
              {canPrepareKyc ? (
                <Link
                  to={`/kyc/${kycCase.id}/documents`}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Link>
              ) : null}
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
                        disabled={!document.storagePath}
                        title="View document"
                        aria-label={`View ${document.fileName}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canPrepareKyc ? (
                        <label
                          title={document.storagePath ? 'Replace file' : 'Upload missing file'}
                          aria-label={`${document.storagePath ? 'Replace' : 'Upload'} ${document.fileName}`}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          <Upload className={`h-4 w-4 ${uploadingDocumentId === document.id ? 'animate-pulse' : ''}`} />
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              replaceDocumentFile(document, event.target.files?.[0] || null);
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                      ) : null}
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
                <p className="px-5 py-6 text-sm text-slate-500">No documents required for KYC preparation uploaded yet.</p>
              )}
            </div>
          </section>

          {canSubmitToAml ? (
            <Link
              to={`/kyc/${kycCase.id}/submit`}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Send className="h-4 w-4" />
              Submit to DMLRO
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
                  {item.note ? <p className="mt-1 text-sm text-slate-600">{workflowNoteLabel(item.note)}</p> : null}
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
