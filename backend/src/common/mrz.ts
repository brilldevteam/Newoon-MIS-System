// Parses the machine-readable zone (MRZ) of passports (ICAO 9303 TD3: 2 x 44 characters) and ID cards such as the
// Qatar ID (TD1: 3 x 30 characters) from OCR text. Every value comes with its ICAO check digit; OCR mix-ups
// (O/0, I/1, S/5, B/8, Z/2, G/6) are only corrected when the corrected value then matches its check digit.
// Pure functions, so the parser can be checked without OCR.

export type MrzResult = {
  format: 'TD3' | 'TD1';
  documentType: string;
  issuingCountry: string;
  documentNumber: string | null;
  // OK: matches its check digit as read. CORRECTED: matches only after swapping look-alike characters, so a person
  // must compare it with the document. FAILED: does not match.
  documentNumberCheck: 'OK' | 'CORRECTED' | 'FAILED';
  expiryDate: string | null;
  expiryValid: boolean;
  // Date of birth (YYYY-MM-DD) when it matches its check digit; null otherwise.
  dateOfBirth: string | null;
  nationality: string;
  surname: string;
  givenNames: string;
  lines: string[];
};

const WEIGHTS = [7, 3, 1];
const charValue = (char: string) => {
  if (char === '<') return 0;
  if (char >= '0' && char <= '9') return char.charCodeAt(0) - 48;
  if (char >= 'A' && char <= 'Z') return char.charCodeAt(0) - 55;
  return -1;
};

export function checkDigit(value: string) {
  let sum = 0;
  for (let index = 0; index < value.length; index += 1) {
    const valueOf = charValue(value[index]);
    if (valueOf < 0) return -1;
    sum += valueOf * WEIGHTS[index % 3];
  }
  return sum % 10;
}

const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' };

const digits = (value: string) => value.split('').map((char) => TO_DIGIT[char] || char).join('');

const matches = (value: string, check: string) => {
  const expected = Number(digits(check));
  return Number.isInteger(expected) && checkDigit(value) === expected;
};

// Tries the value as read, then with ambiguous characters swapped (at most 2^8 variants), until the check digit fits.
function correctAlphanumeric(value: string, check: string): { value: string; check: 'OK' | 'CORRECTED' | 'FAILED' } {
  if (matches(value, check)) return { value, check: 'OK' };
  const positions = value.split('').map((char, index) => (TO_DIGIT[char] || TO_LETTER[char] ? index : -1)).filter((index) => index >= 0).slice(0, 8);
  for (let mask = 1; mask < 1 << positions.length; mask += 1) {
    const chars = value.split('');
    positions.forEach((position, bit) => {
      if (mask & (1 << bit)) chars[position] = TO_DIGIT[chars[position]] || TO_LETTER[chars[position]];
    });
    const candidate = chars.join('');
    if (matches(candidate, check)) return { value: candidate, check: 'CORRECTED' };
  }
  return { value, check: 'FAILED' };
}

function expiryDate(raw: string, check: string) {
  const value = digits(raw);
  const valid = /^\d{6}$/.test(value) && matches(value, check);
  const year = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (!/^\d{6}$/.test(value) || month < 1 || month > 12 || day < 1 || day > 31) return { date: null, valid: false };
  // Expiry years are in this century unless they are implausibly far ahead.
  const fullYear = year + (year >= 70 ? 1900 : 2000);
  return { date: `${fullYear}-${value.slice(2, 4)}-${value.slice(4, 6)}`, valid };
}

