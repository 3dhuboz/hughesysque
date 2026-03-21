import { getDB, rowToUser } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);
    const auth = requireAuth(await verifyAuth(request, env));

    if (request.method === 'PUT') {
      // Users can update themselves, admins can update anyone
      if (auth.userId !== params.id && auth.role !== 'ADMIN' && auth.role !== 'DEV') {
        return json({ error: 'Forbidden' }, 403);
      }
      const data = await request.json();
      const fields: string[] = [];
      const values: any[] = [];
      const map: Record<string, string> = {
        name: 'name', phone: 'phone', address: 'address',
        dietaryPreferences: 'dietary_preferences', stamps: 'stamps',
        role: 'role',
      };
      for (const [key, col] of Object.entries(map)) {
        if (data[key] !== undefined) { fields.push(`${col} = ?`); values.push(data[key]); }
      }
      if (data.isVerified !== undefined) { fields.push('is_verified = ?'); values.push(data.isVerified ? 1 : 0); }
      if (data.hasCateringDiscount !== undefined) { fields.push('has_catering_discount = ?'); values.push(data.hasCateringDiscount ? 1 : 0); }
      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(params.id);
        await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
      }
      const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(params.id).first();
      return json(rowToUser(row));
    }

    if (request.method === 'DELETE') {
      requireAuth(auth, 'ADMIN');
      await db.prepare('DELETE FROM users WHERE id = ?').bind(params.id).run();
      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
