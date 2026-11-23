import { randomUUID } from 'crypto';
import { withDerivedIdentity } from '../common/person-identity';
import { IdentityExpiry, optionList, optionText, personKey, PROFILE_FIELDS, profileFromForm, rowKey, setValue, text } from './compliance-client-profile';

// Client-level records (agreed 2026-11-22). After activation the client profile is kept as one entity record and
// one record per person; a person holds any number of roles, and every tab of the client page is a view of the same
// person. This file holds the pure mapping between those records and the KYC form, so it can be checked without a
// database:
//   - draftsFromProfile: KYC form (with any older client-page edits) -> entity and person drafts, the same person on
//     several KYC rows merged into one;
//   - matchPerson: finds the record a draft belongs to (QID / passport / CR number first, then the name);
//   - formFromRecords: records -> KYC form sections, used to prefill a re-KYC;
//   - recordExpiries: QID, passport, national address and CR expiry dates for the Expiry tab.

type Rec = Record<string, unknown>;

export const ROLE_TYPES = [
  'SHAREHOLDER', 'UBO', 'DIRECTOR', 'MANAGER', 'SECRETARY', 'SEF', 'AUTHORISED_SIGNATORY', 'KEY_CONTACT',
  'CEO', 'CFO', 'COO', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER', 'CHAIRMAN', 'OTHER'
] as const;
export type RoleType = (typeof ROLE_TYPES)[number];

export const ROLE_LABELS: Record<RoleType, string> = {
  SHAREHOLDER: 'Shareholder',
  UBO: 'UBO',
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  SECRETARY: 'Secretary',
  SEF: 'SEF',
  AUTHORISED_SIGNATORY: 'Authorised Signatory',
  KEY_CONTACT: 'Key Communication Person',
  CEO: 'CEO',
  CFO: 'CFO',
  COO: 'COO',
  MANAGING_DIRECTOR: 'Managing Director',
  GENERAL_MANAGER: 'General Manager',
  CHAIRMAN: 'Chairman',
  OTHER: 'Other'
};