// Birth years are in the past: a two-digit year later than this year belongs to the previous century.
function birthDate(raw: string, check: string) {
  const value = digits(raw);
  if (!/^\d{6}$/.test(value) || !matches(value, check)) return null;
  const year = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year + (year > new Date().getFullYear() % 100 ? 1900 : 2000);
  return `${fullYear}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}

const clean = (value: string) => value.replace(/<+$/g, '');
// OCR often reads the '<' filler as K, L or I ("ALPHAKKKLLL"): words made only of those letters (3 or more) and
// lone K's are dropped, so a misread filler does not end up in the person's name. Staff still check the name.
const dropFiller = (value: string) => value.replace(/</g, ' ').split(/\s+/).filter((word) => word && word !== 'K' && !/^[KLI]{3,}$/.test(word)).join(' ');
const names = (value: string) => {
  // Trailing filler read as letters ("ALPHAKKKKLLLL") is cut before the name is split.
  const [surname, given = ''] = value.replace(/[KLI<]{3,}$/, '').split('<<');
  return { surname: dropFiller(surname), givenNames: dropFiller(given) };
};

// OCR text to candidate MRZ lines: upper case, spaces removed, chevron look-alikes mapped to '<'.
export function mrzLines(text: string) {
  return text
    .toUpperCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[«‹(\[{]/g, '<').replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter((line) => line.length >= 25 && line.includes('<'));
}

const fit = (line: string, length: number) => (line.length >= length ? line.slice(0, length) : line.padEnd(length, '<'));

function parseTd3(first: string, second: string): MrzResult {
  const l1 = fit(first, 44);
  const l2 = fit(second, 44);
  const number = correctAlphanumeric(l2.slice(0, 9), l2[9]);
  const expiry = expiryDate(l2.slice(21, 27), l2[27]);
  return {
    format: 'TD3',
    documentType: clean(l1.slice(0, 2)),
    issuingCountry: clean(l1.slice(2, 5)),
    documentNumber: clean(number.value) || null,
    documentNumberCheck: number.check,
    expiryDate: expiry.date,
    expiryValid: expiry.valid,
    dateOfBirth: birthDate(l2.slice(13, 19), l2[19]),
    nationality: clean(l2.slice(10, 13)),
    ...names(l1.slice(5)),
    lines: [l1, l2]
  };
}

function parseTd1(first: string, second: string, third: string): MrzResult {
  const l1 = fit(first, 30);
  const l2 = fit(second, 30);
  const l3 = fit(third, 30);
  // ICAO overflow: a number longer than 9 characters continues in the optional data, ended by its check digit.
  let number: { value: string; check: 'OK' | 'CORRECTED' | 'FAILED' };
  if (l1[14] === '<' && /[0-9A-Z]/.test(l1[15])) {
    const overflow = l1.slice(15).split('<')[0];
    number = correctAlphanumeric(l1.slice(5, 14) + overflow.slice(0, -1), overflow.slice(-1));
  } else {
    number = correctAlphanumeric(l1.slice(5, 14), l1[14]);
  }
  const expiry = expiryDate(l2.slice(8, 14), l2[14]);
  return {
    format: 'TD1',
    documentType: clean(l1.slice(0, 2)),
    issuingCountry: clean(l1.slice(2, 5)),
    documentNumber: clean(number.value) || null,
    documentNumberCheck: number.check,
    expiryDate: expiry.date,
    expiryValid: expiry.valid,
    dateOfBirth: birthDate(l2.slice(0, 6), l2[6]),
    nationality: clean(l2.slice(15, 18)),
    ...names(l3),
    lines: [l1, l2, l3]
  };
}

// Finds a passport (two ~44-character lines) or ID card (three ~30-character lines) MRZ in OCR text. Among several
// candidates the one with the most valid check digits wins.
export function parseMrz(text: string): MrzResult | null {
  const lines = mrzLines(text);
  const candidates: MrzResult[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1];
    const after = lines[index + 2];
    if (next && line.length >= 38 && next.length >= 38) candidates.push(parseTd3(line, next));
    if (next && after && line.length >= 26 && line.length <= 34 && next.length >= 26 && next.length <= 34 && /^[ACI]/.test(line)) {
      candidates.push(parseTd1(line, next, after));
    }
  }
  const numberScore = { OK: 2, CORRECTED: 1, FAILED: 0 };
  const score = (result: MrzResult) => numberScore[result.documentNumberCheck] + Number(result.expiryValid) * 2 + Number(Boolean(result.documentNumber)) + Number(Boolean(result.expiryDate));
  return candidates.sort((a, b) => score(b) - score(a))[0] || null;
}
