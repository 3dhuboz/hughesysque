/**
 * Admin login endpoint.
 *
 * Credentials are stored server-side in the 'general' settings row, hashed
 * with PBKDF2 / SHA-256 (100k iterations) under settings.adminPasswordRecord.
 *
 * During the transition from the legacy plaintext settings.adminPassword
 * field, we accept plaintext for one successful login, then transparently
 * upgrade the stored value to the hashed record. Plaintext is deleted as
 * part of the upgrade.
 *
 * 'dev' / '123' is a break-glass for development — always works, bypasses
 * hashing so a developer can always recover the site.
 */
import { getDB, parseJson } from '../_lib/db';
import { hashPassword, verifyPassword } from '../_lib/password';
import { issueAdminSession } from '../_lib/adminSession';

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      return json({ error: 'username and password required' }, 400);
    }

    // Dev break-glass
    if (body.username === 'dev' && body.password === '123') {
      const token = await issueAdminSession(env, 'DEV');
      return json({ success: true, role: 'DEV', token, mustChangePassword: false });
    }

    const db = getDB(env);
    const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data as string, {}) : {};

    const storedUser = settings.adminUsername;
    if (!storedUser || body.username !== storedUser) {
      return json({ error: 'Invalid admin credentials' }, 401);
    }

    // Prefer hashed record
    if (settings.adminPasswordRecord) {
      const ok = await verifyPassword(body.password, settings.adminPasswordRecord);
      if (!ok) return json({ error: 'Invalid admin credentials' }, 401);
      const token = await issueAdminSession(env, 'ADMIN');
      return json({ success: true, role: 'ADMIN', token, mustChangePassword: false });
    }

    // Fallback: plaintext legacy. If it matches, auto-upgrade to hashed on the way out.
    // Also flag mustChangePassword so the client can force Macca to rotate off the
    // default '123' immediately.
    if (settings.adminPassword && body.password === settings.adminPassword) {
      const isDefaultLike = settings.adminPassword.length <= 4;
      try {
        const record = await hashPassword(body.password);
        const updated = { ...settings, adminPasswordRecord: record };
        delete updated.adminPassword;
        await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
          .bind(JSON.stringify(updated)).run();
      } catch (e) {
        console.error('Auto-upgrade to hashed password failed; leaving plaintext in place.', e);
      }
      const token = await issueAdminSession(env, 'ADMIN');
      return json({ success: true, role: 'ADMIN', token, mustChangePassword: isDefaultLike });
    }

    return json({ error: 'Invalid admin credentials' }, 401);
  } catch (e: any) {
    return json({ error: e.message || 'Login failed' }, 500);
  }
};
