/**
 * Customer magic-link request — step 1 of customer sign-in.
 *
 * Accept an email, generate a single-use token (15 min TTL), persist it in
 * the magic_links table, and email a sign-in link to that address. Always
 * return success — never reveal whether the email was previously known
 * (enumeration defence, same pattern as admin reset request).
 *
 * Throttle: refuse to issue more than one link per email per 60 seconds.
 */

import { sendEmail } from '../_lib/sendEmail';
import { getDB, parseJson } from '../_lib/db';

const TTL_MS = 15 * 60 * 1000;
const THROTTLE_MS = 60 * 1000;

function generateToken(): string {
  // 32 random bytes -> base64url -> 43 chars, ~256 bits of entropy.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    const submittedEmail = (body?.email || '').toString().trim().toLowerCase();
    if (!submittedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) {
      return json({ error: 'valid email required' }, 400);
    }

    const db = getDB(env);

    // Throttle: did we issue a link for this email less than THROTTLE_MS ago?
    const recent = await db
      .prepare("SELECT expires_at FROM magic_links WHERE email = ? AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1")
      .bind(submittedEmail)
      .first<{ expires_at: number }>();
    if (recent && (recent.expires_at - (Date.now() + TTL_MS - THROTTLE_MS)) > 0) {
      // Most recent unconsumed link issued within the last THROTTLE_MS — silently no-op.
      return json({ success: true });
    }

    const token = generateToken();
    const expiresAt = Date.now() + TTL_MS;

    await db
      .prepare("INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)")
      .bind(token, submittedEmail, expiresAt)
      .run();

    // Build the click-through URL. HashRouter is in use on the storefront so
    // the path goes after the `#`. Origin comes from the request.
    const origin = new URL(request.url).origin;
    const link = `${origin}/#/auth/callback?token=${encodeURIComponent(token)}`;

    const settings = await (async () => {
      const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
      return row ? parseJson(row.data as string, {}) : {};
    })();

    const subject = 'Sign in to Hughesys Que';
    const text = `Click this link to sign in to Hughesys Que:\n\n${link}\n\nThe link is good for 15 minutes and can only be used once. If you didn't request this, ignore this email.\n\n— Hughesys Que`;
    const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
      <h1 style="font-size:18px;margin:0 0 8px;color:#fff;">Sign in to Hughesys Que</h1>
      <p style="margin:0 0 16px;font-size:14px;color:#a3a3a3;">Tap the button below to sign in. This link expires in 15 minutes and can only be used once.</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${link}" style="display:inline-block;background:linear-gradient(90deg,#d9381e,#7c1d10);color:#fff;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:1px;text-transform:uppercase;font-size:14px;">Sign in</a>
      </p>
      <p style="margin:0;font-size:12px;color:#737373;">If the button doesn't work, paste this URL into your browser:<br><span style="color:#fbbf24;word-break:break-all;">${link}</span></p>
      <p style="margin:16px 0 0;font-size:12px;color:#737373;">If you didn't request this, ignore this email — your account isn't created until you click the link.</p>
    </div>`;

    try {
      await sendEmail(env, settings.emailSettings, submittedEmail, subject, text, html);
    } catch (e) {
      console.error('Failed to send customer magic link', e);
      // Still return success so we don't leak whether the email is real OR
      // whether email delivery is broken. Customer can request again.
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Magic link request failed' }, 500);
  }
};
