import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Encrypts stored secrets (the company's AI API key) with AES-256-GCM. The key comes from SETTINGS_ENCRYPTION_KEY
// (any long random string; it is hashed to 32 bytes). Without it secrets cannot be saved or read.
// Changing SETTINGS_ENCRYPTION_KEY makes stored keys unreadable: they must then be entered again.

const PREFIX = 'v1';

function key() {
  const value = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!value || value.length < 16) return null;
  return createHash('sha256').update(value).digest();
}

export function canEncryptSecrets() {
  return Boolean(key());
}

export function encryptSecret(plain: string) {
  const secret = key();
  if (!secret) throw new Error('SETTINGS_ENCRYPTION_KEY is not set on the server.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

// Returns null when the value cannot be decrypted (no key, a changed key or a damaged value).
export function decryptSecret(stored: string) {
  const secret = key();
  const [prefix, iv, tag, data] = stored.split(':');
  if (!secret || prefix !== PREFIX || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
