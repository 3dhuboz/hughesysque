import { sendSms } from '../_lib/sendSms';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const { settings, order, businessName } = await request.json();
    const name = businessName || 'Hughesys Que';
    if (!order?.customerPhone) return json({ error: 'No customer phone' }, 400);

    const msg = `🔥 ${order.customerName}, your ${name} order is now being prepared!\n\nWe'll send you another message when it's ready for collection. Hang tight!`;

    const result = await sendSms(env, settings, order.customerPhone, msg);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('Cooking started SMS error:', error);
    return json({ error: error.message }, error.status || 500);
  }
};
