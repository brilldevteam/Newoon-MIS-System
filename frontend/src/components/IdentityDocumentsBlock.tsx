import { CalendarClock, Eye, FileText, IdCard, Link2, LoaderCircle, RefreshCw, Upload, X } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { getApiErrorMessage } from '../services/api';
import {
  ComplianceClientDetail,
  IdentityDocument,
  linkKycIdentityDocument,
  personKey,
  ProfileRef,
  uploadIdentityDocument,
  viewClientDocument
} from '../services/compliance-clients.service';
import { LegalDocument, viewLegalDocument } from '../services/kyc-workflow.service';
import { STANDARD_DOCUMENT_ACCEPT } from '../utils/upload-security';
import { EditableFields } from './EditableFields';
import { TypedDateInput } from './TypedDateInput';
import { useToast } from './ToastProvider';

type IdType = 'QID' | 'PASSPORT';
type KycDocument = ComplianceClientDetail['legalDocuments'][number];

export type IdentityDocumentsContext = {
  clientId: string;
  canEdit: boolean;
  canOpenKyc: boolean;
  documents: IdentityDocument[];
  kycDocuments: KycDocument[];
  kycNumbers: Record<string, string>;
  // Roles of each person across all tabs (DIRECTOR, SECRETARY, SEF, UBO, KEY_CONTACT, ...), keyed by personKey.
  rolesByPerson: Record<string, string[]>;
  onUploaded: (next: ComplianceClientDetail) => void;
  openKycDocuments: () => void;
  // Pencil edits of the number and expiry (the audited profile edit) and its "edited" marker.
  saveField: (ref: ProfileRef, field: string, value: string | null) => Promise<void>;
  isEdited: (ref: ProfileRef, field: string) => boolean;
};

type Person = {
  ref: ProfileRef;
  fullName: string | null;
  qidNumber: string | null;
  qidExpiry: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
};

// KYC uploads named for a role ("Identity Proof - Director", key-contact attachment) belong to the people in that role.
const ROLE_DOCUMENT_TYPES: Record<string, string[]> = {
  DIRECTOR: ['identity proof - director'],
  MANAGER: ['identity proof - director'],
  SIGNATORY: ['identity proof - director'],
  SECRETARY: ['identity proof - authorized secretary', 'identity proof - secretary'],
  SEF: ['identity proof - sef'],
  UBO: ['identity proof - ubo'],
  KEY_CONTACT: ['key contact qid / passport attachment']
};
const SHARED_ID_TYPES = ['qid / passport copies', 'passport', 'qid'];

export function kycIdentityDocumentsFor(fullName: string | null, roles: string[], documents: KycDocument[]) {
  const tokens = personKey(fullName).split(' ').filter((token) => token.length > 2);
  return documents.filter((document) => {
    const type = document.documentType.trim().toLowerCase();
    if (roles.some((role) => ROLE_DOCUMENT_TYPES[role]?.includes(type))) return true;
    // A shared ID upload whose file name carries the person's name (at least two name parts).
    if (!/qid|passport|identity/.test(type)) return false;
    const file = document.fileName.toUpperCase();
    return tokens.length >= 2 && tokens.filter((token) => file.includes(token)).length >= 2;
  });
}

