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
