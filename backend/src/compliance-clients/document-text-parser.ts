// Reads document details from the plain text of a company document (PDF text layer or OCR), for the local reader
// used when the company has no AI service. Best effort, English labels only: every value is a suggestion that staff
// check before saving. Pure functions, so they can be checked without files.

export type DocumentSuggestion = {
  document: { documentNumber: string | null; holderName: string | null; location: string | null; issueDate: string | null; expiryDate: string | null };
  company: Partial<Record<CompanyField, string | null>>;
  people: SuggestedPerson[];
};

export type CompanyField =
  | 'legalName' | 'commercialRegistrationNo' | 'dateOfIncorporation' | 'crExpiryDate' | 'countryOfIncorporation' | 'placeOfIncorporation'
  | 'legalForm' | 'registeredOfficeAddress' | 'shareCapital' | 'taxIdentificationNo' | 'licenseActivities';

export const SUGGESTED_ROLES = ['SHAREHOLDER', 'DIRECTOR', 'MANAGER', 'AUTHORISED_SIGNATORY', 'SECRETARY', 'CHAIRMAN', 'MANAGING_DIRECTOR', 'GENERAL_MANAGER', 'CEO', 'OTHER'] as const;
export type SuggestedPerson = { fullName: string; nationality: string | null; roles: Array<(typeof SUGGESTED_ROLES)[number]>; sharePercentage: string | null; idNumber: string | null };

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DATE = String.raw`(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\.?,?\s+\d{4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})`;

