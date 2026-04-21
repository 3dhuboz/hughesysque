/**
 * Auth verification for Cloudflare Pages Functions.
 *
 * Order of precedence:
 *   1. ADMIN_API_KEY env (server-to-server scripts) — deprecated but kept.
 *   2. Our own HMAC-signed admin session tokens (issued by /auth/admin-login
 *      and stored in browser localStorage). Covers Macca + staff.
 *
 * NOTE: the previous 'setup mode' fallback that treated every unauthenticated
 * request as ADMIN was removed — it was a full admin-API bypass for anyone on
 * the internet. Customer accounts (Clerk) were also removed; this site runs
 * unauthenticated for storefront visitors and admin-only for staff.
 */

import { verifyAdminSession } from './adminSession';

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

  // 2. Our own admin session token (HMAC-signed, issued by /auth/admin-login).
  // Format heuristic: three base64url segments with 'HQS' typ in the header.
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

  return null;
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
