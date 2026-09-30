import { ArrowLeft, Download, Eye, FileSpreadsheet, FileText, Save, Trash2, Upload } from 'lucide-react';
import { ChangeEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CrrfDocument,
  CrrfRiskRating,
  CrrfWorkspace,
  deleteCrrfDocument,
  exportCrrf,
  getCrrfWorkspace,
  saveCrrfWorkspace,
  uploadCrrfDocuments,
  viewCrrfDocument
} from '../services/kyc-workflow.service';
import { CRRF_DOCUMENT_ACCEPT, CRRF_DOCUMENT_HINT, validateCrrfDocuments } from '../utils/upload-security';
import { useAuth } from '../hooks/useAuth';
import { hasAnyRole } from '../utils/access-control';

const riskOptions: Array<{ value: CrrfRiskRating; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' }
];

function errorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' ? message : fallback;
}

export function CrrfWorkspacePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<CrrfWorkspace | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const canEdit = hasAnyRole(user, ['AML_TEAM', 'AML_SUPERVISOR', 'DMLRO', 'MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN']);

  useEffect(() => {
    if (!id) return;
    getCrrfWorkspace(id)
      .then(setWorkspace)
      .catch((requestError) => setError(errorMessage(requestError, 'Unable to load CRRF workspace.')));
  }, [id]);

  async function save() {
    if (!id || !workspace) return;
    if (!workspace.record.riskRating) {
      setError('Select a risk rating before saving the CRRF draft.');
      return;
    }
    setError('');
    setMessage('');
    setBusyKey('save');
    try {
      let currentWorkspace = workspace;
      if (pendingFiles.length) {
        currentWorkspace = await uploadCrrfDocuments(id, pendingFiles);
        setPendingFiles([]);
      }
      setWorkspace(
        await saveCrrfWorkspace(id, {
          riskRating: currentWorkspace.record.riskRating || '',
          internalComment: currentWorkspace.record.internalComment || '',
          dmlroComment: currentWorkspace.record.dmlroComment || '',
          mlroComment: currentWorkspace.record.mlroComment || ''
        })
      );
      setMessage('CRRF draft saved.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to save CRRF record.'));
    } finally {
      setBusyKey('');
    }
  }

  async function upload(files: File[]) {
    if (!id || !files.length) return;
    const validationError = validateCrrfDocuments(files);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setMessage('');
    setPendingFiles((current) => [...current, ...files].filter((file, index, items) => items.findIndex((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index));
    setMessage(`${files.length} CRRF document${files.length === 1 ? '' : 's'} selected. Click Save Draft to upload and save.`);
  }

  async function removeDocument(documentId: string) {
    if (!id || !window.confirm('Delete this CRRF document?')) return;
    setError('');
    setMessage('');
    setBusyKey(`delete-${documentId}`);
    try {
      setWorkspace(await deleteCrrfDocument(id, documentId));
      setMessage('CRRF document deleted.');
    } catch (requestError: any) {
      setError(errorMessage(requestError, 'Unable to delete CRRF document.'));
    } finally {
      setBusyKey('');
    }
  }

  async function download(type: 'excel' | 'pdf') {
    if (!id) return;
    setError('');
    setMessage('');
    setBusyKey(`export-${type}`);
    try {
      await exportCrrf(id, type);
      setMessage(`CRRF ${type === 'excel' ? 'Excel' : 'PDF'} exported.`);
    } catch (requestError: any) {
      setError(errorMessage(requestError, `Unable to export CRRF ${type}.`));
    } finally {
      setBusyKey('');
    }
  }

  function patchRecord(patch: Partial<CrrfWorkspace['record']>) {
    setWorkspace((current) => (current ? { ...current, record: { ...current.record, ...patch } } : current));
  }

  function removePendingFile(file: File) {
    setPendingFiles((current) => current.filter((item) => item !== file));
  }

  if (!workspace) {
    return <p className="text-sm text-slate-500">Loading CRRF workspace...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to={`/kyc/${id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
            <ArrowLeft className="h-4 w-4" />
            Back to case
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">CRRF Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">Capture client risk rating, internal comments, supporting CRRF files, and exportable report data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download('excel')}
            disabled={busyKey === 'export-excel'}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => download('pdf')}
            disabled={busyKey === 'export-pdf'}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="KYC number" value={workspace.clientInfo.kycNumber || '-'} />
        <InfoCard label="Client name" value={workspace.clientInfo.clientName} />
        <InfoCard label="Client code" value={workspace.clientInfo.clientCode || '-'} />
        <InfoCard label="CR number" value={workspace.clientInfo.crNumber || '-'} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Risk Rating and Internal Comments</h2>
          <p className="mt-1 text-sm text-slate-500">{canEdit ? 'Risk rating is mandatory before saving the CRRF record.' : 'CRRF details and supporting documents are available for review.'}</p>
        </div>
        <div className="space-y-4 p-5">
          <label className="block text-sm font-medium text-slate-700">
            Risk rating <span className="text-red-600">*</span>
            <select
              value={workspace.record.riskRating || ''}
              onChange={(event) => patchRecord({ riskRating: event.target.value as CrrfRiskRating })}
              disabled={!canEdit}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 md:max-w-sm"
            >
              <option value="">Select risk rating</option>
              {riskOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <CommentField
            label="Comments"
            value={workspace.record.internalComment || ''}
            onChange={(value) => patchRecord({ internalComment: value })}
            helpText="Internal reference only. These comments are not included in CRRF Excel/PDF exports."
            disabled={!canEdit}
          />
          {hasAnyRole(user, ['DMLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN']) ? <CommentField label="DMLRO comments" value={workspace.record.dmlroComment || ''} onChange={(value) => patchRecord({ dmlroComment: value })} disabled={!canEdit} /> : null}
          {hasAnyRole(user, ['MLRO', 'COMPANY_ADMIN', 'SUPER_ADMIN']) ? <CommentField label="MLRO comments" value={workspace.record.mlroComment || ''} onChange={(value) => patchRecord({ mlroComment: value })} disabled={!canEdit} /> : null}
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">CRRF Documents</h3>
                <p className="mt-1 text-xs text-slate-500">At least one supporting document is required before saving. {CRRF_DOCUMENT_HINT}</p>
              </div>
              {canEdit ? <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Upload className={`h-4 w-4 ${busyKey === 'upload' ? 'animate-pulse' : ''}`} />
                Upload CRRF
                <input
                  type="file"
                  multiple
                  accept={CRRF_DOCUMENT_ACCEPT}
                  className="hidden"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    upload(Array.from(event.target.files || []));
                    event.currentTarget.value = '';
                  }}
                />
              </label> : null}
            </div>
            <div className="divide-y divide-slate-100">
              {pendingFiles.map((file) => (
                <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3 bg-amber-50 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{file.name}</p>
                    <p className="mt-1 text-xs text-amber-800">Selected locally. It will upload when the draft is saved.</p>
                  </div>
                  <button type="button" onClick={() => removePendingFile(file)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50" title="Remove selected document" aria-label={`Remove ${file.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {workspace.record.documents.length ? (
                workspace.record.documents.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    caseId={id}
                    busy={busyKey === `delete-${document.id}`}
                    onDelete={removeDocument}
                    canDelete={canEdit}
                  />
                ))
              ) : (
                <p className="px-4 py-5 text-sm text-slate-500">No CRRF documents uploaded yet.</p>
              )}
            </div>
          </div>
          {canEdit ? <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={save}
              disabled={busyKey === 'save'}
              className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
          </div> : null}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CommentField({
  label,
  value,
  onChange,
  helpText,
  disabled = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helpText?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={5}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      {helpText ? <span className="mt-1 block text-xs font-normal text-slate-500">{helpText}</span> : null}
    </label>
  );
}

function DocumentRow({
  document,
  caseId,
  busy,
  onDelete,
  canDelete
}: {
  document: CrrfDocument;
  caseId: string;
  busy: boolean;
  onDelete: (documentId: string) => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold text-slate-950">
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">{document.fileName}</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">{document.mimeType || 'Document'} | {formatBytes(document.size)}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => viewCrrfDocument(caseId, document)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          title="View document"
          aria-label={`View ${document.fileName}`}
        >
          <Eye className="h-4 w-4" />
        </button>
        {canDelete ? <button
          type="button"
          onClick={() => onDelete(document.id)}
          disabled={busy}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
          title="Delete document"
          aria-label={`Delete ${document.fileName}`}
        >
          <Trash2 className="h-4 w-4" />
        </button> : null}
      </div>
    </div>
  );
}

function formatBytes(value?: number | null) {
  if (!value) return 'Size not captured';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
