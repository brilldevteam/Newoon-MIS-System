import type { DocumentReading } from '../services/legal-documents.service';
import type { EnquiryIdentityReading } from '../services/kyc-workflow.service';
import type { CompanyTarget } from './document-fill';
import { companyFill, matchOption, titleCase } from './document-fill';
import { suggestedPartyType, type DocumentPerson } from './people-from-document';
import { personKeys, type PeopleAdapter } from './linked-people';

export type IntakeKind = 'AUTO' | 'COMPANY' | 'PASSPORT' | 'QID';
export type IntakeReading = { kind: 'COMPANY'; data: DocumentReading } | { kind: 'IDENTITY'; data: Extract<EnquiryIdentityReading, { found: true }> };
export type IntakeField = { key: string; label: string; value: string; selected: boolean; expected: Record<string, unknown>; patch: Record<string, string>; conflict: boolean; options?: string[]; uncertain?: boolean };
export type IntakePerson = DocumentPerson;
export type IntakeApplication = { file: File; kind: IntakeReading['kind']; fields: IntakeField[]; people: IntakePerson[]; target: string; expectedPerson?: Record<string, unknown>; documentType?: string };
export type IntakeTarget = { value: string; label: string; row: Record<string, unknown>; omitFields?: string[]; nationalityOptions?: string[] };
export const newIntakePersonTargets: IntakeTarget[] = [
  { value: 'new:shareholder', label: 'Add a new shareholder', row: {} },
  { value: 'new:ubo', label: 'Add a new beneficial owner (confirm ownership manually)', row: {} },
  { value: 'new:director', label: 'Add a new director', row: {} },
  { value: 'new:manager', label: 'Add a new manager', row: {} }
];

export function appendReviewedPerson<T extends object>(rows: T[], person: T): T[] {
  const next = person as Record<string, unknown>;
  if (!String(next.fullName || '').trim()) throw new Error('A new person needs a name.');
  const normalized = (value: unknown) => String(value || '').replace(/[\s-]+/g, '').toUpperCase();
  const keys = (row: Record<string, unknown>) => ['passportNumber', 'qidNumber'].map(key => row[key] ? `${key}:${normalized(row[key])}` : '').filter(Boolean);
  const nextKeys = keys(next);
  if (rows.some(item => {
    const row = item as Record<string, unknown>; const currentKeys = keys(row);
    return nextKeys.some(key => currentKeys.includes(key)) || ((!nextKeys.length || !currentKeys.length) && normalized(row.fullName) === normalized(next.fullName));
  })) throw new Error('This person may already be listed. Choose the existing person instead of adding a duplicate.');
  const blankIndex = rows.findIndex(item => {
    const row = item as Record<string, unknown>;
    return row.shareholderType !== 'Corporate Entity' && Object.entries(row).every(([key, value]) => ['id', 'shareholderType', 'isUbo'].includes(key) || value === false || value == null || (Array.isArray(value) ? !value.length : String(value).trim() === ''));
  });
  return blankIndex < 0 ? [...rows, person] : rows.map((item, index) => index === blankIndex ? person : item);
}

export function suggestedDocumentKind(name: string): IntakeKind {
  if (/\bqid\b|residen[ct]|qatar.?id/i.test(name)) return 'QID';
  if (/passport/i.test(name)) return 'PASSPORT';
  if (/\bcr\b|registration|incorporation|reservation|shareholder|approval/i.test(name)) return 'COMPANY';
  return 'AUTO';
}

export function validateIntakeFile(file: Pick<File, 'size' | 'type' | 'name'>): string {
  if (!file.size) return 'This file is empty.';
  if (file.size > 10 * 1024 * 1024) return 'Maximum file size is 10 MB.';
  if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name) || (file.type && !/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type))) return 'Choose a PDF, PNG, JPEG or WebP file.';
  return '';
}

export async function readIntakeDocument(file: File, kind: IntakeKind, company: (file: File) => Promise<DocumentReading>, identity: (kind: 'PASSPORT' | 'QID', file: File) => Promise<EnquiryIdentityReading>): Promise<IntakeReading> {
  // Try the existing local identity reader before sending an unclassified file to the company reader/provider.
  if (kind === 'AUTO') {
    const local = await identity('PASSPORT', file);
    if (local.found) return { kind: 'IDENTITY', data: local };
  }
  if (kind === 'AUTO' || kind === 'COMPANY') {
    const data = await company(file);
    if (!Object.values(data.company).some(value => Boolean(value?.trim())) && !data.people.length) throw new Error(data.message || 'No usable details were found. Enter the details manually.');
    return { kind: 'COMPANY', data };
  }
  const data = await identity(kind === 'QID' ? 'QID' : 'PASSPORT', file);
  if (!data.found) throw new Error(data.message || 'No identity details were found. Try the other side or enter them manually.');
  return { kind: 'IDENTITY', data };
}

