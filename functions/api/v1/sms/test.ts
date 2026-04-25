import { sendSms } from '../_lib/sendSms';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const { settings, to } = await request.json();
    const recipient = to || settings?.adminPhone;
    if (!recipient) return json({ error: 'No recipient phone number. Set an Admin Phone first.' }, 400);

    const result = await sendSms(env, settings, recipient, '🔥 Test SMS from Hughesys Que — your SMS integration is working!');
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('SMS test error:', error);
    return json({ error: error.message }, error.status || 500);
  }
};
