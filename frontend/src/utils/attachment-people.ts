import { personKeys } from './linked-people';
import { withDerivedIdentity } from './person-identity';
import type { DocumentPerson } from './document-people';

// Staff upload each person's QID / passport on the Attachments step and say what the person is to the company.
// Those positions are written to the people of the enquiry form, which the KYC is created from, so nobody is typed
// twice: Shareholder -> shareholder row, UBO -> beneficial owner, Contact Person -> key contact, every other position
// (Director, Manager, Secretary ...) -> one management row per person with all their positions.

type Row = Record<string, any>;

export const CONTACT_PERSON = 'Contact Person';
export const SHAREHOLDER = 'Shareholder';
export const UBO = 'UBO';

// What can be chosen against a person's QID / passport. The order is the order of the list.
export const attachmentPositionOptions = [
  SHAREHOLDER, UBO, 'Director', 'Managing Director', 'Chairman', 'Manager', 'General Manager', 'CEO', 'CFO', 'COO',
  'Secretary', 'Authorized Signatory', 'SEF', CONTACT_PERSON
];

const text = (value: unknown) => String(value ?? '').trim();
const normalizeName = (value: unknown) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Positions that make a management row (everything but ownership and the key contact).
export const officerPositions = (positions: string[]) => positions.filter((item) => item !== SHAREHOLDER && item !== UBO && item !== CONTACT_PERSON);

export type PlacementLayout = {
  newShareholder: () => Row;
  newOfficer: () => Row;
  setPositions: (row: Row, positions: string[]) => Row;
  positionsOf: (row: Row) => string[];
  // Matches the country list of the form; returns the text kept on the row.
  nationality: (value: string) => string;
};

export type Placement = { shareholders: Row[]; ubos: Row[]; management: Row[]; contact: boolean };

function personValues(person: DocumentPerson, layout: PlacementLayout): Row {
  const out: Row = {};
  for (const field of ['fullName', 'dateOfBirth', 'qidNumber', 'qidExpiry', 'passportNumber', 'passportExpiry'] as const) {
    if (text(person.row[field])) out[field] = text(person.row[field]);
  }
  if (text(person.row.nationality)) out.nationality = layout.nationality(text(person.row.nationality));
  return out;
}

// Fills only what the row does not already hold; nothing typed is overwritten.
function fillEmpty(row: Row, values: Row): Row {
  const next = { ...row };
  for (const [key, value] of Object.entries(values)) if (!text(next[key])) next[key] = value;
  return withDerivedIdentity(next);
}

// The row of this person: the same QID / passport number, else the same name. `before` is the person as they were
// when the rows were last written, so a corrected name still finds the row it created.
function findIndex(rows: Row[], keys: string[], names: string[]) {
  const byKey = keys.length ? rows.findIndex((row) => personKeys(row).some((key) => keys.includes(key))) : -1;
  if (byKey >= 0) return byKey;
  const wanted = names.map(normalizeName).filter(Boolean);
  return wanted.length ? rows.findIndex((row) => wanted.includes(normalizeName(row.fullName))) : -1;
}

export function placePerson(current: { shareholders: Row[]; ubos: Row[]; management: Row[] }, person: DocumentPerson, positions: string[], layout: PlacementLayout, before?: DocumentPerson): Placement {
  const values = personValues(person, layout);
  const keys = [...personKeys(person.row), ...(before ? personKeys(before.row) : [])];
  const names = [text(person.row.fullName), text(before?.row.fullName)];
  const shareholder = positions.includes(SHAREHOLDER);
  const ubo = positions.includes(UBO);
  const officer = officerPositions(positions);

  let shareholders = current.shareholders.slice();
  let ubos = current.ubos.slice();
  let management = current.management.slice();

  const emptyRow = (row: Row) => !text(row.fullName) && !personKeys(row).length;

  // Shareholders (and a shareholder who is also a beneficial owner).
  const sIndex = findIndex(shareholders, keys, names);
  if (shareholder) {
    if (sIndex >= 0) shareholders[sIndex] = { ...fillEmpty(shareholders[sIndex], values), isUbo: ubo };
    else {
      const blank = shareholders.findIndex(emptyRow);
      const row: Row = { ...fillEmpty({ ...layout.newShareholder() }, values), isUbo: ubo };
      if (blank >= 0) shareholders[blank] = { ...row, id: shareholders[blank].id || row.id };
      else shareholders.push(row);
    }
  } else if (sIndex >= 0 && !text(shareholders[sIndex].ownershipPercentage) && !text(shareholders[sIndex].parentRowId)) {
    // No longer a shareholder and nothing else was entered on the row.
    shareholders = shareholders.filter((_, index) => index !== sIndex);
  } else if (sIndex >= 0 && shareholders[sIndex].isUbo && !ubo) {
    shareholders[sIndex] = { ...shareholders[sIndex], isUbo: false };
  }

  // A beneficial owner who is not a shareholder is a separate beneficial owner row.
  const uIndex = findIndex(ubos, keys, names);
  const standaloneUbo = ubo && !shareholder;
  if (standaloneUbo) {
    if (uIndex >= 0) ubos[uIndex] = fillEmpty(ubos[uIndex], values);
    else {
      const blank = ubos.findIndex(emptyRow);
      const row: Row = { ...fillEmpty({ ...layout.newShareholder() }, values), isUbo: true };
      if (blank >= 0) ubos[blank] = { ...row, id: ubos[blank].id || row.id };
      else ubos.push(row);
    }
  } else if (uIndex >= 0 && !text(ubos[uIndex].ownershipPercentage) && !text(ubos[uIndex].uboPercentage) && !text(ubos[uIndex].sourceShareholderId)) {
    ubos = ubos.filter((_, index) => index !== uIndex);
  }

  // Management: one row per person with all their positions.
  const mIndex = findIndex(management, keys, names);
  if (officer.length) {
    if (mIndex >= 0) {
      // Positions typed on the Management step that are not in the attachment list stay.
      const custom = layout.positionsOf(management[mIndex]).filter((item) => !attachmentPositionOptions.includes(item));
      management[mIndex] = layout.setPositions(fillEmpty(management[mIndex], values), [...officer, ...custom]);
    } else {
      const blank = management.findIndex(emptyRow);
      const row = layout.setPositions(fillEmpty({ ...layout.newOfficer() }, values), officer);
      if (blank >= 0) management[blank] = { ...row, id: management[blank].id || row.id };
      else management.push(row);
    }
  } else if (mIndex >= 0) {
    const kept = layout.positionsOf(management[mIndex]).filter((item) => !attachmentPositionOptions.includes(item));
    if (kept.length) management[mIndex] = layout.setPositions(management[mIndex], kept);
    else management = management.filter((_, index) => index !== mIndex);
  }

  return { shareholders, ubos, management, contact: positions.includes(CONTACT_PERSON) };
}
