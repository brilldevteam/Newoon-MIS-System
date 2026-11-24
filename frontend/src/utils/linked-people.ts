// One person can hold several roles on a form (shareholder, beneficial owner, manager, key contact). Staff pick
// "Same person as ..." instead of typing the details again, and rows that share a QID or passport number stay
// linked: a change to the person's details on one row is copied to the others. The same number is also how the
// screening and the client records recognise one person, so the link carries through the application.

type Row = Record<string, any>;

// Details that belong to the person, not to the role (share %, position, signatory, address stay per row).
export const PERSON_FIELDS = [
  'fullName', 'title', 'nationality', 'nationalityOther', 'dateOfBirth', 'qidNumber', 'qidExpiry', 'passportNumber', 'passportExpiry',
  'isPep', 'pepDetails', 'dualCitizenship', 'otherNationality'
] as const;

// hidden: kept in step (synced) but not offered or named, e.g. a company shareholder or a UBO row that mirrors a
// shareholder already listed.
// source: the form object the slot was read from, so a row component can find its own slot.
export type PersonSlot = { slot: string; role: string; row: Row; hidden?: boolean; source?: object };

// Reads the people of a form into slots and writes one slot back.
export type PeopleAdapter<F> = {
  read: (form: F) => PersonSlot[];
  write: (form: F, slot: string, change: Row) => F;
};

const normalizeNumber = (value: unknown) => String(value ?? '').replace(/[\s\-]+/g, '').toUpperCase();

export function personKeys(row: Row): string[] {
  const qid = normalizeNumber(row.qidNumber);
  const passport = normalizeNumber(row.passportNumber);
  return [qid ? `QID:${qid}` : '', passport ? `PASSPORT:${passport}` : ''].filter(Boolean);
}

const sharesKey = (a: string[], b: string[]) => a.some((key) => b.includes(key));
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const hasValue = (value: unknown) => (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '');

// After a change, copies the person details that changed on one row to the rows linked to it (same QID or passport
// before the change). Skipped when rows were added or removed, so a shifted list never copies to the wrong person.
export function syncLinkedPeople<F>(prev: F, next: F, adapter: PeopleAdapter<F>): F {
  if (prev === next) return next;
  const before = adapter.read(prev);
  const after = adapter.read(next);
  if (before.length !== after.length || before.some((item, index) => item.slot !== after[index].slot)) return next;
  let result = next;
  after.forEach((person, index) => {
    const old = before[index];
    const changed = PERSON_FIELDS.filter((field) => !sameValue(old.row[field], person.row[field]));
    if (!changed.length) return;
    const keys = personKeys(old.row);
    if (!keys.length) return;
    after.forEach((other, otherIndex) => {
      if (otherIndex === index || !sharesKey(keys, personKeys(before[otherIndex].row))) return;
      // A field edited on both rows in the same update keeps each row's own value.
      const patch: Row = {};
      for (const field of changed) if (sameValue(before[otherIndex].row[field], other.row[field])) patch[field] = person.row[field];
      if (Object.keys(patch).length) result = adapter.write(result, other.slot, patch);
    });
  });
  return result;
}

// The person details of a row, to copy onto another row ("Same person as ...").
export function personDetails(row: Row): Row {
  const out: Row = {};
  for (const field of PERSON_FIELDS) if (hasValue(row[field])) out[field] = row[field];
  return out;
}

export type PersonChoice = { value: string; label: string; slots: string[] };

// One choice per person: rows that share a QID / passport number are listed once with all their roles.
export function personChoices(people: PersonSlot[], exceptSlot: string): PersonChoice[] {
  const self = people.find((person) => person.slot === exceptSlot);
  const selfKeys = self ? personKeys(self.row) : [];
  const groups: Array<{ keys: string[]; people: PersonSlot[] }> = [];
  for (const person of people) {
    if (person.slot === exceptSlot || person.hidden || !String(person.row.fullName || '').trim()) continue;
    const keys = personKeys(person.row);
    if (keys.length && sharesKey(keys, selfKeys)) continue; // already the same person
    const group = keys.length ? groups.find((item) => sharesKey(item.keys, keys)) : undefined;
    if (group) {
      group.people.push(person);
      group.keys = [...new Set([...group.keys, ...keys])];
    } else {
      groups.push({ keys, people: [person] });
    }
  }
  return groups.map((group) => {
    const first = group.people[0];
    const roles = [...new Set(group.people.map((person) => person.role))].join(', ');
    return { value: first.slot, label: `${first.row.fullName} (${roles})`, slots: group.people.map((person) => person.slot) };
  });
}

// The other rows already linked to this one, for the "Also: ..." note.
export function linkedRoles(people: PersonSlot[], slot: string) {
  const self = people.find((person) => person.slot === slot);
  const keys = self ? personKeys(self.row) : [];
  if (!keys.length) return [];
  return [...new Set(people.filter((person) => person.slot !== slot && !person.hidden && sharesKey(keys, personKeys(person.row))).map((person) => person.role))];
}

export function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}
