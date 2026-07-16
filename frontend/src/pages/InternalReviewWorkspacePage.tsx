import { FileText, FileUp, MessageSquare, Save, Send } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../services/api';
import {
  addReviewerComment,
  decideMlroReview,
  getInternalReviewWorkspace,
  InternalReviewWorkspace,
  ReviewStage,
  saveInternalReviewDraft,
  startInternalReview,
  submitDmlroReview,
  submitSupervisorReview,
  uploadSignedKycDocumentFile
} from '../services/kyc-workflow.service';
import { allowedReviewStages, hasAnyRole, roleList, workflowRoles } from '../utils/access-control';
import { kycStatusLabel } from '../utils/kyc-status-labels';

const stages: Array<{ id: ReviewStage; title: string; submitLabel: string }> = [
  { id: 'DMLRO', title: 'DMLRO Review', submitLabel: 'Submit to MLRO' },
  { id: 'MLRO', title: 'MLRO Final Review', submitLabel: 'Submit MLRO Decision' }
];

const emptyForm = {
  reviewerName: '',
  reviewDate: '',
  recommendation: '',
  comments: '',
  conditions: '',
  finalRiskClassification: '',
  previousRiskClassification: '',
  riskReasonCategory: 'PROFESSIONAL_JUDGEMENT',
  riskExplanation: '',
  decision: 'APPROVE'
};

