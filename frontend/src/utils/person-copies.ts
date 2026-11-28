import { restoreDocumentPeople } from './document-people';

// Whose QID / passport copy a file is. The people (with their positions) are added on the enquiry's Attachments step
// and kept in the enquiry details; the KYC case and its form read them from the source enquiry, so a copy is shown
// with the person's name wherever documents are listed, not just as a file name.
export type PersonCopy = { name: string; kind: 'QID' | 'Passport' | '' };

export function personOfFile(details: unknown, fileName: string): PersonCopy | null {
  if (!details || typeof details !== 'object') return null;
  const person = restoreDocumentPeople((details as Record<string, unknown>).documentPeople).find((item) => item.files.includes(fileName) && item.row.fullName);
  if (!person) return null;
  const kind = person.kinds?.[fileName];
  return { name: String(person.row.fullName), kind: kind === 'QID' ? 'QID' : kind === 'PASSPORT' ? 'Passport' : '' };
}
