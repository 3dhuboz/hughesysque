/**
 * Liveness/readiness probe for uptime monitors.
 *
 * Public by design — no auth. A 200 means the Worker is up AND can read
 * from D1 (which is the only external dependency the site can't function
 * without). Returns 503 if the D1 binding is missing or the query throws,
 * so external monitors can distinguish "site up but degraded" from "site
 * fully down" — the latter manifests as no response at all.
 *
 * Hook a free uptime monitor (UptimeRobot, Better Stack, Cloudflare Health
 * Check) at https://hugheseysque.au/api/health on a 5-minute interval.
 *
 * The query touches the settings table specifically because (a) it has a
 * single row by design so cost is constant regardless of order volume,
 * and (b) if settings is unreadable the rest of the API is broken anyway.
 *
 * Audit reference: 2026-04-25 audit, DevOps High #5.
 */

import { getDB } from './v1/_lib/db';

export const onRequestGet = async (context: any) => {
  const { env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
    status: s,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

  try {
    const db = getDB(env);
    await db.prepare('SELECT 1 FROM settings LIMIT 1').first();
    return json({ ok: true, ts: new Date().toISOString() });
  } catch (e: any) {
    console.error('[health] check failed:', e);
    return json({ ok: false, error: e.message || 'Database unavailable' }, 503);
  }
};
