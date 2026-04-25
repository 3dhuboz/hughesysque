/**
 * HMAC-signed customer session tokens for Cloudflare Pages Functions.
 *
 * Mirrors adminSession.ts but with `typ: 'HQC'` (Hughesys Que Customer)
 * so verifyAuth can distinguish admin from customer tokens by header
 * inspection without an extra DB hit. Storage key is the customer email.
 *
 * Token format: `base64url(header).base64url(payload).base64url(signature)`
 * Payload: { sub: '<email>', role: 'CUSTOMER', iat: ms, exp: ms }
 */

import { getDB, parseJson } from './db';

const enc = new TextEncoder();
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days — matches admin session

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
  if (env.CUSTOMER_SESSION_SECRET && env.CUSTOMER_SESSION_SECRET.length >= 32) {
    console.info('[customerSession] secret (source: env)');
    return env.CUSTOMER_SESSION_SECRET;
  }
  // Lazy-initialise a persistent secret in settings — tokens survive deploys
  // even without an env var. 32 random bytes, base64url. Stored separately
  // from the admin secret so a customer-token leak doesn't compromise admin.
  const db = getDB(env);
  const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
  const settings = row ? parseJson(row.data as string, {}) : {};
  if (settings.customerSessionSecret && settings.customerSessionSecret.length >= 32) {
    console.info('[customerSession] secret (source: settings)');
    return settings.customerSessionSecret;
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = b64urlEncode(bytes);
  const updated = { ...settings, customerSessionSecret: secret };
  await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
    .bind(JSON.stringify(updated)).run();
  console.info('[customerSession] secret (source: settings, freshly generated)');
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

export interface CustomerSessionPayload {
  sub: string; // email (lowercased)
  role: 'CUSTOMER';
  iat: number;
  exp: number;
}

export async function issueCustomerSession(env: any, email: string): Promise<string> {
  const secret = await getSecret(env);
  const header = { alg: 'HS256', typ: 'HQC' };
  const now = Date.now();
  const payload: CustomerSessionPayload = {
    sub: email.toLowerCase(),
    role: 'CUSTOMER',
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const sig = await hmac(secret, `${h}.${p}`);
  return `${h}.${p}.${b64urlEncode(sig)}`;
}

export async function verifyCustomerSession(env: any, token: string): Promise<CustomerSessionPayload | null> {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;

    // typ check first — bail before expensive HMAC if it's not a customer token.
    const headerJson = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
    if (headerJson.typ !== 'HQC') return null;

    const secret = await getSecret(env);
    const expected = await hmac(secret, `${h}.${p}`);
    const got = b64urlDecode(s);
    if (expected.length !== got.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ got[i];
    if (diff !== 0) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as CustomerSessionPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (payload.role !== 'CUSTOMER' || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Pull the current customer session from a request's Authorization header.
 * Returns null if no token, invalid token, or expired.
 */
export async function readCustomerFromRequest(request: Request, env: any): Promise<CustomerSessionPayload | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (token.split('.').length !== 3) return null;
  return verifyCustomerSession(env, token);
}
