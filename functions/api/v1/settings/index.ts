import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

/**
 * Settings keys that are server-managed and must never be set/overwritten via
 * the PUT endpoint, even by an authenticated admin. Forging these would let
 * an attacker mint admin/customer session tokens at will (session secrets) or
 * impersonate the admin (password record). Reject the whole request — at any
 * depth — if any of these names appear.
 */
const PROTECTED_KEYS = new Set([
  'adminSessionSecret',
  'customerSessionSecret',
  'adminPasswordRecord',
  'adminPassword',
  'adminResetCode',
  'adminResetExpiresAt',
  'adminResetIssuedAt',
  'adminResetAttempts',
  'adminResetDailyCount',
  'adminResetDailyWindowStart',
]);

function findProtectedKey(obj: any, path = ''): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const found = findProtectedKey(obj[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  for (const key of Object.keys(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (PROTECTED_KEYS.has(key)) return fullPath;
    const found = findProtectedKey(obj[key], fullPath);
    if (found) return found;
  }
  return null;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM settings').all();
      const merged: any = {};
      for (const row of results) {
        Object.assign(merged, parseJson(row.data as string, {}));
      }
      const auth = await verifyAuth(request, env);
      const isPrivileged = auth && (auth.role === 'ADMIN' || auth.role === 'DEV');
      if (!isPrivileged) {
        const sensitiveKeys = [
          'geminiApiKey', 'openrouterApiKey', 'facebookAppId',
          'facebookPageAccessToken', 'facebookPageId',
          'instagramBusinessAccountId', 'adminPassword', 'adminUsername',
          'adminPasswordRecord', 'adminResetCode', 'adminResetExpiresAt',
          'adminResetIssuedAt', 'adminResetAttempts',
          'squareAccessToken', 'squareApplicationId', 'squareLocationId',
          'smartPayPublicKey', 'smartPaySecretKey', 'smsSettings', 'emailSettings',
        ];
        for (const key of sensitiveKeys) {
          delete merged[key];
        }
      }
      return json(merged);
    }

    if (request.method === 'PUT' || request.method === 'PATCH' || request.method === 'POST') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const data = await request.json();
      const offending = findProtectedKey(data);
      if (offending) {
        return json({ error: `Field '${offending}' is server-managed and cannot be set via this endpoint.` }, 400);
      }
      const existing = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
      const current = existing ? parseJson(existing.data as string, {}) : {};
      const deepMerge = (target: any, source: any): any => {
        const result = { ...target };
        for (const key of Object.keys(source)) {
          if (
            source[key] !== null &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            target[key] !== null &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])
          ) {
            result[key] = deepMerge(target[key], source[key]);
          } else {
            result[key] = source[key];
          }
        }
        return result;
      };
      const updated = deepMerge(current, data);
      await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
        .bind(JSON.stringify(updated)).run();
      const { results } = await db.prepare('SELECT * FROM settings').all();
      const merged: any = {};
      for (const row of results) {
        Object.assign(merged, parseJson(row.data as string, {}));
      }
      return json(merged);
    }

    return json({ error: `Method not allowed (received: ${request.method})` }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
