import { getDB, rowToGalleryPost } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'PUT') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const data = await request.json();
      const fields: string[] = [];
      const values: any[] = [];
      if (data.approved !== undefined) { fields.push('approved = ?'); values.push(data.approved ? 1 : 0); }
      if (data.caption !== undefined) { fields.push('caption = ?'); values.push(data.caption); }
      if (fields.length > 0) {
        values.push(params.id);
        await db.prepare(`UPDATE gallery_posts SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
      }
      const row = await db.prepare('SELECT * FROM gallery_posts WHERE id = ?').bind(params.id).first();
      return json(rowToGalleryPost(row));
    }

    if (request.method === 'DELETE') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      await db.prepare('DELETE FROM gallery_posts WHERE id = ?').bind(params.id).run();
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
