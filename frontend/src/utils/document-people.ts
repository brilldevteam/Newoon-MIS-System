import { identityFill } from './document-fill';
import { personKeys } from './linked-people';
import type { EnquiryIdentityReading } from '../services/kyc-workflow.service';

const fields = ['fullName', 'dateOfBirth', 'nationality', 'qidNumber', 'qidExpiry', 'passportNumber', 'passportExpiry', 'ownershipPercentage'] as const;
// positions: what the person is to the company (Shareholder, Director, Contact Person ...), chosen on the Attachments step.
export type DocumentPerson = { id: string; files: string[]; row: Partial<Record<typeof fields[number], string>>; positions?: string[]; kinds?: Record<string, 'QID' | 'PASSPORT'> };

export function restoreDocumentPeople(value: unknown): DocumentPerson[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.row || typeof item.row !== 'object') return [];
    const row = Object.fromEntries(fields.flatMap(key => typeof item.row[key] === 'string' ? [[key, item.row[key].slice(0, 500)]] : []));
    const kinds = item.kinds && typeof item.kinds === 'object' ? Object.fromEntries(Object.entries(item.kinds).filter(([, value]) => value === 'QID' || value === 'PASSPORT').slice(0, 20)) as Record<string, 'QID' | 'PASSPORT'> : undefined;
    const positions = Array.isArray(item.positions) ? item.positions.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())).map((value: string) => value.slice(0, 80)).slice(0, 20) : [];
    return [{ id: item.id.slice(0, 100), files: Array.isArray(item.files) ? item.files.filter((file: unknown): file is string => typeof file === 'string').slice(0, 20) : [], row, ...(positions.length ? { positions } : {}), ...(kinds ? { kinds } : {}) }];
  });
}

export function mergeDocumentPerson(people: DocumentPerson[], reading: EnquiryIdentityReading, file: string): DocumentPerson[] {
  if (!reading.found) return people;
  const row = { ...identityFill({}, reading, reading.identityType || 'PASSPORT').change, ...(reading.nationality ? { nationality: reading.nationality } : {}) };
  const keys = personKeys(row);
  const normalize = (value: string | undefined) => (value || '').replace(/[\s-]+/g, '').toUpperCase();
  const matches = people.filter(person => {
    const conflictingNumber = (['qidNumber', 'passportNumber'] as const).some(key => person.row[key] && row[key] && normalize(person.row[key]) !== normalize(row[key]));
    if (conflictingNumber) return false;
    if (personKeys(person.row).some(key => keys.includes(key))) return true;
    return Boolean(row.fullName && row.dateOfBirth && normalize(person.row.fullName) === normalize(row.fullName) && person.row.dateOfBirth === row.dateOfBirth);
  });
  // Name alone is not sufficient to combine identities.
  if (matches.length !== 1) return [...people, { id: crypto.randomUUID(), files: [file], row }];
  const match = matches[0];
  return people.map(person => person !== match ? person : {
    ...person, files: [...new Set([...person.files, file])],
    row: { ...row, ...Object.fromEntries(Object.entries(person.row).filter(([, value]) => Boolean(value))) }
  });
}

// A file added to one person's card is read into that person (their own values are kept; empty fields are filled).
export function mergeDocumentPersonInto(people: DocumentPerson[], personId: string, reading: EnquiryIdentityReading, file: string): DocumentPerson[] {
  return people.map(person => {
    if (person.id !== personId) return person;
    const row = reading.found ? { ...identityFill({}, reading, reading.identityType || 'PASSPORT').change, ...(reading.nationality ? { nationality: reading.nationality } : {}) } : {};
    return { ...person, files: [...new Set([...person.files, file])], row: { ...row, ...Object.fromEntries(Object.entries(person.row).filter(([, value]) => Boolean(value))) } };
  });
}

// A card for a file whose details could not be read: the name is typed in.
export function blankDocumentPerson(file?: string): DocumentPerson {
  return { id: crypto.randomUUID(), files: file ? [file] : [], row: {}, positions: [] };
}
