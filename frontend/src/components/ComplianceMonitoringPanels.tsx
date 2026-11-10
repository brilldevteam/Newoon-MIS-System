import { FileText, Plus } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { MultiFileUploadControl } from './MultiFileUploadControl';
import { useToast } from './ToastProvider';
import { getApiErrorMessage } from '../services/api';
import { CddType, cddLabels, ClientRiskLevel, riskLabels, viewClientDocument } from '../services/compliance-clients.service';
import {
  cancelClientReview,
  cancelClientRiskChange,
  ClientExpiryRecord,
  ClientMonitoring,
  completeClientReview,
  createClientScreening,
  decideClientRiskChange,
  ExpiryDocumentType,
  ExpiryPayload,
  expiryTypeLabels,
  requestClientRiskChange,
  ReviewOutcome,
  reviewOutcomeLabels,
  RiskReason,
  riskReasonLabels,
  saveClientExpiryItem,
  ScreeningResult,
  screeningListLabels,
  screeningLists,
  screeningResultLabels,
  startClientReview
} from '../services/compliance-monitoring.service';

const inputClass = 'w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
const labelClass = 'block text-sm font-medium text-slate-700';
const primaryButton = 'rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60';
const secondaryButton = 'rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60';

export const screeningTone: Record<ScreeningResult, string> = {
  CLEAR: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
  ALERT: 'bg-rose-50 text-rose-700 ring-rose-200',
  PENDING: 'bg-slate-100 text-slate-600 ring-slate-200'
};
const riskTone: Record<string, string> = {
  HIGH: 'bg-rose-50 text-rose-700 ring-rose-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-200',
  LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-200'
};
const expiryTone: Record<string, { label: string; className: string }> = {
  EXPIRED: { label: 'Expired', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  DUE_30: { label: 'Within 30 days', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  DUE_60: { label: 'Within 60 days', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  DUE_90: { label: 'Within 90 days', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  VALID: { label: 'Valid', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
};

const today = () => new Date().toISOString().slice(0, 10);
const person = (user: { firstName: string; lastName: string } | null) => (user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown user');

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>{children}</span>;
}

function Card({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">{children}</p>;
}

type PanelProps = { clientId: string; data: ClientMonitoring; canEdit: boolean; onChange: (next: ClientMonitoring) => void };

function useAction() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  async function run<T>(action: () => Promise<T>, success: string, failure: string) {
    setBusy(true);
    try {
      const result = await action();
      showToast(success, 'success');
      return result;
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, failure), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

// ---------------- Screening ----------------

export function ScreeningPanel({ clientId, data, canEdit, onChange }: PanelProps) {
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const openReview = data.reviews.find((review) => review.status === 'IN_PROGRESS');

  return (
    <Card
      title="Ongoing screening"
      description="Sanctions, PEP and adverse-media screening after onboarding. A Review or Alert result notifies the compliance team."
      action={canEdit && !adding ? <button type="button" onClick={() => setAdding(true)} className={`${primaryButton} inline-flex items-center gap-1.5`}><Plus className="h-4 w-4" />Record screening</button> : undefined}
    >
      {adding ? <ScreeningForm clientId={clientId} reviewId={openReview?.id} onCancel={() => setAdding(false)} onSaved={(next) => { onChange(next); setAdding(false); }} /> : null}
      {data.screenings.length ? (
        <ul className="divide-y divide-slate-100">
          {data.screenings.map((screening) => (
            <li key={screening.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={screeningTone[screening.result]}>{screeningResultLabels[screening.result]}</Badge>
                <span className="text-sm font-medium text-slate-900">{formatDate(screening.screenedAt)}</span>
                <span className="text-xs text-slate-500">by {person(screening.performedBy)}</span>
                {screening.reviewId ? <span className="text-xs text-brand-700">Part of a periodic review</span> : null}
              </div>
              {screening.listsChecked.length ? <p className="mt-1 text-xs text-slate-500">Lists: {screening.listsChecked.map((list) => screeningListLabels[list] || list).join(', ')}</p> : null}
              {screening.scope ? <p className="mt-1 text-xs text-slate-500">Screened: {screening.scope}</p> : null}
              <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-700">{screening.summary}</p>
              {screening.documents.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {screening.documents.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => viewClientDocument(clientId, document).catch((requestError) => showToast(getApiErrorMessage(requestError, 'Unable to open this document.'), 'error'))}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{document.fileName}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !adding ? (
        <Empty>No ongoing screening recorded yet.</Empty>
      ) : null}
    </Card>
  );
}

function ScreeningForm({ clientId, reviewId, onCancel, onSaved }: { clientId: string; reviewId?: string; onCancel: () => void; onSaved: (next: ClientMonitoring) => void }) {
  const { busy, run } = useAction();
  const [form, setForm] = useState({ screenedAt: today(), result: 'CLEAR' as ScreeningResult, scope: '', summary: '', lists: ['UN', 'OFAC', 'EU', 'NCTC'] as string[], linkReview: Boolean(reviewId) });
  const [files, setFiles] = useState<File[]>([]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = await run(
      () => createClientScreening(clientId, { screenedAt: form.screenedAt, result: form.result, summary: form.summary, scope: form.scope, listsChecked: form.lists, reviewId: form.linkReview ? reviewId : undefined, files }),
      'Screening recorded.',
      'Unable to record the screening.'
    );
    if (next) onSaved(next);
  }

  return (
    <form onSubmit={submit} className="mb-5 space-y-4 rounded-md bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Screening date
          <input type="date" required max={today()} value={form.screenedAt} onChange={(event) => setForm({ ...form, screenedAt: event.target.value })} className={`${inputClass} mt-1`} />
        </label>
        <label className={labelClass}>
          Result
          <select value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value as ScreeningResult })} className={`${inputClass} mt-1`}>
            {(Object.keys(screeningResultLabels) as ScreeningResult[]).map((key) => <option key={key} value={key}>{screeningResultLabels[key]}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Who was screened
          <input maxLength={500} placeholder="Company, directors, shareholders, UBOs" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} className={`${inputClass} mt-1`} />
        </label>
      </div>
      <fieldset>
        <legend className={labelClass}>Lists checked</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {screeningLists.map((list) => {
            const checked = form.lists.includes(list);
            return (
              <label key={list} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${checked ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => setForm({ ...form, lists: checked ? form.lists.filter((item) => item !== list) : [...form.lists, list] })} />
                {screeningListLabels[list]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <label className={labelClass}>
        Summary
        <textarea required rows={3} maxLength={4000} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} className={`${inputClass} mt-1`} placeholder="What was found and how possible matches were resolved" />
      </label>
      {reviewId ? (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.linkReview} onChange={(event) => setForm({ ...form, linkReview: event.target.checked })} />
          Part of the periodic review in progress
        </label>
      ) : null}
      <div>
        <span className={labelClass}>Evidence (optional)</span>
        <div className="mt-1">
          <MultiFileUploadControl names={files.map((file) => file.name)} disabled={busy} buttonLabel="Choose files" onSelect={setFiles} onRemoveName={(index) => setFiles((current) => current.filter((_, position) => position !== index))} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>
        <button type="submit" disabled={busy || !form.summary.trim()} className={primaryButton}>{busy ? 'Saving...' : 'Save screening'}</button>
      </div>
    </form>
  );
}

// ---------------- Reviews and risk ----------------

const riskOptions: ClientRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
const cddOptions: CddType[] = ['SIMPLIFIED', 'REGULAR', 'ENHANCED'];

type RiskFields = { proposedRisk: ClientRiskLevel | ''; proposedCdd: CddType | ''; reasonCategory: RiskReason | ''; explanation: string };

function RiskChangeFields({ value, onChange }: { value: RiskFields; onChange: (next: RiskFields) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className={labelClass}>
        Proposed risk
        <select required value={value.proposedRisk} onChange={(event) => onChange({ ...value, proposedRisk: event.target.value as ClientRiskLevel })} className={`${inputClass} mt-1`}>
          <option value="">Choose…</option>
          {riskOptions.map((risk) => <option key={risk} value={risk}>{riskLabels[risk]}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Proposed CDD (optional)
        <select value={value.proposedCdd} onChange={(event) => onChange({ ...value, proposedCdd: event.target.value as CddType })} className={`${inputClass} mt-1`}>
          <option value="">Keep current</option>
          {cddOptions.map((cdd) => <option key={cdd} value={cdd}>{cddLabels[cdd]}</option>)}
        </select>
      </label>
      <label className={labelClass}>
        Reason
        <select required value={value.reasonCategory} onChange={(event) => onChange({ ...value, reasonCategory: event.target.value as RiskReason })} className={`${inputClass} mt-1`}>
          <option value="">Choose…</option>
          {(Object.keys(riskReasonLabels) as RiskReason[]).map((reason) => <option key={reason} value={reason}>{riskReasonLabels[reason]}</option>)}
        </select>
      </label>
      <label className={`${labelClass} sm:col-span-3`}>
        Explanation
        <textarea required rows={3} maxLength={4000} value={value.explanation} onChange={(event) => onChange({ ...value, explanation: event.target.value })} className={`${inputClass} mt-1`} />
      </label>
    </div>
  );
}

const emptyRisk: RiskFields = { proposedRisk: '', proposedCdd: '', reasonCategory: '', explanation: '' };

export function ReviewsPanel({ clientId, data, canEdit, onChange, clientStatus, currentUserId }: PanelProps & { clientStatus: string; currentUserId?: string }) {
  const { busy, run } = useAction();
  const [requesting, setRequesting] = useState(false);
  const [riskForm, setRiskForm] = useState<RiskFields>(emptyRisk);
  const openReview = data.reviews.find((review) => review.status === 'IN_PROGRESS');
  const pending = data.riskChanges.find((change) => change.status === 'PENDING');

  async function submitRiskChange(event: FormEvent) {
    event.preventDefault();
    if (!riskForm.proposedRisk || !riskForm.reasonCategory) return;
    const next = await run(
      () => requestClientRiskChange(clientId, { proposedRisk: riskForm.proposedRisk as ClientRiskLevel, proposedCdd: riskForm.proposedCdd || undefined, reasonCategory: riskForm.reasonCategory as RiskReason, explanation: riskForm.explanation }),
      'Risk change sent for DMLRO/MLRO approval.',
      'Unable to request the risk change.'
    );
    if (next) {
      onChange(next);
      setRequesting(false);
      setRiskForm(emptyRisk);
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="Periodic review"
        description="Start a review, record a screening during it, then complete it. Completing resets the last and next review dates."
        action={canEdit && !openReview && clientStatus === 'ACTIVE' ? (
          <button type="button" disabled={busy} onClick={async () => { const next = await run(() => startClientReview(clientId), 'Review started.', 'Unable to start the review.'); if (next) onChange(next); }} className={primaryButton}>
            Start review
          </button>
        ) : undefined}
      >
        {openReview ? <OpenReview clientId={clientId} data={data} canEdit={canEdit} onChange={onChange} /> : null}
        {data.reviews.filter((review) => review.status !== 'IN_PROGRESS').length ? (
          <ul className="divide-y divide-slate-100">
            {data.reviews.filter((review) => review.status !== 'IN_PROGRESS').map((review) => (
              <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">{formatDate(review.completedAt)}</span>
                  <Badge className={review.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}>
                    {review.status === 'COMPLETED' ? reviewOutcomeLabels[review.outcome || 'NO_CHANGE'] : 'Cancelled'}
                  </Badge>
                  <span className="text-xs text-slate-500">by {person(review.completedBy)} · due {formatDate(review.dueDate)} · {review._count.screenings} linked screening(s)</span>
                </div>
                {review.findings ? <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-600">{review.findings}</p> : null}
              </li>
            ))}
          </ul>
        ) : !openReview ? (
          <Empty>{clientStatus === 'ACTIVE' ? 'No periodic reviews yet.' : 'Periodic reviews are for active clients.'}</Empty>
        ) : null}
      </Card>

      <Card
        title="Risk changes"
        description="Risk and CDD changes after onboarding. A change applies only after a different DMLRO or MLRO approves it."
        action={canEdit && !pending && !requesting ? <button type="button" onClick={() => setRequesting(true)} className={secondaryButton}>Request risk change</button> : undefined}
      >
        {requesting ? (
          <form onSubmit={submitRiskChange} className="mb-5 space-y-4 rounded-md bg-slate-50 p-4">
            <RiskChangeFields value={riskForm} onChange={setRiskForm} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRequesting(false)} className={secondaryButton}>Cancel</button>
              <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Sending...' : 'Send for approval'}</button>
            </div>
          </form>
        ) : null}
        {data.riskChanges.length ? (
          <ul className="divide-y divide-slate-100">
            {data.riskChanges.map((change) => (
              <RiskChangeItem key={change.id} clientId={clientId} change={change} canDecide={data.canDecideRisk} canEdit={canEdit} currentUserId={currentUserId} onChange={onChange} />
            ))}
          </ul>
        ) : !requesting ? (
          <Empty>No risk changes requested.</Empty>
        ) : null}
      </Card>
    </div>
  );
}

function OpenReview({ clientId, data, canEdit, onChange }: PanelProps) {
  const { busy, run } = useAction();
  const review = data.reviews.find((item) => item.status === 'IN_PROGRESS')!;
  const [outcome, setOutcome] = useState<ReviewOutcome>('NO_CHANGE');
  const [findings, setFindings] = useState('');
  const [riskForm, setRiskForm] = useState<RiskFields>(emptyRisk);
  const screenedSinceStart = data.screenings.some((screening) => screening.reviewId === review.id || new Date(screening.createdAt) >= new Date(review.startedAt));
  const pendingExists = data.riskChanges.some((change) => change.status === 'PENDING');

  async function complete(event: FormEvent) {
    event.preventDefault();
    const next = await run(
      () => completeClientReview(clientId, review.id, {
        outcome,
        findings,
        ...(outcome === 'RISK_CHANGE_REQUESTED'
          ? { proposedRisk: riskForm.proposedRisk as ClientRiskLevel, proposedCdd: riskForm.proposedCdd || undefined, reasonCategory: riskForm.reasonCategory as RiskReason, explanation: riskForm.explanation }
          : {})
      }),
      'Review completed.',
      'Unable to complete the review.'
    );
    if (next) onChange(next);
  }

  async function cancel() {
    const reason = window.prompt('Why is this review being cancelled?');
    if (!reason?.trim()) return;
    const next = await run(() => cancelClientReview(clientId, review.id, reason), 'Review cancelled.', 'Unable to cancel the review.');
    if (next) onChange(next);
  }

  return (
    <div className="mb-5 rounded-md border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Review in progress</p>
        <p className="text-xs text-slate-500">Started {formatDate(review.startedAt)} by {person(review.startedBy)} · due {formatDate(review.dueDate)}</p>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        <li className={screenedSinceStart ? 'text-emerald-700' : 'text-amber-700'}>
          {screenedSinceStart ? '✓ Screening recorded during this review' : '• Record a screening on the Screening tab before completing'}
        </li>
      </ul>
      {canEdit ? (
        <form onSubmit={complete} className="mt-4 space-y-4">
          <fieldset>
            <legend className={labelClass}>Outcome</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
              {(Object.keys(reviewOutcomeLabels) as ReviewOutcome[]).map((key) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input type="radio" name="review-outcome" value={key} checked={outcome === key} disabled={key === 'RISK_CHANGE_REQUESTED' && pendingExists} onChange={() => setOutcome(key)} />
                  {reviewOutcomeLabels[key]}
                </label>
              ))}
            </div>
            {pendingExists ? <p className="mt-1 text-xs text-slate-500">A risk change is already awaiting approval.</p> : null}
          </fieldset>
          {outcome === 'RISK_CHANGE_REQUESTED' ? <RiskChangeFields value={riskForm} onChange={setRiskForm} /> : null}
          <label className={labelClass}>
            Findings
            <textarea required rows={4} maxLength={6000} value={findings} onChange={(event) => setFindings(event.target.value)} className={`${inputClass} mt-1`} placeholder="Changes in ownership, activity, screening results, documents reviewed" />
          </label>
          {outcome === 'EXIT_RECOMMENDED' ? <p className="text-xs text-slate-500">Completing records the recommendation. Mark the client inactive from the register once the exit is agreed.</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancel} disabled={busy} className={secondaryButton}>Cancel review</button>
            <button type="submit" disabled={busy || !screenedSinceStart || !findings.trim()} className={primaryButton}>{busy ? 'Saving...' : 'Complete review'}</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function RiskChangeItem({ clientId, change, canDecide, canEdit, currentUserId, onChange }: { clientId: string; change: ClientMonitoring['riskChanges'][number]; canDecide: boolean; canEdit: boolean; currentUserId?: string; onChange: (next: ClientMonitoring) => void }) {
  const { busy, run } = useAction();
  const [note, setNote] = useState('');
  const ownRequest = change.requestedById === currentUserId;
  const statusTone: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
    CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200'
  };

  async function decide(decision: 'APPROVE' | 'REJECT') {
    const next = await run(() => decideClientRiskChange(clientId, change.id, { decision, note }), decision === 'APPROVE' ? 'Risk change approved.' : 'Risk change rejected.', 'Unable to record the decision.');
    if (next) onChange(next);
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge className={statusTone[change.status]}>{change.status.charAt(0) + change.status.slice(1).toLowerCase()}</Badge>
        <span className="text-slate-500">{change.previousRisk ? riskLabels[change.previousRisk] : 'Not rated'} →</span>
        <Badge className={riskTone[change.proposedRisk]}>{riskLabels[change.proposedRisk]}</Badge>
        {change.proposedCdd ? <span className="text-xs text-slate-500">CDD {change.previousCdd ? cddLabels[change.previousCdd] : 'not set'} → {cddLabels[change.proposedCdd]}</span> : null}
        <span className="text-xs text-slate-500">{riskReasonLabels[change.reasonCategory]}</span>
      </div>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700">{change.explanation}</p>
      <p className="mt-1 text-xs text-slate-400">
        Requested by {person(change.requestedBy)} on {formatDate(change.createdAt)}{change.review ? ' during a periodic review' : ''}
        {change.decidedAt ? ` · ${change.status.toLowerCase()} by ${person(change.decidedBy)} on ${formatDate(change.decidedAt)}` : ''}
      </p>
      {change.decisionNote ? <p className="mt-1 text-xs text-slate-600">Decision note: {change.decisionNote}</p> : null}
      {change.status === 'PENDING' ? (
        <div className="mt-3 space-y-2">
          {canDecide && !ownRequest ? (
            <>
              <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Decision note (required to reject)" className={inputClass} aria-label="Decision note" />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => decide('APPROVE')} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                <button type="button" disabled={busy || !note.trim()} onClick={() => decide('REJECT')} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">Reject</button>
              </div>
            </>
          ) : canDecide && ownRequest ? (
            <p className="text-xs text-slate-500">You requested this change, so another DMLRO or MLRO must decide it.</p>
          ) : (
            <p className="text-xs text-slate-500">Awaiting DMLRO / MLRO approval.</p>
          )}
          {canEdit && (ownRequest || canDecide) ? (
            <button type="button" disabled={busy} onClick={async () => { const next = await run(() => cancelClientRiskChange(clientId, change.id), 'Risk change withdrawn.', 'Unable to withdraw the risk change.'); if (next) onChange(next); }} className="text-xs font-medium text-slate-500 hover:text-slate-700">
              Withdraw request
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// ---------------- Expiry tracking ----------------

const emptyExpiry: ExpiryPayload = { documentType: 'PASSPORT', documentLabel: '', holderName: '', holderRole: '', documentNumber: '', expiryDate: '', notes: '' };

export function ExpiryPanel({ clientId, data, canEdit, onChange, holderSuggestions }: PanelProps & { holderSuggestions: Array<{ name: string; role: string }> }) {
  const { busy, run } = useAction();
  const [editing, setEditing] = useState<{ id?: string; value: ExpiryPayload } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const items = data.expiryItems.filter((item) => showArchived || item.isActive);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const next = await run(() => saveClientExpiryItem(clientId, editing.value, editing.id), 'Expiry record saved.', 'Unable to save the expiry record.');
    if (next) {
      onChange(next);
      setEditing(null);
    }
  }

  async function setActive(item: ClientExpiryRecord, isActive: boolean) {
    const next = await run(() => saveClientExpiryItem(clientId, toPayload(item, isActive), item.id), isActive ? 'Expiry record restored.' : 'Expiry record archived.', 'Unable to update the expiry record.');
    if (next) onChange(next);
  }

  return (
    <Card
      title="Expiry tracking"
      description="Passports, QIDs and company documents with expiry dates. Reminders go out at 90, 60 and 30 days and on expiry."
      action={canEdit && !editing ? <button type="button" onClick={() => setEditing({ value: { ...emptyExpiry } })} className={`${primaryButton} inline-flex items-center gap-1.5`}><Plus className="h-4 w-4" />Add document</button> : undefined}
    >
      {editing ? (
        <form onSubmit={save} className="mb-5 grid gap-4 rounded-md bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={labelClass}>
            Document
            <select value={editing.value.documentType} onChange={(event) => setEditing({ ...editing, value: { ...editing.value, documentType: event.target.value as ExpiryDocumentType } })} className={`${inputClass} mt-1`}>
              {(Object.keys(expiryTypeLabels) as ExpiryDocumentType[]).map((key) => <option key={key} value={key}>{expiryTypeLabels[key]}</option>)}
            </select>
          </label>
          {editing.value.documentType === 'OTHER' ? (
            <label className={labelClass}>
              Document name
              <input required maxLength={120} value={editing.value.documentLabel || ''} onChange={(event) => setEditing({ ...editing, value: { ...editing.value, documentLabel: event.target.value } })} className={`${inputClass} mt-1`} />
            </label>
          ) : null}
          <label className={labelClass}>
            Holder
            <input required list="expiry-holders" maxLength={200} value={editing.value.holderName} onChange={(event) => {
              const match = holderSuggestions.find((holder) => holder.name === event.target.value);
              setEditing({ ...editing, value: { ...editing.value, holderName: event.target.value, holderRole: match && !editing.value.holderRole ? match.role : editing.value.holderRole } });
            }} className={`${inputClass} mt-1`} placeholder="Person or company" />
            <datalist id="expiry-holders">
              {holderSuggestions.map((holder) => <option key={`${holder.name}-${holder.role}`} value={holder.name}>{holder.role}</option>)}
            </datalist>
          </label>
          <label className={labelClass}>
            Role
            <input maxLength={80} value={editing.value.holderRole || ''} onChange={(event) => setEditing({ ...editing, value: { ...editing.value, holderRole: event.target.value } })} className={`${inputClass} mt-1`} placeholder="Director, Shareholder, UBO, Company…" />
          </label>
          <label className={labelClass}>
            Document number
            <input maxLength={80} value={editing.value.documentNumber || ''} onChange={(event) => setEditing({ ...editing, value: { ...editing.value, documentNumber: event.target.value } })} className={`${inputClass} mt-1`} />
          </label>
          <label className={labelClass}>
            Expiry date
            <input type="date" required value={editing.value.expiryDate} onChange={(event) => setEditing({ ...editing, value: { ...editing.value, expiryDate: event.target.value } })} className={`${inputClass} mt-1`} />
          </label>
          <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
            Notes
            <input maxLength={1000} value={editing.value.notes || ''} onChange={(event) => setEditing({ ...editing, value: { ...editing.value, notes: event.target.value } })} className={`${inputClass} mt-1`} />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
            <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>Cancel</button>
            <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : null}
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">Document</th>
                <th className="py-2 pr-4">Holder</th>
                <th className="py-2 pr-4">Number</th>
                <th className="py-2 pr-4">Expiry</th>
                <th className="py-2 pr-4">Status</th>
                {canEdit ? <th className="py-2 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className={item.isActive ? '' : 'opacity-60'}>
                  <td className="py-2 pr-4 text-slate-900">{item.documentType === 'OTHER' ? item.documentLabel : expiryTypeLabels[item.documentType]}</td>
                  <td className="py-2 pr-4">
                    <p className="text-slate-900">{item.holderName}</p>
                    {item.holderRole ? <p className="text-xs text-slate-500">{item.holderRole}</p> : null}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{item.documentNumber || '—'}</td>
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-600">{formatDate(item.expiryDate)}</td>
                  <td className="py-2 pr-4">{item.isActive ? <Badge className={expiryTone[item.expiryState].className}>{expiryTone[item.expiryState].label}</Badge> : <Badge className="bg-slate-100 text-slate-600 ring-slate-200">Archived</Badge>}</td>
                  {canEdit ? (
                    <td className="whitespace-nowrap py-2 text-right">
                      <button type="button" onClick={() => setEditing({ id: item.id, value: toPayload(item, item.isActive) })} className="text-xs font-medium text-brand-700 hover:text-brand-800">Edit</button>
                      <button type="button" disabled={busy} onClick={() => setActive(item, !item.isActive)} className="ml-3 text-xs font-medium text-slate-500 hover:text-slate-700">{item.isActive ? 'Archive' : 'Restore'}</button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !editing ? (
        <Empty>No expiry dates tracked yet. Add passports, QIDs and company documents to get reminders.</Empty>
      ) : null}
      {data.expiryItems.some((item) => !item.isActive) ? (
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          Show archived (replaced) documents
        </label>
      ) : null}
    </Card>
  );
}

function toPayload(item: ClientExpiryRecord, isActive: boolean): ExpiryPayload {
  return {
    documentType: item.documentType,
    documentLabel: item.documentLabel || '',
    holderName: item.holderName,
    holderRole: item.holderRole || '',
    documentNumber: item.documentNumber || '',
    expiryDate: item.expiryDate.slice(0, 10),
    notes: item.notes || '',
    isActive
  };
}
