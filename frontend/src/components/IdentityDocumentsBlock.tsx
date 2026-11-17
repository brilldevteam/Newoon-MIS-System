import { FileText, LoaderCircle, Upload, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { getApiErrorMessage } from '../services/api';
import {
  ComplianceClientDetail,
  IdentityDocument,
  personKey,
  ProfileRef,
  uploadIdentityDocument,
  viewClientDocument
} from '../services/compliance-clients.service';
import { STANDARD_DOCUMENT_ACCEPT } from '../utils/upload-security';
import { TypedDateInput } from './TypedDateInput';
import { useToast } from './ToastProvider';

type IdType = 'QID' | 'PASSPORT';

export type IdentityDocumentsContext = {
  clientId: string;
  canEdit: boolean;
  documents: IdentityDocument[];
  // Copies uploaded with the KYC are one combined bundle for everyone, so they are only pointed to.
  kycCopies: number;
  onUploaded: (next: ComplianceClientDetail) => void;
  openKycDocuments: () => void;
};

type Person = {
  ref: ProfileRef;
  fullName: string | null;
  qidNumber: string | null;
  qidExpiry: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
};

const inputClass = 'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

// QID and passport copies for one person, newest first, with an upload for the renewed document.
export function IdentityDocumentsBlock({ person, context }: { person: Person; context: IdentityDocumentsContext }) {
  const key = personKey(person.fullName);
  const mine = key ? context.documents.filter((document) => document.personKey === key) : [];
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ID copies</p>
      <div className="mt-2 space-y-3">
        {(['QID', 'PASSPORT'] as IdType[]).map((type) => (
          <IdentityTypeRow key={type} type={type} person={person} documents={mine.filter((document) => document.identityType === type)} context={context} />
        ))}
      </div>
      {context.kycCopies ? (
        <p className="mt-3 text-xs text-slate-500">
          Copies uploaded with the KYC are kept as one bundle for all persons.{' '}
          <button type="button" onClick={context.openKycDocuments} className="font-medium text-brand-700 hover:text-brand-800">View them in KYC & Documents</button>
        </p>
      ) : null}
    </div>
  );
}

function IdentityTypeRow({ type, person, documents, context }: { type: IdType; person: Person; documents: IdentityDocument[]; context: IdentityDocumentsContext }) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const label = type === 'QID' ? 'QID' : 'Passport';
  const [latest, ...earlier] = documents;

  async function open(document: IdentityDocument) {
    try {
      await viewClientDocument(context.clientId, document);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to open this copy.'), 'error');
    }
  }

  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-900">{label} copy</p>
          {latest ? (
            <p className="break-all text-xs text-slate-500">
              {latest.fileName} · uploaded {formatDate(latest.createdAt)}
              {latest.documentNumber ? ` · no. ${latest.documentNumber}` : ''}
              {latest.documentExpiry ? ` · expires ${formatDate(latest.documentExpiry)}` : ''}
            </p>
          ) : (
            <p className="text-xs text-slate-400">No copy uploaded here yet</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {latest ? (
            <button type="button" onClick={() => open(latest)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <FileText className="h-3.5 w-3.5" />
              View
            </button>
          ) : null}
          {context.canEdit && !uploading ? (
            <button type="button" onClick={() => setUploading(true)} className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
              <Upload className="h-3.5 w-3.5" />
              {latest ? 'Upload new copy' : 'Upload copy'}
            </button>
          ) : null}
        </div>
      </div>
      {uploading ? <UploadForm type={type} person={person} context={context} onDone={() => setUploading(false)} /> : null}
      {earlier.length ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-slate-500">Earlier copies ({earlier.length})</summary>
          <ul className="mt-1 space-y-1">
            {earlier.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 text-slate-600">
                <span className="break-all">
                  {document.fileName} · uploaded {formatDate(document.createdAt)}
                  {document.documentExpiry ? ` · expired/expires ${formatDate(document.documentExpiry)}` : ''}
                </span>
                <button type="button" onClick={() => open(document)} className="font-medium text-brand-700 hover:text-brand-800">View</button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function UploadForm({ type, person, context, onDone }: { type: IdType; person: Person; context: IdentityDocumentsContext; onDone: () => void }) {
  const { showToast } = useToast();
  const label = type === 'QID' ? 'QID' : 'Passport';
  const [file, setFile] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState((type === 'QID' ? person.qidNumber : person.passportNumber) || '');
  const [expiryDate, setExpiryDate] = useState(((type === 'QID' ? person.qidExpiry : person.passportExpiry) || '').slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError(`Choose the ${label} copy to upload.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await uploadIdentityDocument(context.clientId, {
        section: person.ref.section, rowId: person.ref.rowId, identityType: type, documentNumber, expiryDate, file
      });
      context.onUploaded(next);
      showToast(`${label} copy uploaded.`, 'success');
      onDone();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `Unable to upload the ${label} copy.`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <label className="block text-xs font-medium text-slate-700">
        {label} copy *
        <input type="file" accept={STANDARD_DOCUMENT_ACCEPT} disabled={saving} onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
        <span className="mt-0.5 block font-normal text-slate-500">One file: PDF, Word, Excel or an image (JPG, PNG, GIF, WEBP), up to 10 MB.</span>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          {label} number
          <input value={documentNumber} maxLength={100} disabled={saving} onChange={(event) => setDocumentNumber(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          {label} expiry date
          <TypedDateInput value={expiryDate} onChange={setExpiryDate} disabled={saving} className={`${inputClass} mt-1`} />
        </label>
      </div>
      <p className="text-xs text-slate-500">Saving also updates the {label} number and expiry on this person. A new expiry date restarts the 60 / 30-day reminders.</p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </form>
  );
}
