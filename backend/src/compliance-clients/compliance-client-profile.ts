import { beneficialOwners } from '../common/ownership';

// Maps a serialized KYC form (KycService.formSnapshot) to the read-only client profile shown on the compliance
// client page. Pure functions only, so the mapping can be checked without a database.

type Rec = Record<string, unknown>;

export type OfficerRole = 'DIRECTOR' | 'MANAGER' | 'SECRETARY' | 'SEF' | 'SIGNATORY' | 'OTHER';

export type ProfileParty = {
  id: string | null;
  fullName: string;
  partyType: string | null;
  nationality: string | null;
  identityNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  percentage: string | null;
  isUbo: boolean;
  linkedCompany: string | null;
};

export type ProfileOfficer = {
  id: string | null;
  fullName: string;
  positions: string[];
  roles: OfficerRole[];
  entityName: string | null;
  nationality: string | null;
  identityNumber: string | null;
  dateOfBirth: string | null;
  address: string | null;
  isAuthorizedSignatory: boolean;
};

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
  return rows(record(sectionB).shareholders).map((row) => ({
    id: text(row.id),
    fullName: text(row.fullName) || 'Unnamed shareholder',
    partyType: text(row.shareholderType),
    nationality: optionText(row.nationality, row.nationalityOther),
    identityNumber: text(row.identityNumber),
    dateOfBirth: isoDate(row.dateOfBirth),
    address: text(row.residenceAddress) || text(row.address),
    percentage: percentage(row.shareholderPercentage ?? row.ownershipPercentage),
    isUbo: Boolean(row.isUbo),
    linkedCompany: text(row.linkedClientName)
  }));
}

// Same merge the KYC preview and exports use: natural-person shareholders marked as UBO plus separately entered UBOs.
export function uboParties(sectionB: unknown): ProfileParty[] {
  const b = record(sectionB);
  const shareholders = rows(b.shareholders);
  return beneficialOwners(shareholders, rows(b.ubos)).map((row) => {
    const parent = shareholders.find((party) => text(party.id) && (party.id === row.parentRowId || party.id === row.sourceShareholderId));
    const parentIsCompany = parent && parent.shareholderType === 'Corporate Entity';
    return {
      id: text(row.id),
      fullName: text(row.fullName) || 'Unnamed beneficial owner',
      partyType: 'Beneficial owner',
      nationality: optionText(row.nationality, row.nationalityOther),
      identityNumber: text(row.identityNumber),
      dateOfBirth: isoDate(row.dateOfBirth),
      address: text(row.residenceAddress) || text(row.address),
      percentage: percentage(row.uboInterestPercentage ?? row.ownershipPercentage ?? row.shareholderPercentage),
      isUbo: true,
      linkedCompany: parentIsCompany ? text(parent.fullName) : text(row.linkedClientName)
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
  return rows(record(sectionC).managers).map((row) => {
    const positions = optionList(row.position, row.positionOther);
    const isAuthorizedSignatory = Boolean(row.isAuthorizedSignatory);
    return {
      id: text(row.id),
      fullName: text(row.fullName) || 'Unnamed officer',
      positions,
      roles: officerRoles(positions, isAuthorizedSignatory),
      entityName: text(row.entityName),
      nationality: optionText(row.nationality) || text(row.nationalityAndAddress),
      identityNumber: text(row.identityNumber),
      dateOfBirth: isoDate(row.dateOfBirth),
      address: text(row.address),
      isAuthorizedSignatory
    };
  });
}

export function keyContact(sectionE: unknown) {
  const e = record(sectionE);
  const contact = {
    fullName: text(e.fullName),
    position: optionText(e.position, e.positionOther),
    nationality: optionText(e.nationality, e.nationalityOther),
    identityNumber: text(e.identityNumber),
    mobileNumber: text(e.mobileNumber),
    email: text(e.email)
  };
  return Object.values(contact).some(Boolean) ? contact : null;
}

export function profileFromForm(form: { sectionA: unknown; sectionB: unknown; sectionC: unknown; sectionE: unknown; version: number; status: string; updatedAt: Date } | null) {
  if (!form) return null;
  return {
    formVersion: form.version,
    formStatus: form.status,
    formUpdatedAt: form.updatedAt,
    company: companyDetails(form.sectionA),
    shareholders: shareholderParties(form.sectionB),
    ubos: uboParties(form.sectionB),
    officers: officers(form.sectionC),
    keyContact: keyContact(form.sectionE)
  };
}