export function intakeFields(reading: IntakeReading, current: Record<string, unknown>, targets: CompanyTarget[]): IntakeField[] {
  const values: Array<{ key: string; label: string; patch: Record<string, string>; options?: string[] }> = [];
  if (reading.kind === 'COMPANY') {
    for (const target of targets) {
      const raw = reading.data.company[target.field];
      if (!raw?.trim()) continue;
      const empty = companyFill({}, reading.data, [target]);
      const patch = empty.filled;
      if (Object.keys(patch).length) {
        const options = target.options && target.otherKey && !target.options.includes('Other') ? [...target.options, 'Other'] : target.options;
        values.push({ key: target.key, label: target.label, patch: { [target.key]: patch[target.key]! }, options });
        if (target.otherKey && patch[target.otherKey]) values.push({ key: target.otherKey, label: `${target.label} (other)`, patch: { [target.otherKey]: patch[target.otherKey]! } });
      }
    }
  } else {
    const data = reading.data;
    const type = data.identityType || 'PASSPORT';
    const fields = [
      ['fullName', 'Full name', data.nameOnDocument ? titleCase(data.nameOnDocument) : ''],
      ['dateOfBirth', 'Date of birth', data.dateOfBirth],
      ['passportNumber', 'Passport number', data.passport?.number || (type === 'PASSPORT' ? data.documentNumber : '')],
      ['passportExpiry', 'Passport expiry', data.passport?.expiry || (type === 'PASSPORT' ? data.expiryDate : '')],
      ['qidNumber', 'QID number', data.qid?.number || (type === 'QID' ? data.documentNumber : '')],
      ['qidExpiry', 'QID expiry', data.qid?.expiry || (type === 'QID' ? data.expiryDate : '')]
    ];
    for (const [key, label, value] of fields) if (value) values.push({ key: key!, label: label!, patch: { [key!]: value } });
  }
  return values.map(({ key, label, patch, options }) => {
    const conflict = Object.entries(patch).some(([field, value]) => String(current[field] ?? '').trim() !== '' && String(current[field]) !== value);
    const uncertain = reading.kind === 'IDENTITY' && (Boolean(reading.data.readFromText) || (['passportNumber', 'qidNumber'].includes(key) && reading.data.documentNumberCheck !== 'OK') || (['passportExpiry', 'qidExpiry'].includes(key) && !reading.data.expiryValid));
    return { key, label, value: patch[key] || '', patch, options, expected: Object.fromEntries(Object.keys(patch).map(field => [field, current[field] ?? ''])), selected: !conflict && !uncertain, conflict, uncertain };
  });
}

// Reject stale review selections rather than replacing information edited after the review opened.
export function reviewedPatch(current: Record<string, unknown>, fields: IntakeField[]): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const field of fields.filter(item => item.selected)) {
    if (field.options && !field.options.includes(field.value)) throw new Error(`Choose a valid ${field.label}.`);
    if (field.value && ['dateOfBirth', 'passportExpiry', 'qidExpiry', 'crExpiryDate', 'dateOfIncorporation'].includes(field.key) && (!/^\d{4}-\d{2}-\d{2}$/.test(field.value) || !Number.isFinite(Date.parse(field.value)) || new Date(field.value).toISOString().slice(0, 10) !== field.value)) throw new Error(`${field.label} must be a valid date in YYYY-MM-DD format.`);
    for (const [key, expected] of Object.entries(field.expected)) if (JSON.stringify(current[key] ?? '') !== JSON.stringify(expected)) throw new Error(`${field.label} changed in the form. Try the file again to fill the remaining empty fields.`);
    Object.assign(patch, field.patch);
  }
  return patch;
}

export function validateReviewedPeople(people: IntakePerson[]) {
  for (const person of people) {
    if (!person.fullName.trim()) throw new Error('Each selected person needs a name.');
    if (!person.roles.some(role => role !== 'OTHER')) throw new Error(`Choose a supported role for ${person.fullName}, or leave this person unchecked.`);
    if (person.partyType === 'CORPORATE' && person.roles.some(role => role !== 'SHAREHOLDER' && role !== 'OTHER')) throw new Error(`${person.fullName} is a company. Only individuals can be added as management in this form.`);
    if (person.sharePercentage && (!Number.isFinite(Number(person.sharePercentage)) || Number(person.sharePercentage) < 0 || Number(person.sharePercentage) > 100)) throw new Error(`Shareholder percentage for ${person.fullName} must be between 0 and 100.`);
  }
}

const idKey = (value: unknown) => String(value || '').replace(/[\s-]/g, '').toUpperCase();
const nameKey = (value: unknown) => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hasValue = (value: unknown) => Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '';

export function applyAutomaticIdentity<F>(current: F, adapter: PeopleAdapter<F>, slot: string, fields: IntakeField[]): F {
  const people = adapter.read(current);
  const target = people.find(person => person.slot === slot);
  if (!target) throw new Error('Choose a person for this document.');
  const patch = reviewedPatch(target.row, fields);
  const keys = personKeys({ ...target.row, ...patch });
  let next = adapter.write(current, slot, patch);
  for (const other of people) {
    if (other.slot === slot || !personKeys(other.row).some(key => keys.includes(key))) continue;
    const emptyFields = Object.fromEntries(Object.entries(patch).filter(([key]) => !hasValue(other.row[key])));
    if (Object.keys(emptyFields).length) next = adapter.write(next, other.slot, emptyFields);
  }
  return next;
}

