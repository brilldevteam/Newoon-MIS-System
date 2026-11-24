import { TypedDateInput } from './TypedDateInput';
import { readEnquiryIdentityDocument } from '../services/kyc-workflow.service';
import { withDerivedIdentity } from '../utils/person-identity';
import { FillOutcome, identityFill } from '../utils/document-fill';
import { DocumentFillBar } from './DocumentFillBar';

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
    <label className="min-w-0 text-sm font-medium text-slate-700">Passport number<input className={inputClass} value={row.passportNumber || ''} onChange={(event) => patch({ passportNumber: event.target.value } as Partial<T>)} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">Passport expiry<TypedDateInput value={row.passportExpiry || ''} onChange={(value) => onChange({ passportExpiry: value } as Partial<T>)} className={inputClass} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">QID number<input className={inputClass} inputMode="numeric" value={row.qidNumber || ''} onChange={(event) => patch({ qidNumber: event.target.value } as Partial<T>)} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">QID expiry<TypedDateInput value={row.qidExpiry || ''} onChange={(value) => onChange({ qidExpiry: value } as Partial<T>)} className={inputClass} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">Date of birth<TypedDateInput value={row.dateOfBirth || ''} onChange={(value) => onChange({ dateOfBirth: value } as Partial<T>)} className={inputClass} /></label>
    <label className="min-w-0 text-sm font-medium text-slate-700">PEP (politically exposed person)<select className={inputClass} value={row.isPep || ''} onChange={(event) => onChange({ isPep: event.target.value } as Partial<T>)}><option value="">Select</option><option>Yes</option><option>No</option></select></label>
    <DocumentFillBar label="Fill from a copy:" options={[{ value: 'PASSPORT', label: 'Passport' }, { value: 'QID', label: 'QID (back side)' }]} onRead={readCopy} />
  </>;
}
