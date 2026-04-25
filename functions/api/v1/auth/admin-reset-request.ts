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
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RESETS_PER_DAY = 5;

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

    // Per-second throttle: refuse to re-generate if we issued a code less
    // than 60s ago. Catches the "spam-click the button" case.
    if (settings.adminResetIssuedAt && Date.now() - settings.adminResetIssuedAt < 60_000) {
      return json({ success: true }); // still don't leak
    }

    // Daily cap: refuse to issue more than MAX_RESETS_PER_DAY codes in any
    // rolling 24-hour window. Combined with the 5-attempts-per-code limit
    // in admin-reset-confirm, this caps brute-force at 25 guesses/day
    // against the 8.5×10¹¹-keyspace 8-char alphanumeric code (audit High).
    const now = Date.now();
    const windowStart = settings.adminResetDailyWindowStart || 0;
    let dailyCount = settings.adminResetDailyCount || 0;
    const newWindowStart = (now - windowStart > DAY_MS) ? now : windowStart;
    if (now - windowStart <= DAY_MS && dailyCount >= MAX_RESETS_PER_DAY) {
      return json({ success: true }); // silent — don't leak that we're rate-limiting
    }
    dailyCount = (now - windowStart > DAY_MS) ? 1 : dailyCount + 1;

    const code = generateResetCode();
    const expiresAt = Date.now() + TTL_MS;

    const updated = {
      ...settings,
      adminResetCode: code,
      adminResetExpiresAt: expiresAt,
      adminResetIssuedAt: Date.now(),
      adminResetAttempts: 0,
      adminResetDailyCount: dailyCount,
      adminResetDailyWindowStart: newWindowStart,
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

    // Send the code to the email the admin actually entered (which we just
    // confirmed matches a valid on-file address). Previously this hard-coded
    // settings.adminEmail, which silently broke when that field still held a
    // placeholder default like "admin@hugheseysque.au" — emails went into the
    // void and admin had no way to recover.
    // emailSettings.adminEmail is a sensible secondary destination (where
    // order receipts go) but we always include the submitted address first.
    const recipients = Array.from(new Set([
      submittedEmail,
      (settings.emailSettings?.adminEmail || '').toString().trim().toLowerCase(),
    ].filter(Boolean)));

    for (const to of recipients) {
      try {
        await sendEmail(env, settings.emailSettings, to, subject, text, html);
      } catch (e) {
        console.error(`Failed to send admin reset email to ${to}`, e);
        // Try the next recipient; still return success to avoid enumeration.
      }
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Reset request failed' }, 500);
  }
};
