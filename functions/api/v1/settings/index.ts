import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

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
