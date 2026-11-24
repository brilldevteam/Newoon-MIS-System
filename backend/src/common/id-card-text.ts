import { parseDate } from '../compliance-clients/document-text-parser';

// Reads a Qatar ID / residency permit from its printed text (OCR), for cards without the machine-readable lines
// (the older residency permit prints "ID.No", "D.O.B", "Expiry", "Name", "Passport Number", "Passport Expiry").
// Best effort: every value is shown to staff to check. Pure, so it can be checked without images.

export type IdCardText = {
  qidNumber: string | null;
  qidExpiry: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  dateOfBirth: string | null;
  fullName: string | null;
  nationality: string | null;
};

const DATE = String.raw`(\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{4}|\d{4}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{1,2})`;
// Look-alike letters OCR puts in numbers.
const digits = (value: string) => value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/\s+/g, '');

function dateAfter(lines: string[], label: RegExp) {
  for (const line of lines) {
    const match = new RegExp(`${label.source}\\s*[:.;]?\\s*${DATE}`, 'i').exec(line);
    const date = parseDate(match?.[1]?.replace(/\s+/g, ''));
    if (date) return date;
  }
  return null;
}

// The words after a label. Printed values are in capitals, so when the value starts in capitals the words that are
// not (OCR noise from the Arabic beside it, such as "ff") are dropped from the end.
function textAfter(lines: string[], label: RegExp) {
  for (const line of lines) {
    const match = new RegExp(`${label.source}\\s*[:.;]?\\s*([A-Za-z][A-Za-z .'\\-]{1,80})`, 'i').exec(line);
    let words = (match?.[1] || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (words.length && /^[A-Z][A-Z'\-]+$/.test(words[0])) {
      const end = words.findIndex((word) => !/^[A-Z][A-Z.'\-]*$/.test(word));
      if (end > 0) words = words.slice(0, end);
    }
    words = words.filter((word, index) => index === 0 || word.length > 1 || /^[A-Z]$/.test(word));
    const value = words.join(' ');
    if (value) return value;
  }
  return null;
}

export function parseIdCardText(raw: string): IdCardText | null {
  const lines = raw.replace(/\r/g, '').split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
  const text = lines.join('\n');

  // QID: 11 digits after its label, or an 11-digit number on its own (Qatar IDs start with 2 or 3). A longer serial
  // number ("306290...") is never taken.
  const labelled = /(?:\bI\.?\s?D\.?\s*No\.?|\bQID\b(?:\s*No\.?)?|Identity\s*(?:No\.?|Number)|Personal\s*No\.?)\s*[:.;]?\s*([0-9OoIlS ]{11,14})/i.exec(text);
  let qidNumber = labelled ? digits(labelled[1]) : '';
  if (!/^\d{11}$/.test(qidNumber)) qidNumber = /(?<![\d])([23]\d{10})(?![\d])/.exec(text.replace(/(\d) (?=\d)/g, '$1'))?.[1] || '';

  const passportMatch = /Passport\s*(?:No\.?|Number)\s*[:.;]?\s*([A-Z0-9]{6,12})/i.exec(text);
  const passportNumber = passportMatch ? passportMatch[1].toUpperCase() : null;
  const passportExpiry = dateAfter(lines, /Passport\s*Expiry(?:\s*Date)?/);
  // The card's own expiry: a line with "Expiry" that is not the passport's.
  const qidExpiry = dateAfter(lines.filter((line) => !/passport/i.test(line)), /(?:Expiry(?:\s*Date)?|Date\s*of\s*Expiry|Valid\s*(?:until|till|to))/);
  // "D.O.B" is often read as "D.0.B".
  const dateOfBirth = dateAfter(lines, /(?:D\.?\s?[O0]\.?\s?B\.?|Date\s*of\s*Birth|Birth\s*Date)/);
  const name = textAfter(lines, /(?:^|\b)Name/);
  const nationality = textAfter(lines, /Nationality/);

  const result: IdCardText = {
    qidNumber: qidNumber || null,
    qidExpiry,
    passportNumber,
    passportExpiry,
    dateOfBirth,
    fullName: name && /[A-Za-z]{2}/.test(name) ? name : null,
    nationality: nationality || null
  };
  return result.qidNumber || result.passportNumber ? result : null;
}
