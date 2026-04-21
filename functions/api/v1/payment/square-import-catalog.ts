/**
 * Square Catalog import — one-way pull from Square → Hughesys menu.
 *
 * Mirror of square-sync-catalog.ts going the other direction. Fetches all
 * ITEMs from Square, upserts a matching menu_items row for each. Uses the
 * existing settings.squareCatalogMap in reverse to match Square items back
 * to Hughesys menu ids when possible; otherwise creates fresh menu items.
 *
 * Hughesys is still the intended source of truth in day-to-day use — this
 * import is for one-off onboarding (Macca's existing POS catalog) and for
 * recovering if the Hughesys DB gets wiped.
 *
 * Auth: ADMIN only.
 */
import { getDB, parseJson, generateId } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

const json = (d: any, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

function guessCategory(name: string): string {
  const n = (name || '').toLowerCase();
  if (/brisket|pork|chicken|lamb|sausage|rib|beef/.test(n)) return 'Meats';
  if (/slaw|salad|mac|potato|beans|side/.test(n)) return 'Sides';
  if (/burger|bun/.test(n)) return 'Burgers';
  if (/drink|coke|pepsi|water|cola|iced tea/.test(n)) return 'Drinks';
  if (/sauce|rub|spice/.test(n)) return 'Rubs & Sauces';
  if (/merch|shirt|cap|hat/.test(n)) return 'Merch';
  return 'Meats';
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const db = getDB(env);
    const row: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data, {}) : {};

    if (!settings.squareAccessToken || !settings.squareLocationId) {
      return json({ error: 'Square not configured — set access token and location ID in Admin > Settings' }, 400);
    }

    const envIsProd = settings.squareAccessToken.startsWith('EAAA');
    const baseUrl = envIsProd
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    // Pull the full ITEM list from Square. Catalog can be paginated — loop cursors.
    const allItems: any[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
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
        console.error('Square catalog list failed', data);
        return json({ error: data.errors?.[0]?.detail || `Square ${res.status}` }, 502);
      }
      allItems.push(...(data.objects || []));
      cursor = data.cursor;
      if (!cursor) break;
    }

    if (allItems.length === 0) {
      return json({ success: true, imported: 0, updated: 0, message: "No items in Square's catalog to import." });
    }

    // Reverse map: Square item id → Hughesys menu id
    const catalogMap: Record<string, { itemId: string; variationId: string }> = settings.squareCatalogMap || {};
    const squareIdToHqId: Record<string, string> = {};
    for (const [hqId, { itemId }] of Object.entries(catalogMap)) {
      if (itemId) squareIdToHqId[itemId] = hqId;
    }

    // Pre-load existing menu items so we know which to update vs insert
    const { results: existingRows } = await db.prepare('SELECT id, name FROM menu_items').all();
    const existingById: Record<string, any> = {};
    const existingByNameLower: Record<string, string> = {};
    for (const r of (existingRows || [])) {
      existingById[(r as any).id] = r;
      existingByNameLower[((r as any).name || '').toLowerCase().trim()] = (r as any).id;
    }

    let imported = 0;
    let updated = 0;
    const newMap = { ...catalogMap };

    for (const obj of allItems) {
      if (obj.type !== 'ITEM' || obj.is_deleted) continue;
      const itemData = obj.item_data || {};
      const name = itemData.name;
      if (!name) continue;
      const variation = (itemData.variations || [])[0];
      if (!variation) continue;
      const priceCents = variation.item_variation_data?.price_money?.amount;
      if (priceCents == null) continue;
      const price = priceCents / 100;
      const description = itemData.description || '';
      const imageUrl = itemData.image_urls?.[0] || '';

      // Resolution order:
      //   1. Existing map entry matches Square id → update that menu item
      //   2. Existing menu item with same (case-insensitive) name → update it + record the map
      //   3. Otherwise → insert a new menu item
      let hqId = squareIdToHqId[obj.id];
      if (!hqId) {
        const byName = existingByNameLower[name.toLowerCase().trim()];
        if (byName) hqId = byName;
      }

      if (hqId && existingById[hqId]) {
        await db.prepare(
          'UPDATE menu_items SET name = ?, description = ?, price = ?, image = COALESCE(NULLIF(?, ""), image), available = 1 WHERE id = ?'
        ).bind(name, description, price, imageUrl, hqId).run();
        updated++;
      } else {
        hqId = generateId();
        await db.prepare(
          'INSERT INTO menu_items (id, name, description, price, image, category, available, availability_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(hqId, name, description, price, imageUrl, guessCategory(name), 1, 'everyday').run();
        imported++;
      }

      newMap[hqId] = { itemId: obj.id, variationId: variation.id };
    }

    const updatedSettings = {
      ...settings,
      squareCatalogMap: newMap,
      squareCatalogLastImport: Date.now(),
    };
    await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
      .bind(JSON.stringify(updatedSettings)).run();

    return json({
      success: true,
      imported,
      updated,
      total: imported + updated,
      environment: envIsProd ? 'production' : 'sandbox',
    });
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Import failed' }, status);
  }
};
