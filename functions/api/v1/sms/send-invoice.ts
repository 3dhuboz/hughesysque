import { sendSms } from '../_lib/sendSms';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { settings, order, businessName, invoiceSettings } = await request.json();
    const inv = invoiceSettings || {};
    const name = businessName || 'Hughesys Que';

    if (!order?.customerPhone) return json({ error: 'Customer phone is required' }, 400);

    const paymentUrl = inv.paymentUrl || '';
    const total = Number(order.total || 0).toFixed(2);
    const orderNum = order.id?.slice(-6) || order.id || '000000';
    const payLabel = inv.paymentLabel || 'Pay Now';

    const itemsList = (order.items || []).map((item: any) => {
      const itemName = item.item?.name || item.name || 'Item';
      const itemPrice = Number(item.item?.price || item.price || 0);
      const qty = Number(item.quantity || 1);
      const selectedOption = item.selectedOption || '';
      let line = `• ${qty}x ${itemName} - $${(itemPrice * qty).toFixed(2)}`;
      if (selectedOption) line += ` (${selectedOption})`;
      return line;
    }).join('\n');

    const itemsBlock = itemsList ? `\n\n${itemsList}\n` : '';
    const payLink = paymentUrl ? `\n\n💳 ${payLabel}: ${paymentUrl}` : '';

    const template = inv.smsTemplate || `Hi {name}, here's your invoice from {business}.\n\nOrder #{orderNum}\nTotal: \${total}{items}{payLink}\n\nCheers!`;
    let msg = template
      .replace(/\{name\}/g, order.customerName || 'there')
      .replace(/\$\{total\}/g, `$${total}`)
      .replace(/\{total\}/g, total)
      .replace(/\{business\}/g, name)
      .replace(/\{orderNum\}/g, orderNum)
      .replace(/\{items\}/g, itemsBlock)
      .replace(/\{payLink\}/g, payLink);

    if (paymentUrl && !msg.includes(paymentUrl)) {
      msg = msg.trimEnd() + `\n\n💳 ${payLabel}: ${paymentUrl}`;
    }
    if (itemsList && !msg.includes(itemsList.substring(0, 20))) {
      msg = msg.trimEnd() + `\n\n${itemsList}`;
    }
    if (!msg.includes('Do not reply')) {
      msg = msg.trimEnd() + '\n\nDo not reply to this message.';
    }

    const result = await sendSms(env, settings, order.customerPhone, msg);
    return json({ success: true, ...result });
  } catch (error: any) {
    console.error('Invoice SMS error:', error);
    return json({ error: error.message }, 500);
  }
};
