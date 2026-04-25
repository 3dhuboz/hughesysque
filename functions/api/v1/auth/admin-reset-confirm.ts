/**
 * Admin password reset — step 2: confirm code + set a new password.
 *
 * Body: { code: string, newPassword: string }
 *
 * Validates the code against settings.adminResetCode + expiry, enforces
 * a minimum password length, caps at 5 attempts per issued code.
 * On success: hashes the new password, writes adminPasswordRecord, wipes
 * the reset fields and any plaintext adminPassword.
 */
import { getDB, parseJson } from '../_lib/db';
import { hashPassword } from '../_lib/password';

const MIN_PASSWORD_LEN = 8;
const MAX_ATTEMPTS = 5;

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    // Uppercase the submitted code so a hand-typed lowercase entry still
    // matches the stored uppercase value. The reset alphabet is uppercase
    // only (see generateResetCode in _lib/password.ts).
    const code = (body?.code || '').toString().trim().toUpperCase();
    const newPassword = (body?.newPassword || '').toString();

    if (!code || !newPassword) return json({ error: 'code and newPassword required' }, 400);
    if (newPassword.length < MIN_PASSWORD_LEN) {
      return json({ error: `Password must be at least ${MIN_PASSWORD_LEN} characters.` }, 400);
    }

    const db = getDB(env);
    const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data as string, {}) : {};

    if (!settings.adminResetCode || !settings.adminResetExpiresAt) {
      return json({ error: 'No active reset code. Request a new one.' }, 400);
    }
    if (Date.now() > settings.adminResetExpiresAt) {
      return json({ error: 'Reset code has expired. Request a new one.' }, 400);
    }
    const attempts = settings.adminResetAttempts || 0;
    if (attempts >= MAX_ATTEMPTS) {
      return json({ error: 'Too many attempts. Request a new code.' }, 429);
    }

    if (code !== settings.adminResetCode) {
      const updated = { ...settings, adminResetAttempts: attempts + 1 };
      await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
        .bind(JSON.stringify(updated)).run();
      return json({ error: 'Incorrect code.' }, 401);
    }

    // Hash + write the new password, wipe reset + plaintext fields. Also
    // clear the daily-reset counter — once you've successfully reset, the
    // window resets too.
    const record = await hashPassword(newPassword);
    const updated = { ...settings, adminPasswordRecord: record };
    delete updated.adminPassword;
    delete updated.adminResetCode;
    delete updated.adminResetExpiresAt;
    delete updated.adminResetIssuedAt;
    delete updated.adminResetAttempts;
    delete updated.adminResetDailyCount;
    delete updated.adminResetDailyWindowStart;
    await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
      .bind(JSON.stringify(updated)).run();

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Reset confirm failed' }, 500);
  }
};
