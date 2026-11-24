import type { EnquiryIdentityReading } from '../services/kyc-workflow.service';
import type { DocumentReading } from '../services/legal-documents.service';

// Turning what the server read from an uploaded copy into form values. Every value is a suggestion: the forms show
// what was filled and staff check it against the document before saving.

export type FillOutcome = {
  tone: 'ok' | 'warn';
  text: string;
  // An optional follow-up, such as replacing values staff had already typed with the ones on the document.
  action?: { label: string; run: () => string };
};

export type IdentityType = 'PASSPORT' | 'QID';

type IdentityRow = { fullName?: string; passportNumber?: string; passportExpiry?: string; qidNumber?: string; qidExpiry?: string; dateOfBirth?: string };

// "JOHN MICHAEL SMITH" -> "John Michael Smith".
export const titleCase = (value: string) => value.toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

const blank = (value: unknown) => (Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === '');

// Passport / QID number and expiry from the machine-readable lines, plus the date of birth and the name when the
// row has none. Returns the change to apply and the note to show.
export function identityFill(row: IdentityRow, result: EnquiryIdentityReading, readType: IdentityType): { change: Partial<IdentityRow>; outcome: FillOutcome } {
  if (!result.found) return { change: {}, outcome: { tone: 'warn', text: result.message } };
  const type = result.identityType || readType;
  const change: Partial<IdentityRow> = type === 'QID'
    ? { qidNumber: result.qid?.number || result.documentNumber || row.qidNumber || '', qidExpiry: result.qid?.expiry || result.expiryDate || row.qidExpiry || '' }
    : { passportNumber: result.passport?.number || result.documentNumber || row.passportNumber || '', passportExpiry: result.passport?.expiry || result.expiryDate || row.passportExpiry || '' };
  if (result.dateOfBirth && blank(row.dateOfBirth)) change.dateOfBirth = result.dateOfBirth;
  const nameFilled = Boolean(result.nameOnDocument && blank(row.fullName));
  if (nameFilled) change.fullName = titleCase(result.nameOnDocument);
  // A copy can contain both documents. Fill the secondary number/date even without the printed-text marker.
  const sameNumber = (a: string | undefined, b: string) => String(a || '').replace(/[\s-]+/g, '').toUpperCase() === b.replace(/[\s-]+/g, '').toUpperCase();
  if (type !== 'QID' && result.qid?.number) {
    if (blank(row.qidNumber)) change.qidNumber = result.qid.number;
    if (result.qid.expiry && blank(row.qidExpiry) && (blank(row.qidNumber) || sameNumber(row.qidNumber, result.qid.number))) change.qidExpiry = result.qid.expiry;
  }
  if (type !== 'PASSPORT' && result.passport?.number) {
    if (blank(row.passportNumber)) change.passportNumber = result.passport.number;
    if (result.passport.expiry && blank(row.passportExpiry) && (blank(row.passportNumber) || sameNumber(row.passportNumber, result.passport.number))) change.passportExpiry = result.passport.expiry;
  }
  if (result.readFromText) {
    const read = [
      result.qid ? `QID ${result.qid.number}${result.qid.expiry ? ` (expiry ${result.qid.expiry})` : ''}` : '',
      result.passport ? `passport ${result.passport.number}${result.passport.expiry ? ` (expiry ${result.passport.expiry})` : ''}` : '',
      result.dateOfBirth ? `date of birth ${result.dateOfBirth}` : '',
      nameFilled ? 'the name' : ''
    ].filter(Boolean);
    return {
      change,
      outcome: { tone: 'warn', text: `Read from the printed text of the card (it has no machine-readable lines): ${read.join(', ')}. There are no check digits on this card, so compare every value with the document.` }
    };
  }
  const checks = [
    result.documentNumberCheck !== 'OK' ? 'the number' : '',
    result.expiryDate && !result.expiryValid ? 'the expiry date' : '',
    nameFilled ? 'the name' : ''
  ].filter(Boolean);
  const label = type === 'QID' ? 'QID' : 'Passport';
  const expiry = result.expiryDate ? `, expiry ${result.expiryDate}` : '';
  return {
    change,
    outcome: {
      tone: checks.some((item) => item !== 'the name') || !result.typeMatches ? 'warn' : 'ok',
      text: `${label} details filled from the copy (number ${result.documentNumber || 'not read'}${expiry})${result.typeMatches ? '' : ` - the file looks like a ${label}, not a ${readType === 'QID' ? 'QID' : 'passport'}`}.${checks.length ? ` Compare ${checks.join(' and ')} with the document.` : ' Check them against the document.'}`
    }
  };
}

