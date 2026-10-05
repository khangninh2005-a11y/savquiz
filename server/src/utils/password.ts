import crypto from 'node:crypto';

/**
 * Hash password using Node's native scrypt KDF with cryptographically random salt.
 * Returns format: scrypt:<salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against stored hash.
 * Supports:
 * 1. Modern scrypt: scrypt:<salt>:<hash>
 * 2. Legacy MD5 hex
 * 3. Plain text fallback
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;

  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(key, 'hex');
    if (keyBuf.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuf, derivedKey);
  }

  // Legacy MD5 check
  const md5Hash = crypto.createHash('md5').update(password).digest('hex');
  if (storedHash === md5Hash) {
    return true;
  }

  // Plain text compatibility check
  return storedHash === password;
}
