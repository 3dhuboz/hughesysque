/**
 * Square Catalog sync — one-way push from Hughesys menu → Square.
 *
 * Every menu item (non-catering, non-merch, everyday + date-specific) gets
 * upserted as a Square ITEM with a single VARIATION holding the price.
 *
 * We keep a mapping of { hqMenuItemId: { itemId, variationId } } in
 * settings.squareCatalogMap so subsequent syncs update the existing Square
 * objects in place rather than creating duplicates.
 *
 * Auth: ADMIN only.
 */
import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

const json = (d: any, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

async function loadSettings(env: any) {
  const db = getDB(env);
  const row: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
  return { db, settings: row ? parseJson(row.data, {}) : {} };
}

async function persistSettings(db: any, settings: any) {
  await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
    .bind(JSON.stringify(settings)).run();
}

function rowToMenuItem(r: any) {
  return {
    id: r.id,
    name: r.name,
    description: r.description || '',
    price: Number(r.price) || 0,
    category: r.category,
    available: r.available !== 0,
    isCatering: r.is_catering === 1, // not currently in schema but future-safe
    availableForCatering: r.available_for_catering === 1,
    cateringCategory: r.catering_category,
  };
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const { db, settings } = await loadSettings(env);

    if (!settings.squareAccessToken || !settings.squareLocationId) {
      return json({ error: 'Square not configured — set access token and location ID in Admin > Settings' }, 400);
    }

    const { results } = await db.prepare('SELECT * FROM menu_items').all();
    const allItems = (results || []).map(rowToMenuItem);

    // Skip catering-only items — they're sold via the /catering quote flow,
    // not rung up on Square POS. Same rule as the public menu filter.
    const syncable = allItems.filter((m: any) =>
      !m.isCatering &&
      m.category !== 'Catering' &&
      m.category !== 'Catering Packs' &&
      !(m.availableForCatering && m.cateringCategory)
    );

    if (syncable.length === 0) {
      return json({ success: true, upserted: 0, message: 'No sync-eligible items found.' });
    }

    const catalogMap: Record<string, { itemId: string; variationId: string }> = settings.squareCatalogMap || {};

    // Build Square batch — one ITEM per menu item, each with one VARIATION.
    // Square accepts either server-assigned IDs (for existing) or client
    // '#temp' IDs (for new). We reuse stored server IDs when present.
    const objects: any[] = [];
    for (const m of syncable) {
      const known = catalogMap[m.id];
      const itemId = known?.itemId || `#hq_item_${m.id.replace(/[^a-zA-Z0-9]/g, '')}`;
      const variationId = known?.variationId || `#hq_var_${m.id.replace(/[^a-zA-Z0-9]/g, '')}`;

      objects.push({
        type: 'ITEM',
        id: itemId,
        item_data: {
          name: (m.name || 'Item').substring(0, 512),
          description: (m.description || '').substring(0, 4096),
          variations: [{
            type: 'ITEM_VARIATION',
            id: variationId,
            item_variation_data: {
              item_id: itemId,
              name: 'Regular',
              pricing_type: 'FIXED_PRICING',
              price_money: { amount: Math.round((m.price || 0) * 100), currency: 'AUD' },
            },
          }],
        },
      });
    }

    const envIsProd = settings.squareAccessToken.startsWith('EAAA');
    const baseUrl = envIsProd
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const res = await fetch(`${baseUrl}/v2/catalog/batch-upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.squareAccessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-10-17',
      },
      body: JSON.stringify({
        idempotency_key: `hq_sync_${Date.now()}`,
        batches: [{ objects }],
      }),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok || data.errors) {
      console.error('Square batch-upsert failed', data);
      return json({ error: data.errors?.[0]?.detail || data.errors?.[0]?.category || `Square ${res.status}` }, 502);
    }

    // Build menu-id → Square-id map from the response.
    // Square returns id_mappings: [{ client_object_id: '#hq_item_abc', object_id: '<real-id>' }, ...]
    // and objects with their final IDs. Our '#hq_item_<menuId>' scheme lets
    // us recover the menu id from the client prefix.
    const newMap: Record<string, { itemId: string; variationId: string }> = { ...catalogMap };
    const mappings: any[] = data.id_mappings || [];
    const objectsByRealId: Record<string, any> = {};
    for (const obj of (data.objects || [])) objectsByRealId[obj.id] = obj;

    for (const map of mappings) {
      const clientId: string = map.client_object_id || '';
      const realId: string = map.object_id || '';
      if (!clientId.startsWith('#hq_item_')) continue;
      const menuIdClean = clientId.slice('#hq_item_'.length);
      // Find the original menu id — we stripped non-alphanumeric when hashing, so do the same lookup.
      const menuItem = syncable.find((m: any) => m.id.replace(/[^a-zA-Z0-9]/g, '') === menuIdClean);
      if (!menuItem) continue;
      const real = objectsByRealId[realId];
      const variationId = real?.item_data?.variations?.[0]?.id || '';
      newMap[menuItem.id] = { itemId: realId, variationId };
    }

    // Persist updated map
    const updatedSettings = { ...settings, squareCatalogMap: newMap, squareCatalogLastSync: Date.now() };
    await persistSettings(db, updatedSettings);

    return json({
      success: true,
      upserted: objects.length,
      newlyMapped: Object.keys(newMap).length - Object.keys(catalogMap).length,
      environment: envIsProd ? 'production' : 'sandbox',
    });
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Sync failed' }, status);
  }
};
