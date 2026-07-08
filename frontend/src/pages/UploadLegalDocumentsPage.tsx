import { Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getKycCase, KycCase, uploadLegalDocumentFile } from '../services/kyc-workflow.service';

export function UploadLegalDocumentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [form, setForm] = useState({ documentType: '', fileName: '', storagePath: '', mimeType: '', size: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      getKycCase(id).then(setKycCase);
    }
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      if (!selectedFile) {
        setError('Select a document file to upload.');
        return;
      }

      await uploadLegalDocumentFile(id, {
        documentType: form.documentType,
        file: selectedFile
      });
      navigate(`/kyc/${id}`);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to save document.');
    } finally {
      setSaving(false);
    }
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
        {error ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="grid items-end gap-4 lg:grid-cols-[minmax(320px,1fr)_auto_minmax(260px,0.8fr)]">
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
          <div className="text-sm font-medium text-slate-700">
            <span className="block">Upload file</span>
            <label className="mt-1 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              <Upload className="h-4 w-4" />
              Upload
              <input
                required
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setSelectedFile(file);
                  setForm({
                    ...form,
                    fileName: file.name,
                    storagePath: '',
                    mimeType: file.type || 'application/octet-stream',
                    size: file.size
                  });
                }}
              />
            </label>
          </div>
          <div className="text-sm font-medium text-slate-700">
            <span className="block">Uploaded document</span>
            <div className="mt-1 flex h-10 min-w-0 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
              <span className="truncate">{form.fileName || 'No file selected'}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Document'}
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
