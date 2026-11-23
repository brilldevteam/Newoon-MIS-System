import { beneficialOwners } from '../common/ownership';
import { hasSplitIdentity, identitySummary, withDerivedIdentity } from '../common/person-identity';

// Reads a serialized KYC form (KycService.formSnapshot) into company, shareholder, UBO, officer and key-contact
// details. Client-page edits stored before the client records existed (ClientProfileOverride, up to 2026-11-22) are
// overlaid first; the result seeds the client records (client-records.ts). The KYC form itself is never changed.
// Pure functions only, so the mapping can be checked without a database.

type Rec = Record<string, unknown>;

export type OfficerRole = 'DIRECTOR' | 'MANAGER' | 'SECRETARY' | 'SEF' | 'SIGNATORY' | 'OTHER';
export type ProfileSection = 'COMPANY' | 'SHAREHOLDER' | 'UBO' | 'OFFICER' | 'KEY_CONTACT';
export type FieldKind = 'text' | 'longtext' | 'date' | 'list' | 'percent' | 'email';
type FieldSpec = { kind: FieldKind; clears?: string[] };

export type ProfileRef = { section: ProfileSection; rowId: string; rowLabel: string | null };

export type PersonIdentity = {
  identityNumber: string | null;
  qidNumber: string | null;
  qidExpiry: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  // Combined "QID / Passport" value from an older KYC that has not been split into QID and passport yet.
  legacyIdentity: string | null;
};

// Per-person declarations on every KYC person row (2026-11-23).
export type PersonDeclarations = { title: string | null; dualCitizenship: string | null; otherNationality: string | null; isPep: string | null; pepDetails: string | null };

export type ProfileParty = PersonIdentity & PersonDeclarations & {
  ref: ProfileRef;
  id: string | null;
  fullName: string;
  partyType: string | null;
  isCorporate: boolean;
  nationality: string | null;
  dateOfBirth: string | null;
  address: string | null;
  percentage: string | null;
  percentageField: 'shareholderPercentage' | 'uboInterestPercentage';
  isUbo: boolean;
  linkedCompany: string | null;
};

export type ProfileOfficer = PersonIdentity & PersonDeclarations & {
  ref: ProfileRef;
  id: string | null;
  fullName: string;
  positions: string[];
  roles: OfficerRole[];
  entityName: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  address: string | null;
  isAuthorizedSignatory: boolean;
};

export type ProfileOverride = { section: string; rowId: string; rowLabel: string | null; field: string; value: string | null; updatedAt?: Date };

const DECLARATION_FIELDS: Record<string, FieldSpec> = {
  title: { kind: 'text' },
  dualCitizenship: { kind: 'text' },
  otherNationality: { kind: 'text' },
  isPep: { kind: 'text' },
  pepDetails: { kind: 'longtext' }
};

const ID_FIELDS: Record<string, FieldSpec> = {
  qidNumber: { kind: 'text' },
  qidExpiry: { kind: 'date' },
  passportNumber: { kind: 'text' },
  passportExpiry: { kind: 'date' }
};

// Every value the client page can edit, by section, with the raw KYC form field it overlays.
export const PROFILE_FIELDS: Record<ProfileSection, Record<string, FieldSpec>> = {
  COMPANY: {
    legalName: { kind: 'text' },
    legalForm: { kind: 'list', clears: ['legalFormOther'] },
    commercialRegistrationNo: { kind: 'text' },
    countryOfIncorporation: { kind: 'list', clears: ['countryOfIncorporationOther'] },
    dateOfIncorporation: { kind: 'date' },
    registeredOfficeAddress: { kind: 'longtext' },
    telephone: { kind: 'text' },
    email: { kind: 'email' },
    website: { kind: 'text' },
    businessNature: { kind: 'list', clears: ['businessNatureOther'] },
    relatedIndustry: { kind: 'list', clears: ['relatedIndustryOther'] },
    licenseActivities: { kind: 'longtext' },
    taxIdentificationNo: { kind: 'text' },
    prospectiveService: { kind: 'list', clears: ['prospectiveServiceOther'] }
  },
  SHAREHOLDER: {
    fullName: { kind: 'text' },
    nationality: { kind: 'list', clears: ['nationalityOther'] },
    dateOfBirth: { kind: 'date' },
    residenceAddress: { kind: 'longtext', clears: ['address'] },
    shareholderPercentage: { kind: 'percent' },
    uboInterestPercentage: { kind: 'percent' },
    identityNumber: { kind: 'text' },
    ...ID_FIELDS,
    ...DECLARATION_FIELDS
  },
  UBO: {
    fullName: { kind: 'text' },
    nationality: { kind: 'list', clears: ['nationalityOther'] },
    dateOfBirth: { kind: 'date' },
    residenceAddress: { kind: 'longtext', clears: ['address'] },
    uboInterestPercentage: { kind: 'percent' },
    ...ID_FIELDS,
    ...DECLARATION_FIELDS
  },
  OFFICER: {
    fullName: { kind: 'text' },
    entityName: { kind: 'text' },
    nationality: { kind: 'list' },
    address: { kind: 'longtext' },
    dateOfBirth: { kind: 'date' },
    position: { kind: 'list', clears: ['positionOther'] },
    ...ID_FIELDS,
    ...DECLARATION_FIELDS
  },
  KEY_CONTACT: {
    fullName: { kind: 'text' },
    position: { kind: 'list', clears: ['positionOther'] },
    nationality: { kind: 'list', clears: ['nationalityOther'] },
    mobileNumber: { kind: 'text' },
    email: { kind: 'email' },
    ...ID_FIELDS,
    ...DECLARATION_FIELDS
  }
};

