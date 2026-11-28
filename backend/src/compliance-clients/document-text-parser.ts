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

  // The Ministry's printed summary has its own layout: when it is recognised its values replace the generic reading.
  const moci = COMPANY_DOCUMENTS.includes(typeKey) && layout?.length ? readMociSummary(layout) : null;
  if (moci) {
    for (const key of Object.keys(company) as Array<keyof typeof company>) delete company[key];
    Object.assign(company, moci.company);
    documentNumber = moci.company.commercialRegistrationNo || documentNumber;
  }
  for (const key of Object.keys(company) as Array<keyof typeof company>) if (!company[key]) delete company[key];
  return {
    document: {
      documentNumber,
      holderName: typeKey === 'NATIONAL_ADDRESS' || typeKey === 'POWER_OF_ATTORNEY' ? after(text, [/(?:full\s*)?name/, /holder/], 200) : moci?.company.legalName || legalName,
      location: /Qatar/i.test(text) ? 'Qatar' : null,
      issueDate: issue,
      expiryDate: moci?.company.crExpiryDate || expiry
    },
    company,
    people: COMPANY_DOCUMENTS.includes(typeKey) ? moci?.people || fromLayout?.people || [] : []
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

// ---- Ministry of Commerce and Industry "Summary of commercial registry info" ----
// The Qatar CR printed by the Ministry (Arabic and English side by side). Every English label is printed under its
// value, long values wrap above and below their label, and the owner / director tables list one person per row. The
// Arabic text has no Latin letters, so only the English cells are used; each value is the cell nearest above its label.

const MOCI_TITLE = /summary\s*of\s*commercial\s*registry\s*info/i;
const POSITION_ROLES: Array<[RegExp, SuggestedPerson['roles'][number]]> = [
  [/chairman/i, 'CHAIRMAN'], [/managing\s*director/i, 'MANAGING_DIRECTOR'], [/general\s*manager/i, 'GENERAL_MANAGER'], [/director/i, 'DIRECTOR'],
  [/manager/i, 'MANAGER'], [/secretary/i, 'SECRETARY'], [/signator/i, 'AUTHORISED_SIGNATORY'], [/\bceo\b|chief\s*executive/i, 'CEO']
];

function mociLegalForm(value: string) {
  const compact = value.replace(/[\s.]/g, '').toUpperCase();
  if (compact === 'WLL' || compact === 'LLC') return 'LLC';
  return value.trim();
}

const titleCase = (value: string) => value.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());

