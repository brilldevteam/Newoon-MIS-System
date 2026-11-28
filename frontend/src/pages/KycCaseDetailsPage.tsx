import { ArrowLeft, ChevronDown, Clock, Download, Eye, FileSpreadsheet, FileText, MessageSquare, SearchCheck, Send, Trash2, Undo2, Upload, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { canSubmitToDmlro, KycCaseGuide } from '../components/KycCaseGuide';
import { safeCommentHtml } from '../components/RichTextEditor';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { personOfFile } from '../utils/person-copies';
import { getApiErrorMessage } from '../services/api';
import {
  addWorkflowComment,
  completeEngagementDecision,
  completeFinalKycDecision,
  deleteLegalDocument,
  downloadGeneratedKycDocument,
  downloadLegalDocument,
  downloadLegalDocumentGroup,
  generateKycDocument,
  getKycCase,
  getSubmissionReadiness,
  KycCase,
  KycCaseStatus,
  SubmissionReadiness,
  returnKycToBusinessDevelopment,
  uploadEngagementLetter,
  uploadLegalDocumentFiles,
  viewLegalDocument
} from '../services/kyc-workflow.service';
import { kycStatusLabel, kycStatusOwner, kycStatusToneClass } from '../utils/kyc-status-labels';
import { hasAnyRole, workflowRoles } from '../utils/access-control';
import { canOpenKycFormForActiveStage as canOpenKycFormForActiveStageFor, isPreparationEditable } from '../utils/kyc-case-access';

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
  const { showToast } = useToast();
  // Set by the KYC form after a DMLRO / MLRO decision is submitted.
  const reviewNotice = (useLocation().state as { reviewNotice?: string } | null)?.reviewNotice || '';
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<NonNullable<KycCase['reviewFeedback']>>([]);
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
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [readiness, setReadiness] = useState<SubmissionReadiness | null>(null);
  const [readinessError, setReadinessError] = useState('');

  useEffect(() => {
    setReviewFeedback([]);
    if (id) {
      getKycCase(id).then((item) => {
        setKycCase(item);
        setReviewFeedback(item.reviewFeedback || []);
      });
    }
  }, [id]);

  // The AML to-do list: what is still missing before the case can go to DMLRO (re-checked when the case changes).
  const readinessStatus = kycCase?.status;
  const readinessOpen = kycCase ? canSubmitToDmlro(kycCase) : false;
  const readinessFormVersion = kycCase?.kycForm?.status;
  const readinessDocuments = kycCase?.legalDocuments.length;
  const canSeeReadiness = hasAnyRole(user, workflowRoles.kycPreparation);
  useEffect(() => {
    let active = true;
    setReadiness(null);
    setReadinessError('');
    if (!id || !readinessStatus || !canSeeReadiness || !readinessOpen) return;
    getSubmissionReadiness(id)
      .then((result) => { if (active) setReadiness(result); })
      .catch((failure) => { if (active) setReadinessError(getApiErrorMessage(failure, 'Could not check what is left before submitting to DMLRO. Reload the page to try again.')); });
    return () => { active = false; };
  }, [id, readinessStatus, readinessDocuments, canSeeReadiness, readinessOpen, readinessFormVersion]);

  function jumpTo(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !comment.trim()) return;
    setKycCase(await addWorkflowComment(id, comment.trim()));
    setComment('');
    showToast('Comment added.', 'success');
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
      showToast(`${document.fileName} deleted.`, 'success');
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
      setReturnDialogOpen(false);
      setWorkflowActionMessage('KYC case returned to BD for correction.');
      showToast('KYC case returned to BD for correction.', 'success');
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
      showToast(`${files.length} file${files.length === 1 ? '' : 's'} uploaded.`, 'success');
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
        nextCase = await uploadEngagementLetter(id, engagementFile);
        setKycCase(nextCase);
      }
      if (!nextCase?.legalDocuments.some((document) => document.documentType === 'Signed Engagement Letter' && document.storagePath)) {
        setWorkflowActionError('Upload the signed engagement letter before submitting the decision.');
        return;
      }
      setKycCase(await completeEngagementDecision(id, { decision: engagementDecision, reason: engagementReason }));
      setEngagementFile(null);
      const engagementMessage = engagementDecision === 'CONVERT_TO_CLIENT' ? 'Client converted and activated.' : engagementDecision === 'ON_HOLD' ? 'Engagement placed on hold.' : 'Engagement rejected.';
      setWorkflowActionMessage(engagementMessage);
      showToast(engagementMessage, 'success');
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
        showToast('The approved KYC has been marked as the final KYC.', 'success');
      }
    } catch (requestError: any) {
      setWorkflowActionError(getApiErrorMessage(requestError, 'Unable to connect to the server to complete the final KYC decision.'));
    }
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading KYC case...</p>;
  }

  const preparationEditable = isPreparationEditable(kycCase);
  const canUploadDocuments =
    hasAnyRole(user, workflowRoles.documentUpload) &&
    preparationEditable;
  const canDeleteDocuments = hasAnyRole(user, workflowRoles.documentDelete);
  const canOpenKycForm = hasAnyRole(user, workflowRoles.kycFormBuilder);
  const canOpenScreening = hasAnyRole(user, workflowRoles.screening);
  const canOpenCrrf = hasAnyRole(user, workflowRoles.crrf);
  const canOpenInternalReview = hasAnyRole(user, workflowRoles.userAdmin);
  const isApproved = approvedStatuses.includes(kycCase.status);
  const isPreliminaryProposedCompany = kycCase.sourceEnquiry?.enquiryType === 'PROPOSED_COMPANY';
  const canOpenKycFormForActiveStage = canOpenKycFormForActiveStageFor(user, kycCase);
  const reviewerAction =
    canOpenKycForm && canOpenKycFormForActiveStage
      ? ['DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status) && hasAnyRole(user, ['DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])
        ? 'DMLRO Review: Send to MLRO or Return to AML'
        : ['DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status) && hasAnyRole(user, ['MLRO'])
          ? 'MLRO Review: Decide without DMLRO'
        : ['MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS'].includes(kycCase.status) && hasAnyRole(user, ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])
          ? 'MLRO Review: Send to SEF or Return to DMLRO'
          : ['SEF_DECISION_PENDING', 'SEF_DECISION_IN_PROGRESS'].includes(kycCase.status) && hasAnyRole(user, ['SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN'])
            ? 'SEF Review: Approve or Return to MLRO'
            : null
      : null;
  const finalDecisionPending = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'SEF_APPROVED'].includes(kycCase.status);
  const finalDecisionRole = 'AML Supervisor, DMLRO or MLRO';
  const engagementOnHold = kycCase.status === 'CLIENT_ON_HOLD';
  const canCompleteEngagement = ['KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ON_HOLD'].includes(kycCase.status) && hasAnyRole(user, ['OPERATING_TEAM', 'COMPANY_ADMIN', 'SUPER_ADMIN']);
  const canCompleteFinalKycDecision =
    (finalDecisionPending && hasAnyRole(user, ['AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN'])) ||
    (isPreliminaryProposedCompany && finalDecisionPending && hasAnyRole(user, ['AML_TEAM'])) ||
    (kycCase.status === 'SEF_APPROVED' && hasAnyRole(user, ['SEF', 'COMPANY_ADMIN', 'SUPER_ADMIN']));
  const canReturnToBd =
    Boolean(kycCase.sourceEnquiry) &&
    [
      'INQUIRY_RECEIVED',
      'PROPOSAL_OPTIONAL',
      'LEGAL_DOCUMENTS_PENDING',
      'LEGAL_DOCUMENTS_UPLOADED',
      'SUBMITTED_TO_AML',
      'AML_REVIEW_STARTED',
      'SUPERVISOR_REVIEW_PENDING',
      'SUPERVISOR_REVIEW_IN_PROGRESS',
      'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED',
      'DMLRO_ADDITIONAL_INFORMATION_REQUIRED',
      'MLRO_ADDITIONAL_INFORMATION_REQUIRED'
    ].includes(kycCase.status) &&
    hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR', 'COMPANY_ADMIN', 'SUPER_ADMIN']);
  const primaryContact = kycCase.client.contacts.find((contact) => contact.isPrimary) || kycCase.client.contacts[0];
  const legalDocumentGroups = groupedLegalDocuments(kycCase.legalDocuments);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-slate-950">{kycCase.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{kycCase.client.name} | {kycCase.service?.name || 'Service not selected'}</p>
        </div>
        {(reviewerAction || canReturnToBd || (isPreliminaryProposedCompany && kycCase.sourceEnquiry && hasAnyRole(user, workflowRoles.enquiryView))) ? (
          <nav aria-label="Case actions" className="flex flex-wrap items-center gap-2 sm:justify-end">
            {isPreliminaryProposedCompany && kycCase.sourceEnquiry && hasAnyRole(user, workflowRoles.enquiryView) ? (
              <Link to={`/enquiries/${kycCase.sourceEnquiry.id}`} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <FileText className="h-4 w-4" />
                Open Preliminary KYC
              </Link>
            ) : null}
            {canReturnToBd ? (
              <button type="button" onClick={() => { setWorkflowActionError(''); setReturnDialogOpen(true); }} className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                <Undo2 className="h-4 w-4" />
                Return to BD
              </button>
            ) : null}
            {reviewerAction ? (
              <Link to={`/kyc/${kycCase.id}/form`} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <FileText className="h-4 w-4" />
                {reviewerAction}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </header>
      {reviewNotice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{reviewNotice}</p> : null}
      <KycCaseGuide kycCase={kycCase} user={user} readiness={readiness} readinessError={readinessError} isPreliminary={isPreliminaryProposedCompany} onJump={jumpTo} />

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
      {workflowActionError && !returnDialogOpen ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{workflowActionError}</p> : null}

      {canCompleteEngagement ? (
        <section id="client-activation" className="scroll-mt-36 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-950">Signed Engagement and Client Activation</h2>
          <p className="mt-1 text-sm text-slate-500">
            {engagementOnHold
              ? 'This engagement is on hold (the reason is in the Timeline). When the client is ready, upload the new signed engagement letter, choose "Convert to client and activate" and press Submit decision.'
              : 'Upload the signed engagement letter, then convert and activate the client or reject the engagement.'}
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px_1fr_auto] lg:items-end">
            <label className="text-sm font-medium text-slate-700">Signed engagement letter {kycCase.legalDocuments.some((item) => item.documentType === 'Signed Engagement Letter' && item.storagePath) ? <span className="font-normal text-emerald-700">{engagementOnHold ? '(a letter is on file - add the new signed letter here)' : '(already uploaded - add a file only to replace it)'}</span> : <span className="text-red-600">* required, PDF or Word</span>}
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
        <section id="final-kyc-decision" className="scroll-mt-36 rounded-lg border border-slate-200 bg-white p-5">
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
                {['A. General Company Information', 'B. Managers / Signatories', 'C. Shareholders', 'D. Compliance and Risk', 'E. Key Communication Person', 'F. Required Documents', 'G. Client Declaration', 'H. Internal Review'].map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </label> : <div />}
            {finalKycDecision === 'AMENDMENT_REQUIRED' ? <label className="text-sm font-medium text-slate-700">Amendment reason *
              <textarea rows={4} value={amendmentReason} onChange={(event) => setAmendmentReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label> : <div />}
            <button type="button" onClick={submitFinalKycDecision} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Confirm decision</button>
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                Documents Required for KYC Preparation
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{kycCase.legalDocuments.length}</span>
              </h2>
              {canUploadDocuments ? (
                <Link
                  to={`/kyc/${kycCase.id}/documents`}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Link>
              ) : null}
            </div>
            {documentError ? <p role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{documentError}</p> : null}
            {legalDocumentGroups.length ? (
              <ul className="divide-y divide-slate-100">
                {legalDocumentGroups.map((group) => {
                  const downloadableCount = group.items.filter((document) => document.storagePath).length;
                  return (
                    <li key={group.documentType} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-950">
                          <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 break-words">{group.documentType}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{group.items.length}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => saveDocumentGroup(group.documentType, group.items)}
                          disabled={!downloadableCount}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadableCount > 1 ? 'Download ZIP' : 'Download'}
                        </button>
                      </div>
                      <ul className="mt-2 space-y-1.5 pl-6">
                        {group.items.map((document) => (
                          <li key={document.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-1.5">
                            <div className="min-w-0">
                              {(() => {
                                // QID / passport copies show whose they are (people added on the enquiry's Attachments step).
                                const owner = personOfFile(kycCase.sourceEnquiry?.details, document.fileName);
                                return owner ? (
                                  <>
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-slate-900">
                                      <span className="inline-flex items-center gap-1.5"><UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />{owner.name}</span>
                                      {owner.kind ? <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">{owner.kind}</span> : null}
                                    </p>
                                    <p className="break-all text-xs text-slate-500">{document.fileName}</p>
                                  </>
                                ) : <p className="break-all text-sm text-slate-900">{document.fileName}</p>;
                              })()}
                              {document.storagePath ? null : <p className="text-xs text-amber-700">Metadata only</p>}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDocument(document)}
                                disabled={!document.storagePath}
                                title="View document"
                                aria-label={`View ${document.fileName}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => saveDocument(document)}
                                disabled={!document.storagePath}
                                title="Download document"
                                aria-label={`Download ${document.fileName}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              {canUploadDocuments ? (
                                <label
                                  title={document.storagePath ? 'Upload more files' : 'Upload missing file'}
                                  aria-label={`Upload files for ${document.fileName}`}
                                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-60"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">No documents required for KYC preparation uploaded yet.</p>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-20">
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950"><Clock aria-hidden="true" className="h-4 w-4 text-slate-400" />Timeline</h2>
            </div>
            <ol className="space-y-4 p-5">
              {kycCase.statusHistory.map((item, index) => (
                <li key={item.id} className="relative pl-5">
                  <span aria-hidden="true" className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-brand-600' : 'bg-slate-300'}`} />
                  {index < kycCase.statusHistory.length - 1 ? <span aria-hidden="true" className="absolute bottom-[-1rem] left-[4px] top-4 w-px bg-slate-200" /> : null}
                  <p className="text-sm font-medium text-slate-950">{kycStatusLabel(item.toStatus)}</p>
                  <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                  {item.note ? <p className="mt-1 text-sm text-slate-600">{workflowNoteLabel(item.note)}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950"><MessageSquare aria-hidden="true" className="h-4 w-4 text-slate-400" />Comments</h2>
            </div>
            <form onSubmit={submitComment} className="space-y-3 border-b border-slate-200 p-5">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                placeholder="Add a comment"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button disabled={!comment.trim()} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <MessageSquare className="h-4 w-4" />
                Add Comment
              </button>
            </form>
            <div className="space-y-3 p-5">
              {(kycCase.reviewFeedback || reviewFeedback).map((item) => (
                <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{item.stage === 'SUPERVISOR' ? 'AML Supervisor' : item.stage}{['RETURN_TO_SUPERVISOR', 'RETURN_TO_DMLRO', 'REQUEST_ADDITIONAL_INFORMATION'].includes(item.decision) ? ' - Return feedback' : ' - Review feedback'}</p>
                  {item.reason ? <div className="mt-2"><p className="text-xs font-semibold text-slate-600">Reason</p><div className="review-rich-text break-words text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: safeCommentHtml(item.reason) }} /></div> : null}
                  {item.comments && item.comments !== item.reason ? <div className="review-rich-text mt-2 break-words text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: safeCommentHtml(item.comments) }} /> : null}
                  {item.conditions && item.conditions !== item.reason && item.conditions !== item.comments ? <div className="mt-2"><p className="text-xs font-semibold text-slate-600">Conditions</p><div className="review-rich-text break-words text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: safeCommentHtml(item.conditions) }} /></div> : null}
                  <p className="mt-2 text-xs text-slate-500">{item.author ? `${item.author.firstName} ${item.author.lastName}` : item.stage} | {formatDate(item.submittedAt)}</p>
                </div>
              ))}
              {kycCase.comments.map((item) => (
                <div key={item.id} className="rounded-md bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">{item.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.author ? `${item.author.firstName} ${item.author.lastName}` : 'System'} | {formatDate(item.createdAt)}
                  </p>
                </div>
              ))}
              {!(kycCase.reviewFeedback || reviewFeedback).length && !kycCase.comments.length ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
            </div>
          </section>
        </aside>
      </div>

      {returnDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReturnDialogOpen(false); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-bd-title"
            onKeyDown={(event) => { if (event.key === 'Escape') setReturnDialogOpen(false); }}
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Undo2 className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h2 id="return-bd-title" className="text-base font-semibold text-slate-950">Return this case to BD?</h2>
                <p className="mt-1 text-sm text-slate-600">The case goes back to Business Development to be corrected. Say what they need to fix.</p>
              </div>
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-800">
              Reason for BD <span className="text-red-600">*</span>
              <textarea
                autoFocus
                value={returnToBdReason}
                onChange={(event) => setReturnToBdReason(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="Describe the information or documents BD must correct."
              />
            </label>
            {workflowActionError ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{workflowActionError}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setReturnDialogOpen(false)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={returnToBusinessDevelopment} disabled={!returnToBdReason.trim()} className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" />
                Return to BD
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
