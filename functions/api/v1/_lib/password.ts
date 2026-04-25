/**
 * Password hashing utilities for the admin account.
 * PBKDF2 / SHA-256 / 100_000 iterations — standard modern practice, native Web Crypto.
 * We store { hash, salt, iter } as base64url strings so the stored value is self-describing.
 */

const ITERATIONS = 100_000;
const HASH_BITS = 256;

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface PasswordRecord {
  hash: string;   // base64url of derived bits
  salt: string;   // base64url of 16-byte salt
  iter: number;
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    keyMaterial,
    HASH_BITS,
  );
  return { hash: b64urlEncode(new Uint8Array(bits)), salt: b64urlEncode(salt), iter: ITERATIONS };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  if (!record?.hash || !record?.salt || !record?.iter) return false;
  try {
    const salt = b64urlDecode(record.salt);
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: record.iter },
      keyMaterial,
      HASH_BITS,
    );
    const candidate = b64urlEncode(new Uint8Array(bits));
    // Constant-time compare
    if (candidate.length !== record.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ record.hash.charCodeAt(i);
    return diff === 0;
  } catch (e) {
    console.error('verifyPassword failed', e);
    return false;
  }
}

/**
 * 8-char alphanumeric reset code. ~37 bits of entropy (31^8 ≈ 8.5 * 10^11)
 * vs the previous 6-digit-only (1 * 10^6) — a ~850,000x larger keyspace.
 *
 * Character set excludes ambiguous glyphs (0/O, 1/I/L, U/V) so an admin
 * can read the code from an email without misreads. Uppercase only;
 * verification is case-insensitive (admin-reset-confirm uppercases the
 * submitted value before comparing).
 */
export function generateResetCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[bytes[i] % chars.length];
  return out;
}
