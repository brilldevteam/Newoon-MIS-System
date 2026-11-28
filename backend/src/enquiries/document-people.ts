import { randomUUID } from 'crypto';
import { withDerivedIdentity } from '../common/person-identity';

// People added on the enquiry's Attachments step: the QID / passport of each person with the positions chosen for
// them. For a proposed company the same people are already on the Ownership and Management steps (the form writes them
// there), so this is used for the other enquiry types, where there are no such steps, to build the KYC rows.

type Row = Record<string, unknown>;

const SHAREHOLDER = 'shareholder';
const UBO = 'ubo';
const CONTACT_PERSON = 'contact person';
const MAX_PEOPLE = 100;

const text = (value: unknown, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export type DocumentPeopleRows = { shareholders: Row[]; ubos: Row[]; management: Row[] };

export function documentPeopleRows(value: unknown): DocumentPeopleRows {
  const out: DocumentPeopleRows = { shareholders: [], ubos: [], management: [] };
  if (!Array.isArray(value)) return out;
  for (const item of value.slice(0, MAX_PEOPLE)) {
    if (!item || typeof item !== 'object') continue;
    const source = item as Record<string, unknown>;
    const row = source.row && typeof source.row === 'object' ? (source.row as Record<string, unknown>) : {};
    const fullName = text(row.fullName);
    if (!fullName) continue;
    const positions = (Array.isArray(source.positions) ? source.positions : []).map((position) => text(position, 80)).filter(Boolean).slice(0, 20);
    const person: Row = withDerivedIdentity({
      fullName,
      nationality: text(row.nationality),
      dateOfBirth: text(row.dateOfBirth),
      qidNumber: text(row.qidNumber),
      qidExpiry: text(row.qidExpiry),
      passportNumber: text(row.passportNumber),
      passportExpiry: text(row.passportExpiry),
      identityNumber: ''
    });
    const shareholder = positions.some((position) => normalized(position) === SHAREHOLDER);
    const ubo = positions.some((position) => normalized(position) === UBO);
    // Ownership and the key contact are not management positions.
    const officer = positions.filter((position) => ![SHAREHOLDER, UBO, CONTACT_PERSON].includes(normalized(position)));
    if (shareholder) out.shareholders.push({ ...person, id: randomUUID(), shareholderType: 'Individual', address: '', ownershipPercentage: text(row.ownershipPercentage, 10), isUbo: ubo, parentRowId: '' });
    else if (ubo) out.ubos.push({ ...person, id: randomUUID(), shareholderType: 'Individual', address: '', ownershipPercentage: text(row.ownershipPercentage, 10), isUbo: true });
    if (officer.length) out.management.push({ ...person, id: randomUUID(), position: officer.join(', '), positions: officer });
  }
  return out;
}
