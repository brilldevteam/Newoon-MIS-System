import { FileScan, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { TypedDateInput } from './TypedDateInput';
import { readEnquiryIdentityDocument } from '../services/kyc-workflow.service';
import { withDerivedIdentity } from '../utils/person-identity';

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

// Turns a name read from the document ("JOHN MICHAEL SMITH") into "John Michael Smith".
const titleCase = (value: string) => value.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

export function PreliminaryPersonFields<T extends PersonIdentity>({ row, isCompany = false, onChange, onIdentityFile }: Props<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [readType, setReadType] = useState<IdType>('PASSPORT');
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const patch = (change: Partial<T>) => {
    const next = withDerivedIdentity({ ...row, ...change } as T);
    onChange({ ...change, identityNumber: next.identityNumber } as Partial<T>);
  };

  async function readCopy(file: File) {
    setReading(true);
    setMessage(null);
    try {
      const result = await readEnquiryIdentityDocument(readType, file);
      onIdentityFile?.(file, readType);
      if (!result.found) {
        setMessage({ tone: 'warn', text: `${result.message} The copy was added to the attachments.` });
        return;
      }
      const type = result.identityType || readType;
      const change: Partial<PersonIdentity> = type === 'QID'
        ? { qidNumber: result.documentNumber || row.qidNumber || '', qidExpiry: result.expiryDate || row.qidExpiry || '' }
        : { passportNumber: result.documentNumber || row.passportNumber || '', passportExpiry: result.expiryDate || row.passportExpiry || '' };
      if (result.dateOfBirth && !row.dateOfBirth) change.dateOfBirth = result.dateOfBirth;
      const nameFilled = Boolean(result.nameOnDocument && !row.fullName.trim());
      if (nameFilled) change.fullName = titleCase(result.nameOnDocument);
      patch(change as Partial<T>);
      const checks = [
        result.documentNumberCheck !== 'OK' ? 'the number' : '',
        result.expiryDate && !result.expiryValid ? 'the expiry date' : '',
        nameFilled ? 'the name' : ''
      ].filter(Boolean);
      const label = type === 'QID' ? 'QID' : 'Passport';
      setMessage({
        tone: checks.some((item) => item !== 'the name') || !result.typeMatches ? 'warn' : 'ok',
        text: `${label} details filled from the copy${result.typeMatches ? '' : ` (the file looks like a ${label}, not a ${readType === 'QID' ? 'QID' : 'passport'})`}.${checks.length ? ` Compare ${checks.join(' and ')} with the document.` : ' Check them against the document.'}`
      });
    } catch {
      setMessage({ tone: 'warn', text: 'The copy could not be read. Enter the details from the document.' });
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (isCompany) {
    return <label className="min-w-0 text-sm font-medium text-slate-700">Date of incorporation<TypedDateInput value={row.dateOfBirth || ''} onChange={(value) => onChange({ dateOfBirth: value } as Partial<T>)} className={inputClass} /></label>;
  }

  return <>
    <label className="min-w-0 text-sm font-medium text-slate-700">Passport number<input className={inputClass} value={row.passportNumber || ''} onChange={(event) => patch({ passportNumber: event.target.value } as Partial<T>)} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">Passport expiry<TypedDateInput value={row.passportExpiry || ''} onChange={(value) => onChange({ passportExpiry: value } as Partial<T>)} className={inputClass} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">QID number<input className={inputClass} inputMode="numeric" value={row.qidNumber || ''} onChange={(event) => patch({ qidNumber: event.target.value } as Partial<T>)} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">QID expiry<TypedDateInput value={row.qidExpiry || ''} onChange={(value) => onChange({ qidExpiry: value } as Partial<T>)} className={inputClass} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">Date of birth<TypedDateInput value={row.dateOfBirth || ''} onChange={(value) => onChange({ dateOfBirth: value } as Partial<T>)} className={inputClass} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">PEP (politically exposed person)<select className={inputClass} value={row.isPep || ''} onChange={(event) => onChange({ isPep: event.target.value } as Partial<T>)}><option value="">Select</option><option>Yes</option><option>No</option></select></label>
    <div className="min-w-0 sm:col-span-full" style={{ gridColumn: '1 / -1' }}>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
        <FileScan className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="text-sm text-slate-700">Fill from a copy:</span>
        <select aria-label="Document type to read" className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" value={readType} onChange={(event) => setReadType(event.target.value as IdType)} disabled={reading}>
          <option value="PASSPORT">Passport</option>
          <option value="QID">QID (back side)</option>
        </select>
        <button type="button" disabled={reading} onClick={() => fileRef.current?.click()} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">
          {reading ? <><Loader2 className="h-4 w-4 animate-spin" />Reading...</> : 'Upload and read'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCopy(file); }} />
      </div>
      {message && <p role="status" className={`mt-1.5 text-xs ${message.tone === 'ok' ? 'text-teal-800' : 'text-amber-800'}`}>{message.text}</p>}
    </div>
  </>;
}
