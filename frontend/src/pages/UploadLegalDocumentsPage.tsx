import { Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKycCase, KycCase, uploadLegalDocument } from '../services/kyc-workflow.service';

export function UploadLegalDocumentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [form, setForm] = useState({ documentType: '', fileName: '', storagePath: '', mimeType: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      getKycCase(id).then(setKycCase);
    }
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setSaving(true);
    await uploadLegalDocument(id, {
      documentType: form.documentType,
      fileName: form.fileName,
      storagePath: form.storagePath || undefined,
      mimeType: form.mimeType || undefined
    });
    navigate(`/kyc/${id}`);
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading case...</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Upload Legal Documents</h1>
        <p className="mt-1 text-sm text-slate-500">{kycCase.title}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Document type
            <input
              required
              placeholder="Trade license, passport, UBO register..."
              value={form.documentType}
              onChange={(event) => setForm({ ...form, documentType: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            File name
            <input
              required
              value={form.fileName}
              onChange={(event) => setForm({ ...form, fileName: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Storage path
            <input
              value={form.storagePath}
              onChange={(event) => setForm({ ...form, storagePath: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            MIME type
            <input
              value={form.mimeType}
              onChange={(event) => setForm({ ...form, mimeType: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Document Metadata'}
        </button>
        <Link
          to={`/kyc/${kycCase.id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
