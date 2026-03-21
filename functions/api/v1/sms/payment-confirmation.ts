import { sendSms } from '../_lib/sendSms';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { settings, order, businessName, amountPaid } = await request.json();
    const name = businessName || 'Hughesys Que';

    if (!order?.customerPhone) return json({ error: 'Customer phone is required' }, 400);

    const total = amountPaid || Number(order.total || 0).toFixed(2);
    const orderNum = order.id?.slice(-6) || order.id || '000000';

    const itemsList = (order.items || []).map((item: any) => {
      const itemName = item.item?.name || item.name || 'Item';
      const itemPrice = Number(item.item?.price || item.price || 0);
      const qty = Number(item.quantity || 1);
      return `• ${qty}x ${itemName} - $${(itemPrice * qty).toFixed(2)}`;
    }).join('\n');

    const itemsBlock = itemsList ? `\n\n${itemsList}\n` : '';
    const msg = `✅ ${name}: Payment of $${total} received!\n\nOrder #${orderNum}${itemsBlock}\nTotal Paid: $${total}\n\nYour order is confirmed. Thank you!`;

    const result = await sendSms(env, settings, order.customerPhone, msg);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('Payment confirmation SMS error:', error);
    return json({ error: error.message }, 500);
  }
};
