import { Download, Eye, FileSpreadsheet, FileText, MessageSquare, SearchCheck, Send, Trash2, Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SearchableMultiSelect } from '../components/SearchableSelect';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  addWorkflowComment,
  assignService,
  completeEngagementDecision,
  completeFinalKycDecision,
  deleteLegalDocument,
  downloadGeneratedKycDocument,
  downloadLegalDocument,
  downloadLegalDocumentGroup,
  generateKycDocument,
  getKycCase,
  KycCase,
  ProposalStatus,
  KycCaseStatus,
  returnKycToBusinessDevelopment,
  updateProposalStatus,
  uploadLegalDocumentFiles,
  viewLegalDocument
} from '../services/kyc-workflow.service';
import { kycStatusLabel, kycStatusToneClass } from '../utils/kyc-status-labels';
import { newoonServiceOptions, serviceListText, serviceListValue } from '../utils/newoon-services';
import { hasAnyRole, workflowRoles } from '../utils/access-control';

const approvedStatuses: KycCaseStatus[] = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'SEF_APPROVED', 'KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ACTIVE'];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function workflowNoteLabel(value: string) {
  return value
    .replace('Legal document metadata uploaded', 'Documents required for KYC preparation uploaded')
    .replace('legal document metadata uploaded', 'documents required for KYC preparation uploaded');
}

