import { getDB, parseJson, rowToGalleryPost } from '../../_lib/db';
import { verifyAuth } from '../../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const auth = await verifyAuth(request, env);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const db = getDB(env);
    const row = await db.prepare('SELECT * FROM gallery_posts WHERE id = ?').bind(params.id).first();
    if (!row) return json({ error: 'Not found' }, 404);

    const likedBy: string[] = parseJson(row.liked_by as string, []);
    const idx = likedBy.indexOf(auth.userId);
    if (idx >= 0) {
      likedBy.splice(idx, 1);
    } else {
      likedBy.push(auth.userId);
    }

    await db.prepare('UPDATE gallery_posts SET likes = ?, liked_by = ? WHERE id = ?')
      .bind(likedBy.length, JSON.stringify(likedBy), params.id).run();

    const updated = await db.prepare('SELECT * FROM gallery_posts WHERE id = ?').bind(params.id).first();
    return json(rowToGalleryPost(updated));
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
