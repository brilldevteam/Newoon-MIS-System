// Password policy for every account password (user creation, admin reset, self-service change).
// Keep in sync with frontend/src/utils/password-policy.ts and the copies in backend/scripts/*-admin*.cjs.
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
export const PASSWORD_MAX_BYTES = 72;

// At least 8 characters with one capital letter, one number and one symbol (any character that is not a letter or digit).
export const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/s;

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include a capital letter, a number and a symbol (maximum 72 bytes).';

export function passwordPolicyError(password: string) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) return PASSWORD_RULE_MESSAGE;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return PASSWORD_RULE_MESSAGE;
  if (!PASSWORD_PATTERN.test(password)) return PASSWORD_RULE_MESSAGE;
  return null;
}
