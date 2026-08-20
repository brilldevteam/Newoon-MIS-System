import { Plus, Trash2, Upload } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MultiFileUploadControl } from '../components/MultiFileUploadControl';
import { getKycCase, KycCase, uploadLegalDocumentFiles } from '../services/kyc-workflow.service';

type UploadRow = {
  id: string;
  documentType: string;
  files: File[];
};

function createUploadRow(): UploadRow {
  return {
    id: crypto.randomUUID(),
    documentType: '',
    files: []
  };
}

function mergeSelectedFiles(existingFiles: File[], selectedFiles: File[]) {
  const seen = new Set(existingFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
  return [
    ...existingFiles,
    ...selectedFiles.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  ];
}

export function UploadLegalDocumentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [kycCase, setKycCase] = useState<KycCase | null>(null);
  const [documents, setDocuments] = useState<UploadRow[]>([createUploadRow()]);
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
      const incompleteRow = documents.find((document) => !document.documentType.trim() || !document.files.length);

      if (incompleteRow) {
        setError('Add a document type and at least one file for every row before saving.');
        return;
      }

      for (const document of documents) {
        await uploadLegalDocumentFiles(id, {
          documentType: document.documentType.trim(),
          files: document.files
        });
      }

      navigate(`/kyc/${id}`);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to save documents.');
    } finally {
      setSaving(false);
    }
  }

  function updateDocument(rowId: string, patch: Partial<UploadRow>) {
    setDocuments((current) => current.map((document) => (document.id === rowId ? { ...document, ...patch } : document)));
  }

  function removeDocument(rowId: string) {
    setDocuments((current) => (current.length === 1 ? current : current.filter((document) => document.id !== rowId)));
  }

  if (!kycCase) {
    return <p className="text-sm text-slate-500">Loading case...</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Upload Documents Required for KYC Preparation</h1>
        <p className="mt-1 text-sm text-slate-500">{kycCase.title}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        {error ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <div className="space-y-4">
          {documents.map((document, index) => (
            <div key={document.id} className="grid items-end gap-4 rounded-md border border-slate-200 p-4 lg:grid-cols-[minmax(280px,1fr)_auto_minmax(260px,0.8fr)_auto]">
              <label className="text-sm font-medium text-slate-700">
                Document type
                <input
                  required
                  placeholder="Trade license, passport, UBO register..."
                  value={document.documentType}
                  onChange={(event) => updateDocument(document.id, { documentType: event.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="text-sm font-medium text-slate-700 lg:col-span-2">
                <span className="mb-1 block">Upload documents</span>
                <MultiFileUploadControl
                  names={document.files.map((file) => file.name)}
                  onSelect={(files) => updateDocument(document.id, { files: mergeSelectedFiles(document.files, files) })}
                  onRemoveName={(fileIndex) => updateDocument(document.id, { files: document.files.filter((_, index) => index !== fileIndex) })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeDocument(document.id)}
                disabled={documents.length === 1}
                title="Remove document row"
                aria-label={`Remove document row ${index + 1}`}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDocuments((current) => [...current, createUploadRow()])}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Add another document
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Documents'}
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
