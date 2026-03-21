import { getDB, generateId, rowToEvent } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM calendar_events ORDER BY date ASC').all();
      return json(results.map(rowToEvent));
    }

    if (request.method === 'POST') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const e = await request.json();
      const id = e.id || generateId();
      await db.prepare(`INSERT OR REPLACE INTO calendar_events (id, date, type, title, description, location, time, start_time, end_time, order_id, image, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, e.date, e.type, e.title, e.description || null, e.location || null, e.time || null, e.startTime || null, e.endTime || null, e.orderId || null, e.image || null, e.tags ? JSON.stringify(e.tags) : null).run();
      const row = await db.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();
      return json(rowToEvent(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
