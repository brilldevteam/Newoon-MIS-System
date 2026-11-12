import { AlertCircle, ArrowRight, CheckCircle2, Circle, Clock, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthUser } from '../services/auth.service';
import { KycCase, SubmissionReadiness } from '../services/kyc-workflow.service';
import { hasAnyRole } from '../utils/access-control';
import { kycNextStep, kycStatusOwner } from '../utils/kyc-status-labels';

// The case journey every role sees, with the current step highlighted and, for whoever holds the case,
// a plain-English to-do list that links to the page where each item is done.
const STAGES = ['KYC preparation', 'DMLRO review', 'MLRO / SEF approval', 'Final KYC', 'Convert to client', 'Client active'] as const;

const PREPARATION = ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUBMITTED_TO_AML', 'AML_REVIEW_STARTED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_REVIEW_IN_PROGRESS', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED', 'DMLRO_ADDITIONAL_INFORMATION_REQUIRED', 'MLRO_ADDITIONAL_INFORMATION_REQUIRED', 'FINAL_SIGNATURES_PENDING', 'FINAL_DOCUMENTS_PENDING'];
export const SUBMITTABLE_STATUSES = ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'];

// A full-KYC amendment draft is prepared by AML and submitted to DMLRO like a new file (same checklist).
export function isAmlAmendmentDraft(kycCase: Pick<KycCase, 'status' | 'kycForm'>) {
  return kycCase.status === 'AML_REVIEW_STARTED' && kycCase.kycForm?.fullKycStarted === true && kycCase.kycForm.status === 'AMENDMENT_DRAFT' && !kycCase.kycForm.isLocked;
}