export function InternalReviewWorkspacePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<InternalReviewWorkspace | null>(null);
  const [activeStage, setActiveStage] = useState<ReviewStage>('DMLRO');
  const [forms, setForms] = useState<Record<ReviewStage, Record<string, string>>>({
    SUPERVISOR: { ...emptyForm },
    DMLRO: { ...emptyForm },
    MLRO: { ...emptyForm }
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [confidentialComment, setConfidentialComment] = useState('');
  const [signedFile, setSignedFile] = useState<File | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    if (!id) return;
    const next = await getInternalReviewWorkspace(id);
    setWorkspace(next);
    setForms((current) => {
      const merged = { ...current };
      for (const review of next.reviews) {
        merged[review.stage as ReviewStage] = { ...emptyForm, ...(review.data || {}), formalComments: review.formalComments || '' };
      }
      return merged;
    });
  }

  const activeForm = forms[activeStage];
  const submittedStages = useMemo(() => new Set(workspace?.reviews.filter((review) => review.isLocked).map((review) => review.stage) || []), [workspace]);
  const stageAccess = allowedReviewStages(user);
  const canUseActiveStage = stageAccess[activeStage];
  const canEdit = canUseActiveStage && !submittedStages.has(activeStage);
  const signedUploadStage = getSignedUploadStage(user, activeStage);
  const canUploadSignedDocuments = Boolean(signedUploadStage);
  const signedDocumentStageLabel = signedUploadStage === 'DMLRO_SIGNED_KYC' ? 'DMLRO signed KYC' : signedUploadStage === 'MLRO_SIGNED_KYC' ? 'MLRO signed KYC' : 'Final signed KYC';
  const signedStageSet = new Set(workspace?.signedDocuments?.filter((document: any) => document.activeVersion).map((document: any) => document.reviewStage) || []);

  function updateField(key: string, value: string) {
    setForms((current) => ({ ...current, [activeStage]: { ...current[activeStage], [key]: value } }));
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      setMessage(success);
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, 'Unable to complete this review action.'));
    }
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    await run(() => saveInternalReviewDraft(id, activeStage, { data: activeForm, formalComments: activeForm.comments }), 'Draft saved');
  }

  async function submitStage() {
    if (!id) return;
    if (activeStage === 'SUPERVISOR') {
      await run(() => submitSupervisorReview(id, { data: activeForm, formalComments: activeForm.comments }), 'Supervisor review submitted to DMLRO');
    } else if (activeStage === 'DMLRO') {
      await run(() => submitDmlroReview(id, { data: activeForm, formalComments: activeForm.comments }), 'DMLRO review submitted to MLRO');
    } else {
      await run(() => decideMlroReview(id, { ...activeForm, data: activeForm, formalComments: activeForm.comments }), 'MLRO decision submitted');
    }
  }

  async function submitComment(type: 'FORMAL' | 'CONFIDENTIAL') {
    if (!id) return;
    const body = type === 'FORMAL' ? comment : confidentialComment;
    if (!body.trim()) return;
    await run(
      () => addReviewerComment(id, activeStage, { type, body, visibilityScope: type === 'CONFIDENTIAL' ? 'SUPERVISOR_DMLRO_MLRO' : undefined }),
      `${type === 'FORMAL' ? 'Formal' : 'Confidential'} comment added`
    );
    setComment('');
    setConfidentialComment('');
  }

  async function submitSignedDocument() {
    if (!id || !signedFile) {
      setError('Choose a signed KYC document file first.');
      return;
    }
    if (!signedUploadStage) {
      setError('Your current login cannot upload a signed KYC document.');
      return;
    }
    await run(() => uploadSignedKycDocumentFile(id, { reviewStage: signedUploadStage, file: signedFile }), 'Signed KYC document uploaded');
    setSignedFile(null);
  }

  if (!workspace) return <p className="text-sm text-slate-500">Loading internal review workspace...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to={`/kyc/${workspace.kycCase.id}`} className="text-sm font-semibold text-brand-700">Back to case</Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Internal Review Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">{workspace.kycCase.title} | {kycStatusLabel(workspace.kycCase.status)}</p>
        </div>
        <Link
          to={`/kyc/${workspace.kycCase.id}/form`}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <FileText className="h-4 w-4" />
          Open KYC Part 1
        </Link>
      </div>

      {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-950">Approval Sequence</h2>
        <p className="mt-1 text-sm text-slate-500">Logged in as {roleList(user)}. DMLRO and MLRO update their own approval stage and signature details.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveStage(stage.id)}
              className={`rounded-md border p-3 text-left ${activeStage === stage.id ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <p className="text-sm font-semibold text-slate-950">{stage.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {submittedStages.has(stage.id) ? 'Submitted and locked' : stageAccess[stage.id] ? 'Available for this login' : 'View only for this login'}
              </p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">{stages.find((stage) => stage.id === activeStage)?.title}</h2>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => id && run(() => startInternalReview(id, activeStage), 'Review started')}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start review
            </button>
          </div>
          {!canUseActiveStage ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This stage is read-only for your current login. Use the assigned reviewer role or Company Admin to edit it.
            </p>
          ) : null}
          <form onSubmit={saveDraft} className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Reviewer name" value={activeForm.reviewerName} disabled={!canEdit} onChange={(value) => updateField('reviewerName', value)} />
            <Field label="Review date" type="date" value={activeForm.reviewDate} disabled={!canEdit} onChange={(value) => updateField('reviewDate', value)} />
            {activeStage === 'MLRO' ? (
              <>
                <Select label="Final decision" value={activeForm.decision} disabled={!canEdit} options={['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REQUEST_ADDITIONAL_INFORMATION', 'RETURN_TO_DMLRO']} onChange={(value) => updateField('decision', value)} />
                <Select label="Final risk classification" value={activeForm.finalRiskClassification} disabled={!canEdit} options={['', 'LOW', 'MEDIUM', 'HIGH']} onChange={(value) => updateField('finalRiskClassification', value)} />
                <Select label="Risk reason category" value={activeForm.riskReasonCategory} disabled={!canEdit} options={['PROFESSIONAL_JUDGEMENT', 'PEP_IDENTIFIED', 'SANCTIONS_FINDING', 'ADVERSE_MEDIA', 'OWNERSHIP_COMPLEXITY', 'COUNTRY_RISK', 'INDUSTRY_RISK', 'SOURCE_OF_FUNDS_CONCERN', 'ENHANCED_MONITORING_REQUIRED', 'OTHER']} onChange={(value) => updateField('riskReasonCategory', value)} />
                <Field label="Risk explanation" value={activeForm.riskExplanation} disabled={!canEdit} onChange={(value) => updateField('riskExplanation', value)} textarea />
              </>
            ) : null}
            <Field label="Recommendation / comments" value={activeForm.comments} disabled={!canEdit} onChange={(value) => updateField('comments', value)} textarea wide />
            <Field label="Conditions" value={activeForm.conditions} disabled={!canEdit} onChange={(value) => updateField('conditions', value)} textarea wide />
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button disabled={!canEdit} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save className="h-4 w-4" /> Save draft</button>
              <button type="button" disabled={!canEdit} onClick={submitStage} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><Send className="h-4 w-4" /> {stages.find((stage) => stage.id === activeStage)?.submitLabel}</button>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Activation Readiness</h2>
            <div className="mt-3 space-y-2">
              {workspace.activationChecklist.checklist.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <span className={item.completed ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{item.completed ? 'Done' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Signed KYC Document</h2>
            <p className="mt-1 text-xs text-slate-500">Current upload type: {signedDocumentStageLabel}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
              <label className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 ${canUploadSignedDocuments ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                <FileUp className="h-4 w-4" />
                Upload
                <input
                  disabled={!canUploadSignedDocuments}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                  onChange={(event) => {
                    setSignedFile(event.target.files?.[0] || null);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <div className="flex h-10 min-w-0 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                <span className="truncate">{signedFile?.name || 'No file selected'}</span>
              </div>
              <button
                disabled={!canUploadSignedDocuments}
                onClick={submitSignedDocument}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" /> Save
              </button>
            </div>
            {!canUploadSignedDocuments ? <p className="mt-2 text-xs text-slate-500">Signed document metadata is managed by DMLRO, MLRO, or admin roles.</p> : null}
            <div className="mt-4 grid gap-2">
              <SignedStageStatus label="DMLRO signed KYC" done={signedStageSet.has('DMLRO_SIGNED_KYC')} />
              <SignedStageStatus label="MLRO signed KYC" done={signedStageSet.has('MLRO_SIGNED_KYC')} />
            </div>
            {workspace.signedDocuments?.length ? (
              <div className="mt-4 space-y-2">
                {workspace.signedDocuments.map((document: any) => (
                  <div key={document.id} className="rounded-md border border-slate-200 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{document.fileName}</p>
                    <p className="text-xs text-slate-500">{document.reviewStage} | Version {document.documentVersion}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">Reviewer Comments</h2>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Formal comment" className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={() => submitComment('FORMAL')} className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><MessageSquare className="h-4 w-4" /> Add formal</button>
            <textarea value={confidentialComment} onChange={(event) => setConfidentialComment(event.target.value)} rows={2} placeholder="Confidential internal comment" className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={() => submitComment('CONFIDENTIAL')} className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><MessageSquare className="h-4 w-4" /> Add confidential</button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', textarea = false, disabled = false, wide = false }: { label: string; value?: string; onChange: (value: string) => void; type?: string; textarea?: boolean; disabled?: boolean; wide?: boolean }) {
  return (
    <label className={`text-sm font-medium text-slate-700 ${wide ? 'md:col-span-2' : ''}`}>
      {label}
      {textarea ? (
        <textarea disabled={disabled} rows={3} value={value || ''} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" />
      ) : (
        <input disabled={disabled} type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" />
      )}
    </label>
  );
}

function Select({ label, value, options, onChange, disabled = false }: { label: string; value?: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <select disabled={disabled} value={value || ''} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100">
        {options.map((option) => <option key={option} value={option}>{option || 'Select'}</option>)}
      </select>
    </label>
  );
}

function SignedStageStatus({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={done ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{done ? 'Done' : 'Pending'}</span>
    </div>
  );
}

function getSignedUploadStage(user: any, activeStage: ReviewStage) {
  if (hasAnyRole(user, ['DMLRO'])) return 'DMLRO_SIGNED_KYC';
  if (hasAnyRole(user, ['MLRO'])) return 'MLRO_SIGNED_KYC';
  if (hasAnyRole(user, ['COMPANY_ADMIN', 'SUPER_ADMIN'])) {
    if (activeStage === 'DMLRO') return 'DMLRO_SIGNED_KYC';
    if (activeStage === 'MLRO') return 'MLRO_SIGNED_KYC';
    return 'FINAL_SIGNED_KYC';
  }

  return null;
}