// Roles kept on a KYC management (section C) row.
export const OFFICER_ROLES: RoleType[] = ['DIRECTOR', 'MANAGER', 'SECRETARY', 'SEF', 'AUTHORISED_SIGNATORY', 'CEO', 'CFO', 'COO', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER', 'CHAIRMAN', 'OTHER'];
export const PERCENT_ROLES: RoleType[] = ['SHAREHOLDER', 'UBO'];
// Roles a corporate party can hold.
export const CORPORATE_ROLES: RoleType[] = ['SHAREHOLDER', 'DIRECTOR', 'SECRETARY', 'OTHER'];

export const PERSON_TITLES = ['Mr', 'Ms', 'Mrs', 'Dr', 'Sheikh', 'Sheikha'];

export type RecordFieldKind = 'text' | 'longtext' | 'date' | 'email' | 'bool' | 'title';

// Entity fields. The first group is also on the KYC form (section A); the rest are kept on the client only.
export const ENTITY_KYC_FIELDS = [
  'legalName', 'legalForm', 'commercialRegistrationNo', 'countryOfIncorporation', 'dateOfIncorporation', 'registeredOfficeAddress',
  'telephone', 'email', 'website', 'businessNature', 'relatedIndustry', 'licenseActivities', 'taxIdentificationNo', 'prospectiveServices'
] as const;
export type EntityKycField = (typeof ENTITY_KYC_FIELDS)[number];

export const ENTITY_FIELDS: Record<string, RecordFieldKind> = {
  legalName: 'text',
  legalForm: 'text',
  commercialRegistrationNo: 'text',
  crExpiryDate: 'date',
  dateOfIncorporation: 'date',
  countryOfIncorporation: 'text',
  placeOfIncorporation: 'text',
  registeredOfficeAddress: 'longtext',
  shareCapital: 'text',
  taxIdentificationNo: 'text',
  poBox: 'text',
  telephone: 'text',
  email: 'email',
  website: 'text',
  businessNature: 'text',
  relatedIndustry: 'text',
  licenseActivities: 'longtext',
  prospectiveServices: 'text',
  financialYearEnd: 'text',
  auditorName: 'text'
};

// Person fields that come from the KYC form. A re-KYC approval updates them unless they were edited on the client
// page after the re-KYC started; an empty KYC value never clears a value the client record already has.
export const PERSON_KYC_FIELDS = [
  'fullName', 'nationality', 'dateOfBirth', 'address', 'telephone', 'email', 'representedEntity', 'qidNumber', 'qidExpiry', 'registrationNumber',
  // Per-person declarations from the KYC rows (2026-11-23); Yes / No are stored as booleans.
  'title', 'dualCitizenship', 'otherNationality', 'isPep', 'pepDetails'
] as const;
export type PersonKycField = (typeof PERSON_KYC_FIELDS)[number];

export const PERSON_FIELDS: Record<string, RecordFieldKind> = {
  title: 'title',
  fullName: 'text',
  nationality: 'text',
  dualCitizenship: 'bool',
  otherNationality: 'text',
  dateOfBirth: 'date',
  address: 'longtext',
  telephone: 'text',
  email: 'email',
  isPep: 'bool',
  pepDetails: 'longtext',
  representedEntity: 'text',
  qidNumber: 'text',
  qidExpiry: 'date',
  nationalAddressExpiry: 'date',
  registrationNumber: 'text'
};
// Fields that only apply to individuals (a corporate shareholder uses its CR number).
export const INDIVIDUAL_ONLY_FIELDS = ['title', 'dualCitizenship', 'otherNationality', 'isPep', 'pepDetails', 'qidNumber', 'qidExpiry', 'nationalAddressExpiry'];

export type PartyType = 'INDIVIDUAL' | 'CORPORATE';

export type RoleDraft = {
  role: RoleType;
  title: string;
  percentage: string | null;
  viaName: string | null;
  sourceSection: string | null;
  sourceRowId: string | null;
};

export type PersonDraft = {
  partyType: PartyType;
  fullName: string;
  values: Partial<Record<PersonKycField, string | null>>;
  // Every passport found on the person's KYC rows (the same person can show different passports on different
  // rows); the first one is the main passport.
  passports: DraftPassport[];
  legacyIdentity: string | null;
  linkedClientName: string | null;
  roles: RoleDraft[];
};

export type DraftPassport = { number: string; expiry: string | null; sourceSection: string; sourceRowId: string };

export type EntityDraft = Partial<Record<EntityKycField, string | null>>;

// Stored records as the mapping functions need them (dates as YYYY-MM-DD, percentages as text).
export type RecordRole = {
  id: string;
  role: RoleType;
  title: string;
  percentage: string | null;
  viaPersonId: string | null;
  sourceSection: string | null;
  sourceRowId: string | null;
};
export type RecordPassport = { id: string; passportNumber: string; issuingCountry: string | null; expiryDate: string | null; isPrimary: boolean };
export type RecordPerson = {
  id: string;
  partyType: PartyType;
  title: string | null;
  fullName: string;
  nationality: string | null;
  dualCitizenship: boolean | null;
  otherNationality: string | null;
  dateOfBirth: string | null;
  address: string | null;
  telephone: string | null;
  email: string | null;
  isPep: boolean | null;
  pepDetails: string | null;
  representedEntity: string | null;
  qidNumber: string | null;
  qidExpiry: string | null;
  nationalAddressExpiry: string | null;
  registrationNumber: string | null;
  linkedClientName: string | null;
  legacyIdentity: string | null;
  passports: RecordPassport[];
  roles: RecordRole[];
  // Fields changed on the client page (passport changes are "passport:<id>"); a re-KYC prefill writes only these
  // over the values a KYC row already has.
  edited?: string[];
};
export type RecordEntity = Partial<Record<keyof typeof ENTITY_FIELDS, string | null>>;

const normal = (value: string | null | undefined) => (value || '').replace(/\s+/g, '').toUpperCase();

// Maps the KYC position wording to roles. Wording that is not a listed role is kept as OTHER with its text.
export function positionRoles(positions: string[], isAuthorizedSignatory: boolean): Array<{ role: RoleType; title: string }> {
  const result = new Map<string, { role: RoleType; title: string }>();
  const add = (role: RoleType, title = '') => result.set(`${role}|${title}`, { role, title });
  for (const raw of positions) {
    const original = raw.trim();
    const position = original.toLowerCase();
    if (!position) continue;
    if (position === 'managing director') add('MANAGING_DIRECTOR');
    else if (position === 'shareholder') add('SHAREHOLDER');
    else if (position === 'ubo' || position === 'ultimate beneficial owner') add('UBO');
    else if (position.includes('secretary')) add('SECRETARY');
    else if (position === 'sef' || position.includes('senior executive')) add('SEF');
    else if (position === 'general manager') add('GENERAL_MANAGER');
    else if (position === 'ceo' || position === 'chief executive officer') add('CEO');
    else if (position === 'cfo' || position === 'chief financial officer') add('CFO');
    else if (position === 'coo' || position === 'chief operating officer') add('COO');
    else if (['chairman', 'chairperson', 'chairwoman', 'chair'].includes(position)) add('CHAIRMAN');
    else if (position.includes('director')) add('DIRECTOR');
    else if (position.includes('signatory')) add('AUTHORISED_SIGNATORY');
    else if (position.includes('manager')) add('MANAGER');
    else add('OTHER', original.slice(0, 100));
  }
  if (isAuthorizedSignatory) add('AUTHORISED_SIGNATORY');
  if (!result.size) add('OTHER');
  return [...result.values()];
}

type Profile = NonNullable<ReturnType<typeof profileFromForm>>;

// Keys that identify a person: ID numbers first, then the normalized name.
function draftKeys(draft: { partyType: PartyType; fullName: string; values: Partial<Record<string, string | null>>; passportNumbers: string[] }) {
  if (draft.partyType === 'CORPORATE') {
    return [draft.values.registrationNumber ? `CR:${normal(draft.values.registrationNumber)}` : null, `CORP:${personKey(draft.fullName)}`].filter(Boolean) as string[];
  }
  return [
    draft.values.qidNumber ? `QID:${normal(draft.values.qidNumber)}` : null,
    ...draft.passportNumbers.map((number) => `PASSPORT:${normal(number)}`),
    `NAME:${personKey(draft.fullName)}`
  ].filter(Boolean) as string[];
}

// Two entries are not the same person when they are different kinds of party or carry different QID numbers.
function conflicts(a: { partyType: PartyType; qid: string | null }, b: { partyType: PartyType; qid: string | null }) {
  return a.partyType !== b.partyType || Boolean(a.qid && b.qid && normal(a.qid) !== normal(b.qid));
}

function mergeRoles(target: RoleDraft[], extra: RoleDraft[]) {
  for (const role of extra) {
    const existing = target.find((item) => item.role === role.role && item.title === role.title);
    if (!existing) target.push({ ...role });
    else {
      existing.percentage = existing.percentage ?? role.percentage;
      existing.viaName = existing.viaName ?? role.viaName;
    }
  }
}

// Title and the Yes / No answers of a KYC person row as draft values.
function declarationValues(source: { title: string | null; dualCitizenship: string | null; otherNationality: string | null; isPep: string | null; pepDetails: string | null }) {
  return { title: source.title, dualCitizenship: source.dualCitizenship, otherNationality: source.otherNationality, isPep: source.isPep, pepDetails: source.pepDetails };
}

// Reads the KYC profile (with any older client-page edits already applied) into one draft per person.
export function draftsFromProfile(profile: Profile | null): { entity: EntityDraft; people: PersonDraft[] } {
  if (!profile) return { entity: {}, people: [] };
  const company = profile.company;
  const entity: EntityDraft = {
    legalName: company.legalName,
    legalForm: company.legalForm,
    commercialRegistrationNo: company.commercialRegistrationNo,
    countryOfIncorporation: company.countryOfIncorporation,
    dateOfIncorporation: company.dateOfIncorporation,
    registeredOfficeAddress: company.registeredOfficeAddress,
    telephone: company.telephone,
    email: company.email,
    website: company.website,
    businessNature: company.businessNature,
    relatedIndustry: company.relatedIndustry,
    licenseActivities: company.licenseActivities,
    taxIdentificationNo: company.taxIdentificationNo,
    prospectiveServices: company.prospectiveServices
  };

  const entries: PersonDraft[] = [];
  const passport = (number: string | null, expiry: string | null, ref: { section: string; rowId: string }) =>
    (number ? [{ number, expiry, sourceSection: ref.section, sourceRowId: ref.rowId }] : []);
  for (const party of profile.shareholders) {
    const corporate = party.isCorporate;
    entries.push({
      partyType: corporate ? 'CORPORATE' : 'INDIVIDUAL',
      fullName: party.fullName,
      values: {
        fullName: party.fullName,
        nationality: party.nationality,
        dateOfBirth: party.dateOfBirth,
        address: party.address,
        qidNumber: corporate ? null : party.qidNumber,
        qidExpiry: corporate ? null : party.qidExpiry,
        registrationNumber: corporate ? party.identityNumber : null,
        ...(corporate ? {} : declarationValues(party))
      },
      passports: corporate ? [] : passport(party.passportNumber, party.passportExpiry, party.ref),
      legacyIdentity: party.legacyIdentity,
      linkedClientName: party.linkedCompany,
      roles: [{ role: 'SHAREHOLDER', title: '', percentage: party.percentage, viaName: null, sourceSection: party.ref.section, sourceRowId: party.ref.rowId }]
    });
  }
  for (const party of profile.ubos) {
    entries.push({
      partyType: 'INDIVIDUAL',
      fullName: party.fullName,
      values: { fullName: party.fullName, nationality: party.nationality, dateOfBirth: party.dateOfBirth, address: party.address, qidNumber: party.qidNumber, qidExpiry: party.qidExpiry, ...declarationValues(party) },
      passports: passport(party.passportNumber, party.passportExpiry, party.ref),
      legacyIdentity: party.legacyIdentity,
      linkedClientName: null,
      roles: [{ role: 'UBO', title: '', percentage: party.percentage, viaName: party.linkedCompany, sourceSection: party.ref.section, sourceRowId: party.ref.rowId }]
    });
  }
  for (const officer of profile.officers) {
    entries.push({
      partyType: 'INDIVIDUAL',
      fullName: officer.fullName,
      values: {
        fullName: officer.fullName, nationality: officer.nationality, dateOfBirth: officer.dateOfBirth, address: officer.address,
        representedEntity: officer.entityName, qidNumber: officer.qidNumber, qidExpiry: officer.qidExpiry, ...declarationValues(officer)
      },
      passports: passport(officer.passportNumber, officer.passportExpiry, officer.ref),
      legacyIdentity: officer.legacyIdentity,
      linkedClientName: null,
      roles: positionRoles(officer.positions, officer.isAuthorizedSignatory).map(({ role, title }) => ({
        role, title, percentage: null, viaName: null, sourceSection: 'OFFICER', sourceRowId: officer.ref.rowId
      }))
    });
  }
  const contact = profile.keyContact;
  if (contact.fullName) {
    entries.push({
      partyType: 'INDIVIDUAL',
      fullName: contact.fullName,
      values: {
        fullName: contact.fullName, nationality: contact.nationality, telephone: contact.mobileNumber, email: contact.email,
        qidNumber: contact.qidNumber, qidExpiry: contact.qidExpiry, ...declarationValues(contact)
      },
      passports: passport(contact.passportNumber, contact.passportExpiry, contact.ref),
      legacyIdentity: contact.legacyIdentity,
      linkedClientName: null,
      // The key contact's own position wording is kept as the role title, so the re-KYC prints it again.
      roles: [{ role: 'KEY_CONTACT', title: (contact.position || '').slice(0, 100), percentage: null, viaName: null, sourceSection: 'KEY_CONTACT', sourceRowId: '' }]
    });
  }

  // The same person listed as shareholder, UBO, director and key contact becomes one draft with all the roles.
  const merged: Array<PersonDraft & { keys: Set<string> }> = [];
  for (const entry of entries) {
    const keys = draftKeys({ ...entry, passportNumbers: entry.passports.map((item) => item.number) });
    const target = merged.find((item) => keys.some((key) => item.keys.has(key)) &&
      !conflicts({ partyType: item.partyType, qid: item.values.qidNumber ?? null }, { partyType: entry.partyType, qid: entry.values.qidNumber ?? null }));
    if (!target) {
      merged.push({ ...entry, values: { ...entry.values }, passports: entry.passports.map((item) => ({ ...item })), roles: entry.roles.map((role) => ({ ...role })), keys: new Set(keys) });
      continue;
    }
    for (const [field, value] of Object.entries(entry.values) as Array<[PersonKycField, string | null]>) {
      if (target.values[field] == null && value != null) target.values[field] = value;
      // The same person answered differently on two rows: a Yes to PEP or dual citizenship is never cleared by a No.
      else if ((field === 'isPep' || field === 'dualCitizenship') && /^yes$/i.test(String(value ?? '').trim())) target.values[field] = value;
    }
    for (const item of entry.passports) {
      const same = target.passports.find((existing) => normal(existing.number) === normal(item.number));
      if (!same) target.passports.push({ ...item });
      else same.expiry = same.expiry ?? item.expiry;
    }
    target.legacyIdentity = target.legacyIdentity ?? entry.legacyIdentity;
    target.linkedClientName = target.linkedClientName ?? entry.linkedClientName;
    mergeRoles(target.roles, entry.roles);
    keys.forEach((key) => target.keys.add(key));
  }
  return { entity, people: merged.map(({ keys: _keys, ...draft }) => draft) };
}

// The stored person a KYC draft belongs to, or null for someone new.
export function matchPerson<T extends Pick<RecordPerson, 'id' | 'partyType' | 'fullName' | 'qidNumber' | 'registrationNumber'> & { passports: Array<{ passportNumber: string }> }>(
  people: T[], draft: PersonDraft
): T | null {
  const draftKeysList = draftKeys({ ...draft, passportNumbers: draft.passports.map((item) => item.number) });
  // Stronger keys first: an ID number match wins over a name match with someone else.
  for (const key of draftKeysList) {
    const found = people.find((person) => {
      const keys = draftKeys({ partyType: person.partyType, fullName: person.fullName, values: { qidNumber: person.qidNumber, registrationNumber: person.registrationNumber }, passportNumbers: person.passports.map((item) => item.passportNumber) });
      return keys.includes(key) && !conflicts({ partyType: person.partyType, qid: person.qidNumber }, { partyType: draft.partyType, qid: draft.values.qidNumber ?? null });
    });
    if (found) return found;
  }
  return null;
}

// KYC position wording for each role (the options of the KYC form; other roles are written as "Other").
const KYC_POSITION_OPTIONS = ['Director', 'Manager', 'General Manager', 'Authorized Signatory', 'Secretary', 'SEF', 'Senior Executive Function', 'Interest Holder', 'Beneficial Person', 'Compliance Officer'];
const ROLE_POSITION: Partial<Record<RoleType, string>> = {
  DIRECTOR: 'Director', MANAGER: 'Manager', GENERAL_MANAGER: 'General Manager', SECRETARY: 'Secretary', SEF: 'SEF',
  CEO: 'CEO', CFO: 'CFO', COO: 'COO', MANAGING_DIRECTOR: 'Managing Director', CHAIRMAN: 'Chairman'
};

function positionValue(roles: RecordRole[]) {
  const labels = roles.filter((role) => role.role !== 'AUTHORISED_SIGNATORY').map((role) => (role.role === 'OTHER' ? role.title : ROLE_POSITION[role.role] || '')).filter(Boolean);
  if (!labels.length && roles.some((role) => role.role === 'AUTHORISED_SIGNATORY')) labels.push('Authorized Signatory');
  const known = labels.filter((label) => KYC_POSITION_OPTIONS.includes(label));
  const other = labels.filter((label) => !KYC_POSITION_OPTIONS.includes(label));
  return { position: other.length ? [...known, 'Other'] : known, positionOther: other.join(', ') };
}

const record = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Rec) } : {});
const rowsOf = (value: unknown): Rec[] => (Array.isArray(value) ? (value.filter((row) => row && typeof row === 'object') as Rec[]).map((row) => ({ ...row })) : []);

