import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

/**
 * Encrypts third-party credentials (e.g. a business's electronic-invoicing
 * account) before they go into the database. AES-256-GCM with a key derived
 * from CREDENTIALS_ENCRYPTION_KEY; the output is "v1:<iv>:<tag>:<data>" in
 * base64, so a database dump alone never reveals them.
 */
const VERSION = 'v1';

function key(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY is not set (at least 16 characters): credentials cannot be stored or read',
    );
  }
  return createHash('sha256').update(secret).digest();
}

export function isSecretBoxConfigured(): boolean {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  return Boolean(secret && secret.length >= 16);
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    data.toString('base64'),
  ].join(':');
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('Unrecognized sealed secret');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
