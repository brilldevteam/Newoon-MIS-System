import { AlertTriangle, CalendarClock, CheckCircle2, Eye, FileText, IdCard, Info, Link2, LoaderCircle, Plus, RefreshCw, ScanLine, Star, Trash2, Upload, X } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { getApiErrorMessage } from '../services/api';
import {
  addPersonPassport,
  ClientPassport,
  ClientPerson,
  ComplianceClientDetail,
  IdentityDocument,
  IdentityDocumentReading,
  linkKycIdentityDocument,
  PassportField,
  personKey,
  PersonRoleType,
  readIdentityDocument,
  removePersonPassport,
  updatePersonField,
  updatePersonPassport,
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
  // Uploading or replacing QID / passport copies (compliance or clients Edit: Operations replaces documents).
  canUpload: boolean;
  // False for staff who may not see passports (Accounting, HR): only the QID is shown.
  showPassports?: boolean;
  canOpenKyc: boolean;
  documents: IdentityDocument[];
  kycDocuments: KycDocument[];
  kycNumbers: Record<string, string>;
  // Every change returns the refreshed client page.
  onChange: (next: ComplianceClientDetail) => void;
  openKycDocuments: () => void;
};

// KYC uploads named for a role ("Identity Proof - Director", key-contact attachment) belong to the people in that role.
const DIRECTOR_DOCUMENTS = ['identity proof - director'];
const ROLE_DOCUMENT_TYPES: Partial<Record<PersonRoleType, string[]>> = {
  DIRECTOR: DIRECTOR_DOCUMENTS,
  MANAGER: DIRECTOR_DOCUMENTS,
  AUTHORISED_SIGNATORY: DIRECTOR_DOCUMENTS,
  CEO: DIRECTOR_DOCUMENTS,
  CFO: DIRECTOR_DOCUMENTS,
  COO: DIRECTOR_DOCUMENTS,
  MANAGING_DIRECTOR: DIRECTOR_DOCUMENTS,
  GENERAL_MANAGER: DIRECTOR_DOCUMENTS,
  CHAIRMAN: DIRECTOR_DOCUMENTS,
  SECRETARY: ['identity proof - authorized secretary', 'identity proof - secretary'],
  SEF: ['identity proof - sef'],
  UBO: ['identity proof - ubo'],
  KEY_CONTACT: ['key contact qid / passport attachment']
};
const SHARED_ID_TYPES = ['qid / passport copies', 'passport', 'qid'];