function primaryPassport(person: RecordPerson) {
  return person.passports.find((item) => item.isPrimary) || person.passports[0] || null;
}

type Spec = Parameters<typeof setValue>[2];

// Single-choice fields of KYC section A: stored as text, never as a list.
const SINGLE_CHOICE = new Set(['legalForm', 'countryOfIncorporation', 'businessNature', 'relatedIndustry']);

// A row value read the way the client profile reads it, so it can be compared with a record value.
function rowText(row: Rec, field: string, spec: Spec): string | null {
  if (spec.kind === 'list') return optionText(row[field], spec.clears?.[0] ? row[spec.clears[0]] : undefined);
  if (spec.kind === 'date') return text(row[field])?.slice(0, 10) || null;
  if (spec.kind === 'percent') {
    const value = text(row[field])?.replace(/%$/, '');
    return value === undefined || value === null || value === '' ? null : String(Number(value));
  }
  return text(row[field]);
}

function sameValue(current: string | null, next: string | null, kind: string) {
  const clean = (value: string | null) => {
    if (value === null || value === undefined || value.trim() === '') return '';
    if (kind === 'list') return value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean).sort().join(',');
    if (kind === 'percent') return String(Number(value.replace(/%$/, '')));
    if (kind === 'date') return value.slice(0, 10);
    return value.trim();
  };
  return clean(current) === clean(next);
}

