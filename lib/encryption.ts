import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Get the encryption key from environment. Returns null if not configured.
 */
function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) return null;
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns the format: `iv:authTag:ciphertext` (all hex-encoded).
 * If TOKEN_ENCRYPTION_KEY is not set, returns the plaintext as-is.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a ciphertext string produced by `encrypt()`.
 * Expects the format: `iv:authTag:ciphertext` (all hex-encoded).
 *
 * Migration path: if the input does not contain the `:` separator pattern
 * (i.e., it's a legacy plaintext token), it is returned as-is.
 * If TOKEN_ENCRYPTION_KEY is not set, returns the input as-is.
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  if (!key) return ciphertext;

  // Migration path: plaintext tokens won't have exactly two `:` separators
  // that form valid hex segments. A simple heuristic: encrypted values have
  // exactly 2 colons separating 3 hex strings (iv 24 chars : authTag 32 chars : ciphertext).
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    return ciphertext; // Plaintext token — return as-is
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  // Extra safety: verify the parts look like valid hex of expected lengths
  if (ivHex.length !== IV_LENGTH * 2 || authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    return ciphertext; // Does not match encrypted format — treat as plaintext
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails (e.g., wrong key, corrupted data), return as-is
    // so the application doesn't crash on legacy data
    return ciphertext;
  }
}
