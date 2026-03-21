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
      return json(merged);
    }

    if (request.method === 'PUT') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const data = await request.json();
      const existing = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
      const current = existing ? parseJson(existing.data as string, {}) : {};
      const updated = { ...current, ...data };
      await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
        .bind(JSON.stringify(updated)).run();
      const { results } = await db.prepare('SELECT * FROM settings').all();
      const merged: any = {};
      for (const row of results) {
        Object.assign(merged, parseJson(row.data as string, {}));
      }
      return json(merged);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