export function kycIdentityDocumentsFor(fullName: string | null, roles: PersonRoleType[], documents: KycDocument[]) {
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
const normal = (value: string | null | undefined) => (value || '').replace(/\s+/g, '').toUpperCase();

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function daysUntil(value: string) {
  return Math.floor((new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

export function ExpiryBadge({ expiry }: { expiry: string | null }) {
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

function ExpiryValue({ expiry }: { expiry: string | null }) {
  if (!expiry) return null;
  const days = daysUntil(expiry);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
      {formatDate(expiry)}
      {days >= 0 ? <span className="text-xs text-slate-500">({days} days)</span> : null}
    </span>
  );
}

function Detail({ label, empty = 'Not captured', children }: { label: string; empty?: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-xs">
      <dt className="w-16 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-slate-800">{children || <span className="font-normal text-slate-400">{empty}</span>}</dd>
    </div>
  );
}

// QID and passports of one person: details, current copy, earlier copies, and ID files from the KYC.
export function IdentityDocumentsBlock({ person, context }: { person: ClientPerson; context: IdentityDocumentsContext }) {
  const { showToast } = useToast();
  const key = personKey(person.fullName);
  const mine = context.documents.filter((document) => document.personId === person.id || (!document.personId && key && document.personKey === key));
  const kycMatches = kycIdentityDocumentsFor(person.fullName, person.roles.map((role) => role.role), context.kycDocuments);
  const shared = sharedKycIdentityCount(context.kycDocuments);
  const [linking, setLinking] = useState<string | null>(null);
  const [addingPassport, setAddingPassport] = useState(false);
  const primary = person.passports.find((passport) => passport.isPrimary) || person.passports[0] || null;

  // Passport copies go to the passport with the same number; copies without a matching number to the main passport.
  const passportCopies = (passport: ClientPassport) => mine.filter((document) => document.identityType === 'PASSPORT' && (
    normal(document.documentNumber) === normal(passport.passportNumber) ||
    (passport.id === primary?.id && !person.passports.some((other) => normal(other.passportNumber) === normal(document.documentNumber)))
  ));

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
      const next = await linkKycIdentityDocument(context.clientId, { legalDocumentId: document.id, personId: person.id, identityType: type, passportId: type === 'PASSPORT' ? primary?.id : undefined });
      context.onChange(next);
      showToast(next.readFromDocument
        ? `Saved as the ${type === 'QID' ? 'QID' : 'passport'} copy of ${person.fullName}. Number ${next.readFromDocument.documentNumber} and expiry ${formatDate(next.readFromDocument.expiryDate)} were read from the document.`
        : `Saved as the ${type === 'QID' ? 'QID' : 'passport'} copy of ${person.fullName}. Enter the number and expiry with the pencils if they are missing.`, 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to use this document.'), 'error');
    } finally {
      setLinking(null);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3" aria-label={`ID documents of ${person.fullName}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IdCard className="h-4 w-4 text-slate-500" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">ID documents</h4>
        </div>
        {context.canEdit && context.showPassports !== false && !addingPassport ? (
          <button type="button" onClick={() => setAddingPassport(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800">
            <Plus className="h-3.5 w-3.5" />Add passport
          </button>
        ) : null}
      </div>
      {person.legacyIdentity && !person.qidNumber && !person.passports.length ? (
        <p className="mt-2 text-xs text-slate-600">
          Recorded on an older KYC as one value: <span className="font-medium text-slate-800">{person.legacyIdentity}</span>. Enter it as the QID or passport number below.
        </p>
      ) : null}
      {addingPassport ? <AddPassportForm person={person} context={context} onDone={() => setAddingPassport(false)} /> : null}
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <IdentityCard type="QID" person={person} passport={null} documents={mine.filter((document) => document.identityType === 'QID')} context={context} />
        {context.showPassports === false ? null : person.passports.length
          ? person.passports.map((passport) => (
            <IdentityCard key={passport.id} type="PASSPORT" person={person} passport={passport} documents={passportCopies(passport)} context={context} />
          ))
          : <IdentityCard type="PASSPORT" person={person} passport={null} documents={mine.filter((document) => document.identityType === 'PASSPORT')} context={context} />}
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
                  {context.canUpload && context.canOpenKyc ? (['QID', 'PASSPORT'] as IdType[]).map((type) => (
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
          <button type="button" onClick={context.openKycDocuments} className="font-medium text-brand-700 hover:text-brand-800">View in Legal Documents</button>
        </p>
      ) : null}
    </section>
  );
}

function AddPassportForm({ person, context, onDone }: { person: ClientPerson; context: IdentityDocumentsContext; onDone: () => void }) {
  const { showToast } = useToast();
  const [passportNumber, setPassportNumber] = useState('');
  const [issuingCountry, setIssuingCountry] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!passportNumber.trim()) {
      setError('Enter the passport number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      context.onChange(await addPersonPassport(context.clientId, person.id, { passportNumber: passportNumber.trim(), issuingCountry, expiryDate }));
      showToast('Passport added.', 'success');
      onDone();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to add the passport.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-md border border-brand-100 bg-brand-50/40 p-2.5">
      <p className="text-xs font-semibold text-slate-700">Add a passport for {person.fullName}</p>
      <p className="text-xs text-slate-500">For a second nationality or a renewed passport kept alongside the old one. Upload its copy from the new passport card.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-700">
          Passport number *
          <input value={passportNumber} maxLength={100} disabled={saving} onChange={(event) => setPassportNumber(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Issuing country
          <input value={issuingCountry} maxLength={100} disabled={saving} onChange={(event) => setIssuingCountry(event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Expiry date
          <TypedDateInput value={expiryDate} onChange={setExpiryDate} disabled={saving} className={`${inputClass} mt-1`} />
        </label>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <X className="h-3.5 w-3.5" />Cancel
        </button>
      </div>
    </form>
  );
}

// One QID or passport: number and expiry (edited with the pencils), the current copy, earlier copies and upload.
function IdentityCard({ type, person, passport, documents, context }: {
  type: IdType; person: ClientPerson; passport: ClientPassport | null; documents: IdentityDocument[]; context: IdentityDocumentsContext;
}) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = type === 'QID' ? 'QID' : 'Passport';
  const number = type === 'QID' ? person.qidNumber : passport?.passportNumber || null;
  const expiry = (type === 'QID' ? person.qidExpiry : passport?.expiryDate) || null;
  const [latest, ...earlier] = documents;
  const days = expiry ? daysUntil(expiry) : null;
  const passportEdited = passport ? person.edited.includes(`passport:${passport.id}`) : false;

  async function open(document: IdentityDocument) {
    try {
      await viewClientDocument(context.clientId, document);
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to open this copy.'), 'error');
    }
  }

  async function savePassport(field: PassportField, value: string | null) {
    context.onChange(await updatePersonPassport(context.clientId, person.id, passport!.id, field, value));
    showToast('Saved.', 'success');
  }

  async function saveQid(field: 'qidNumber' | 'qidExpiry', value: string | null) {
    context.onChange(await updatePersonField(context.clientId, person.id, field, value));
    showToast('Saved.', 'success');
  }

  async function makeMain() {
    setBusy(true);
    try {
      await savePassport('isPrimary', 'true');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to change the main passport.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!passport || !window.confirm(`Remove passport ${passport.passportNumber} from ${person.fullName}? Its uploaded copies are kept in the Identity Documents folder.`)) return;
    setBusy(true);
    try {
      context.onChange(await removePersonPassport(context.clientId, person.id, passport.id));
      showToast('Passport removed.', 'success');
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Unable to remove the passport.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const editable = context.canEdit && (type === 'QID' || Boolean(passport));
  return (
    <div className={`rounded-md border bg-white p-3 ${days !== null && days <= 30 ? 'border-rose-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">
          {label}
          {passport && passport.isPrimary && person.passports.length > 1 ? (
            <span title="Printed on the next KYC" className="rounded bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">Main</span>
          ) : null}
        </p>
        <ExpiryBadge expiry={expiry} />
      </div>
      <div className="mt-2">
        <EditableFields columns={2} items={[
          {
            label: 'Number',
            value: number,
            edited: type === 'QID' ? person.edited.includes('qidNumber') : passportEdited,
            edit: editable ? {
              kind: 'text', initial: number, maxLength: 100, required: type === 'PASSPORT',
              onSave: (value) => (type === 'QID' ? saveQid('qidNumber', value) : savePassport('passportNumber', value))
            } : null
          },
          {
            label: 'Expiry',
            value: <ExpiryValue expiry={expiry} />,
            edited: type === 'QID' ? person.edited.includes('qidExpiry') : passportEdited,
            edit: editable ? {
              kind: 'date', initial: expiry, hint: 'Alerts 60 and 30 days before expiry and when expired.',
              onSave: (value) => (type === 'QID' ? saveQid('qidExpiry', value) : savePassport('expiryDate', value))
            } : null
          },
          ...(passport ? [{
            label: 'Issuing country',
            value: passport.issuingCountry,
            edit: context.canEdit ? { kind: 'text' as const, initial: passport.issuingCountry, maxLength: 100, onSave: (value: string | null) => savePassport('issuingCountry', value) } : null
          }] : [])
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
          {context.canUpload ? (
            <button
              type="button"
              onClick={() => setUploading(true)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${latest ? 'border border-brand-200 text-brand-700 hover:bg-brand-50' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
            >
              {latest ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {latest ? 'Replace copy' : 'Upload copy'}
            </button>
          ) : null}
          {context.canEdit && passport && !passport.isPrimary ? (
            <button type="button" disabled={busy} onClick={makeMain} title="Print this passport on the next KYC" className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
              <Star className="h-3.5 w-3.5" />Make main
            </button>
          ) : null}
          {context.canEdit && passport ? (
            <button type="button" disabled={busy} onClick={remove} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60">
              <Trash2 className="h-3.5 w-3.5" />Remove
            </button>
          ) : null}
        </div>
      ) : (
        <UploadForm type={type} person={person} passport={passport} context={context} replacing={Boolean(latest)} onDone={() => setUploading(false)} />
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

function UploadForm({ type, person, passport, context, replacing, onDone }: {
  type: IdType; person: ClientPerson; passport: ClientPassport | null; context: IdentityDocumentsContext; replacing: boolean; onDone: () => void;
}) {
  const { showToast } = useToast();
  const label = type === 'QID' ? 'QID' : 'Passport';
  const currentNumber = (type === 'QID' ? person.qidNumber : passport?.passportNumber) || '';
  const [file, setFile] = useState<File | null>(null);
  const [documentNumber, setDocumentNumber] = useState(currentNumber);
  const [expiryDate, setExpiryDate] = useState(((type === 'QID' ? person.qidExpiry : passport?.expiryDate) || '').slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<IdentityDocumentReading | null>(null);
  const [filled, setFilled] = useState<{ number: boolean; expiry: boolean }>({ number: false, expiry: false });

  // Reads the machine-readable lines of the chosen file and pre-fills the number and expiry for review.
  async function chooseFile(next: File | null) {
    setFile(next);
    setReadResult(null);
    setFilled({ number: false, expiry: false });
    if (!next) return;
    setReading(true);
    try {
      const result = await readIdentityDocument(context.clientId, type, next);
      setReadResult(result);
      if (result.found && result.typeMatches) {
        if (result.documentNumber) setDocumentNumber(result.documentNumber);
        if (result.expiryDate) setExpiryDate(result.expiryDate);
        setFilled({ number: Boolean(result.documentNumber), expiry: Boolean(result.expiryDate) });
      }
    } catch (requestError) {
      setReadResult({ found: false, message: getApiErrorMessage(requestError, 'The file could not be read. Enter the number and expiry date from the document.') });
    } finally {
      setReading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError(`Choose the ${label} copy to upload.`);
      return;
    }
    if (type === 'PASSPORT' && !passport && !documentNumber.trim()) {
      setError('Enter the passport number: it adds the passport to this person.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await uploadIdentityDocument(context.clientId, {
        personId: person.id, identityType: type, passportId: passport?.id, documentNumber, expiryDate, file
      });
      context.onChange(next);
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
        <input type="file" accept={STANDARD_DOCUMENT_ACCEPT} disabled={saving || reading} onChange={(event) => chooseFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" />
        <span className="mt-0.5 block font-normal text-slate-500">
          One file: PDF, Word, Excel or an image (JPG, PNG, GIF, WEBP), up to 10 MB. The number and expiry are read from the machine-readable lines ({type === 'QID' ? 'back of the QID' : 'bottom of the photo page'}).
        </span>
      </label>
      {reading ? (
        <p className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-xs text-slate-600"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Reading the number and expiry date from the document...</p>
      ) : readResult ? <ReadingNote result={readResult} label={label} type={type} personName={person.fullName} currentNumber={currentNumber} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          {label} number
          <input value={documentNumber} maxLength={100} disabled={saving} onChange={(event) => { setDocumentNumber(event.target.value); setFilled((current) => ({ ...current, number: false })); }} className={`${inputClass} mt-1 ${filled.number ? 'border-emerald-300 bg-emerald-50' : ''}`} />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Expiry date
          <TypedDateInput value={expiryDate} onChange={(value) => { setExpiryDate(value); setFilled((current) => ({ ...current, expiry: false })); }} disabled={saving} className={`${inputClass} mt-1 ${filled.expiry ? 'border-emerald-300 bg-emerald-50' : ''}`} />
        </label>
      </div>
      <p className="text-xs text-slate-500">{replacing ? 'The current copy is kept under Earlier copies. ' : ''}Saving also updates the {label} number and expiry of this person, and a new expiry date restarts the 60 / 30-day reminders.</p>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || reading} className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
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

// Explains what was read from the file: confirmed values, values to check, a wrong document type or another name.
function ReadingNote({ result, label, type, personName, currentNumber }: { result: IdentityDocumentReading; label: string; type: IdType; personName: string | null; currentNumber: string }) {
  if (!result.found) {
    return (
      <p className="flex items-start gap-1.5 rounded-md bg-white px-2 py-1.5 text-xs text-slate-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span>{result.message} {type === 'QID' ? 'A QID front side has no machine-readable lines; upload the back, or both sides in one file.' : 'Use a clear scan of the photo page.'}</span>
      </p>
    );
  }
  if (!result.typeMatches) {
    return (
      <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>This looks like {result.format === 'TD3' ? 'a passport' : 'an ID card'} ({result.issuingCountry}, no. {result.documentNumber || 'unknown'}), not a {label}. Nothing was filled in; check you are in the right box.</span>
      </p>
    );
  }
  const numberOk = result.documentNumberCheck === 'OK';
  const confirmed = numberOk && result.expiryValid;
  const tokens = (value: string | null) => (value || '').toUpperCase().split(/[^A-Z]+/).filter((token) => token.length > 2);
  const personTokens = tokens(personName);
  const nameMismatch = result.nameOnDocument && personTokens.length && !tokens(result.nameOnDocument).some((token) => personTokens.includes(token));
  const toCheck = [!numberOk && 'the number', !result.expiryValid && 'the expiry date'].filter(Boolean).join(' and ');
  return (
    <div className="space-y-1">
      <p className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs ${confirmed ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-amber-200 bg-amber-50 text-amber-800'}`}>
        {confirmed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <span>
          {confirmed
            ? 'Number and expiry date read from the document and confirmed by its check digits. Still compare them with the document before uploading.'
            : `Read from the document, but ${toCheck} could not be confirmed. Check ${toCheck === 'the number and the expiry date' ? 'them' : 'it'} against the document.`}
        </span>
      </p>
      {nameMismatch ? (
        <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>The name on the document reads "{result.nameOnDocument}". Check this is the {label} of {personName}.</span>
        </p>
      ) : null}
      {currentNumber && result.documentNumber && currentNumber.replace(/\s/g, '').toUpperCase() !== result.documentNumber ? (
        <p className="px-2 text-xs text-slate-500">The number on file was {currentNumber}; saving replaces it.</p>
      ) : null}
    </div>
  );
}