function groupedLegalDocuments(documents: KycCase['legalDocuments']) {
  const groups = new Map<string, KycCase['legalDocuments']>();
  documents.forEach((document) => {
    const documentType = document.documentType || 'Other documents';
    groups.set(documentType, [...(groups.get(documentType) || []), document]);
  });
  return Array.from(groups.entries()).map(([documentType, items]) => ({ documentType, items }));
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
  const [engagementFile, setEngagementFile] = useState<File | null>(null);
  const [engagementDecision, setEngagementDecision] = useState<'CONVERT_TO_CLIENT' | 'REJECT' | 'ON_HOLD'>('CONVERT_TO_CLIENT');
  const [engagementReason, setEngagementReason] = useState('');
  const [amendmentSections, setAmendmentSections] = useState<string[]>([]);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [finalKycDecision, setFinalKycDecision] = useState<'SAME_KYC_FINAL' | 'AMENDMENT_REQUIRED'>('SAME_KYC_FINAL');
  const [workflowActionMessage, setWorkflowActionMessage] = useState('');
  const [workflowActionError, setWorkflowActionError] = useState('');
  const [returnToBdReason, setReturnToBdReason] = useState('');

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

  async function saveDocument(document: KycCase['legalDocuments'][number]) {
    if (!id) return;
    if (!document.storagePath) {
      setDocumentError('This document row has no stored file yet. Reupload the file once to make it downloadable.');
      return;
    }
    setDocumentError('');
    try {
      await downloadLegalDocument(id, document);
    } catch (requestError: any) {
      setDocumentError(requestError.response?.data?.message || 'Unable to download uploaded document.');
    }
  }

  async function saveDocumentGroup(documentType: string, documents: KycCase['legalDocuments']) {
    if (!id) return;
    const downloadable = documents.filter((document) => document.storagePath);
    if (!downloadable.length) {
      setDocumentError('No uploaded files are available for this document group.');
      return;
    }

    setDocumentError('');
    try {
      if (downloadable.length === 1) {
        await downloadLegalDocument(id, downloadable[0]);
        return;
      }

      await downloadLegalDocumentGroup(id, documentType);
    } catch (requestError: any) {
      setDocumentError(requestError.response?.data?.message || 'Unable to download this document group.');
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

  async function returnToBusinessDevelopment() {
    if (!id || !returnToBdReason.trim()) return;
    setWorkflowActionError('');
    setWorkflowActionMessage('');
    try {
      setKycCase(await returnKycToBusinessDevelopment(id, returnToBdReason.trim()));
      setReturnToBdReason('');
      setWorkflowActionMessage('KYC case returned to BD for correction.');
    } catch (requestError: any) {
      setWorkflowActionError(getApiErrorMessage(requestError, 'Unable to return the KYC case to BD.'));
    }
  }

  async function replaceDocumentFile(document: KycCase['legalDocuments'][number], files: File[]) {
    if (!id || !files.length) return;
    setDocumentError('');
    setUploadingDocumentId(document.id);
    try {
      setKycCase(await uploadLegalDocumentFiles(id, { documentType: document.documentType, files }));
    } catch (requestError: any) {
      setDocumentError(requestError.response?.data?.message || 'Unable to upload selected files.');
    } finally {
      setUploadingDocumentId('');
    }
  }

  async function submitEngagementDecision() {
    if (!id) return;
    setWorkflowActionError('');
    setWorkflowActionMessage('');
    try {
      let nextCase = kycCase;
      if (engagementFile) {
        nextCase = await uploadLegalDocumentFiles(id, { documentType: 'Signed Engagement Letter', files: [engagementFile] });
        setKycCase(nextCase);
      }
      if (!nextCase?.legalDocuments.some((document) => document.documentType === 'Signed Engagement Letter' && document.storagePath)) {
        setWorkflowActionError('Upload the signed engagement letter before submitting the decision.');
        return;
      }
      setKycCase(await completeEngagementDecision(id, { decision: engagementDecision, reason: engagementReason }));
      setEngagementFile(null);
      setWorkflowActionMessage(engagementDecision === 'CONVERT_TO_CLIENT' ? 'Client converted and activated.' : engagementDecision === 'ON_HOLD' ? 'Engagement placed on hold.' : 'Engagement rejected.');
    } catch (requestError: any) {
      setWorkflowActionError(requestError.response?.data?.message || 'Unable to complete the engagement decision.');
    }
  }

  async function submitFinalKycDecision() {
    if (!id) return;
    setWorkflowActionError('');
    setWorkflowActionMessage('');
    try {
      const updated = await completeFinalKycDecision(id, {
        decision: finalKycDecision,
        sections: finalKycDecision === 'AMENDMENT_REQUIRED' ? amendmentSections : undefined,
        reason: finalKycDecision === 'AMENDMENT_REQUIRED' ? amendmentReason : undefined
      });
      setKycCase(updated);
      setAmendmentSections([]);
      setAmendmentReason('');
      if (finalKycDecision === 'AMENDMENT_REQUIRED') {
        setWorkflowActionMessage('KYC amendment opened as a new version. The existing information is ready to edit.');
        window.open(`/kyc/${id}/form`, '_blank', 'noopener,noreferrer');
      } else {
        setWorkflowActionMessage('The approved KYC has been marked as the final KYC.');
      }
    } catch (requestError: any) {
      setWorkflowActionError(getApiErrorMessage(requestError, 'Unable to connect to the server to complete the final KYC decision.'));
    }
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading KYC case...</p>;
  }

  const preparationEditable = ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status);
  const canPrepareKyc = hasAnyRole(user, workflowRoles.kycPreparation) && preparationEditable;
  const canUploadDocuments =
    hasAnyRole(user, workflowRoles.documentUpload) &&
    ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status);
  const canDeleteDocuments = hasAnyRole(user, workflowRoles.documentDelete);
  const canOpenKycForm = hasAnyRole(user, workflowRoles.kycFormBuilder);
  const canOpenScreening = hasAnyRole(user, workflowRoles.screening);
  const canOpenCrrf = hasAnyRole(user, workflowRoles.crrf);
  const canSubmitToAml =
    canPrepareKyc &&
    kycCase.legalDocuments.length > 0 &&
    ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status);
  const canOpenInternalReview = hasAnyRole(user, workflowRoles.userAdmin);
  const isApproved = approvedStatuses.includes(kycCase.status);
  const isPreliminaryProposedCompany = kycCase.sourceEnquiry?.enquiryType === 'PROPOSED_COMPANY';
  const canOpenKycFormForActiveStage =
    hasAnyRole(user, ['SUPER_ADMIN', 'COMPANY_ADMIN']) ||
    (hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR']) && preparationEditable) ||
    (hasAnyRole(user, ['DMLRO']) && ['DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status)) ||
    (hasAnyRole(user, ['MLRO']) && ['MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status)) ||
    (hasAnyRole(user, ['SEF']) && ['SEF_DECISION_PENDING', 'SEF_DECISION_IN_PROGRESS'].includes(kycCase.status));
  const preliminaryReviewAction =
    isPreliminaryProposedCompany && canOpenKycForm
      ? ['DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status) && hasAnyRole(user, ['DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])
        ? 'Review and Send to MLRO'
        : ['MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status) && hasAnyRole(user, ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])
          ? 'Review and Send to SEF'
          : ['SEF_DECISION_PENDING', 'SEF_DECISION_IN_PROGRESS'].includes(kycCase.status) && hasAnyRole(user, ['SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN'])
            ? 'SEF Review Decision'
            : null
      : null;
  const finalDecisionPending = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'SEF_APPROVED'].includes(kycCase.status);
  const finalDecisionRole = isPreliminaryProposedCompany ? 'AML Supervisor' : kycCase.status === 'SEF_APPROVED' ? 'SEF' : 'MLRO';
  const canCompleteEngagement = ['KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING'].includes(kycCase.status) && hasAnyRole(user, ['OPERATING_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN']);
  const canCompleteFinalKycDecision =
    (isPreliminaryProposedCompany && finalDecisionPending && hasAnyRole(user, ['AML_SUPERVISOR', 'AML_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) ||
    (!isPreliminaryProposedCompany && ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS'].includes(kycCase.status) && hasAnyRole(user, ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) ||
    (kycCase.status === 'SEF_APPROVED' && hasAnyRole(user, ['SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN']));
  const canReturnToBd =
    Boolean(kycCase.sourceEnquiry) &&
    ['SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status) &&
    hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN']);
  const primaryContact = kycCase.client.contacts.find((contact) => contact.isPrimary) || kycCase.client.contacts[0];
  const legalDocumentGroups = groupedLegalDocuments(kycCase.legalDocuments);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{kycCase.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {kycCase.client.name} | {kycCase.service?.name || 'Service not selected'}
          </p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${kycStatusToneClass(kycCase.status)}`}>
          {kycStatusLabel(kycCase.status)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {isPreliminaryProposedCompany && kycCase.sourceEnquiry && hasAnyRole(user, workflowRoles.enquiryView) ? (
          <Link
            to={`/enquiries/${kycCase.sourceEnquiry.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FileText className="h-4 w-4" />
            Open Preliminary KYC
          </Link>
        ) : null}
        {preliminaryReviewAction ? (
          <Link
            to={`/kyc/${kycCase.id}/form`}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FileText className="h-4 w-4" />
            {preliminaryReviewAction}
          </Link>
        ) : null}
        {canOpenKycForm && canOpenKycFormForActiveStage && (!isPreliminaryProposedCompany || kycCase.kycForm?.status === 'AMENDMENT_DRAFT') ? (
          <Link
            to={`/kyc/${kycCase.id}/form`}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <FileText className="h-4 w-4" />
            Open KYC Form
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
        {canOpenScreening ? (
          <Link
            to={`/kyc/${kycCase.id}/screening`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <SearchCheck className="h-4 w-4" />
            Screening
          </Link>
        ) : null}
        {canOpenCrrf ? (
          <Link
            to={`/kyc/${kycCase.id}/crrf`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            CRRF
          </Link>
        ) : null}
        {canSubmitToAml ? (
          <Link
            to={`/kyc/${kycCase.id}/submit`}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Send className="h-4 w-4" />
            {['SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status) ? 'Resubmit to DMLRO' : 'Submit to DMLRO'}
          </Link>
        ) : null}
      </div>

      {canReturnToBd ? (
        <section className="flex flex-col gap-3 border-l-4 border-amber-400 bg-amber-50 p-4 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
            Return reason for BD
            <textarea value={returnToBdReason} onChange={(event) => setReturnToBdReason(event.target.value)} className="mt-1 min-h-20 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-normal" placeholder="Describe the information or documents BD must correct." />
          </label>
          <button type="button" onClick={returnToBusinessDevelopment} disabled={!returnToBdReason.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" />
            Return to BD
          </button>
        </section>
      ) : null}

      {isApproved ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-base font-semibold text-emerald-900">
                {finalDecisionPending ? 'Required approvals completed - final KYC decision pending' : 'KYC fully approved and ready for activation'}
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                {finalDecisionPending
                  ? `${finalDecisionRole} must confirm this approved KYC as final or open an amendment before activation.`
                  : 'Client details, KYC form data, approval signatures, uploaded preparation documents, workflow comments, and generated documents are stored against this case.'}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="font-semibold text-emerald-900">Client</dt>
                  <dd className="text-emerald-700">{kycCase.client.name}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-emerald-900">Primary contact</dt>
                  <dd className="text-emerald-700">{primaryContact?.name || 'Not assigned'}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-emerald-900">Uploaded documents</dt>
                  <dd className="text-emerald-700">{kycCase.legalDocuments.length}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-emerald-900">Current status</dt>
                  <dd className="text-emerald-700">{kycStatusLabel(kycCase.status)}</dd>
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

      {workflowActionMessage ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{workflowActionMessage}</p> : null}
      {workflowActionError ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{workflowActionError}</p> : null}

      {canCompleteEngagement ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">Signed Engagement and Client Activation</h2>
          <p className="mt-1 text-sm text-slate-500">Upload the signed engagement letter, then convert and activate the client or reject the engagement.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px_1fr_auto] lg:items-end">
            <label className="text-sm font-medium text-slate-700">Signed engagement letter
              <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setEngagementFile(event.target.files?.[0] || null)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-sm font-medium text-slate-700">Decision
              <select value={engagementDecision} onChange={(event) => setEngagementDecision(event.target.value as 'CONVERT_TO_CLIENT' | 'REJECT' | 'ON_HOLD')} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="CONVERT_TO_CLIENT">Convert to client and activate</option>
                <option value="REJECT">Reject engagement</option>
                <option value="ON_HOLD">Place engagement on hold</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Reason {engagementDecision === 'CONVERT_TO_CLIENT' ? '(optional)' : '*'}
              <input value={engagementReason} onChange={(event) => setEngagementReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <button type="button" onClick={submitEngagementDecision} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Submit decision</button>
          </div>
        </section>
      ) : null}

      {canCompleteFinalKycDecision ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">Final KYC Decision</h2>
          <p className="mt-1 text-sm text-slate-500">{isPreliminaryProposedCompany ? 'Confirm the approved Preliminary KYC as final, or open the same populated full KYC form for completion.' : 'Confirm the approved KYC as final or reopen the same populated form as an amendment.'}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr_1fr_auto] lg:items-end">
            <label className="text-sm font-medium text-slate-700">Decision
              <select value={finalKycDecision} onChange={(event) => setFinalKycDecision(event.target.value as 'SAME_KYC_FINAL' | 'AMENDMENT_REQUIRED')} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="SAME_KYC_FINAL">{isPreliminaryProposedCompany ? 'Use Preliminary KYC as final' : 'Use approved KYC as final'}</option>
                <option value="AMENDMENT_REQUIRED">{isPreliminaryProposedCompany ? 'Complete full KYC form' : 'Amendment required'}</option>
              </select>
            </label>
            {finalKycDecision === 'AMENDMENT_REQUIRED' ? <label className="text-sm font-medium text-slate-700">Sections to amend
              <select multiple value={amendmentSections} onChange={(event) => setAmendmentSections(Array.from(event.target.selectedOptions, (option) => option.value))} className="mt-1 h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {['A. General Company Information', 'B. Control / Interest Details', 'C. Managers / Signatories', 'D. Compliance and Risk', 'E. Key Communication Person', 'F. Required Documents', 'G. Client Declaration', 'H. Internal Review'].map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </label> : <div />}
            {finalKycDecision === 'AMENDMENT_REQUIRED' ? <label className="text-sm font-medium text-slate-700">Amendment reason *
              <textarea rows={4} value={amendmentReason} onChange={(event) => setAmendmentReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label> : <div />}
            <button type="button" onClick={submitFinalKycDecision} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Confirm decision</button>
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
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
              {canUploadDocuments ? (
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
              {legalDocumentGroups.length ? (
                legalDocumentGroups.map((group) => {
                  const downloadableCount = group.items.filter((document) => document.storagePath).length;
                  return (
                    <div key={group.documentType} className="px-5 py-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50">
                        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">{group.documentType}</p>
                            <p className="text-xs text-slate-500">{group.items.length} file{group.items.length === 1 ? '' : 's'} attached</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => saveDocumentGroup(group.documentType, group.items)}
                            disabled={!downloadableCount}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-4 w-4" />
                            {downloadableCount > 1 ? 'Download ZIP' : 'Download'}
                          </button>
                        </div>
                        <div className="divide-y divide-slate-200 bg-white">
                          {group.items.map((document) => (
                            <div key={document.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-950">{document.fileName}</p>
                                <p className="text-xs text-slate-500">{document.storagePath ? 'Uploaded file available' : 'Metadata only'}</p>
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
                                <button
                                  type="button"
                                  onClick={() => saveDocument(document)}
                                  disabled={!document.storagePath}
                                  title="Download document"
                                  aria-label={`Download ${document.fileName}`}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                {canUploadDocuments ? (
                                  <label
                                    title={document.storagePath ? 'Upload more files' : 'Upload missing file'}
                                    aria-label={`Upload files for ${document.fileName}`}
                                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                                  >
                                    <Upload className={`h-4 w-4 ${uploadingDocumentId === document.id ? 'animate-pulse' : ''}`} />
                                    <input
                                      type="file"
                                      multiple
                                      className="hidden"
                                      onChange={(event) => {
                                        replaceDocumentFile(document, Array.from(event.target.files || []));
                                        event.currentTarget.value = '';
                                      }}
                                    />
                                  </label>
                                ) : null}
                                {canDeleteDocuments ? (
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
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="px-5 py-6 text-sm text-slate-500">No documents required for KYC preparation uploaded yet.</p>
              )}
            </div>
          </section>

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