// Writes one record value onto a KYC row. A row taken from the current KYC keeps its own value unless the value was
// changed on the client page, or the row has none (for example a QID known from the same person's other row). The
// stored format is kept: a single-choice field stays text and a list stays a list.
function writeValue(row: Rec, field: string, spec: Spec | undefined, value: string | null, mode: { fresh: boolean; edited: boolean; single?: boolean }) {
  if (!spec) return;
  const current = rowText(row, field, spec);
  if (sameValue(current, value, spec.kind)) return;
  if (!mode.fresh && !mode.edited && current !== null) return;
  const single = mode.single || (row[field] !== undefined && row[field] !== null && !Array.isArray(row[field]));
  setValue(row, field, spec, value);
  if (spec.kind === 'list' && single) row[field] = value ?? '';
}

// Percentages compare with the value the profile shows, which falls back to other percentage fields of the row.
function writePercent(row: Rec, field: string, value: string | null, fallbacks: string[] = []) {
  const current = [field, ...fallbacks].map((key) => text(row[key])).find((item) => item !== null) ?? null;
  if (sameValue(current, value, 'percent')) return;
  row[field] = value ?? '';
}

// Writes a person's KYC values onto a KYC row through the same field rules the form uses.
function writePerson(row: Rec, section: 'SHAREHOLDER' | 'UBO' | 'OFFICER' | 'KEY_CONTACT', person: RecordPerson, fresh: boolean) {
  const specs = PROFILE_FIELDS[section] as Record<string, Spec>;
  const edited = new Set(person.edited || []);
  const passportEdited = [...edited].some((key) => key.startsWith('passport:'));
  const set = (field: string, recordField: string, value: string | null) => writeValue(row, field, specs[field], value, { fresh, edited: edited.has(recordField) });
  const corporate = person.partyType === 'CORPORATE';
  set('fullName', 'fullName', person.fullName);
  set('nationality', 'nationality', person.nationality);
  if (section !== 'KEY_CONTACT') set('dateOfBirth', 'dateOfBirth', person.dateOfBirth);
  if (section === 'SHAREHOLDER' || section === 'UBO') set('residenceAddress', 'address', person.address);
  if (section === 'OFFICER') {
    set('address', 'address', person.address);
    set('entityName', 'representedEntity', person.representedEntity);
  }
  if (section === 'KEY_CONTACT') {
    set('mobileNumber', 'telephone', person.telephone);
    set('email', 'email', person.email);
  }
  if (corporate) {
    set('identityNumber', 'registrationNumber', person.registrationNumber);
    return row;
  }
  // Per-person declarations; Yes / No go back to the KYC rows as typed there.
  const yn = (value: boolean | null) => (value === null ? null : value ? 'Yes' : 'No');
  set('title', 'title', person.title);
  set('dualCitizenship', 'dualCitizenship', yn(person.dualCitizenship));
  set('otherNationality', 'otherNationality', person.otherNationality);
  set('isPep', 'isPep', yn(person.isPep));
  set('pepDetails', 'pepDetails', person.pepDetails);
  const passport = primaryPassport(person);
  set('qidNumber', 'qidNumber', person.qidNumber);
  set('qidExpiry', 'qidExpiry', person.qidExpiry);
  writeValue(row, 'passportNumber', specs.passportNumber, passport?.passportNumber ?? null, { fresh, edited: passportEdited });
  writeValue(row, 'passportExpiry', specs.passportExpiry, passport?.expiryDate ?? null, { fresh, edited: passportEdited });
  // The printed "QID: ... / Passport: ..." value follows the split numbers (withDerivedIdentity returns a copy).
  return Object.assign(row, withDerivedIdentity(row));
}