export function sharedKycIdentityCount(documents: KycDocument[]) {
  return documents.filter((document) => SHARED_ID_TYPES.includes(document.documentType.trim().toLowerCase())).length;
}

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function daysUntil(value: string) {
  return Math.floor((new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

function ExpiryBadge({ expiry }: { expiry: string | null }) {
  if (!expiry) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">No expiry date</span>;
  const days = daysUntil(expiry);
  const [tone, label] = days < 0
    ? ['bg-rose-50 text-rose-700 ring-rose-200', 'Expired']
    : days <= 30
      ? ['bg-rose-50 text-rose-700 ring-rose-200', `Expires in ${days} day${days === 1 ? '' : 's'}`]
      : days <= 60
        ? ['bg-amber-50 text-amber-700 ring-amber-200', `Expires in ${days} days`]
        : ['bg-emerald-50 text-emerald-700 ring-emerald-200', 'Valid'];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>{label}</span>;
}

function Detail({ label, empty = 'Not captured', children }: { label: string; empty?: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-xs">
      <dt className="w-16 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-slate-800">{children || <span className="font-normal text-slate-400">{empty}</span>}</dd>
    </div>
  );
}

// QID and passport of one person: details, current copy, earlier copies, and ID files from the KYC.
export function IdentityDocumentsBlock({ person, context }: { person: Person; context: IdentityDocumentsContext }) {
  const { showToast } = useToast();
  const key = personKey(person.fullName);
  const mine = key ? context.documents.filter((document) => document.personKey === key) : [];
  const kycMatches = kycIdentityDocumentsFor(person.fullName, context.rolesByPerson[key] || [], context.kycDocuments);
  const shared = sharedKycIdentityCount(context.kycDocuments);
  const [linking, setLinking] = useState<string | null>(null);

  async function openKyc(document: KycDocument) {
    try {
      await viewLegalDocument(document.kycCaseId, { ...document, status: 'UPLOADED' } as LegalDocument);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to open this document.'), 'error');
    }
  }

  async function link(document: KycDocument, type: IdType) {
    setLinking(`${document.id}-${type}`);
    try {
      const next = await linkKycIdentityDocument(context.clientId, { legalDocumentId: document.id, section: person.ref.section, rowId: person.ref.rowId, identityType: type });
      context.onUploaded(next);
      showToast(`Saved as the ${type === 'QID' ? 'QID' : 'passport'} copy of ${person.fullName}.`, 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to use this document.'), 'error');
    } finally {
      setLinking(null);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3" aria-label={`ID documents of ${person.fullName || 'this person'}`}>
      <div className="flex items-center gap-2">
        <IdCard className="h-4 w-4 text-slate-500" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">ID documents</h4>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {(['QID', 'PASSPORT'] as IdType[]).map((type) => (
          <IdentityCard key={type} type={type} person={person} documents={mine.filter((document) => document.identityType === type)} context={context} />
        ))}
      </div>

      {kycMatches.length ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-700">Uploaded with the KYC for this person</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {kycMatches.map((document) => (
              <li key={document.id} className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 text-xs">
                    <p className="font-medium text-slate-800">{document.documentType}</p>
                    <p className="break-all text-slate-500">{document.fileName} · {context.kycNumbers[document.kycCaseId] || 'KYC'} · {formatDate(document.createdAt)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {context.canOpenKyc ? (
                    <button type="button" onClick={() => openKyc(document)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Eye className="h-3.5 w-3.5" />View
                    </button>
                  ) : null}
                  {context.canEdit && context.canOpenKyc ? (['QID', 'PASSPORT'] as IdType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      disabled={Boolean(linking)}
                      onClick={() => link(document, type)}
                      title={`Save a copy of this file as the ${type === 'QID' ? 'QID' : 'passport'} copy of this person`}
                      className="inline-flex items-center gap-1 rounded-md border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                    >
                      {linking === `${document.id}-${type}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                      Use as {type === 'QID' ? 'QID' : 'passport'}
                    </button>
                  )) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {shared ? (
        <p className="mt-3 text-xs text-slate-500">
          {shared} ID file{shared === 1 ? ' was' : 's were'} uploaded with the KYC for all persons together.{' '}
          <button type="button" onClick={context.openKycDocuments} className="font-medium text-brand-700 hover:text-brand-800">View in KYC & Documents</button>
        </p>
      ) : null}
    </section>
  );
}

function IdentityCard({ type, person, documents, context }: { type: IdType; person: Person; documents: IdentityDocument[]; context: IdentityDocumentsContext }) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const label = type === 'QID' ? 'QID' : 'Passport';
  const number = type === 'QID' ? person.qidNumber : person.passportNumber;
  const expiry = (type === 'QID' ? person.qidExpiry : person.passportExpiry) || null;
  const [latest, ...earlier] = documents;
  const days = expiry ? daysUntil(expiry) : null;
  const prefix = type === 'QID' ? 'qid' : 'passport';

  async function open(document: IdentityDocument) {
    try {
      await viewClientDocument(context.clientId, document);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to open this copy.'), 'error');
    }
  }

  return (
    <div className={`rounded-md border bg-white p-3 ${days !== null && days <= 30 ? 'border-rose-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <ExpiryBadge expiry={expiry} />
      </div>
      <div className="mt-2">
        <EditableFields columns={2} items={[
          {
            label: 'Number',
            value: number,
            edited: context.isEdited(person.ref, `${prefix}Number`),
            edit: context.canEdit ? { kind: 'text', initial: number, maxLength: 100, onSave: (value) => context.saveField(person.ref, `${prefix}Number`, value) } : null
          },
          {
            label: 'Expiry',
            value: expiry ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(expiry)}
                {days !== null && days >= 0 ? <span className="text-xs text-slate-500">({days} days)</span> : null}
              </span>
            ) : null,
            edited: context.isEdited(person.ref, `${prefix}Expiry`),
            edit: context.canEdit ? { kind: 'date', initial: expiry, hint: 'Alerts 60 and 30 days before expiry and when expired.', onSave: (value) => context.saveField(person.ref, `${prefix}Expiry`, value) } : null
          }
        ]} />
      </div>
      <dl className="mt-3 space-y-1 border-t border-slate-100 pt-2">
        <Detail label="Copy" empty="No copy uploaded yet">
          {latest ? (
            <span>
              {latest.fileName}
              <span className="block font-normal text-slate-500">
                Uploaded {formatDate(latest.createdAt)}{latest.uploadedBy ? ` by ${latest.uploadedBy.firstName} ${latest.uploadedBy.lastName}` : ''}
              </span>
            </span>
          ) : null}
        </Detail>
      </dl>
      {!uploading ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {latest ? (
            <button type="button" onClick={() => open(latest)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Eye className="h-3.5 w-3.5" />View copy
            </button>
          ) : null}
          {context.canEdit ? (
            <button
              type="button"
              onClick={() => setUploading(true)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${latest ? 'border border-brand-200 text-brand-700 hover:bg-brand-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
            >
              {latest ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {latest ? 'Replace copy' : 'Upload copy'}
            </button>
          ) : null}
        </div>
      ) : (
        <UploadForm type={type} person={person} context={context} replacing={Boolean(latest)} onDone={() => setUploading(false)} />
      )}
      {earlier.length ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Earlier copies ({earlier.length})</summary>
          <ul className="mt-1.5 space-y-1">
            {earlier.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-2 text-slate-600">
                <span className="min-w-0 break-all">
                  {document.fileName}
                  <span className="text-slate-400"> · {formatDate(document.createdAt)}{document.documentNumber ? ` · no. ${document.documentNumber}` : ''}{document.documentExpiry ? ` · exp. ${formatDate(document.documentExpiry)}` : ''}</span>
                </span>
                <button type="button" onClick={() => open(document)} className="shrink-0 font-medium text-brand-700 hover:text-brand-800">View</button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function UploadForm({ type, person, context, replacing, onDone }: { type: IdType; person: Person; context: IdentityDocumentsContext; replacing: boolean; onDone: () => void }) {
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
      showToast(`${label} copy ${replacing ? 'replaced' : 'uploaded'}.`, 'success');
      onDone();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `Unable to upload the ${label} copy.`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-md border border-brand-100 bg-brand-50/40 p-2.5">
      <p className="text-xs font-semibold text-slate-700">{replacing ? `Replace the ${label} copy` : `Upload the ${label} copy`}</p>
      <label className="block text-xs font-medium text-slate-700">
        File *
        <input type="file" accept={STANDARD_DOCUMENT_ACCEPT} disabled={saving} onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
        <span className="mt-0.5 block font-normal text-slate-500">One file: PDF, Word, Excel or an image (JPG, PNG, GIF, WEBP), up to 10 MB.</span>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          {label} number
          <input value={documentNumber} maxLength={100} disabled={saving} onChange={(event) => setDocumentNumber(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Expiry date
          <TypedDateInput value={expiryDate} onChange={setExpiryDate} disabled={saving} className={`${inputClass} mt-1`} />
        </label>
      </div>
      <p className="text-xs text-slate-500">{replacing ? 'The current copy is kept under Earlier copies. ' : ''}Saving also updates the {label} number and expiry of this person, and a new expiry date restarts the 60 / 30-day reminders.</p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {replacing ? 'Replace' : 'Upload'}
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <X className="h-3.5 w-3.5" />Cancel
        </button>
      </div>
    </form>
  );
}
