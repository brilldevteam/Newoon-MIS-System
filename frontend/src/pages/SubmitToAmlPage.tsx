import { ArrowRight, CheckCircle2, Circle, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKycCase, getSubmissionReadiness, KycCase, SubmissionReadiness, submitToAml } from '../services/kyc-workflow.service';
import { getApiErrorMessage } from '../services/api';
import { RichTextEditor, safeCommentHtml } from '../components/RichTextEditor';
import { isAmlAmendmentDraft } from '../components/KycCaseGuide';

export function SubmitToAmlPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState<SubmissionReadiness | null>(null);
  const [error, setError] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    let active = true;
    setReadiness(null);
    setError('');
    setComments('');
    if (id) Promise.all([getKycCase(id), getSubmissionReadiness(id)])
      .then(([record, status]) => { if (active) { setKycCase(record); setReadiness(status); setComments(status.supervisorComments || ''); } })
      .catch((failure) => { if (active) setError(getApiErrorMessage(failure, 'Unable to check submission requirements. Please reload and try again.')); });
    return () => { active = false; };
  }, [id]);

  async function submit() {
    if (!id || !canSubmit || saving) return;
    setSaving(true);
    setError('');
    try {
      await submitToAml(id, comments);
      navigate(`/kyc/${id}`);
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'Unable to submit the KYC file. Please try again.'));
      setReadiness(null);
      try { setReadiness(await getSubmissionReadiness(id)); } catch { /* Keep submission disabled until requirements can be checked. */ }
    } finally {
      setSaving(false);
    }
  }

  if (!kycCase) {
    return <p role={error ? 'alert' : undefined} className="text-sm text-slate-600">{error || 'Loading case...'}</p>;
  }

  const hasComments = Boolean(new DOMParser().parseFromString(safeCommentHtml(comments), 'text/html').body.textContent?.trim());
  const checks = readiness?.checks.map((check) => check.label === 'AML Supervisor comments' ? { ...check, complete: hasComments, message: hasComments ? '' : 'Write the AML Supervisor comments in the box below.' } : check);
  const fixLinks: Record<string, { label: string; to: string }> = {
    documents: { label: 'Upload documents', to: `/kyc/${kycCase.id}/documents` },
    form: { label: 'Open KYC Form', to: `/kyc/${kycCase.id}/form` },
    internal: { label: 'Open Section H', to: `/kyc/${kycCase.id}/form?section=sectionH` },
    screening: { label: 'Open Screening', to: `/kyc/${kycCase.id}/screening` },
    crrf: { label: 'Open CRRF', to: `/kyc/${kycCase.id}/crrf` }
  };
  const remaining = checks?.filter((check) => !check.complete).length || 0;
  const canSubmit = Boolean(checks?.length && checks.every((check) => check.complete));
  const isResubmission = ['SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status) || isAmlAmendmentDraft(kycCase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{isResubmission ? 'Resubmit to DMLRO' : 'Submit to DMLRO'}</h1>
        <p className="mt-1 text-sm text-slate-500">{kycCase.title}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Submission Checklist</h2>
        <p className="mt-1 text-sm text-slate-500">
          {!checks ? 'Checking what is left…' : remaining ? `${remaining} item${remaining === 1 ? '' : 's'} left before you can submit. Fix each one using its button, then come back here.` : 'Everything is ready. Press the submit button below.'}
        </p>
        <ul className="mt-3 divide-y divide-slate-200 text-sm">
          {checks?.map((check) => {
            const base = check.key ? fixLinks[check.key] : undefined;
            const fix = base && check.section ? { ...base, to: `/kyc/${kycCase.id}/form?section=${check.section}` } : base;
            return (
              <li key={check.label} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  {check.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />}
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{check.label} <span className={check.complete ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{check.complete ? '- done' : '- needed'}</span></p>
                    {!check.complete && check.message ? <p className="mt-1 whitespace-pre-line text-red-700">{check.message}</p> : null}
                  </div>
                </div>
                {!check.complete && fix ? (
                  <Link to={fix.to} className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    {fix.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </li>
            );
          })}
          <li className="flex items-center gap-2 py-3">
            {kycCase.service ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-amber-500" />}
            <span className="font-medium text-slate-800">Requested service {kycCase.service ? <span className="font-semibold text-emerald-700">- {kycCase.service.name}</span> : <span className="font-normal text-amber-700">- not selected yet (optional; set it in Service &amp; Proposal on the case page)</span>}</span>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-950">AML Supervisor submission comments <span className="text-red-600">*</span></h2>
        <RichTextEditor label="AML Supervisor submission comments" value={comments} onChange={setComments} disabled={saving} />
      </section>

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {(
          <button
            type="button"
            onClick={submit}
            disabled={saving || !canSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {saving ? 'Submitting...' : isResubmission ? 'Resubmit KYC File to DMLRO' : 'Submit KYC File to DMLRO'}
          </button>
        )}
        <Link
          to={`/kyc/${kycCase.id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to Case
        </Link>
      </div>
    </div>
  );
}
