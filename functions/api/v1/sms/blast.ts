import { sendSms } from '../_lib/sendSms';
import { getDB, parseJson } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    let { settings, to, message } = await request.json();

    if (!to) return json({ error: 'Recipient phone number is required' }, 400);
    if (!message) return json({ error: 'Message body is required' }, 400);

    // Fall back to stored smsSettings if the caller didn't pass any —
    // matches the email-blast pattern, lets a curl/script fire without
    // first pulling settings out of D1.
    if (!settings) {
      const db = getDB(env);
      const row = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
      const stored = row ? parseJson(row.data as string, {}) : {};
      settings = stored.smsSettings;
    }

    const result = await sendSms(env, settings, to, message);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('SMS blast error:', error);
    return json({ error: error.message }, 500);
  }
};
