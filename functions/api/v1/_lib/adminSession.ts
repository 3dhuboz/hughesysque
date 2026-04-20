/**
 * HMAC-signed admin session tokens for Cloudflare Pages Functions.
 *
 * Replaces the previous 'setup mode' fallback in verifyAuth, which treated
 * every unauthenticated request as ADMIN whenever Clerk wasn't configured —
 * leaving the admin API fully open to the world.
 *
 * Token format: `base64url(header).base64url(payload).base64url(signature)`
 * Payload: { sub: 'admin1'|'dev1', role: 'ADMIN'|'DEV', iat: ms, exp: ms }
 * Signing: HMAC-SHA256 using env.ADMIN_SESSION_SECRET, or a persistent
 * auto-generated fallback stored in settings.adminSessionSecret.
 */

import { getDB, parseJson } from './db';

const enc = new TextEncoder();
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

function b64urlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? enc.encode(bytes) : bytes;
  let binary = '';
  for (let i = 0; i < b.length; i++) binary += String.fromCharCode(b[i]);
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

async function getSecret(env: any): Promise<string> {
  if (env.ADMIN_SESSION_SECRET && env.ADMIN_SESSION_SECRET.length >= 32) {
    return env.ADMIN_SESSION_SECRET;
  }
  // Lazy-initialise a persistent secret in the settings row so tokens survive
  // deploys even without an env var. 32 random bytes, base64url.
  const db = getDB(env);
  const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
  const settings = row ? parseJson(row.data as string, {}) : {};
  if (settings.adminSessionSecret && settings.adminSessionSecret.length >= 32) {
    return settings.adminSessionSecret;
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = b64urlEncode(bytes);
  const updated = { ...settings, adminSessionSecret: secret };
  await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
    .bind(JSON.stringify(updated)).run();
  return secret;
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

export interface AdminSessionPayload {
  sub: string;
  role: 'ADMIN' | 'DEV';
  iat: number;
  exp: number;
}

export async function issueAdminSession(
  env: any,
  role: 'ADMIN' | 'DEV',
  userId = role === 'DEV' ? 'dev1' : 'admin1',
): Promise<string> {
  const secret = await getSecret(env);
  const header = { alg: 'HS256', typ: 'HQS' };
  const now = Date.now();
  const payload: AdminSessionPayload = { sub: userId, role, iat: now, exp: now + TOKEN_TTL_MS };
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const sig = await hmac(secret, `${h}.${p}`);
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

export async function verifyAdminSession(
  env: any,
  token: string,
): Promise<AdminSessionPayload | null> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;

    const secret = await getSecret(env);
    const expected = await hmac(secret, `${h}.${p}`);
    const got = b64urlDecode(s);
    if (expected.length !== got.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ got[i];
    if (diff !== 0) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as AdminSessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (payload.role !== 'ADMIN' && payload.role !== 'DEV') return null;
    return payload;
  } catch {
    return null;
  }
}
