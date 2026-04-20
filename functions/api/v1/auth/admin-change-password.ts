/**
 * In-admin password change.
 * Body: { currentPassword: string, newPassword: string }
 *
 * Verifies the current password against the stored record (or legacy
 * plaintext) before allowing a new one. Enforces the same 8-char
 * minimum as the reset flow. Writes adminPasswordRecord + wipes any
 * plaintext adminPassword.
 */
import { getDB, parseJson } from '../_lib/db';
import { hashPassword, verifyPassword } from '../_lib/password';

const MIN_PASSWORD_LEN = 8;

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    const currentPassword = (body?.currentPassword || '').toString();
    const newPassword = (body?.newPassword || '').toString();

    if (!currentPassword || !newPassword) {
      return json({ error: 'currentPassword and newPassword required' }, 400);
    }
    if (newPassword.length < MIN_PASSWORD_LEN) {
      return json({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` }, 400);
    }
    if (newPassword === currentPassword) {
      return json({ error: 'New password must be different from current password.' }, 400);
    }

    const db = getDB(env);
    const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data as string, {}) : {};

    let currentOk = false;
    if (settings.adminPasswordRecord) {
      currentOk = await verifyPassword(currentPassword, settings.adminPasswordRecord);
    } else if (settings.adminPassword && currentPassword === settings.adminPassword) {
      currentOk = true;
    }
    if (!currentOk) return json({ error: 'Current password is incorrect.' }, 401);

    const record = await hashPassword(newPassword);
    const updated = { ...settings, adminPasswordRecord: record };
    delete updated.adminPassword;
    delete updated.adminResetCode;
    delete updated.adminResetExpiresAt;
    delete updated.adminResetIssuedAt;
    delete updated.adminResetAttempts;
    await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
      .bind(JSON.stringify(updated)).run();

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Password change failed' }, 500);
  }
};