export function automaticIdentityTarget(data: Extract<EnquiryIdentityReading, { found: true }>, targets: IntakeTarget[]): string {
  const rows = targets.filter(target => !target.value.startsWith('new:'));
  const numbers = {
    qidNumber: data.qid?.number || (data.identityType === 'QID' ? data.documentNumber : ''),
    passportNumber: data.passport?.number || (data.identityType !== 'QID' ? data.documentNumber : '')
  };
  const exact = rows.filter(target => Object.entries(numbers).some(([key, value]) => value && idKey(target.row[key]) === idKey(value)));
  if (exact.length) return (exact.find(target => target.value === 'contact') || exact[0])!.value;
  const named = rows.filter(target => nameKey(data.nameOnDocument) && nameKey(target.row.fullName) === nameKey(data.nameOnDocument) && !Object.entries(numbers).some(([key, value]) => value && hasValue(target.row[key]) && idKey(target.row[key]) !== idKey(value)));
  if (named.length === 1) return named[0]!.value;
  // A new enquiry's only person is its still-empty key contact. Do not guess a shareholder/UBO/management role.
  const contact = rows.find(target => target.value === 'contact' && !['fullName', 'qidNumber', 'passportNumber'].some(key => hasValue(target.row[key])));
  return contact && !rows.some(target => hasValue(target.row.fullName) || hasValue(target.row.qidNumber) || hasValue(target.row.passportNumber)) ? contact.value : '';
}

type AutomaticOptions = {
  file: File; company: Record<string, unknown>; companyTargets: CompanyTarget[]; targets: IntakeTarget[];
  target?: string; peopleEnabled?: boolean; attachmentTypes?: { COMPANY: string[]; IDENTITY: string[] };
};

export function automaticIntakeApplication(reading: IntakeReading, options: AutomaticOptions): { application: IntakeApplication | null; note: string } {
  const targetValue = reading.kind === 'IDENTITY' ? options.target || automaticIdentityTarget(reading.data, options.targets) : '';
  const target = options.targets.find(item => item.value === targetValue);
  if (reading.kind === 'IDENTITY' && !target) return { application: null, note: 'Choose the person this document belongs to.' };
  const current = reading.kind === 'COMPANY' ? options.company : target!.row;
  const candidates = intakeFields(reading, current, options.companyTargets).filter(field => !target?.omitFields?.includes(field.key));
  if (reading.kind === 'IDENTITY' && reading.data.nationality && target?.nationalityOptions) {
    const source = reading.data.nationality.trim();
    const direct = matchOption(source, target.nationalityOptions);
    const derived = target.nationalityOptions.filter(value => value.toLowerCase().startsWith(source.toLowerCase()) && /^(?:ese|ian|i|n|ish)$/i.test(value.slice(source.length)));
    const nationality = direct || (source.length >= 4 && derived.length === 1 ? derived[0] : '');
    if (nationality) candidates.push({ key: 'nationality', label: 'Nationality', value: nationality, patch: { nationality }, selected: true, conflict: hasValue(current.nationality) && String(current.nationality) !== nationality, expected: { nationality: current.nationality ?? '' } });
  }
  const skipped: string[] = [];
  const fields = candidates.map(field => {
    if (field.conflict || hasValue(current[field.key])) { if (field.conflict) skipped.push(field.label); return { ...field, selected: false }; }
    const selected = { ...field, selected: true };
    try { reviewedPatch(current, [selected]); return selected; }
    catch { skipped.push(field.label); return { ...field, selected: false }; }
  });
  const people: IntakePerson[] = [];
  if (reading.kind === 'COMPANY' && options.peopleEnabled !== false) for (const source of reading.data.people) {
    const person = { ...source, roles: [...source.roles], partyType: suggestedPartyType(source.fullName) };
    if (person.sharePercentage && (!Number.isFinite(Number(person.sharePercentage)) || Number(person.sharePercentage) < 0 || Number(person.sharePercentage) > 100)) { person.sharePercentage = null; skipped.push('Ownership percentage'); }
    try { validateReviewedPeople([person]); people.push(person); } catch { skipped.push('Unassigned person'); }
  }
  const types = options.attachmentTypes?.[reading.kind] || [];
  const category = reading.kind === 'COMPANY' && /\bcr\b|commercial.?registration|registration.?extract/i.test(options.file.name) ? types.find(type => /Commercial Registration \/ CR Extract/.test(type)) : undefined;
  const count = fields.filter(field => field.selected).length;
  return {
    application: { file: options.file, kind: reading.kind, fields, people, target: targetValue, expectedPerson: target ? { ...target.row } : undefined, documentType: category || types[0] },
    note: `${count} field${count === 1 ? '' : 's'} filled${people.length ? `; ${people.length} named parties processed` : ''}.${skipped.length ? ` Kept existing values or left for manual entry: ${[...new Set(skipped)].join(', ')}.` : ''}`
  };
}