export type CompanyField = keyof DocumentReading['company'];

// Where a company value read from the document goes on a form. A list field takes the matching option, or
// "Other" with the read text when `otherKey` is given.
export type CompanyTarget = { field: CompanyField; key: string; label: string; options?: string[]; otherKey?: string };

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Exact match first; otherwise whole words: "State of Qatar" -> "Qatar", "Limited Liability Company" ->
// "Limited Liability Company (LLC)". Never part of a word ("Oman" is not "Romania").
export function matchOption(value: string, options: string[]) {
  const wanted = normalize(value);
  if (!wanted) return '';
  // "A Limited Liability Company incorporated in the QFC" also counts as "LLC".
  const words = (text: string) => {
    const list = normalize(text).split(' ').filter(Boolean);
    return list.includes('limited') && list.includes('liability') && !list.includes('llc') ? [...list, 'llc'] : list;
  };
  const contains = (outer: string[], inner: string[]) => inner.length > 0 && inner.every((word) => outer.includes(word));
  const candidates = options.filter((option) => option && option !== 'Other');
  const exact = candidates.find((option) => normalize(option) === wanted);
  if (exact) return exact;
  // The most specific option wins; a one-word value ("LLC") is too vague to pick a longer option by itself.
  const matches = candidates.filter((option) => contains(words(value), words(option)) || (words(value).length >= 2 && contains(words(option), words(value))));
  return matches.sort((a, b) => words(b).length - words(a).length)[0] || '';
}

function targetPatch(target: CompanyTarget, value: string): Record<string, string> | null {
  if (!target.options) return { [target.key]: value };
  const option = matchOption(value, target.options);
  if (option) return { [target.key]: option, ...(target.otherKey ? { [target.otherKey]: '' } : {}) };
  return target.otherKey ? { [target.key]: 'Other', [target.otherKey]: value } : null;
}

function sameValue(current: Record<string, any>, patch: Record<string, string>) {
  return Object.entries(patch).every(([key, value]) => normalize(String(current[key] ?? '')) === normalize(value));
}

// Fills the empty fields from the reading. Fields that already hold a different value are left as typed and listed,
// so staff can choose to replace them with the document's values.
export function companyFill(current: Record<string, any>, reading: DocumentReading, targets: CompanyTarget[]) {
  const filled: Record<string, string> = {};
  const filledLabels: string[] = [];
  const replace: Record<string, string> = {};
  const differentLabels: string[] = [];
  for (const target of targets) {
    const value = String(reading.company[target.field] ?? '').trim();
    if (!value) continue;
    const patch = targetPatch(target, value);
    if (!patch) continue;
    if (blank(current[target.key])) {
      Object.assign(filled, patch);
      filledLabels.push(target.label);
    } else if (!sameValue(current, patch)) {
      Object.assign(replace, patch);
      differentLabels.push(`${target.label} (document: ${value.length > 60 ? `${value.slice(0, 57)}...` : value})`);
    }
  }
  return { filled, filledLabels, replace, differentLabels };
}

// The note shown after a CR was read into a form.
export function companyFillOutcome(
  reading: DocumentReading,
  result: ReturnType<typeof companyFill>,
  applyReplace: () => void,
  where = ''
): FillOutcome {
  const { filledLabels, differentLabels } = result;
  if (!filledLabels.length && !differentLabels.length) {
    const matched = Object.keys(reading.company).length > 0;
    return { tone: 'warn', text: matched ? `${reading.message} The form already shows the same details.` : reading.message };
  }
  const parts = [
    filledLabels.length ? `Filled${where}: ${filledLabels.join(', ')}.` : '',
    differentLabels.length ? `Kept your values for: ${differentLabels.join('; ')}.` : '',
    reading.message
  ].filter(Boolean);
  return {
    tone: differentLabels.length || reading.method !== 'AI' ? 'warn' : 'ok',
    text: parts.join(' '),
    action: differentLabels.length
      ? { label: 'Use the document values', run: () => { applyReplace(); return `Replaced with the document values: ${differentLabels.map((item) => item.replace(/ \(document:.*$/, '')).join(', ')}. ${reading.message}`; } }
      : undefined
  };
}
