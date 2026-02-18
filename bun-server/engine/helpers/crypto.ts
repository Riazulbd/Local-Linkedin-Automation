import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-cbc';

function resolveSecret(): string {
  const primary = process.env.ENCRYPTION_SECRET?.trim();
  if (primary) return primary;

  const fallback = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (fallback) return fallback;

  return '';
}

function getKey(): Buffer {
  const secret = resolveSecret();

  if (!secret) {
    throw new Error('Encryption secret is not configured (set ENCRYPTION_SECRET or CREDENTIAL_ENCRYPTION_KEY)');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptCredential(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptCredential(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  if (!ivHex || !encHex) {
    throw new Error('Invalid encrypted credential format');
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
