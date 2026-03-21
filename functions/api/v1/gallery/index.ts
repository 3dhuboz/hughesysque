import { getDB, generateId, rowToGalleryPost } from '../_lib/db';
import { verifyAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const auth = await verifyAuth(request, env);
      const isAdmin = auth?.role === 'ADMIN' || auth?.role === 'DEV';
      const query = isAdmin
        ? 'SELECT * FROM gallery_posts ORDER BY created_at DESC'
        : 'SELECT * FROM gallery_posts WHERE approved = 1 ORDER BY created_at DESC';
      const { results } = await db.prepare(query).all();
      return json(results.map(rowToGalleryPost));
    }

    if (request.method === 'POST') {
      const auth = await verifyAuth(request, env);
      if (!auth) return json({ error: 'Unauthorized' }, 401);
      const p = await request.json();
      const id = p.id || generateId();
      await db.prepare(`INSERT INTO gallery_posts (id, user_id, user_name, image_url, caption, created_at, approved, likes, liked_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, auth.userId, p.userName || auth.email.split('@')[0], p.imageUrl, p.caption || '', p.createdAt || new Date().toISOString(), 0, 0, '[]').run();
      const row = await db.prepare('SELECT * FROM gallery_posts WHERE id = ?').bind(id).first();
      return json(rowToGalleryPost(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
