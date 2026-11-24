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

const COMPANY_DOCUMENTS = ['CR_EXTRACT_EN', 'CR_EXTRACT_AR', 'PUBLIC_CR', 'CERT_INCORPORATION', 'COMMERCIAL_LICENSE', 'ARTICLES'];

// `layout` (PDF text layer with positions) lets two-column forms and tables be read: see readLayout.
export function parseDocumentText(typeKey: string, raw: string, layout?: TextLine[]): DocumentSuggestion {
  const fromLayout = layout?.length ? readLayout(layout) : null;
  // Label / value pairs found in the layout come first, so they win over the same labels in the run-on text.
  const text = [
    ...(fromLayout?.pairs.map(([label, value]) => `${label}: ${value}`) || []),
    fromLayout?.activities ? `Licensed activities: ${fromLayout.activities}` : '',
    raw
  ].filter(Boolean).join('\n').replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  // A tax registration number is not the CR number.
  const crNumber = idAfter(text, [/commercial\s*registration\s*(?:no\.?|number)/, /\bC\.?\s?R\.?\s*(?:no\.?|number)/])
    || idAfter(text, [/QFC\s*(?:licen[cs]e\s*)?(?:no\.?|number)/])
    || idAfter(text, [/(?<!tax\s)(?<!tax)registration\s*(?:no\.?|number)/]);
  const qfc = /QFC\s*(?:licen[cs]e\s*)?(?:no\.?|number)\s*[:\-#]?\s*(\d{3,6})/i.exec(text)?.[1];
  const legalName = after(text, NAME, 200);
  const expiry = dateAfter(text, EXPIRY);
  const issue = dateAfter(text, ISSUE);
  const incorporated = dateAfter(text, INCORPORATION);
  const company: DocumentSuggestion['company'] = {};
  let documentNumber: string | null = null;

  if (COMPANY_DOCUMENTS.includes(typeKey)) {
    documentNumber = qfc && /qfc/i.test(text) && ['CERT_INCORPORATION', 'COMMERCIAL_LICENSE', 'ARTICLES'].includes(typeKey) ? `QFC Number ${qfc}` : crNumber;
    Object.assign(company, {
      legalName,
      commercialRegistrationNo: crNumber || qfc || null,
      dateOfIncorporation: incorporated,
      legalForm: after(text, [/legal\s*(?:form|status|structure|entity\s*type)/, /company\s*type/], 100),
      registeredOfficeAddress: after(text, [/registered\s*(?:office\s*)?address/, /(?:head\s*)?office\s*address/, /\baddress/], 300),
      shareCapital: after(text, [/(?:share|paid[\s\-]*up|authori[sz]ed)\s*capital/, /\bcapital/], 120),
      licenseActivities: after(text, [/licen[cs]ed\s*activities/, /business\s*activities/, /\bactivities/], 600),
      placeOfIncorporation: after(text, [/place\s*of\s*(?:incorporation|registration)/], 120),
      taxIdentificationNo: idAfter(text, [/tax\s*(?:registration|identification)\s*(?:no\.?|number)/])
    });
    if (['CR_EXTRACT_EN', 'CR_EXTRACT_AR', 'PUBLIC_CR'].includes(typeKey)) company.crExpiryDate = expiry;
    const nationality = after(text, [/corporate\s*nationality/, /country\s*of\s*(?:incorporation|registration)/], 100);
    if (nationality && /[a-z]/i.test(nationality)) company.countryOfIncorporation = nationality;
    else if (/QFC|Qatar\s*Financial\s*Cent/i.test(text) || /State\s*of\s*Qatar|Ministry\s*of\s*Commerce/i.test(text)) company.countryOfIncorporation = 'Qatar';
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
    people: COMPANY_DOCUMENTS.includes(typeKey) ? fromLayout?.people || [] : []
  };
}

// ---- Reading positioned text (PDF text layer) ----
// Registers such as the QFC Commercial Registration Extract print two label / value columns side by side, wrap long
// values onto the next lines and list shareholders, directors and signatories in tables. Joined into plain lines,
// a value runs into the next column's label ("Brilliant Software and Stamp of Entity: -"). Here every text piece
// keeps its x position, so values are read from their own column.

export type TextCell = { x: number; text: string };
export type TextLine = TextCell[];

const FIELD_LABELS = [
  /^(?:name\s*of\s*(?:the\s*)?(?:entity|company|firm)|(?:company|trade|commercial|entity|legal|establishment)\s*name(?:\s*\(english\))?)$/i,
  /^(?:commercial\s*registration|c\.?\s?r\.?|qfc|registration|tax\s*registration|tax\s*identification|reference|establishment\s*id)\s*(?:no\.?|number)$/i,
  /^(?:date\s*of\s*(?:registration|incorporation|establishment|expiry|issue)|(?:registration|incorporation|expiry|issue|establishment|print)\s*date)$/i,
  /^(?:legal\s*(?:form|structure|status)|company\s*type|registration\s*status|(?:share\s*|paid[\s-]*up\s*|authori[sz]ed\s*)?capital|number\s*of\s*branches|corporate\s*(?:nationality|ownership)|stamp\s*of\s*entity)$/i,
  /^(?:registered\s*(?:office\s*)?address|(?:head\s*)?office\s*address|contact\s*number|place\s*of\s*(?:incorporation|registration))$/i
];
const PEOPLE_SECTIONS: Array<[RegExp, SuggestedPerson['roles'][number]]> = [
  [/^(?:shareholders?|shareholder\(s\)|partners?|partner\(s\)|owners?)$/i, 'SHAREHOLDER'],
  [/^(?:directors?|director\(s\)|board\s*of\s*directors)$/i, 'DIRECTOR'],
  [/^(?:managers?|manager\(s\))$/i, 'MANAGER'],
  [/^authori[sz]ed\s*signator(?:y|ies)/i, 'AUTHORISED_SIGNATORY'],
  [/^(?:secretar(?:y|ies)|company\s*secretary)$/i, 'SECRETARY']
];
const SECTION_END = /^(?:activities|contact\s*information|conditions\s*and\s*restrictions|shareholders?|shareholder\(s\)|directors?|director\(s\)|authori[sz]ed\s*signator)/i;

const bare = (text: string) => text.replace(/\s+/g, ' ').replace(/^[\s:]+|[\s:]+$/g, '').trim();
const isFieldLabel = (text: string) => FIELD_LABELS.some((label) => label.test(bare(text)));
const near = (a: number, b: number, tolerance = 8) => Math.abs(a - b) <= tolerance;

// Page headers / footers and lines without Latin letters or digits (the Arabic title) are left out.
function isNoise(line: TextLine) {
  const text = line.map((cell) => cell.text).join(' ');
  return !/[A-Za-z0-9]/.test(text)
    || /^page\s*\d+\s*of\s*\d+/i.test(text)
    || /digitally[\s-]*signed/i.test(text)
    || /^(?:companies|registration\s*office|commercial\s*registration\s*extract)$/i.test(bare(text));
}

export function readLayout(input: TextLine[]) {
  const lines = input.map((line) => line.filter((cell) => bare(cell.text)).sort((a, b) => a.x - b.x)).filter((line) => line.length && !isNoise(line));
  const pairs: Array<[string, string]> = [];
  const consumed = new Set<string>();
  const key = (lineIndex: number, cell: TextCell) => `${lineIndex}:${cell.x}`;
  const isLabelCell = (cell: TextCell) => isFieldLabel(cell.text) || (cell.text.trim().endsWith(':') && bare(cell.text).split(' ').length <= 4 && /[a-z]/i.test(cell.text));

  lines.forEach((line, lineIndex) => {
    line.forEach((cell, cellIndex) => {
      if (consumed.has(key(lineIndex, cell))) return;
      let label = bare(cell.text);
      if (!isFieldLabel(label)) {
        // A label wrapped onto the next line: "Date of" / "Registration:", "Tax Registration" / "Number:".
        const next = lines[lineIndex + 1]?.find((other) => near(other.x, cell.x, 6) && other.text.trim().endsWith(':'));
        if (!next || !isFieldLabel(`${label} ${bare(next.text)}`)) return;
        label = `${label} ${bare(next.text)}`;
        consumed.add(key(lineIndex + 1, next));
      }
      const rest = line.slice(cellIndex + 1);
      const nextLabel = rest.find(isLabelCell) || rest.find((other) => isFieldLabel(`${bare(other.text)} ${bare(lines[lineIndex + 1]?.find((below) => near(below.x, other.x, 6))?.text || '')}`));
      const valueCell = rest[0] && rest[0] !== nextLabel ? rest[0] : undefined;
      const columnEnd = nextLabel ? nextLabel.x - 4 : Infinity;
      const parts: string[] = [];
      if (valueCell) {
        // Value to the right, continued on the following lines in the same column.
        parts.push(...rest.filter((other) => other.x < columnEnd).map((other) => other.text));
        for (let follow = lineIndex + 1; follow < Math.min(lines.length, lineIndex + 6); follow += 1) {
          const row = lines[follow].filter((other) => !consumed.has(key(follow, other)));
          if (!row.some((other) => near(other.x, valueCell.x)) || row.some((other) => other.x < valueCell.x - 8)) break;
          const inColumn = row.filter((other) => other.x >= valueCell.x - 8 && other.x < columnEnd);
          if (inColumn.some(isLabelCell)) break;
          parts.push(...inColumn.map((other) => other.text));
        }
      } else if (!cell.text.trim().endsWith(':') && lines[lineIndex + 1] && !lines[lineIndex + 1].some(isLabelCell)) {
        // A column header with its value on the next line ("Registered Office Address" over the address).
        parts.push(...lines[lineIndex + 1].filter((other) => other.x >= cell.x - 8 && other.x < columnEnd).map((other) => other.text));
      }
      const value = bare(parts.filter((part) => bare(part) !== ':').join(' '));
      if (value && value !== '-') pairs.push([label, value]);
    });
  });

  return { pairs, activities: readActivities(lines), people: readPeopleTables(lines) };
}

// "Activities": each activity name is the line just before its code line ("6201-001 Designing ...").
function readActivities(lines: TextLine[]) {
  const start = lines.findIndex((line) => line.length === 1 && /^(?:licen[cs]ed\s*)?activities$/i.test(bare(line[0].text)));
  if (start < 0) return null;
  const section: TextLine[] = [];
  for (let index = start + 1; index < lines.length && section.length < 80; index += 1) {
    const text = bare(lines[index].map((cell) => cell.text).join(' '));
    if (/^conditions/i.test(text) || (lines[index].length === 1 && SECTION_END.test(text))) break;
    if (/^number\s+activity$/i.test(text)) continue;
    section.push(lines[index]);
  }
  const isCode = (line: TextLine | undefined) => Boolean(line && /^\d{4}-\d{3}$|^\d{4,6}$/.test(bare(line[0].text)));
  const names = section
    .map((line, index) => (!isCode(line) && isCode(section[index + 1]) ? `${bare(line.map((cell) => cell.text).join(' '))} (${bare(section[index + 1][0].text)})` : ''))
    .filter(Boolean);
  return names.length ? names.join('; ').slice(0, 1000) : null;
}

// Shareholder / director / signatory tables: a title line, a header with "Name", then rows. A row starts on a line
// with a value under another column (document number, nationality, ...); lines with only name text continue it.
function readPeopleTables(lines: TextLine[]): SuggestedPerson[] {
  const people: SuggestedPerson[] = [];
  lines.forEach((line, lineIndex) => {
    if (line.length !== 1) return;
    const role = PEOPLE_SECTIONS.find(([title]) => title.test(bare(line[0].text)))?.[1];
    const header = lines[lineIndex + 1];
    if (!role || !header?.some((cell) => /^(?:full\s*)?name$/i.test(bare(cell.text)))) return;
    const columns = header.map((cell) => ({ x: cell.x, name: bare(cell.text).toLowerCase() }));
    const column = (x: number) => columns.reduce((best, item) => (Math.abs(item.x - x) < Math.abs(best.x - x) ? item : best)).name;
    const rows: Array<Record<string, string>> = [];
    for (let index = lineIndex + 2; index < lines.length; index += 1) {
      const row = lines[index];
      const text = bare(row.map((cell) => cell.text).join(' '));
      if ((row.length === 1 && SECTION_END.test(text)) || row.some((cell) => isFieldLabel(cell.text))) break;
      // The header's second line ("Number", "Number").
      if (index === lineIndex + 2 && row.every((cell) => /^(?:number|no\.?)$/i.test(bare(cell.text)))) continue;
      const cells = row.map((cell) => ({ column: column(cell.x), text: bare(cell.text) }));
      const startsRow = cells.some((cell) => /document|passport|qid|nationality|percent|share/.test(cell.column));
      if (startsRow || !rows.length) rows.push({});
      const current = rows[rows.length - 1];
      for (const cell of cells) current[cell.column] = current[cell.column] ? `${current[cell.column]} ${cell.text}` : cell.text;
    }
    for (const row of rows) {
      const pick = (pattern: RegExp) => {
        const name = Object.keys(row).find((item) => pattern.test(item));
        const value = name ? bare(row[name]) : '';
        return value && value !== '-' ? value : null;
      };
      const fullName = pick(/name/);
      if (!fullName) continue;
      const share = pick(/percent|share/)?.replace(/\s*%$/, '') || null;
      people.push({
        fullName: fullName.slice(0, 200),
        nationality: pick(/nationality/),
        roles: [role],
        sharePercentage: share && Number.isFinite(Number(share)) && Number(share) >= 0 && Number(share) <= 100 ? String(Number(share)) : null,
        idNumber: pick(/document|passport|qid/)
      });
    }
  });
  // One entry per person: the same document number (or name) in several tables is one person with several roles.
  const merged: SuggestedPerson[] = [];
  for (const person of people) {
    const same = merged.find((other) => (person.idNumber && other.idNumber === person.idNumber) || other.fullName.toLowerCase() === person.fullName.toLowerCase());
    if (!same) {
      merged.push({ ...person, roles: [...person.roles] });
      continue;
    }
    for (const role of person.roles) if (!same.roles.includes(role)) same.roles.push(role);
    same.nationality = same.nationality || person.nationality;
    same.sharePercentage = same.sharePercentage || person.sharePercentage;
    same.idNumber = same.idNumber || person.idNumber;
  }
  return merged.slice(0, 50);
}
