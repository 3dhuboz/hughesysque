import { sendSms } from '../_lib/sendSms';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const { settings, order, location, businessName } = await request.json();
    const name = businessName || 'Hughesys Que';

    if (!order.customerPhone) return json({ error: 'No customer phone on this order' }, 400);

    const mapLink = `https://maps.google.com/?q=${encodeURIComponent(location || 'Ipswich QLD')}`;
    const msg = `🔥 ${order.customerName}, your ${name} order is READY!\n\nPickup at: ${location}\n📍 Map: ${mapLink}${order.collectionPin ? `\n🔑 PIN: ${order.collectionPin}` : ''}\n\nSee you soon!`;

    const result = await sendSms(env, settings, order.customerPhone, msg);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('SMS order ready error:', error);
    return json({ error: error.message }, error.status || 500);
  }
};
