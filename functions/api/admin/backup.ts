/**
 * Admin-triggered D1 → R2 backup.
 *
 * POST /api/admin/backup (ADMIN-only). Reads every row of every business
 * table, bundles them into one JSON object, and writes it to the R2 bucket
 * bound as `BACKUPS` under a timestamped key.
 *
 * Why a manual endpoint instead of a cron Worker? See
 * PRODUCTION-AUDIT-2026-04-25.md DevOps #25 — a separate Workers project
 * just for cron is too much overhead for one client. Steve runs this from
 * the laptop (or wires a cron trigger from his side) by curl-ing this
 * endpoint with the admin Bearer token. See README "Backups" for usage.
 */
import { verifyAuth, requireAuth } from '../v1/_lib/auth';
import { getDB } from '../v1/_lib/db';

// Tables to back up. Order matters only for human-readability of the
// resulting JSON; restore is one-INSERT-at-a-time and doesn't depend on it.
const BACKUP_TABLES = [
  'orders',
  'customers',
  'magic_links',
  'settings',
  'calendar_events',
  'gallery_posts',
  'menu_items',
  'social_posts',
  'users',
  'live_chat',
  'chat_bans',
  'cook_days',
] as const;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function backupKey(now: Date): string {
  // backup-YYYY-MM-DD-HH-mm-ss.json (UTC; cheap and unambiguous)
  const y = now.getUTCFullYear();
  const mo = pad(now.getUTCMonth() + 1);
  const d = pad(now.getUTCDate());
  const h = pad(now.getUTCHours());
  const mi = pad(now.getUTCMinutes());
  const s = pad(now.getUTCSeconds());
  return `backup-${y}-${mo}-${d}-${h}-${mi}-${s}.json`;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) =>
    new Response(JSON.stringify(d), {
      status: s,
      headers: { 'Content-Type': 'application/json' },
    });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    // R2 binding may not be wired up yet (it's commented out in wrangler.toml
    // until the bucket is created). Give a clear, actionable message rather
    // than a generic 500.
    if (!env.BACKUPS) {
      return json(
        {
          error:
            'R2 binding "BACKUPS" not configured. Run `wrangler r2 bucket create hughesys-que-backups` then uncomment the [[r2_buckets]] block in wrangler.toml and redeploy. See README "Backups" for details.',
        },
        503,
      );
    }

    const db = getDB(env);

    // Read every table sequentially. D1 batches would be marginally faster
    // but harder to reason about for this rare admin call; clarity wins.
    const tables: Record<string, any[]> = {};
    const tableCounts: Record<string, number> = {};
    for (const name of BACKUP_TABLES) {
      // Table names are a fixed allow-list above, so interpolation is safe.
      const { results } = await db.prepare(`SELECT * FROM ${name}`).all();
      const rows = (results || []) as any[];
      tables[name] = rows;
      tableCounts[name] = rows.length;
    }

    const exportedAt = new Date();
    const payload = {
      exported_at: exportedAt.toISOString(),
      version: 1,
      tables,
    };
    const body = JSON.stringify(payload);
    const sizeBytes = new TextEncoder().encode(body).byteLength;
    const key = backupKey(exportedAt);

    await env.BACKUPS.put(key, body, {
      httpMetadata: { contentType: 'application/json' },
    });

    return json({ success: true, key, sizeBytes, tableCounts });
  } catch (error: any) {
    console.error('Admin backup error:', error);
    return json({ error: error.message || 'Internal Server Error' }, error.status || 500);
  }
};