// Dates are read day-first (Qatar documents); the result is YYYY-MM-DD or null when not a real date.
export function parseDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/.exec(text);
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(text))) [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(text))) [day, month, year] = [Number(match[1]), monthIndex(match[2]), Number(match[3])];
  else if ((match = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text))) [month, day, year] = [monthIndex(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  if (!month || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

function monthIndex(name: string) {
  const lower = name.toLowerCase();
  const index = MONTHS.findIndex((month) => month.startsWith(lower.slice(0, 3)));
  return index >= 0 ? index + 1 : 0;
}

function clean(value: string | undefined | null, max = 300) {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').replace(/^[\s:.\-–]+|[\s:;,–]+$/g, '').trim();
  return text ? text.slice(0, max) : null;
}

// The value after the first label that matches, on the same line.
function after(text: string, labels: RegExp[], max = 300) {
  for (const label of labels) {
    const match = new RegExp(`${label.source}\\s*[:\\-–]?\\s*([^\\n]+)`, 'i').exec(text);
    const value = clean(match?.[1], max);
    if (value) return value;
  }
  return null;
}

function dateAfter(text: string, labels: RegExp[]) {
  for (const label of labels) {
    const match = new RegExp(`${label.source}\\s*[:\\-–]?\\s*${DATE}`, 'i').exec(text);
    const date = parseDate(match?.[1]);
    if (date) return date;
  }
  return null;
}

function idAfter(text: string, labels: RegExp[]) {
  for (const label of labels) {
    // Letters, digits, dashes and slashes with at least one digit (04669, T04669, 17-3101-95, CR-DEMO-90210).
    const match = new RegExp(`${label.source}\\s*[:\\-–#]?\\s*([A-Z0-9](?=[A-Z0-9\\-\\/]*\\d)[A-Z0-9\\-\\/]{1,30})`, 'i').exec(text);
    const value = clean(match?.[1], 40);
    if (value) return value.replace(/\s+/g, '');
  }
  return null;
}

const EXPIRY = [/expiry\s*date/, /date\s*of\s*expiry/, /expiration\s*date/, /valid\s*(?:until|till|to|up\s*to)/, /expires?\s*on/, /expiry/];
const ISSUE = [/issue\s*date/, /date\s*of\s*issue/, /issued\s*on/];
const INCORPORATION = [/date\s*of\s*(?:incorporation|registration|establishment)/, /(?:incorporation|registration|establishment)\s*date/];
const NAME = [/(?:company|trade|commercial|entity|legal|establishment)\s*name(?:\s*\(english\))?/, /name\s*of\s*(?:the\s*)?(?:company|entity|firm)/];

export function parseDocumentText(typeKey: string, raw: string): DocumentSuggestion {
  const text = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const crNumber = idAfter(text, [/commercial\s*registration\s*(?:no\.?|number)/, /\bC\.?\s?R\.?\s*(?:no\.?|number)/, /registration\s*(?:no\.?|number)/])
    || idAfter(text, [/QFC\s*(?:licen[cs]e\s*)?(?:no\.?|number)/]);
  const qfc = /QFC\s*(?:licen[cs]e\s*)?(?:no\.?|number)\s*[:\-#]?\s*(\d{3,6})/i.exec(text)?.[1];
  const legalName = after(text, NAME, 200);
  const expiry = dateAfter(text, EXPIRY);
  const issue = dateAfter(text, ISSUE);
  const incorporated = dateAfter(text, INCORPORATION);
  const company: DocumentSuggestion['company'] = {};
  let documentNumber: string | null = null;

  if (['CR_EXTRACT_EN', 'CR_EXTRACT_AR', 'PUBLIC_CR', 'CERT_INCORPORATION', 'COMMERCIAL_LICENSE', 'ARTICLES'].includes(typeKey)) {
    documentNumber = qfc && /qfc/i.test(text) && ['CERT_INCORPORATION', 'COMMERCIAL_LICENSE', 'ARTICLES'].includes(typeKey) ? `QFC Number ${qfc}` : crNumber;
    Object.assign(company, {
      legalName,
      commercialRegistrationNo: crNumber || qfc || null,
      dateOfIncorporation: incorporated,
      legalForm: after(text, [/legal\s*(?:form|status|structure|entity\s*type)/, /company\s*type/], 100),
      registeredOfficeAddress: after(text, [/registered\s*(?:office\s*)?address/, /(?:head\s*)?office\s*address/, /\baddress/], 300),
      shareCapital: after(text, [/(?:share|paid[\s\-]*up|authori[sz]ed)\s*capital/, /\bcapital/], 120),
      licenseActivities: after(text, [/licen[cs]ed\s*activities/, /business\s*activities/, /\bactivities/], 600),
      placeOfIncorporation: after(text, [/place\s*of\s*(?:incorporation|registration)/], 120)
    });
    if (['CR_EXTRACT_EN', 'CR_EXTRACT_AR', 'PUBLIC_CR'].includes(typeKey)) company.crExpiryDate = expiry;
    if (/QFC|Qatar\s*Financial\s*Cent/i.test(text) || /State\s*of\s*Qatar|Ministry\s*of\s*Commerce/i.test(text)) company.countryOfIncorporation = 'Qatar';
  } else if (typeKey === 'COMPUTER_CARD') {
    documentNumber = idAfter(text, [/establishment\s*(?:id|no\.?|number)/, /computer\s*card\s*(?:no\.?|number)/, /card\s*(?:no\.?|number)/]);
  } else if (typeKey === 'TAX_CARD') {
    documentNumber = idAfter(text, [/tax\s*(?:identification|registration|card)?\s*(?:no\.?|number)/, /\bTIN\b/]);
    if (documentNumber) company.taxIdentificationNo = documentNumber;
  } else if (typeKey === 'NATIONAL_ADDRESS') {
    documentNumber = idAfter(text, [/certificate\s*(?:no\.?|number)/, /reference\s*(?:no\.?|number)/]);
  } else {
    documentNumber = idAfter(text, [/(?:document|certificate|reference|licen[cs]e)\s*(?:no\.?|number)/]);
  }

  for (const key of Object.keys(company) as Array<keyof typeof company>) if (!company[key]) delete company[key];
  return {
    document: {
      documentNumber,
      holderName: typeKey === 'NATIONAL_ADDRESS' || typeKey === 'POWER_OF_ATTORNEY' ? after(text, [/(?:full\s*)?name/, /holder/], 200) : legalName,
      location: /Qatar/i.test(text) ? 'Qatar' : null,
      issueDate: issue,
      expiryDate: expiry
    },
    company,
    people: []
  };
}
