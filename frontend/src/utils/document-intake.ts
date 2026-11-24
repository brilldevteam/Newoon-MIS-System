import type { DocumentReading } from '../services/legal-documents.service';
import type { EnquiryIdentityReading } from '../services/kyc-workflow.service';
import type { CompanyTarget } from './document-fill';
import { companyFill, titleCase } from './document-fill';
import type { DocumentPerson } from './people-from-document';

export type IntakeKind = 'AUTO' | 'COMPANY' | 'PASSPORT' | 'QID';
export type IntakeReading = { kind: 'COMPANY'; data: DocumentReading } | { kind: 'IDENTITY'; data: Extract<EnquiryIdentityReading, { found: true }> };
export type IntakeField = { key: string; label: string; value: string; selected: boolean; expected: Record<string, unknown>; patch: Record<string, string>; conflict: boolean; options?: string[]; uncertain?: boolean };
export type IntakePerson = DocumentPerson;
export type IntakeApplication = { file: File; kind: IntakeReading['kind']; fields: IntakeField[]; people: IntakePerson[]; target: string; expectedPerson?: Record<string, unknown>; documentType?: string };
export type IntakeTarget = { value: string; label: string; row: Record<string, unknown>; omitFields?: string[] };
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
    for (const [key, expected] of Object.entries(field.expected)) if (JSON.stringify(current[key] ?? '') !== JSON.stringify(expected)) throw new Error(`${field.label} changed in the form. Reopen this review before applying.`);
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
