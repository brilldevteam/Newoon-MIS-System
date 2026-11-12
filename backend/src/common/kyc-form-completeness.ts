import { beneficialOwners } from './ownership';

// Required KYC form details, checked before the AML Supervisor submits the file to DMLRO. Saving a draft stays
// possible with gaps; only submission needs these. Keep the list in sync with the "*" markers in KycFormEditorPage.
// Preliminary (proposed-company) forms that have not started the full KYC have their own completeness rules.

type Rec = Record<string, unknown>;
export type FormCompletenessIssue = { section: 'sectionA' | 'sectionB' | 'sectionC' | 'sectionE' | 'sectionG'; title: string; missing: string[] };

const record = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Rec;
const rows = (value: unknown) => (Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : []) as Rec[];
const filled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(filled);
  if (value === null || value === undefined) return false;
  const textValue = String(value).trim();
  return textValue !== '' && textValue !== '[]' && textValue.toLowerCase() !== 'other';
};
// "Other" selections carry their text in a sibling "...Other" field.
const choice = (data: Rec, key: string) => filled(data[key]) || filled(data[`${key}Other`]);
// The telephone field is pre-filled with the country dial code; a number needs more than the code.
const phone = (value: unknown) => String(value || '').replace(/\D/g, '').length >= 7;
const email = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

// Long tables: name the first few rows with gaps, then count the rest so the message stays readable.
function capRows(lines: string[], kind: string, limit = 6) {
  return lines.length > limit ? [...lines.slice(0, limit), `and ${lines.length - limit} more ${kind} with missing details`] : lines;
}

function rowLabel(row: Rec, index: number, kind: string) {
  const name = String(row.fullName || '').trim();
  return name ? `${kind} "${name}"` : `${kind} ${index + 1}`;
}

export function kycFormCompletenessIssues(form: { fullKycStarted?: boolean | null; sectionA?: unknown; sectionB?: unknown; sectionC?: unknown; sectionE?: unknown; sectionG?: unknown }): FormCompletenessIssue[] {
  const a = record(form.sectionA);
  if (a.formVariant === 'PRELIMINARY_PROPOSED_COMPANY' && !form.fullKycStarted) return [];
  const b = record(form.sectionB);
  const c = record(form.sectionC);
  const e = record(form.sectionE);
  const g = record(form.sectionG);
  const issues: FormCompletenessIssue[] = [];
  const add = (section: FormCompletenessIssue['section'], title: string, missing: string[]) => {
    if (missing.length) issues.push({ section, title, missing });
  };

  add('sectionA', 'A. General Company Information', [
    !filled(a.legalName) && 'Legal Name of Company',
    !filled(a.commercialRegistrationNo) && 'Commercial Registration No.',
    !filled(a.dateOfIncorporation) && 'Date of Incorporation',
    !choice(a, 'countryOfIncorporation') && 'Country of Incorporation',
    !choice(a, 'legalForm') && 'Legal Form',
    !filled(a.registeredOfficeAddress) && 'Registered Office Address',
    !phone(a.telephone) && 'Telephone',
    !email(a.email) && 'Email (a valid address)',
    !choice(a, 'businessNature') && 'Main purpose / nature of business',
    !choice(a, 'relatedIndustry') && 'Related Industry',
    !choice(a, 'prospectiveService') && 'Nature of prospective service from Newoon'
  ].filter(Boolean) as string[]);

  const managers = rows(c.managers);
  const managerGaps: string[] = [];
  if (!managers.length) managerGaps.push('add at least one manager, director or authorized signatory');
  const managerRows: string[] = [];
  managers.forEach((row, index) => {
    const missing = [!filled(row.fullName) && 'full name', !filled(row.position) && 'position', !filled(row.nationality) && !filled(row.nationalityAndAddress) && 'nationality', !filled(row.identityNumber) && 'QID / Passport No.'].filter(Boolean);
    if (missing.length) managerRows.push(`${rowLabel(row, index, 'Person')}: ${missing.join(', ')}`);
  });
  managerGaps.push(...capRows(managerRows, 'people'));
  if (managers.length && !managers.some((row) => row.isAuthorizedSignatory === true || row.isAuthorizedSignatory === 'true')) managerGaps.push('tick "Authorized signatory" for at least one person');
  add('sectionC', 'B. Managers / Signatories', managerGaps);

  const parties = rows(b.shareholders);
  const ownershipGaps: string[] = [];
  if (!parties.length) ownershipGaps.push('add at least one shareholder');
  const partyRows: string[] = [];
  parties.forEach((row, index) => {
    const corporate = row.shareholderType === 'Corporate Entity';
    const missing = [
      !filled(row.fullName) && 'full name',
      !filled(row.nationality) && (corporate ? 'country' : 'nationality'),
      !filled(row.identityNumber) && (corporate ? 'CR number' : 'QID / Passport number'),
      !filled(row.shareholderPercentage ?? row.ownershipPercentage) && 'shareholder %'
    ].filter(Boolean);
    if (missing.length) partyRows.push(`${rowLabel(row, index, 'Shareholder')}: ${missing.join(', ')}`);
  });
  ownershipGaps.push(...capRows(partyRows, 'shareholders'));
  const direct = parties.filter((row) => !String(row.parentRowId || '').trim());
  const directTotal = direct.reduce((sum, row) => {
    const value = Number(row.shareholderPercentage ?? row.ownershipPercentage);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  if (direct.length && Math.abs(directTotal - 100) > 0.01) ownershipGaps.push(`direct shareholders must total 100% (now ${Number(directTotal.toFixed(2))}%)`);
  if (parties.length && !beneficialOwners(parties, rows(b.ubos)).length) ownershipGaps.push('identify at least one beneficial owner (UBO): tick "Beneficial person" on an individual or add one');
  add('sectionB', 'C. Shareholders', ownershipGaps);

  add('sectionE', 'E. Key Communication Person', [
    !filled(e.fullName) && 'Full name',
    !choice(e, 'position') && 'Position / Job title',
    !phone(e.mobileNumber) && 'Mobile Number',
    !email(e.email) && 'Email (a valid address)'
  ].filter(Boolean) as string[]);

  add('sectionG', 'G. Client Declaration', [
    !filled(g.fullName) && 'Full name',
    !choice(g, 'position') && 'Position',
    !filled(g.date) && 'Date',
    !filled(g.signatureDataUrl) && !filled(g.signatureFileName) && 'Authorized signature'
  ].filter(Boolean) as string[]);

  return issues;
}

export function kycFormCompletenessMessage(issues: FormCompletenessIssue[]) {
  return issues.map((issue) => `${issue.title}: ${issue.missing.join('; ')}.`).join('\n');
}
