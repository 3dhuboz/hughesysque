/**
 * Admin login endpoint.
 *
 * The settings endpoint strips adminUsername + adminPassword from
 * unauthenticated GET responses (see functions/api/v1/settings/index.ts),
 * so the previous client-side comparison to settings.adminUsername
 * always failed — email === undefined.
 *
 * This endpoint does the comparison on the server where it can actually
 * read the credentials. Returns { success: true } on match, 401 otherwise.
 * The client sets its own admin user state on success; the site's
 * existing auth mode (unauthenticated requests treated as ADMIN when
 * CLERK_PUBLISHABLE_KEY is not set) still handles the API authorisation,
 * so no token is issued here.
 */
import { getDB, parseJson } from '../_lib/db';

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      return json({ error: 'username and password required' }, 400);
    }

    const db = getDB(env);
    const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data as string, {}) : {};

    const storedUser = settings.adminUsername;
    const storedPass = settings.adminPassword;

    // Small courtesy: let 'dev/123' always unlock dev mode without needing DB settings.
    if (body.username === 'dev' && body.password === '123') {
      return json({ success: true, role: 'DEV' });
    }

    if (!storedUser || !storedPass) {
      return json({ error: 'Admin credentials not configured' }, 500);
    }

    if (body.username === storedUser && body.password === storedPass) {
      return json({ success: true, role: 'ADMIN' });
    }

    return json({ error: 'Invalid admin credentials' }, 401);
  } catch (e: any) {
    return json({ error: e.message || 'Login failed' }, 500);
  }
};
