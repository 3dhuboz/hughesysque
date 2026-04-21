/**
 * Square Catalog — read + delete for the admin inspector modal.
 *
 *   GET    /api/v1/payment/square-catalog          → list all Square ITEMs with
 *                                                    their id, name, price,
 *                                                    description, image, and
 *                                                    which Hughesys menu item
 *                                                    (if any) they're mapped to.
 *   DELETE /api/v1/payment/square-catalog?id=<id>  → delete that Square item
 *                                                    and scrub it from our
 *                                                    settings.squareCatalogMap.
 *
 * Both require ADMIN auth.
 */
import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

const json = (d: any, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

async function loadSquare(env: any) {
  const db = getDB(env);
  const row: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
  const settings = row ? parseJson(row.data, {}) : {};
  if (!settings.squareAccessToken || !settings.squareLocationId) {
    throw Object.assign(new Error('Square not configured — set access token and location ID in Admin > Settings'), { status: 400 });
  }
  const envIsProd = settings.squareAccessToken.startsWith('EAAA');
  const baseUrl = envIsProd ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  return { db, settings, baseUrl, envIsProd };
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');
    const { db, settings, baseUrl, envIsProd } = await loadSquare(env);

    if (request.method === 'GET') {
      // Collect all ITEMs, following pagination cursors.
      const items: any[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 20; i++) {
        const url = new URL(`${baseUrl}/v2/catalog/list`);
        url.searchParams.set('types', 'ITEM');
        if (cursor) url.searchParams.set('cursor', cursor);
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${settings.squareAccessToken}`,
            'Square-Version': '2024-10-17',
          },
        });
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok || data.errors) {
          return json({ error: data.errors?.[0]?.detail || `Square ${res.status}` }, 502);
        }
        items.push(...(data.objects || []));
        cursor = data.cursor;
        if (!cursor) break;
      }

      // Reverse map: Square itemId → hqMenuItemId
      const catalogMap: Record<string, { itemId: string; variationId: string }> = settings.squareCatalogMap || {};
      const squareIdToHqId: Record<string, string> = {};
      for (const [hqId, { itemId }] of Object.entries(catalogMap)) {
        if (itemId) squareIdToHqId[itemId] = hqId;
      }

      // Hydrate Hughesys names for the mapped items so the UI can show both sides.
      const mappedHqIds = Object.values(squareIdToHqId);
      let hqNamesById: Record<string, string> = {};
      if (mappedHqIds.length > 0) {
        const placeholders = mappedHqIds.map(() => '?').join(',');
        const { results } = await db.prepare(`SELECT id, name FROM menu_items WHERE id IN (${placeholders})`).bind(...mappedHqIds).all();
        for (const r of (results || [])) hqNamesById[(r as any).id] = (r as any).name;
      }

      const rows = items
        .filter((o: any) => o.type === 'ITEM' && !o.is_deleted)
        .map((obj: any) => {
          const itemData = obj.item_data || {};
          const variation = (itemData.variations || [])[0];
          const priceCents = variation?.item_variation_data?.price_money?.amount ?? null;
          const hqId = squareIdToHqId[obj.id] || null;
          return {
            squareId: obj.id,
            variationId: variation?.id || null,
            name: itemData.name || '(no name)',
            description: itemData.description || '',
            priceAud: priceCents != null ? priceCents / 100 : null,
            image: itemData.image_urls?.[0] || null,
            mappedHqId: hqId,
            mappedHqName: hqId ? (hqNamesById[hqId] || null) : null,
            updatedAt: obj.updated_at || null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return json({ success: true, environment: envIsProd ? 'production' : 'sandbox', count: rows.length, items: rows });
    }

    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'id query param required' }, 400);

      const res = await fetch(`${baseUrl}/v2/catalog/object/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${settings.squareAccessToken}`,
          'Square-Version': '2024-10-17',
        },
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data.errors) {
        return json({ error: data.errors?.[0]?.detail || `Square ${res.status}` }, 502);
      }

      // Scrub the deleted id out of our squareCatalogMap so future syncs don't
      // try to update a ghost and surface confusing Square 404s.
      const catalogMap: Record<string, { itemId: string; variationId: string }> = settings.squareCatalogMap || {};
      const next: typeof catalogMap = {};
      for (const [hqId, entry] of Object.entries(catalogMap)) {
        if (entry.itemId === id) continue;
        next[hqId] = entry;
      }
      if (Object.keys(next).length !== Object.keys(catalogMap).length) {
        const updated = { ...settings, squareCatalogMap: next };
        await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
          .bind(JSON.stringify(updated)).run();
      }

      return json({ success: true, deletedIds: data.deleted_object_ids || [id] });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Square catalog request failed' }, status);
  }
};
