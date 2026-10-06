import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKycCase, getSubmissionReadiness, KycCase, SubmissionReadiness, submitToAml } from '../services/kyc-workflow.service';
import { getApiErrorMessage } from '../services/api';
import { RichTextEditor, safeCommentHtml } from '../components/RichTextEditor';

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
  const checks = readiness?.checks.map((check) => check.label === 'AML Supervisor comments' ? { ...check, complete: hasComments, message: hasComments ? '' : 'Enter AML Supervisor comments below before submitting.' } : check);
  const canSubmit = Boolean(checks?.length && checks.every((check) => check.complete));
  const isResubmission = ['SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED'].includes(kycCase.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{isResubmission ? 'Resubmit to DMLRO' : 'Submit to DMLRO'}</h1>
        <p className="mt-1 text-sm text-slate-500">{kycCase.title}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Submission Checklist</h2>
        <div className="mt-4 space-y-3 text-sm">
          {checks?.map((check) => <div key={check.label} className="border-b border-slate-200 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-700">{check.label}</span><span className={check.complete ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{check.complete ? 'Complete' : 'Required'}</span></div>{!check.complete && <p className="mt-1 text-red-700">{check.message}</p>}</div>)}
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-slate-700">Client inquiry recorded</span>
            <span className="font-semibold text-emerald-700">Complete</span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-slate-700">Requested service selected</span>
            <span className={kycCase.service ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
              {kycCase.service ? 'Complete' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
            <span className="text-slate-700">Documents required for KYC preparation uploaded</span>
            <span className={kycCase.legalDocuments.length ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
              {kycCase.legalDocuments.length} document{kycCase.legalDocuments.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
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
