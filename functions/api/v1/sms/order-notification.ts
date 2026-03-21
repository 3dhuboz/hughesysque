import { sendSms } from '../_lib/sendSms';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = env.EMAIL_API_SECRET;
  if (secret && request.headers.get('x-api-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  try {
    const { settings, order } = await request.json();

    const adminMsg = `🔥 New Order! ${order.customerName} — $${order.total?.toFixed(2)}. Cook Day: ${order.cookDay}`;
    if (settings?.adminPhone) {
      await sendSms(env, settings, settings.adminPhone, adminMsg);
    }

    if (order.customerPhone) {
      const customerMsg = `Hey ${order.customerName}! Your Hughesys Que order is confirmed 🔥 Total: $${order.total?.toFixed(2)}. We'll SMS when it's ready!`;
      await sendSms(env, settings, order.customerPhone, customerMsg);
    }

    return json({ success: true, provider: env.MESSAGEBIRD_API_KEY ? 'messagebird' : 'twilio' });
  } catch (error: any) {
    console.error('SMS order notification error:', error);
    return json({ error: error.message }, 500);
  }
};
