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

/** 6-digit reset code */
export function generateResetCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, '0');
}
