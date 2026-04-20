/**
 * Admin password reset — step 1: request a code.
 *
 * Posts to this endpoint with the admin email; if it matches the
 * settings.adminEmail on file we generate a 6-digit code, stash it in
 * settings under `adminResetCode` + `adminResetExpiresAt` (15 min TTL),
 * and email it to the configured admin email via Resend.
 *
 * We always return { success: true } regardless of whether the email
 * matched — the response must not reveal whether an email is valid
 * (classic enumeration defence).
 */
import { getDB, parseJson } from '../_lib/db';
import { generateResetCode } from '../_lib/password';
import { sendEmail } from '../_lib/sendEmail';

const TTL_MS = 15 * 60 * 1000; // 15 minutes

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    const submittedEmail = (body?.email || '').toString().trim().toLowerCase();
    if (!submittedEmail) return json({ error: 'email required' }, 400);

    const db = getDB(env);
    const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data as string, {}) : {};

    const onFile = [settings.adminEmail, settings.contactEmail].filter(Boolean).map((e: string) => e.toLowerCase());
    const matches = onFile.includes(submittedEmail);

    if (!matches) {
      // Don't leak which email is real. Return success anyway.
      return json({ success: true });
    }

    // Throttle: refuse to re-generate if we issued a code less than 60s ago.
    if (settings.adminResetIssuedAt && Date.now() - settings.adminResetIssuedAt < 60_000) {
      return json({ success: true }); // still don't leak
    }

    const code = generateResetCode();
    const expiresAt = Date.now() + TTL_MS;

    const updated = {
      ...settings,
      adminResetCode: code,
      adminResetExpiresAt: expiresAt,
      adminResetIssuedAt: Date.now(),
      adminResetAttempts: 0,
    };
    await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
      .bind(JSON.stringify(updated)).run();

    const subject = 'Hughesys Que — admin password reset code';
    const text = `Your admin password reset code is ${code}.\n\nIt expires in 15 minutes. If you didn't request this, ignore this email and consider changing your password.\n\n— Hughesys Que`;
    const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
      <h1 style="font-size:18px;margin:0 0 8px;color:#fff;">Admin password reset</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#a3a3a3;">Use this code to reset the Hughesys Que admin password. It expires in 15 minutes.</p>
      <div style="font-size:40px;letter-spacing:8px;text-align:center;background:#111;border:1px solid #333;border-radius:12px;padding:24px;color:#fbbf24;font-weight:700;">${code}</div>
      <p style="margin:16px 0 0;font-size:12px;color:#737373;">If you didn't request this, ignore this email and consider changing your password.</p>
    </div>`;

    try {
      await sendEmail(env, settings.emailSettings, settings.adminEmail, subject, text, html);
    } catch (e) {
      console.error('Failed to send admin reset email', e);
      // Still return success to avoid enumeration; admin can check logs if no email arrives.
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Reset request failed' }, 500);
  }
};
