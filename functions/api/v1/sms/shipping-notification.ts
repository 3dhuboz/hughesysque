import { sendSms } from '../_lib/sendSms';

function getTrackingUrl(courier: string, trackingNumber: string): string {
  const c = (courier || '').toLowerCase();
  if (c.includes('auspost') || c.includes('australia post')) return `https://auspost.com.au/mypost/track/#/details/${trackingNumber}`;
  if (c.includes('startrack')) return `https://startrack.com.au/track/#/details/${trackingNumber}`;
  if (c.includes('dhl')) return `https://www.dhl.com/au-en/home/tracking.html?tracking-id=${trackingNumber}`;
  if (c.includes('tnt')) return `https://www.tnt.com/express/en_au/site/tracking.html?searchType=con&cons=${trackingNumber}`;
  if (c.includes('sendle')) return `https://track.sendle.com/tracking?ref=${trackingNumber}`;
  if (c.includes('aramex') || c.includes('fastway')) return `https://www.aramex.com.au/tools/track?l=${trackingNumber}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  return `https://www.google.com/search?q=${encodeURIComponent(courier + ' tracking ' + trackingNumber)}`;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { settings, order, businessName, trackingNumber, courier } = await request.json();
    const name = businessName || 'Hughesys Que';

    if (!order?.customerPhone) return json({ error: 'Customer phone is required' }, 400);

    const orderNum = order.id?.slice(-6) || order.id || '000000';
    const courierName = courier || order.courier || 'Australia Post';
    const tracking = trackingNumber || order.trackingNumber || '';
    const trackingUrl = getTrackingUrl(courierName, tracking);

    const msg = `📦 ${name}: Your order #${orderNum} has shipped!\n\nCourier: ${courierName}\nTracking: ${tracking}\n\n🚚 Track: ${trackingUrl}\n\nEst. delivery: 3-5 business days.`;

    const result = await sendSms(env, settings, order.customerPhone, msg);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('Shipping notification SMS error:', error);
    return json({ error: error.message }, 500);
  }
};
