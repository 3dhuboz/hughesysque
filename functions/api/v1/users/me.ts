import { getDB, generateId, rowToUser } from '../_lib/db';
import { verifyAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const auth = await verifyAuth(request, env);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const db = getDB(env);

    if (request.method === 'GET') {
      let row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first();
      // Auto-create user row on first visit
      if (!row) {
        await db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)')
          .bind(auth.userId, auth.email.split('@')[0], auth.email, auth.role).run();
        row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(auth.userId).first();
      }
      return json(rowToUser(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