const sourced = (person: RecordPerson, section: string, rowId: string) => person.roles.filter((role) => role.sourceSection === section && (role.sourceRowId || '') === rowId);

const roleSet = (roles: Array<{ role: RoleType; title: string }>) => roles.map((role) => `${role.role}|${role.role === 'OTHER' ? role.title.toLowerCase() : ''}`).sort().join(',');

// Positions and signatory flag of a management row from the person's officer roles; the row is left as it was when
// the roles still match what it says.
function writePositions(row: Rec, roles: RecordRole[], fresh: boolean) {
  const signatory = roles.some((role) => role.role === 'AUTHORISED_SIGNATORY');
  const shown = positionRoles(optionList(row.position, row.positionOther), Boolean(row.isAuthorizedSignatory));
  if (!fresh && roleSet(shown) === roleSet(roles)) return;
  Object.assign(row, positionValue(roles), { isAuthorizedSignatory: signatory });
}

// Builds the KYC form sections A, B, C and E for a re-KYC from the client records. Rows the records came from keep
// their own details except what was changed on the client page; rows whose people no longer hold that role are left
// out; roles and people added on the client page become new rows. Sections D and later are not touched.
export function formFromRecords<T extends { sectionA: unknown; sectionB: unknown; sectionC: unknown; sectionE: unknown }>(
  form: T, entity: RecordEntity | null, people: RecordPerson[], entityEdited: string[] = []
): T {
  const a = record(form.sectionA);
  if (entity) {
    const edited = new Set(entityEdited);
    for (const field of ENTITY_KYC_FIELDS) {
      const formField = field === 'prospectiveServices' ? 'prospectiveService' : field;
      const spec = (PROFILE_FIELDS.COMPANY as Record<string, Spec>)[formField];
      writeValue(a, formField, spec, entity[field] ?? null, { fresh: false, edited: edited.has(field), single: SINGLE_CHOICE.has(formField) });
    }
  }

  const b = record(form.sectionB);
  const used = new Set<string>();
  const roleKey = (person: RecordPerson, role: RecordRole) => `${person.id}|${role.id}`;

  // Shareholders.
  const shareholderRows: Rec[] = [];
  const shareholderRowOf = new Map<string, Rec>();
  rowsOf(b.shareholders).forEach((row, index) => {
    const rowId = rowKey(row, index);
    const owner = people.find((person) => sourced(person, 'SHAREHOLDER', rowId).some((role) => role.role === 'SHAREHOLDER'));
    if (!owner) return;
    const holding = sourced(owner, 'SHAREHOLDER', rowId).find((role) => role.role === 'SHAREHOLDER')!;
    used.add(roleKey(owner, holding));
    writePerson(row, 'SHAREHOLDER', owner, false);
    writePercent(row, 'shareholderPercentage', holding.percentage, ['ownershipPercentage']);
    if ('ownershipPercentage' in row) writePercent(row, 'ownershipPercentage', holding.percentage);
    const ubo = sourced(owner, 'SHAREHOLDER', rowId).find((role) => role.role === 'UBO');
    if (Boolean(row.isUbo) !== Boolean(ubo)) row.isUbo = Boolean(ubo);
    if (ubo) {
      used.add(roleKey(owner, ubo));
      writePercent(row, 'uboInterestPercentage', ubo.percentage, ['ownershipPercentage', 'shareholderPercentage']);
    }
    shareholderRows.push(row);
    shareholderRowOf.set(owner.id, row);
  });
  for (const person of people) {
    const holding = person.roles.find((role) => role.role === 'SHAREHOLDER' && !used.has(roleKey(person, role)));
    if (!holding || shareholderRowOf.has(person.id)) continue;
    used.add(roleKey(person, holding));
    const row: Rec = { id: randomUUID(), shareholderType: person.partyType === 'CORPORATE' ? 'Corporate Entity' : 'Individual' };
    writePerson(row, 'SHAREHOLDER', person, true);
    row.shareholderPercentage = holding.percentage ?? '';
    row.isUbo = false;
    if (person.linkedClientName) row.linkedClientName = person.linkedClientName;
    shareholderRows.push(row);
    shareholderRowOf.set(person.id, row);
  }

  // Beneficial owners: separately entered rows, then UBO roles added on the client page.
  const uboRows: Rec[] = [];
  const keptShareholderIds = new Set(shareholderRows.map((row, index) => rowKey(row, index)));
  rowsOf(b.ubos).forEach((row, index) => {
    const rowId = rowKey(row, index);
    const owner = people.find((person) => sourced(person, 'UBO', rowId).some((role) => role.role === 'UBO'));
    if (owner) {
      const ubo = sourced(owner, 'UBO', rowId).find((role) => role.role === 'UBO')!;
      used.add(roleKey(owner, ubo));
      writePerson(row, 'UBO', owner, false);
      writePercent(row, 'uboInterestPercentage', ubo.percentage, ['ownershipPercentage', 'shareholderPercentage']);
      uboRows.push(row);
      return;
    }
    // A copy of a shareholder marked as UBO stays while that shareholder row is still a UBO.
    const source = text(row.sourceShareholderId);
    const sourceRow = source ? shareholderRows.find((item) => item.id === source) : null;
    if (source && keptShareholderIds.has(source) && sourceRow?.isUbo) uboRows.push(row);
  });
  for (const person of people) {
    if (person.partyType === 'CORPORATE') continue;
    const ubo = person.roles.find((role) => role.role === 'UBO' && !used.has(roleKey(person, role)));
    if (!ubo) continue;
    used.add(roleKey(person, ubo));
    const ownRow = shareholderRowOf.get(person.id);
    if (ownRow) {
      ownRow.isUbo = true;
      writePercent(ownRow, 'uboInterestPercentage', ubo.percentage);
      continue;
    }
    const row: Rec = { id: randomUUID() };
    writePerson(row, 'UBO', person, true);
    row.uboInterestPercentage = ubo.percentage ?? '';
    const via = ubo.viaPersonId ? shareholderRowOf.get(ubo.viaPersonId) : null;
    if (via) row.parentRowId = via.id;
    uboRows.push(row);
  }

  // Management: one row per person, positions from the person's officer roles.
  const c = record(form.sectionC);
  const managerRows: Rec[] = [];
  const managerRowOf = new Set<string>();
  rowsOf(c.managers).forEach((row, index) => {
    const rowId = rowKey(row, index);
    const owner = people.find((person) => sourced(person, 'OFFICER', rowId).some((role) => OFFICER_ROLES.includes(role.role)));
    if (!owner || managerRowOf.has(owner.id)) return;
    // All the person's officer roles go on their first row (including roles added on the client page).
    const roles = owner.roles.filter((role) => OFFICER_ROLES.includes(role.role) && !used.has(roleKey(owner, role)));
    roles.forEach((role) => used.add(roleKey(owner, role)));
    writePerson(row, 'OFFICER', owner, false);
    writePositions(row, roles, false);
    managerRows.push(row);
    managerRowOf.add(owner.id);
  });
  for (const person of people) {
    const roles = person.roles.filter((role) => OFFICER_ROLES.includes(role.role) && !used.has(roleKey(person, role)));
    if (!roles.length || managerRowOf.has(person.id) || person.partyType === 'CORPORATE') continue;
    roles.forEach((role) => used.add(roleKey(person, role)));
    const row: Rec = { id: randomUUID() };
    writePerson(row, 'OFFICER', person, true);
    writePositions(row, roles, true);
    managerRows.push(row);
    managerRowOf.add(person.id);
  }

  // Key communication person: the first person holding that role. A different person replaces the section.
  const e = record(form.sectionE);
  const contact = people.find((person) => person.roles.some((role) => role.role === 'KEY_CONTACT'));
  const contactSpecs = PROFILE_FIELDS.KEY_CONTACT as Record<string, Spec>;
  if (contact) {
    const samePerson = personKey(text(e.fullName)) === personKey(contact.fullName) || Boolean(contact.edited?.includes('fullName') && text(e.fullName));
    writePerson(e, 'KEY_CONTACT', contact, !samePerson);
    const role = contact.roles.find((item) => item.role === 'KEY_CONTACT')!;
    if (role.title) writeValue(e, 'position', contactSpecs.position, role.title, { fresh: !samePerson, edited: false });
  } else {
    for (const field of ['fullName', 'position', 'nationality', 'mobileNumber', 'email', 'qidNumber', 'qidExpiry', 'passportNumber', 'passportExpiry']) {
      if (rowText(e, field, contactSpecs[field]) !== null) setValue(e, field, contactSpecs[field], null);
    }
  }

  return {
    ...form,
    sectionA: a,
    sectionB: { ...b, shareholders: shareholderRows, ubos: uboRows },
    sectionC: { ...c, managers: managerRows },
    sectionE: e
  };
}

