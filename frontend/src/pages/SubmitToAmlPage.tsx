import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKycCase, KycCase, submitToAml } from '../services/kyc-workflow.service';

export function SubmitToAmlPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      getKycCase(id).then(setKycCase);
    }
  }, [id]);

  async function submit() {
    if (!id) return;
    setSaving(true);
    await submitToAml(id);
    navigate(`/kyc/${id}`);
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading case...</p>;
  }

  const canSubmit = kycCase.legalDocuments.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Submit to AML</h1>
        <p className="mt-1 text-sm text-slate-500">{kycCase.title}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Submission Checklist</h2>
        <div className="mt-4 space-y-3 text-sm">
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
            <span className="text-slate-700">Legal documents uploaded</span>
            <span className={canSubmit ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
              {kycCase.legalDocuments.length} document{kycCase.legalDocuments.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        {canSubmit ? (
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {saving ? 'Submitting...' : 'Submit Client File to AML'}
          </button>
        ) : null}
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