export function canSubmitToDmlro(kycCase: Pick<KycCase, 'status' | 'kycForm'>) {
  return SUBMITTABLE_STATUSES.includes(kycCase.status) || isAmlAmendmentDraft(kycCase);
}
const DMLRO = ['SUPERVISOR_REVIEW_COMPLETED', 'DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'];
const MLRO = ['DMLRO_REVIEW_COMPLETED', 'MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS'];
const SEF = ['SEF_DECISION_PENDING', 'SEF_DECISION_IN_PROGRESS'];
const FINAL = ['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'SEF_APPROVED'];
const ACTIVATION = ['KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ON_HOLD'];
const STOPPED: Record<string, string> = {
  MLRO_REJECTED: 'MLRO rejected this KYC. The case is closed.',
  SEF_REJECTED: 'SEF rejected this KYC. The case is closed.',
  CLIENT_REJECTED: 'Operations rejected the engagement. The case is closed.'
};
const ADMIN = ['SUPER_ADMIN', 'COMPANY_ADMIN'];

export function kycStageIndex(status: string) {
  if (PREPARATION.includes(status)) return 0;
  if (DMLRO.includes(status)) return 1;
  if (MLRO.includes(status) || SEF.includes(status)) return 2;
  if (FINAL.includes(status)) return 3;
  if (ACTIVATION.includes(status)) return 4;
  if (status === 'CLIENT_ACTIVE') return 5;
  return -1;
}

type Action = { label: string; to?: string; onClick?: () => void };
type Props = {
  kycCase: KycCase;
  user: AuthUser | null;
  readiness: SubmissionReadiness | null;
  readinessError: string;
  isPreliminary: boolean;
  onJump: (sectionId: string) => void;
};

export function KycCaseGuide({ kycCase, user, readiness, readinessError, isPreliminary, onJump }: Props) {
  const status = kycCase.status;
  const stage = kycStageIndex(status);
  const caseUrl = `/kyc/${kycCase.id}`;
  const stopped = STOPPED[status];

  return (
    <section aria-label="Case progress" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs font-semibold">
        {STAGES.map((name, index) => {
          const done = stage > index || status === 'CLIENT_ACTIVE';
          const current = stage === index && status !== 'CLIENT_ACTIVE';
          return (
            <li key={name} className="flex items-center gap-1">
              <span
                aria-current={current ? 'step' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${done ? 'bg-emerald-50 text-emerald-700' : current ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="tabular-nums">{index + 1}</span>}
                {name}
              </span>
              {index < STAGES.length - 1 ? <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" /> : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-4">{stopped ? <Notice tone="stop" text={stopped} /> : <NextStep />}</div>
    </section>
  );

  function NextStep() {
    const owner = kycStatusOwner(status);

    if (status === 'CLIENT_ACTIVE') {
      return <Notice tone="done" text="All done. The client is active, and ongoing checks continue under Compliance → Compliance Clients." />;
    }

    if (stage === 0) {
      if (!hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR', ...ADMIN])) return <Waiting owner={owner || 'AML Team'} text={kycNextStep(status)} />;
      if (!canSubmitToDmlro(kycCase)) return <Todo title="Your next step" intro={kycNextStep(status) || 'Complete the KYC preparation.'} action={{ label: 'Open KYC Form', to: `${caseUrl}/form` }} />;
      return <PreparationChecklist />;
    }

    if (stage === 1) {
      if (hasAnyRole(user, ['MLRO']) && !hasAnyRole(user, ['DMLRO', ...ADMIN])) {
        return <Todo title="Waiting for DMLRO - you can decide it as MLRO" intro="This case is waiting for the DMLRO review. If DMLRO is not available (for example on leave), you can decide it yourself: open the review, complete your part of Section H, explain in your comments, and submit. The DMLRO task is then closed." action={{ label: 'Decide as MLRO', to: `${caseUrl}/form?section=sectionH` }} />;
      }
      if (!hasAnyRole(user, ['DMLRO', ...ADMIN])) return <Waiting owner="DMLRO" text={kycNextStep(status)} />;
      return <Todo title="Your next step (DMLRO)" steps={['Check the KYC form, Screening and CRRF using the Review Package tabs.', 'In Section H, enter your name, date, signature, risk classification and comments.', 'Choose the decision: send to MLRO, or return to AML with the reason, then press Submit.']} action={{ label: 'Open DMLRO review', to: `${caseUrl}/form` }} />;
    }

    if (stage === 2) {
      if (SEF.includes(status)) {
        if (!hasAnyRole(user, ['SEF', ...ADMIN])) return <Waiting owner="SEF" text={kycNextStep(status)} />;
        return <Todo title="Your next step (SEF)" steps={['Review the KYC, Screening and CRRF.', 'In Section H, enter your name, date, signature, decision and comments, then press Submit.']} action={{ label: 'Open SEF review', to: `${caseUrl}/form` }} />;
      }
      if (!hasAnyRole(user, ['MLRO', ...ADMIN])) return <Waiting owner="MLRO" text={kycNextStep(status)} />;
      return <Todo title="Your next step (MLRO)" steps={['Review the KYC, Screening, CRRF and the DMLRO comments.', 'In Section H, enter your name, date, signature, final risk classification and comments.', 'Choose the decision: approve, send to SEF (required for High risk), or return to DMLRO, then press Submit.']} action={{ label: 'Open MLRO review', to: `${caseUrl}/form` }} />;
    }

    if (stage === 3) {
      const roles = status === 'SEF_APPROVED' ? ['SEF', 'AML_SUPERVISOR', 'DMLRO', 'MLRO'] : ['AML_SUPERVISOR', 'DMLRO', 'MLRO', ...(isPreliminary ? ['AML_TEAM'] : [])];
      if (!hasAnyRole(user, [...roles, ...ADMIN])) return <Waiting owner={owner || 'AML Supervisor / MLRO'} text={kycNextStep(status)} />;
      return <Todo title="Your next step" intro={`The KYC is approved. Confirm it as the final KYC in "Final KYC Decision" below. Choose "${isPreliminary ? 'Use Preliminary KYC as final' : 'Use approved KYC as final'}", or open an amendment if something must change. Operations is then told to convert it to a client.`} action={{ label: 'Go to Final KYC Decision', onClick: () => onJump('final-kyc-decision') }} />;
    }

    if (stage === 4) {
      if (!hasAnyRole(user, ['OPERATING_TEAM', ...ADMIN])) return <Waiting owner="Operations" text={kycNextStep(status)} />;
      const hasLetter = kycCase.legalDocuments.some((document) => document.documentType === 'Signed Engagement Letter' && document.storagePath);
      if (status === 'CLIENT_ON_HOLD') {
        return <Todo title="This engagement is on hold - to resume it (Operations)" steps={['Read why it was put on hold in the Timeline.', 'Upload the new signed engagement letter (PDF or Word). The earlier letter stays on file.', 'Choose "Convert to client and activate" and press Submit decision. The client then gets its client code and appears in Compliance Clients.']} action={{ label: 'Go to Client Activation', onClick: () => onJump('client-activation') }} />;
      }
      return <Todo title="Your next step (Operations)" steps={[`${hasLetter ? 'Done: the signed engagement letter is uploaded.' : 'Upload the signed engagement letter (PDF or Word).'}`, 'Choose "Convert to client and activate" (or reject / put on hold with a reason).', 'Press Submit decision. The client then appears in Compliance Clients with its client code.']} action={{ label: 'Go to Client Activation', onClick: () => onJump('client-activation') }} />;
    }

    return kycNextStep(status) ? <Notice tone="info" text={kycNextStep(status)!} /> : null;

    function Waiting({ owner: waitingOwner, text }: { owner: string; text: string | null }) {
      return (
        <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p><span className="font-semibold">Nothing for you to do right now.</span> This case is with {waitingOwner}.{text ? ` ${text}` : ''}</p>
        </div>
      );
    }
  }

  function PreparationChecklist() {
    const resubmit = ['SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(status) || isAmlAmendmentDraft(kycCase);
    const links: Record<string, Action> = {
      documents: { label: 'Upload documents', to: `${caseUrl}/documents` },
      // Opens the first section with missing required details (the check carries that section).
      form: { label: 'Open KYC Form', to: `${caseUrl}/form` },
      internal: { label: 'Open Section H', to: `${caseUrl}/form?section=sectionH` },
      screening: { label: 'Open Screening', to: `${caseUrl}/screening` },
      crrf: { label: 'Open CRRF', to: `${caseUrl}/crrf` },
      comments: { label: 'Write comments', to: `${caseUrl}/submit` }
    };
    const checks = readiness?.checks || [];
    // Supervisor comments are written on the submit page itself, so they do not block opening it.
    const blocking = checks.filter((check) => !check.complete && check.key !== 'comments');
    const left = checks.filter((check) => !check.complete).length;

    return (
      <div className="rounded-md border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">{isAmlAmendmentDraft(kycCase) ? 'Your next step: complete the amendment, then resubmit it to DMLRO' : resubmit ? 'Your next step: fix the points DMLRO raised, then resubmit' : 'Your next step: prepare the KYC file and submit it to DMLRO'}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {!readiness ? (readinessError ? 'The checklist could not be loaded.' : 'Checking what is left…') : left ? `${left} item${left === 1 ? '' : 's'} left. Work through them in this order.` : 'Everything is ready. Submit it to DMLRO.'}
            </p>
          </div>
          <SubmitButton disabled={!readiness || blocking.length > 0} />
        </div>
        {readinessError ? <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{readinessError}</p> : null}
        {checks.length ? (
          <ul className="mt-3 divide-y divide-sky-100 rounded-md border border-sky-100 bg-white">
            {checks.map((check) => {
              const base = check.key ? links[check.key] : undefined;
              const action = base && check.section ? { ...base, to: `${caseUrl}/form?section=${check.section}` } : base;
              return (
                <li key={check.key || check.label} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2">
                    {check.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${check.complete ? 'text-slate-500' : 'text-slate-900'}`}>{check.label}{check.complete ? ' - done' : ''}</p>
                      {!check.complete && check.message ? <p className="mt-0.5 whitespace-pre-line text-sm text-amber-800">{check.message}</p> : null}
                    </div>
                  </div>
                  {!check.complete && action?.to ? (
                    <Link to={action.to} className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      {action.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {readiness && blocking.length ? <p className="mt-2 text-xs text-slate-600">"Submit to DMLRO" unlocks when the items above are done. The AML Supervisor comments are written on the submit page.</p> : null}
      </div>
    );

    function SubmitButton({ disabled }: { disabled: boolean }) {
      const label = resubmit ? 'Resubmit to DMLRO' : 'Submit to DMLRO';
      if (disabled) {
        return (
          <span aria-disabled="true" title="Finish the checklist items first" className="inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">
            <Send className="h-4 w-4" />
            {label}
          </span>
        );
      }
      return (
        <Link to={`${caseUrl}/submit`} className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Send className="h-4 w-4" />
          {label}
        </Link>
      );
    }
  }

  function Todo({ title, intro, steps, action }: { title: string; intro?: string; steps?: string[]; action?: Action }) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-sky-200 bg-sky-50/60 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          {intro ? <p className="mt-1 text-sm text-slate-700">{intro}</p> : null}
          {steps?.length ? (
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
              {steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          ) : null}
        </div>
        {action ? (
          action.to ? (
            <Link to={action.to} className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className="inline-flex shrink-0 items-center gap-2 self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          )
        ) : null}
      </div>
    );
  }
}

function Notice({ tone, text }: { tone: 'done' | 'stop' | 'info'; text: string }) {
  const style = tone === 'done' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'stop' ? 'border-red-200 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-800';
  const Icon = tone === 'done' ? CheckCircle2 : AlertCircle;
  return (
    <p className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${style}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </p>
  );
}
