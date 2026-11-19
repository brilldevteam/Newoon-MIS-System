// Mirrors backend/src/common/person-identity.ts. People have separate QID and passport numbers (each with an
// expiry date); identityNumber is kept as the single printed value, derived as "QID: ... / Passport: ...".
// Rows from older KYCs that only have the combined identityNumber keep it until someone enters the split values.

type Row = Record<string, any>;

const clean = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

export function hasSplitIdentity(row: Row) {
  return Boolean(clean(row.qidNumber) || clean(row.passportNumber));
}

export function identitySummary(row: Row) {
  const qid = clean(row.qidNumber);
  const passport = clean(row.passportNumber);
  if (!qid && !passport) return clean(row.identityNumber);
  return [qid && `QID: ${qid}`, passport && `Passport: ${passport}`].filter(Boolean).join(' / ');
}

export function withDerivedIdentity<T extends Row>(row: T): T {
  if (row.shareholderType === 'Corporate Entity' || !hasSplitIdentity(row)) return row;
  return { ...row, identityNumber: identitySummary(row) };
}

// Combined value from an older KYC, shown so it can be re-entered as QID or passport.
export function legacyIdentity(row: Row) {
  return row.shareholderType !== 'Corporate Entity' && !hasSplitIdentity(row) ? clean(row.identityNumber) : '';
}
