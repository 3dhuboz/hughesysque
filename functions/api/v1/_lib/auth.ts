/**
 * Auth verification for Cloudflare Pages Functions.
 *
 * Order of precedence:
 *   1. ADMIN_API_KEY env (server-to-server scripts) — deprecated but kept.
 *   2. Our own HMAC-signed admin session tokens (issued by /auth/admin-login
 *      and stored in browser localStorage). Covers Macca + staff.
 *   3. Clerk JWT (customer accounts). Only when CLERK_PUBLISHABLE_KEY is set.
 *
 * NOTE: the previous 'setup mode' fallback that treated every unauthenticated
 * request as ADMIN when Clerk wasn't configured has been removed — it was a
 * full admin-API bypass for anyone on the internet.
 */

import { verifyAdminSession } from './adminSession';

let cachedJwks: any = null;
let jwksCachedAt = 0;
const JWKS_TTL = 3600000; // 1 hour

async function fetchJwks(clerkPublishableKey: string): Promise<any> {
  const now = Date.now();
  if (cachedJwks && now - jwksCachedAt < JWKS_TTL) return cachedJwks;

  // Extract Clerk frontend API domain from publishable key
  const domain = clerkPublishableKey.replace('pk_test_', '').replace('pk_live_', '').replace(/=$/, '');
  const url = `https://${domain}.clerk.accounts.dev/.well-known/jwks.json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch JWKS: ${res.status}`);
  cachedJwks = await res.json();
  jwksCachedAt = now;
  return cachedJwks;
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importJwk(jwk: any): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
}

export interface AuthResult {
  userId: string;
  role: string;
  email: string;
}

export async function verifyAuth(request: Request, env: any): Promise<AuthResult | null> {
  const authHeader = request.headers.get('Authorization');

  // 1. Backdoor: explicit admin API key via env (kept for server-to-server scripts)
  const apiKey = env.ADMIN_API_KEY;
  if (apiKey && authHeader === `Bearer ${apiKey}`) {
    return { userId: 'admin1', role: 'ADMIN', email: 'admin@hugheseysque.au' };
  }

  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // 2. Our own admin session token (HMAC-signed, issued by /auth/admin-login)
  // Format heuristic: three base64url segments with 'HQS' typ in the header.
  // Try this first so we don't waste a network hop to Clerk JWKS on every admin API call.
  if (token.split('.').length === 3) {
    const session = await verifyAdminSession(env, token);
    if (session) {
      return {
        userId: session.sub,
        role: session.role,
        email: session.role === 'DEV' ? 'dev@local' : 'admin@hugheseysque.au',
      };
    }
  }

  // 3. Clerk JWT path (customers). Only attempted when Clerk is configured.
  const publishableKey = env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return null;

  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64)));
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));

    // Check expiry
    if (payload.exp && payload.exp < Date.now() / 1000) return null;

    const jwks = await fetchJwks(publishableKey);
    const jwk = jwks.keys?.find((k: any) => k.kid === header.kid);
    if (!jwk) return null;

    // Verify signature
    const key = await importJwk(jwk);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64urlDecode(signatureB64);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    if (!valid) return null;

    return {
      userId: payload.sub || '',
      role: payload.publicMetadata?.role || payload.metadata?.role || 'CUSTOMER',
      email: payload.email || payload.primaryEmail || '',
    };
  } catch (e) {
    console.error('Auth verification failed:', e);
    return null;
  }
}

export function requireAuth(auth: AuthResult | null, minRole?: string): AuthResult {
  if (!auth) {
    const err = new Error('Unauthorized');
    (err as any).status = 401;
    throw err;
  }
  if (minRole) {
    const hierarchy = ['GUEST', 'CUSTOMER', 'ADMIN', 'DEV'];
    if (hierarchy.indexOf(auth.role) < hierarchy.indexOf(minRole)) {
      const err = new Error('Forbidden');
      (err as any).status = 403;
      throw err;
    }
  }
  return auth;
}
