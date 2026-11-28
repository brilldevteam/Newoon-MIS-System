// What is still missing in one section of the KYC form, so "Next" can wait until the section is complete.
// Mirrors backend/src/common/kyc-form-completeness.ts (the submission check); keep the two in sync.

type Rec = Record<string, any>;

const record = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Rec;
const rows = (value: unknown) => (Array.isArray(value) ? value.filter((row) => row && typeof row === 'object') : []) as Rec[];
const filled = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(filled);
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== '' && text !== '[]' && text.toLowerCase() !== 'other';
};
// "Other" selections carry their text in a sibling "...Other" field.
const choice = (data: Rec, key: string) => filled(data[key]) || filled(data[`${key}Other`]);
const phone = (value: unknown) => String(value || '').replace(/\D/g, '').length >= 7;
const email = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const who = (row: Rec, index: number, kind: string) => (String(row.fullName || '').trim() ? `${kind} "${String(row.fullName).trim()}"` : `${kind} ${index + 1}`);

function capped(lines: string[], limit = 4) {
  return lines.length > limit ? [...lines.slice(0, limit), `and ${lines.length - limit} more with missing details`] : lines;
}

export function kycSectionMissing(form: Rec, section: string): string[] {
  const a = record(form.sectionA);
  // A preliminary (proposed company) form has its own, lighter rules until the full KYC starts.
  if (a.formVariant === 'PRELIMINARY_PROPOSED_COMPANY' && !form.fullKycStarted) return [];

  if (section === 'sectionA') {
    return [
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
    ].filter(Boolean) as string[];
  }

  if (section === 'sectionC') {
    const managers = rows(record(form.sectionC).managers);
    const gaps = managers.length ? [] : ['Add at least one manager, director or authorized signatory'];
    const lines: string[] = [];
    managers.forEach((row, index) => {
      const missing = [
        !filled(row.fullName) && 'full name',
        !filled(row.position) && 'position',
        !filled(row.nationality) && !filled(row.nationalityAndAddress) && 'nationality',
        !filled(row.identityNumber) && !filled(row.qidNumber) && !filled(row.passportNumber) && 'QID or passport number',
        filled(row.qidNumber) && !filled(row.qidExpiry) && 'QID expiry date',
        filled(row.passportNumber) && !filled(row.passportExpiry) && 'passport expiry date'
      ].filter(Boolean);
      if (missing.length) lines.push(`${who(row, index, 'Person')}: ${missing.join(', ')}`);
    });
    return [...gaps, ...capped(lines)];
  }

  if (section === 'sectionB') {
    const b = record(form.sectionB);
    const parties = rows(b.shareholders);
    const gaps = parties.length ? [] : ['Add at least one shareholder'];
    const lines: string[] = [];
    parties.forEach((row, index) => {
      const corporate = row.shareholderType === 'Corporate Entity';
      const missing = [
        !filled(row.fullName) && 'full name',
        !filled(row.nationality) && (corporate ? 'country' : 'nationality'),
        !filled(row.identityNumber) && !filled(row.qidNumber) && !filled(row.passportNumber) && (corporate ? 'CR number' : 'QID or passport number'),
        !filled(row.shareholderPercentage ?? row.ownershipPercentage) && 'shareholder %',
        !corporate && filled(row.qidNumber) && !filled(row.qidExpiry) && 'QID expiry date',
        !corporate && filled(row.passportNumber) && !filled(row.passportExpiry) && 'passport expiry date'
      ].filter(Boolean);
      if (missing.length) lines.push(`${who(row, index, 'Shareholder')}: ${missing.join(', ')}`);
    });
    const out = [...gaps, ...capped(lines)];
    const direct = parties.filter((row) => !String(row.parentRowId || '').trim());
    const total = direct.reduce((sum, row) => {
      const value = Number(row.shareholderPercentage ?? row.ownershipPercentage);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    if (direct.length && Math.abs(total - 100) > 0.01) out.push(`Direct shareholders must total 100% (now ${Number(total.toFixed(2))}%)`);
    const hasOwner = parties.some((row) => row.isUbo && row.shareholderType !== 'Corporate Entity' && filled(row.fullName)) || rows(b.ubos).some((row) => filled(row.fullName));
    if (parties.length && !hasOwner) out.push('Identify at least one beneficial owner (UBO)');
    return out;
  }

  if (section === 'sectionE') {
    const e = record(form.sectionE);
    return [
      !filled(e.fullName) && 'Full name',
      !choice(e, 'position') && 'Position / Job title',
      filled(e.qidNumber) && !filled(e.qidExpiry) && 'QID expiry date',
      filled(e.passportNumber) && !filled(e.passportExpiry) && 'Passport expiry date',
      !phone(e.mobileNumber) && 'Mobile Number',
      !email(e.email) && 'Email (a valid address)'
    ].filter(Boolean) as string[];
  }

  if (section === 'sectionG') {
    const g = record(form.sectionG);
    return [!filled(g.fullName) && 'Full name', !choice(g, 'position') && 'Position', !filled(g.date) && 'Date'].filter(Boolean) as string[];
  }

  return [];
}
