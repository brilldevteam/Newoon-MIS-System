import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { TypedDateInput } from './TypedDateInput';
import { readEnquiryIdentityDocument } from '../services/kyc-workflow.service';
import { withDerivedIdentity } from '../utils/person-identity';
import { FillOutcome, identityFill } from '../utils/document-fill';
import { FillNote } from './DocumentFillBar';
import { STANDARD_DOCUMENT_ACCEPT, validateStandardDocuments } from '../utils/upload-security';

// Identity fields shared by every person on the Preliminary enquiry (shareholders, beneficial owners, management):
// passport and QID numbers with their expiry dates, date of birth (date of incorporation for a company) and PEP.
// Field names match the KYC form rows so they carry over when the enquiry becomes a KYC case.
export type PersonIdentity = {
  shareholderType?: string;
  fullName: string;
  identityNumber: string;
  passportNumber?: string;
  passportExpiry?: string;
  qidNumber?: string;
  qidExpiry?: string;
  dateOfBirth?: string;
  isPep?: string;
};

type IdType = 'PASSPORT' | 'QID';

type Props<T extends PersonIdentity> = {
  row: T;
  isCompany?: boolean;
  onChange: (change: Partial<T>) => void;
  // The copy that was read is also attached to the enquiry, so it does not have to be uploaded twice.
  onIdentityFile?: (file: File, type: IdType) => void;
};

const inputClass = 'mt-1.5 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';
const QID_PATTERN = /^\d{11}$/;

// Enquiries saved before the split had one "Passport or QID number": an 11-digit value is a Qatar ID, anything else a passport.
export function withSplitIdentity<T extends PersonIdentity>(row: T): T {
  if (row.shareholderType === 'Corporate Entity' || row.passportNumber || row.qidNumber || !row.identityNumber?.trim()) return row;
  const value = row.identityNumber.trim();
  return QID_PATTERN.test(value) ? { ...row, qidNumber: value } : { ...row, passportNumber: value };
}

// One inline upload slot of the Passport / QID group: the copy is read into the fields above it and attached to the
// enquiry. Shows a spinner while reading and the result under the button.
function InlineCopyUpload({ label, hint, onRead }: { label: string; hint?: string; onRead: (file: File) => Promise<FillOutcome> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [outcome, setOutcome] = useState<FillOutcome | null>(null);
  const [error, setError] = useState('');

  async function choose(files: File[]) {
    const file = files[0];
    if (!file) return;
    const problem = validateStandardDocuments([file]);
    setError(problem);
    if (problem) return;
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome(await onRead(file));
      setFileName(file.name);
    } catch {
      setOutcome({ tone: 'warn', text: 'The details could not be read from this file. Enter them above.' });
      setFileName(file.name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 sm:col-span-2" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold disabled:cursor-wait ${busy ? 'border-sky-300 bg-sky-50 text-sky-700' : fileName ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-dashed border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Upload aria-hidden="true" className="h-4 w-4" />}
          {busy ? 'Reading...' : fileName ? `Replace ${label} copy` : `Upload ${label} copy`}
        </button>
        {fileName && !busy ? <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="max-w-56 truncate" title={fileName}>{fileName}</span></span> : null}
        {hint && !fileName ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {error ? <p role="alert" className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
      {outcome ? <FillNote outcome={outcome} onChange={setOutcome} /> : null}
      <input ref={inputRef} type="file" accept={STANDARD_DOCUMENT_ACCEPT} className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); event.currentTarget.value = ''; void choose(files); }} />
    </div>
  );
}

const groupClass = 'min-w-0 rounded-lg border border-slate-200 bg-white p-3';
const legendClass = 'px-1 text-xs font-semibold uppercase tracking-wide text-slate-500';
const smallInput = 'mt-1 min-h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-normal text-slate-950 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500';

export function PreliminaryPersonFields<T extends PersonIdentity>({ row, isCompany = false, onChange, onIdentityFile }: Props<T>) {
  const patch = (change: Partial<T>) => {
    const next = withDerivedIdentity({ ...row, ...change } as T);
    onChange({ ...change, identityNumber: next.identityNumber } as Partial<T>);
  };

  async function readCopy(file: File, kind: string): Promise<FillOutcome> {
    const readType = kind as IdType;
    const result = await readEnquiryIdentityDocument(readType, file);
    onIdentityFile?.(file, readType);
    const { change, outcome } = identityFill(row, result, readType);
    if (Object.keys(change).length) patch(change as Partial<T>);
    return { ...outcome, text: result.found ? outcome.text : `${outcome.text} The copy was added to the attachments.` };
  }

  if (isCompany) {
    return <label className="min-w-0 text-sm font-medium text-slate-700">Date of incorporation<TypedDateInput value={row.dateOfBirth || ''} onChange={(value) => onChange({ dateOfBirth: value } as Partial<T>)} className={inputClass} /></label>;
  }

  return <>
    <div className="grid gap-3 md:grid-cols-2" style={{ gridColumn: '1 / -1' }}>
      <fieldset className={groupClass}>
        <legend className={legendClass}>Passport</legend>
        <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-medium text-slate-600">Passport number<input className={smallInput} value={row.passportNumber || ''} onChange={(event) => patch({ passportNumber: event.target.value } as Partial<T>)} /></label>
          <label className="min-w-0 text-xs font-medium text-slate-600">Passport expiry<TypedDateInput value={row.passportExpiry || ''} onChange={(value) => onChange({ passportExpiry: value } as Partial<T>)} className={smallInput} /></label>
          <InlineCopyUpload label="passport" onRead={(file) => readCopy(file, 'PASSPORT')} />
        </div>
      </fieldset>
      <fieldset className={groupClass}>
        <legend className={legendClass}>QID</legend>
        <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
          <label className="min-w-0 text-xs font-medium text-slate-600">QID number<input className={smallInput} inputMode="numeric" value={row.qidNumber || ''} onChange={(event) => patch({ qidNumber: event.target.value } as Partial<T>)} /></label>
          <label className="min-w-0 text-xs font-medium text-slate-600">QID expiry<TypedDateInput value={row.qidExpiry || ''} onChange={(value) => onChange({ qidExpiry: value } as Partial<T>)} className={smallInput} /></label>
          <InlineCopyUpload label="QID" hint="Back side of the card" onRead={(file) => readCopy(file, 'QID')} />
        </div>
      </fieldset>
    </div>
    <label className="min-w-0 text-sm font-medium text-slate-700">Date of birth<TypedDateInput value={row.dateOfBirth || ''} onChange={(value) => onChange({ dateOfBirth: value } as Partial<T>)} className={inputClass} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">PEP (politically exposed person)<select className={inputClass} value={row.isPep || ''} onChange={(event) => onChange({ isPep: event.target.value } as Partial<T>)}><option value="">Select</option><option>Yes</option><option>No</option></select></label>
  </>;
}