export function roleSummary(person: Pick<RecordPerson, 'roles'>) {
  return [...new Set(person.roles.map((role) => (role.role === 'OTHER' && role.title ? role.title : ROLE_LABELS[role.role])))].join(', ');
}

// Expiry dates kept on the records: QID, each passport and the national address certificate of every individual,
// and the company's CR. The QID / passport keys are the ones used before the records existed, so reminders already
// sent are not repeated.
// A current document of the legal documents register with an expiry date.
export type RecordLegalDocument = {
  id: string; typeLabel: string; expiryType: IdentityExpiry['documentType'] | 'TRADE_LICENSE' | 'COMPUTER_CARD'; isRegistration: boolean; isNationalAddress: boolean;
  documentNumber: string | null; holderName: string; personId: string | null; expiryDate: string | null;
};

export function recordExpiries(entity: RecordEntity | null, people: RecordPerson[], legalDocuments: RecordLegalDocument[] = []): IdentityExpiry[] {
  const result = new Map<string, IdentityExpiry>();
  const add = (item: IdentityExpiry) => {
    const existing = result.get(item.sourceKey);
    if (!existing) result.set(item.sourceKey, item);
    else if (item.expiryDate > existing.expiryDate) existing.expiryDate = item.expiryDate;
  };
  for (const person of people) {
    if (person.partyType === 'CORPORATE') continue;
    const holderRole = roleSummary(person) || 'Person';
    if (person.qidExpiry) {
      add({ sourceKey: `person:QID:${person.qidNumber ? normal(person.qidNumber) : `name:${normal(person.fullName)}`}`, documentType: 'QID', documentNumber: person.qidNumber, expiryDate: person.qidExpiry, holderName: person.fullName, holderRole });
    }
    for (const passport of person.passports) {
      if (!passport.expiryDate) continue;
      add({ sourceKey: `person:PASSPORT:${normal(passport.passportNumber)}`, documentType: 'PASSPORT', documentNumber: passport.passportNumber, expiryDate: passport.expiryDate, holderName: person.fullName, holderRole });
    }
    // A National Address certificate in the register is listed as that document instead.
    const addressDocument = legalDocuments.some((document) => document.isNationalAddress && document.personId === person.id && document.expiryDate);
    if (person.nationalAddressExpiry && !addressDocument) {
      add({
        sourceKey: `person:NATIONAL_ADDRESS:${person.id}`, documentType: 'OTHER', documentLabel: 'National Address certificate', documentNumber: null,
        expiryDate: person.nationalAddressExpiry, holderName: person.fullName, holderRole
      });
    }
  }
  for (const document of legalDocuments) {
    if (!document.expiryDate) continue;
    const holder = document.personId ? people.find((person) => person.id === document.personId) : null;
    add({
      sourceKey: `legal:${document.id}`, documentType: document.expiryType as IdentityExpiry['documentType'], documentLabel: document.typeLabel,
      documentNumber: document.documentNumber, expiryDate: document.expiryDate, holderName: holder?.fullName || document.holderName,
      holderRole: holder ? roleSummary(holder) || 'Person' : 'Company'
    });
  }
  // The CR expiry on the Company tab is listed on its own only while no CR document in the register has one.
  if (entity?.crExpiryDate && !legalDocuments.some((document) => document.isRegistration && document.expiryDate)) {
    add({
      sourceKey: 'entity:CR', documentType: 'CR', documentLabel: 'Commercial Registration', documentNumber: entity.commercialRegistrationNo ?? null,
      expiryDate: entity.crExpiryDate, holderName: entity.legalName || 'Company', holderRole: 'Company'
    });
  }
  return [...result.values()];
}
