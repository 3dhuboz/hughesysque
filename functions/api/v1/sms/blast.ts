import { sendSms } from '../_lib/sendSms';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { settings, to, message } = await request.json();

    if (!to) return json({ error: 'Recipient phone number is required' }, 400);
    if (!message) return json({ error: 'Message body is required' }, 400);

    const result = await sendSms(env, settings, to, message);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('SMS blast error:', error);
    return json({ error: error.message }, 500);
  }
};
