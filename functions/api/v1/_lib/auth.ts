/**
 * Clerk JWT verification for Cloudflare Pages Functions.
 * Uses Web Crypto API — zero Node.js dependencies.
 * Falls back to ADMIN_API_KEY for backdoor admin access.
 * When CLERK_PUBLISHABLE_KEY is not set, auth is relaxed (setup mode).
 */

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

  // 1. Check for admin API key (backdoor admin access)
  const apiKey = env.ADMIN_API_KEY;
  if (apiKey && authHeader === `Bearer ${apiKey}`) {
    return { userId: 'admin1', role: 'ADMIN', email: 'admin@hugheseysque.au' };
  }

  // 2. If Clerk is not configured, allow unauthenticated access as admin (setup mode)
  const publishableKey = env.CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return { userId: 'setup', role: 'ADMIN', email: 'setup@local' };
  }

  // 3. Verify Clerk JWT
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

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
    throw { status: 401, message: 'Unauthorized' };
  }
  if (minRole) {
    const hierarchy = ['GUEST', 'CUSTOMER', 'ADMIN', 'DEV'];
    if (hierarchy.indexOf(auth.role) < hierarchy.indexOf(minRole)) {
      throw { status: 403, message: 'Forbidden' };
    }
  }
  return auth;
}
