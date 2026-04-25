/**
 * Generic email blast — mirrors the existing /sms/blast endpoint.
 * Sends an arbitrary subject + body to a recipient using configured
 * email settings. Used by admin to fire one-off messages
 * (apologies, follow-ups, custom invoices) without a dedicated template.
 */
import { sendEmail } from '../_lib/sendEmail';
import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    let { settings, to, subject, text, html } = await request.json();

    if (!to) return json({ error: 'Recipient email is required' }, 400);
    if (!subject) return json({ error: 'Subject is required' }, 400);
    if (!text && !html) return json({ error: 'text or html body is required' }, 400);

    // Fall back to stored emailSettings if the caller didn't pass any —
    // makes it possible to fire a blast from a curl/script without first
    // pulling settings out of D1.
    if (!settings) {
      const db = getDB(env);
      const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
      const stored = row ? parseJson(row.data as string, {}) : {};
      settings = stored.emailSettings;
    }

    if (!settings || !settings.enabled) return json({ error: 'Email not configured or disabled' }, 400);

    // Auto-generate a basic HTML wrapper if only text was provided.
    const htmlBody = html || `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222;line-height:1.55;font-size:15px;">${
      String(text).split('\n').map(l => l.trim() ? `<p style="margin:0 0 12px;">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '').join('')
    }</div>`;

    const result = await sendEmail(env, settings, to, subject, text || '', htmlBody);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('Email blast error:', error);
    return json({ error: error.message }, error.status || 500);
  }
};
