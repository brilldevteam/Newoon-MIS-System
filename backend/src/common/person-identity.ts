// A person's identity documents are captured as separate QID and passport numbers, each with an expiry date.
// identityNumber stays the single printed/screened value: for people with split values it is derived as
// "QID: ... / Passport: ...". Older KYC rows that only have the combined identityNumber keep it unchanged.

type Row = Record<string, unknown>;

export const IDENTITY_FIELDS = ['qidNumber', 'qidExpiry', 'passportNumber', 'passportExpiry'] as const;

const clean = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  return String(value).trim();
};

export function hasSplitIdentity(row: Row) {
  return Boolean(clean(row.qidNumber) || clean(row.passportNumber));
}

export function identitySummary(row: Row): string | null {
  const qid = clean(row.qidNumber);
  const passport = clean(row.passportNumber);
  if (!qid && !passport) return clean(row.identityNumber) || null;
  return [qid && `QID: ${qid}`, passport && `Passport: ${passport}`].filter(Boolean).join(' / ');
}

// Applied when a person row is saved. Corporate shareholders keep their CR number in identityNumber.
export function withDerivedIdentity<T extends Row>(row: T): T {
  if (row.shareholderType === 'Corporate Entity' || !hasSplitIdentity(row)) return row;
  return { ...row, identityNumber: identitySummary(row) };
}

// Every ID number a person row or screening record carries (QID, passport and the combined identityNumber, labels
// such as "QID:" or "Passport:" removed), normalised so "QID: 291 3953 3953" and "29139533953" are the same.
export function identityTokens(...values: unknown[]): Set<string> {
  const tokens = new Set<string>();
  for (const value of values) {
    clean(value)
      .toUpperCase()
      .split(/[\/,;|]|\b(?:QID|PASSPORT|PP|CR|ID|NO)\b\.?\s*:?/)
      .map((part) => part.replace(/[^A-Z0-9]/g, ''))
      .filter((part) => part.length >= 4)
      .forEach((part) => tokens.add(part));
  }
  return tokens;
}

export function rowIdentityTokens(row: Row) {
  return identityTokens(row.qidNumber, row.passportNumber, row.identityNumber);
}

// The same person (or company) when any ID number matches. Without an ID on one side, the same name is enough;
// two different ID numbers under the same name stay separate people.
export function sameParty(a: { name: unknown; tokens: Set<string> }, b: { name: unknown; tokens: Set<string> }) {
  if (a.tokens.size && b.tokens.size) return [...a.tokens].some((token) => b.tokens.has(token));
  const name = (value: unknown) => clean(value).toLowerCase().replace(/\s+/g, ' ');
  return Boolean(name(a.name)) && name(a.name) === name(b.name);
}
