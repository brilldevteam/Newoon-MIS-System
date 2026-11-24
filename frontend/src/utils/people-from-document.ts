import type { DocumentReading } from '../services/legal-documents.service';
import { matchOption } from './document-fill';
import { personKeys } from './linked-people';

// The shareholders, directors, managers and signatories read from a CR are added to the form's people rows, so they
// do not have to be typed: a shareholder row for each shareholder, one officer row per person with all positions.
// A person already on the form (same QID / passport number, or the same name) is not added again; only their empty
// fields are filled and new positions added. Nothing typed is overwritten.

type Row = Record<string, any>;
export type DocumentPerson = DocumentReading['people'][number] & { partyType?: 'INDIVIDUAL' | 'CORPORATE' };
type ReadPerson = DocumentPerson;

const ROLE_POSITIONS: Record<string, string[]> = {
  DIRECTOR: ['Director'],
  MANAGER: ['Manager'],
  AUTHORISED_SIGNATORY: ['Authorized Signatory'],
  SECRETARY: ['Secretary', 'Company Secretary'],
  CHAIRMAN: ['Chairman'],
  MANAGING_DIRECTOR: ['Managing Director'],
  GENERAL_MANAGER: ['General Manager'],
  CEO: ['CEO']
};

const COMPANY_NAME = /\b(?:llc|l\.l\.c|w\.?l\.?l|ltd|limited|company|holding|holdings|inc|plc|s\.?a\.?|s\.?p\.?c|gmbh|b\.?v|fz[ce]?|corporation|corp|group|trust|fund)\b/i;
export const suggestedPartyType = (name: string): 'CORPORATE' | 'INDIVIDUAL' => COMPANY_NAME.test(name) ? 'CORPORATE' : 'INDIVIDUAL';
const normalizeName = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const blank = (value: unknown) => (Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === '');

export type PeopleLayout = {
  countries: string[];
  positions: string[];
  // Enquiry rows keep nationality as "A, B" text; KYC rows as a list.
  nationalityAsText?: boolean;
  preservePartialRows?: boolean;
  newShareholder: () => Row;
  newOfficer: () => Row;
  // Writes the officer's positions onto a row in the form's own shape.
  setPositions: (row: Row, positions: string[]) => Row;
  positionsOf: (row: Row) => string[];
};

function identity(person: ReadPerson) {
  const number = String(person.idNumber || '').replace(/\s+/g, '');
  if (!number) return {};
  return /^\d{11}$/.test(number) ? { qidNumber: number } : { passportNumber: number };
}

export function addPeopleFromDocument(people: ReadPerson[], shareholders: Row[], officers: Row[], layout: PeopleLayout) {
  const added: string[] = [];
  const updated: string[] = [];
  // Empty placeholder rows are replaced rather than left above the new rows.
  const isEmpty = (row: Row) => blank(row.fullName) && !personKeys(row).length && blank(row.identityNumber) && (!layout.preservePartialRows || Object.entries(row).every(([key, value]) => ['id', 'shareholderType', 'isUbo', 'isAuthorizedSignatory'].includes(key) || value === false || value == null || blank(value)));
  let nextShareholders = shareholders.filter((row) => !isEmpty(row));
  let nextOfficers = officers.filter((row) => !isEmpty(row));
  const nationality = (person: ReadPerson) => {
    const country = person.nationality ? matchOption(person.nationality, layout.countries) : '';
    return country ? (layout.nationalityAsText ? country : [country]) : undefined;
  };
  const sameAs = (person: ReadPerson, row: Row) => {
    const keys = personKeys({ ...identity(person) });
    const rowKeys = personKeys(row);
    if (keys.length && rowKeys.length) return keys.some((key) => rowKeys.includes(key));
    const companyNumber = String(person.idNumber || '').trim();
    if (companyNumber && String(row.identityNumber || '').trim() === companyNumber) return true;
    return normalizeName(row.fullName) !== '' && normalizeName(row.fullName) === normalizeName(person.fullName);
  };
  // Only empty fields are filled on an existing row.
  const fillEmpty = (row: Row, values: Row) => {
    const change: Row = {};
    for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null && !blank(value) && blank(row[key])) change[key] = value;
    return Object.keys(change).length ? { ...row, ...change } : row;
  };

  for (const person of people) {
    const isCompany = person.partyType ? person.partyType === 'CORPORATE' : COMPANY_NAME.test(person.fullName);
    const personValues: Row = { fullName: person.fullName, nationality: isCompany ? undefined : nationality(person), ...(isCompany ? {} : identity(person)) };

    if (person.roles.includes('SHAREHOLDER')) {
      const values: Row = isCompany
        ? { fullName: person.fullName, shareholderType: 'Corporate Entity', identityNumber: person.idNumber || undefined, nationality: nationality(person) }
        : personValues;
      if (person.sharePercentage) Object.assign(values, { shareholderPercentage: person.sharePercentage, ownershipPercentage: person.sharePercentage });
      const index = nextShareholders.findIndex((row) => sameAs(person, row));
      if (index >= 0) {
        const before = nextShareholders[index];
        const after = fillEmpty(before, values);
        if (after !== before) {
          nextShareholders = nextShareholders.map((row, rowIndex) => (rowIndex === index ? after : row));
          updated.push(`${person.fullName} (shareholder)`);
        }
      } else {
        nextShareholders = [...nextShareholders, { ...layout.newShareholder(), ...(isCompany ? {} : { shareholderType: 'Individual' }), ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) }];
        added.push(`${person.fullName} (shareholder${person.sharePercentage ? ` ${person.sharePercentage}%` : ''})`);
      }
    }

    const positions = [...new Set(person.roles.flatMap((role) => ROLE_POSITIONS[role] || []).map((position) => (layout.positions.includes(position) ? position : '')).filter(Boolean))];
    // Secretary has two names across the forms; keep the one this form lists.
    if (!positions.length || isCompany) continue;
    const signatory = person.roles.includes('AUTHORISED_SIGNATORY');
    const index = nextOfficers.findIndex((row) => sameAs(person, row));
    if (index >= 0) {
      const before = nextOfficers[index];
      const merged = [...new Set([...layout.positionsOf(before), ...positions])];
      let after = fillEmpty(before, personValues);
      if (merged.length !== layout.positionsOf(before).length) after = layout.setPositions(after, merged);
      if (signatory && !before.isAuthorizedSignatory) after = { ...after, isAuthorizedSignatory: true };
      if (after !== before) {
        nextOfficers = nextOfficers.map((row, rowIndex) => (rowIndex === index ? after : row));
        updated.push(`${person.fullName} (${merged.join(', ')})`);
      }
    } else {
      const row = layout.setPositions({ ...layout.newOfficer(), ...Object.fromEntries(Object.entries(personValues).filter(([, value]) => value !== undefined)), ...(signatory ? { isAuthorizedSignatory: true } : {}) }, positions);
      nextOfficers = [...nextOfficers, row];
      added.push(`${person.fullName} (${positions.join(', ')})`);
    }
  }
  return { shareholders: nextShareholders, officers: nextOfficers, added, updated };
}