export function profileFieldSpec(section: string, field: string): FieldSpec | null {
  return (PROFILE_FIELDS as Record<string, Record<string, FieldSpec>>)[section]?.[field] || null;
}

const LEGACY_KEY = '_legacyIdentity';
const record = (value: unknown): Rec => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {});
const rows = (value: unknown): Rec[] => (Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') as Rec[] : []);

export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const result = String(value).trim();
  return result || null;
}

// Multi-select values are stored as arrays or comma-separated text; "Other" is replaced by the typed value.
export function optionList(value: unknown, other?: unknown): string[] {
  const items = Array.isArray(value) ? value.map((item) => String(item ?? '')) : String(value ?? '').split(',');
  const otherText = text(other);
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item === 'Other' && otherText ? otherText : item));
}

export function optionText(value: unknown, other?: unknown) {
  const list = optionList(value, other);
  return list.length ? list.join(', ') : null;
}

const isoDate = (value: unknown) => text(value)?.slice(0, 10) || null;

const percentage = (value: unknown) => {
  const result = text(value);
  return result === null ? null : result.replace(/%$/, '');
};

// Links uploaded QID / passport copies to a person: the same name on several tabs shares the copies.
export function personKey(fullName: string | null | undefined) {
  return (fullName || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function rowKey(row: Rec, index: number) {
  return text(row.id) || `#${index}`;
}

function declarations(row: Rec): PersonDeclarations {
  return { title: text(row.title), dualCitizenship: text(row.dualCitizenship), otherNationality: text(row.otherNationality), isPep: text(row.isPep), pepDetails: text(row.pepDetails) };
}

function identity(row: Rec, corporate = false): PersonIdentity {
  const split = hasSplitIdentity(row);
  return {
    identityNumber: corporate ? text(row.identityNumber) : identitySummary(row),
    qidNumber: text(row.qidNumber),
    qidExpiry: isoDate(row.qidExpiry),
    passportNumber: text(row.passportNumber),
    passportExpiry: isoDate(row.passportExpiry),
    legacyIdentity: corporate ? null : text(row[LEGACY_KEY]) || (split ? null : text(row.identityNumber))
  };
}

export function setValue(target: Rec, field: string, spec: FieldSpec, value: string | null) {
  if (spec.kind === 'list') target[field] = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
  else if (spec.kind === 'date') target[field] = value || null;
  else target[field] = value ?? '';
  for (const key of spec.clears || []) target[key] = '';
}

function findRow(original: Rec[], override: ProfileOverride) {
  const byId = original.findIndex((row, index) => rowKey(row, index) === override.rowId);
  if (byId >= 0 || !override.rowLabel) return byId;
  // KYC manager rows get new ids whenever the form is saved again; fall back to the name the edit was made on.
  const label = override.rowLabel.trim().toLowerCase();
  return original.findIndex((row) => (text(row.fullName) || '').toLowerCase() === label);
}

// Returns a copy of the form with the client-page edits applied; the input is not changed.
export function applyOverrides<T extends { sectionA: unknown; sectionB: unknown; sectionC: unknown; sectionE: unknown }>(form: T, overrides: ProfileOverride[]): T {
  if (!overrides.length) return form;
  const a: Rec = { ...record(form.sectionA) };
  const e: Rec = { ...record(form.sectionE) };
  const b = record(form.sectionB);
  const c = record(form.sectionC);
  const lists: Record<'SHAREHOLDER' | 'UBO' | 'OFFICER', { original: Rec[]; copy: Rec[] }> = {
    SHAREHOLDER: { original: rows(b.shareholders), copy: [] },
    UBO: { original: rows(b.ubos), copy: [] },
    OFFICER: { original: rows(c.managers), copy: [] }
  };
  for (const list of Object.values(lists)) list.copy = list.original.map((row) => ({ ...row }));
  const touched = new Set<Rec>();

  for (const override of overrides) {
    const spec = profileFieldSpec(override.section, override.field);
    if (!spec) continue;
    let target: Rec | undefined;
    if (override.section === 'COMPANY') target = a;
    else if (override.section === 'KEY_CONTACT') target = e;
    else {
      const list = lists[override.section as keyof typeof lists];
      const index = findRow(list.original, override);
      target = index >= 0 ? list.copy[index] : undefined;
    }
    if (!target) continue;
    if (override.field in ID_FIELDS && !hasSplitIdentity(target) && text(target.identityNumber) && target[LEGACY_KEY] === undefined) {
      target[LEGACY_KEY] = text(target.identityNumber);
    }
    setValue(target, override.field, spec, override.value);
    touched.add(target);
  }

  const derive = (row: Rec) => (touched.has(row) ? withDerivedIdentity(row) : row);
  return {
    ...form,
    sectionA: a,
    sectionB: { ...b, shareholders: lists.SHAREHOLDER.copy.map(derive), ubos: lists.UBO.copy.map(derive) },
    sectionC: { ...c, managers: lists.OFFICER.copy.map(derive) },
    sectionE: derive(e)
  };
}

// Removes overlay bookkeeping before rows are written into a new (re-KYC) form.
export function stripOverlayKeys(row: Rec): Rec {
  const { [LEGACY_KEY]: _legacy, ...rest } = row;
  return rest;
}

export function companyDetails(sectionA: unknown) {
  const a = record(sectionA);
  return {
    legalName: text(a.legalName),
    legalForm: optionText(a.legalForm, a.legalFormOther),
    commercialRegistrationNo: text(a.commercialRegistrationNo),
    countryOfIncorporation: optionText(a.countryOfIncorporation, a.countryOfIncorporationOther),
    dateOfIncorporation: isoDate(a.dateOfIncorporation),
    registeredOfficeAddress: text(a.registeredOfficeAddress),
    telephone: text(a.telephone),
    email: text(a.email),
    website: text(a.website),
    businessNature: optionText(a.businessNature, a.businessNatureOther),
    relatedIndustry: optionText(a.relatedIndustry, a.relatedIndustryOther),
    licenseActivities: text(a.licenseActivities),
    taxIdentificationNo: text(a.taxIdentificationNo),
    prospectiveServices: optionText(a.prospectiveService, a.prospectiveServiceOther)
  };
}

export function shareholderParties(sectionB: unknown): ProfileParty[] {
  return rows(record(sectionB).shareholders).map((row, index) => {
    const isCorporate = row.shareholderType === 'Corporate Entity';
    return {
      ref: { section: 'SHAREHOLDER', rowId: rowKey(row, index), rowLabel: text(row.fullName) },
      id: text(row.id),
      fullName: text(row.fullName) || 'Unnamed shareholder',
      partyType: text(row.shareholderType),
      isCorporate,
      nationality: optionText(row.nationality, row.nationalityOther),
      dateOfBirth: isoDate(row.dateOfBirth),
      address: text(row.residenceAddress) || text(row.address),
      percentage: percentage(row.shareholderPercentage ?? row.ownershipPercentage),
      percentageField: 'shareholderPercentage',
      isUbo: Boolean(row.isUbo),
      linkedCompany: text(row.linkedClientName),
      ...identity(row, isCorporate),
      ...(isCorporate ? { title: null, dualCitizenship: null, otherNationality: null, isPep: null, pepDetails: null } : declarations(row))
    };
  });
}

// Same merge the KYC preview and exports use: natural-person shareholders marked as UBO plus separately entered UBOs.
// Edits go to the row the owner comes from (the shareholder row, or the separate UBO row).
export function uboParties(sectionB: unknown): ProfileParty[] {
  const b = record(sectionB);
  const shareholders = rows(b.shareholders);
  const manual = rows(b.ubos);
  return beneficialOwners(shareholders, manual).map((row) => {
    const shareholderIndex = shareholders.indexOf(row);
    const manualIndex = shareholderIndex >= 0 ? -1 : manual.findIndex((ubo) => ubo === row || (text(ubo.id) && ubo.id === row.id));
    const ref: ProfileRef = shareholderIndex >= 0
      ? { section: 'SHAREHOLDER', rowId: rowKey(row, shareholderIndex), rowLabel: text(row.fullName) }
      : { section: 'UBO', rowId: rowKey(manual[manualIndex] || row, Math.max(manualIndex, 0)), rowLabel: text(row.fullName) };
    const parent = shareholders.find((party) => text(party.id) && (party.id === row.parentRowId || party.id === row.sourceShareholderId));
    const parentIsCompany = parent && parent.shareholderType === 'Corporate Entity';
    return {
      ref,
      id: text(row.id),
      fullName: text(row.fullName) || 'Unnamed beneficial owner',
      partyType: 'Beneficial owner',
      isCorporate: false,
      nationality: optionText(row.nationality, row.nationalityOther),
      dateOfBirth: isoDate(row.dateOfBirth),
      address: text(row.residenceAddress) || text(row.address),
      percentage: percentage(row.uboInterestPercentage ?? row.ownershipPercentage ?? row.shareholderPercentage),
      percentageField: 'uboInterestPercentage',
      isUbo: true,
      linkedCompany: parentIsCompany ? text(parent.fullName) : text(row.linkedClientName),
      ...identity(row),
      ...declarations(row)
    };
  });
}

export function officerRoles(positions: string[], isAuthorizedSignatory: boolean): OfficerRole[] {
  const roles = new Set<OfficerRole>();
  for (const position of positions.map((item) => item.toLowerCase())) {
    if (position.includes('secretary')) roles.add('SECRETARY');
    else if (position === 'sef' || position.includes('senior executive')) roles.add('SEF');
    else if (position.includes('director')) roles.add('DIRECTOR');
    else if (position.includes('signatory')) roles.add('SIGNATORY');
    else if (position.includes('manager') || ['ceo', 'cfo', 'coo', 'compliance officer'].includes(position)) roles.add('MANAGER');
    else roles.add('OTHER');
  }
  if (isAuthorizedSignatory) roles.add('SIGNATORY');
  return roles.size ? [...roles] : ['OTHER'];
}

export function officers(sectionC: unknown): ProfileOfficer[] {
  return rows(record(sectionC).managers).map((row, index) => {
    const positions = optionList(row.position, row.positionOther);
    const isAuthorizedSignatory = Boolean(row.isAuthorizedSignatory);
    return {
      ref: { section: 'OFFICER', rowId: rowKey(row, index), rowLabel: text(row.fullName) },
      id: text(row.id),
      fullName: text(row.fullName) || 'Unnamed officer',
      positions,
      roles: officerRoles(positions, isAuthorizedSignatory),
      entityName: text(row.entityName),
      nationality: optionText(row.nationality) || text(row.nationalityAndAddress),
      dateOfBirth: isoDate(row.dateOfBirth),
      address: text(row.address),
      isAuthorizedSignatory,
      ...identity(row),
      ...declarations(row)
    };
  });
}

export function keyContact(sectionE: unknown) {
  const e = record(sectionE);
  return {
    ref: { section: 'KEY_CONTACT' as const, rowId: '', rowLabel: null },
    fullName: text(e.fullName),
    position: optionText(e.position, e.positionOther),
    nationality: optionText(e.nationality, e.nationalityOther),
    mobileNumber: text(e.mobileNumber),
    email: text(e.email),
    ...identity(e),
    ...declarations(e)
  };
}

type FormLike = { sectionA: unknown; sectionB: unknown; sectionC: unknown; sectionE: unknown; version: number; status: string; updatedAt: Date };

export function profileFromForm(form: FormLike | null, overrides: ProfileOverride[] = []) {
  if (!form) return null;
  const effective = applyOverrides(form, overrides);
  return {
    formVersion: form.version,
    formStatus: form.status,
    formUpdatedAt: form.updatedAt,
    editCount: overrides.length,
    company: companyDetails(effective.sectionA),
    shareholders: shareholderParties(effective.sectionB),
    ubos: uboParties(effective.sectionB),
    officers: officers(effective.sectionC),
    keyContact: keyContact(effective.sectionE)
  };
}

export type IdentityExpiry = {
  sourceKey: string;
  documentType: 'QID' | 'PASSPORT' | 'CR' | 'TRADE_LICENSE' | 'COMPUTER_CARD' | 'OTHER';
  documentLabel?: string | null;
  documentNumber: string | null;
  expiryDate: string;
  holderName: string;
  holderRole: string;
};