export function readMociSummary(input: TextLine[]): { company: Partial<Record<CompanyField, string>>; people: SuggestedPerson[] } | null {
  const lines = input.map((line) => line.filter((cell) => /[A-Za-z0-9]/.test(cell.text) && bare(cell.text)).sort((a, b) => a.x - b.x)).filter((line) => line.length);
  if (!lines.some((line) => MOCI_TITLE.test(line.map((cell) => cell.text).join(' ')))) return null;
  const textOf = (cell: TextCell) => bare(cell.text);
  const joined = (line: TextLine) => line.map(textOf).join(' ');
  const find = (label: RegExp) => {
    for (let index = 0; index < lines.length; index += 1) {
      const cell = lines[index].find((item) => label.test(textOf(item)));
      if (cell) return { index, cell };
    }
    return null;
  };
  // The value printed next to a label: the nearest matching cell of the lines just before or after the label line
  // (values are centred in their row, so a two-line label can sit above or below its value).
  const above = (label: RegExp, accept: RegExp = /./) => {
    const found = find(label);
    if (!found) return '';
    const candidates: Array<{ cell: TextCell; distance: number }> = [];
    for (const offset of [-1, 1, 2, 3]) {
      for (const cell of lines[found.index + offset] || []) {
        if (accept.test(textOf(cell)) && Math.abs(cell.x - found.cell.x) <= 130) candidates.push({ cell, distance: Math.abs(cell.x - found.cell.x) });
      }
    }
    candidates.sort((x, y) => x.distance - y.distance);
    return candidates[0] ? textOf(candidates[0].cell) : '';
  };
  const company: Partial<Record<CompanyField, string>> = {};

  const crNumber = above(/^C\.?R\.?\s*Number$/i, /^\d{3,}$/);
  if (crNumber) company.commercialRegistrationNo = crNumber;

  // Legal form sits left of its label on the label line; the commercial name wraps above and below the line.
  const nameLabel = find(/^Commercial\s*Name$/i);
  const formLabel = find(/^Legal\s*form$/i);
  if (formLabel) {
    const form = lines[formLabel.index].filter((cell) => cell.x < formLabel.cell.x && !/^legal\s*form$/i.test(textOf(cell))).map(textOf).join(' ');
    if (form) company.legalForm = mociLegalForm(form);
  }
  if (nameLabel) {
    const side = (line: TextLine | undefined) => (line || []).filter((cell) => cell.x >= 200 && !/information|number|date|status|nationality|capital/i.test(textOf(cell))).map(textOf);
    const sameLine = lines[nameLabel.index].filter((cell) => cell.x > nameLabel.cell.x + 20).map(textOf);
    const name = [...side(lines[nameLabel.index - 1]), ...sameLine, ...(lines[nameLabel.index + 1] && lines[nameLabel.index + 1].length === 1 ? side(lines[nameLabel.index + 1]) : [])].join(' ').replace(/\s+/g, ' ').trim();
    if (name) company.legalName = name;
  }

  const capital = above(/^Capital$/i, /^[\d,.]+$/);
  if (capital) company.shareCapital = capital.replace(/,/g, '');
  const expiry = parseDate(above(/^Expiry\s*Date$/i, /^\d{1,2}\/\d{1,2}\/\d{4}$/));
  if (expiry) company.crExpiryDate = expiry;
  const established = parseDate(above(/^Est\.?\s*Date$/i, /^\d{1,2}\/\d{1,2}\/\d{4}$/));
  if (established) company.dateOfIncorporation = established;
  const nationality = above(/^Nationality$/i, /^[A-Z][A-Z\s]+$/);
  if (nationality) company.countryOfIncorporation = titleCase(nationality);
  const tax = above(/^Tax\s*Registration\s*Number/i, /^\d{6,}$/);
  if (tax) company.taxIdentificationNo = tax;

  // Activities: rows of two columns; a row starts on the line holding the activity codes.
  const start = find(/^Commercial\s*Activities$/i);
  const end = find(/^Tax\s*Registration\s*Number/i);
  if (start && end && end.index > start.index) {
    type Row = { codes: Array<[number, string]>; left: string[]; right: string[] };
    const rows: Row[] = [];
    for (const line of lines.slice(start.index + 1, end.index)) {
      const text = joined(line);
      if (/activity\s*(?:name|code)/i.test(text)) continue;
      const codes = line.filter((cell) => /^\d{4,6}$/.test(textOf(cell))).map((cell) => [cell.x, textOf(cell)] as [number, string]);
      if (codes.length) rows.push({ codes, left: [], right: [] });
      const row = rows[rows.length - 1];
      if (!row) continue;
      for (const cell of line) {
        const value = textOf(cell);
        if (/^\d{4,6}$/.test(value) || /^[•\-]$/.test(value)) continue;
        (cell.x < 260 ? row.left : row.right).push(value.replace(/^[•\-]\s*/, ''));
      }
    }
    const activities = rows.flatMap((row) => {
      const code = (right: boolean) => row.codes.find(([x]) => (x >= 260) === right)?.[1];
      return [[row.left.join(' ').trim(), code(false)], [row.right.join(' ').trim(), code(true)]].filter(([name]) => name).map(([name, number]) => (number ? `${name} (${number})` : name));
    });
    if (activities.length) company.licenseActivities = activities.join('; ').slice(0, 1000);
  }

  // Owners (percentage, id, name) then directors (position, id, name); nationality is on the following line.
  const ownersAt = find(/^Owner\s*Name\s*or\s*Partners$/i)?.index ?? -1;
  const directorsAt = find(/^Directors\s*Names$/i)?.index ?? -1;
  const people: SuggestedPerson[] = [];
  const byId = new Map<string, SuggestedPerson>();
  const addPerson = (person: SuggestedPerson) => {
    const existing = person.idNumber ? byId.get(person.idNumber) : undefined;
    if (existing) {
      existing.roles = [...new Set([...existing.roles, ...person.roles])];
      existing.sharePercentage = existing.sharePercentage || person.sharePercentage;
      existing.nationality = existing.nationality || person.nationality;
      return;
    }
    people.push(person);
    if (person.idNumber) byId.set(person.idNumber, person);
  };
  const isId = (cell: TextCell) => /^\d{8,}$/.test(textOf(cell));
  const readRows = (from: number, to: number, owners: boolean) => {
    for (let index = from + 1; index < to; index += 1) {
      const id = lines[index].find(isId);
      if (!id) continue;
      const name: string[] = lines[index].filter((cell) => cell.x > id.x && !isId(cell)).map(textOf);
      let country = '';
      let position = '';
      for (let follow = index + 1; follow < to && !lines[follow].some(isId) && follow < index + 5; follow += 1) {
        for (const cell of lines[follow]) {
          const value = textOf(cell);
          if (/^(?:active|inactive|cancelled|suspended)$/i.test(value) || /^page\b|^\d+$/i.test(value) || MOCI_TITLE.test(value)) continue;
          if (cell.x > 300) name.push(value);
          else if (/^[A-Za-z][A-Za-z\s]+$/.test(value) && !country && !/authority|manager|director|chairman|secretary|signator/i.test(value)) country = value;
          else if (/manager|director|chairman|secretary|signator/i.test(value)) position = value.replace(/\s*-\s*$/, '');
        }
      }
      // Directors print their position and authority to the left of the id on the id line.
      if (!owners) position = position || lines[index].filter((cell) => cell.x < id.x).map(textOf).find((value) => /manager|director|chairman|secretary|signator/i.test(value)) || '';
      const fullName = name.join(' ').replace(/\s+/g, ' ').trim();
      if (!fullName) continue;
      const percentage = owners ? lines[index].filter((cell) => cell.x < id.x).map(textOf).find((value) => /^\d{1,3}(?:\.\d+)?$/.test(value)) || null : null;
      const role = owners ? 'SHAREHOLDER' : POSITION_ROLES.find(([pattern]) => pattern.test(position))?.[1] || 'MANAGER';
      addPerson({ fullName, nationality: country ? titleCase(country) : null, roles: [role], sharePercentage: percentage, idNumber: textOf(id) });
    }
  };
  if (ownersAt >= 0) readRows(ownersAt, directorsAt > ownersAt ? directorsAt : lines.length, true);
  if (directorsAt >= 0) readRows(directorsAt, start && start.index > directorsAt ? start.index : lines.length, false);
  return { company, people };
}
