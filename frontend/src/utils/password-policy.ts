// Same rules as backend/src/common/security/password-policy.ts (the server enforces them; this is for guidance).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export const passwordRules: Array<{ key: string; label: string; test: (value: string) => boolean }> = [
  { key: 'length', label: 'At least 8 characters', test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { key: 'upper', label: '1 capital letter', test: (value) => /[A-Z]/.test(value) },
  { key: 'number', label: '1 number', test: (value) => /\d/.test(value) },
  { key: 'symbol', label: '1 symbol', test: (value) => /[^A-Za-z0-9]/.test(value) }
];

export const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include a capital letter, a number and a symbol.';

export function passwordPolicyError(value: string) {
  if (!passwordRules.every((rule) => rule.test(value))) return PASSWORD_RULE_MESSAGE;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return 'Password is too long (maximum 72 bytes).';
  return null;
}
