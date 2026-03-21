import { getDB, generateId, rowToSocialPost } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const { results } = await db.prepare('SELECT * FROM social_posts ORDER BY scheduled_for ASC').all();
      return json(results.map(rowToSocialPost));
    }

    if (request.method === 'POST') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const p = await request.json();
      const id = p.id || generateId();
      await db.prepare(`INSERT OR REPLACE INTO social_posts (id, platform, content, image, scheduled_for, status, hashtags, published_at, platform_post_id, publish_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, p.platform, p.content, p.image || null, p.scheduledFor, p.status || 'Draft', p.hashtags ? JSON.stringify(p.hashtags) : '[]', p.publishedAt || null, p.platformPostId || null, p.publishError || null).run();
      const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?').bind(id).first();
      return json(rowToSocialPost(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
