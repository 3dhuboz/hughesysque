import { getDB, generateId, rowToMenuItem } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM menu_items ORDER BY category, name').all();
      return json(results.map(rowToMenuItem));
    }

    if (request.method === 'POST') {
      const auth = requireAuth(await verifyAuth(request, env), 'ADMIN');
      const item = await request.json();
      const id = item.id || generateId();
      await db.prepare(`INSERT OR REPLACE INTO menu_items (id, name, description, price, unit, min_quantity, preparation_options, image, category, available, availability_type, specific_date, specific_dates, is_pack, pack_groups, available_for_catering, catering_category, moq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, item.name, item.description || '', item.price, item.unit || null, item.minQuantity || null, item.preparationOptions ? JSON.stringify(item.preparationOptions) : null, item.image || '', item.category, item.available ? 1 : 0, item.availabilityType || 'everyday', item.specificDate || null, item.specificDates ? JSON.stringify(item.specificDates) : null, item.isPack ? 1 : 0, item.packGroups ? JSON.stringify(item.packGroups) : null, item.availableForCatering ? 1 : 0, item.cateringCategory || null, item.moq || null).run();
      const row = await db.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).first();
      return json(rowToMenuItem(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
