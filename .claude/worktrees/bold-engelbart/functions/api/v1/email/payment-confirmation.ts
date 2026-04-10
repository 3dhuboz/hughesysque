import { sendEmail } from '../_lib/sendEmail';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { settings, order, businessName, invoiceSettings, amountPaid } = await request.json();

    if (!settings || !settings.enabled) return json({ error: 'Email settings not configured or disabled' }, 400);
    if (!order?.customerEmail) return json({ error: 'Customer email is required' }, 400);

    const inv = invoiceSettings || {};
    const name = businessName || 'Hughesys Que';
    const headerColor = inv.headerColor || '#d9381e';
    const logoUrl = inv.logoUrl || '';
    const footerNote = inv.footerNote || 'Thank you for your business! If you have questions, reply to this email or give us a call.';
    const orderNum = order.id?.slice(-6) || order.id || '000000';
    const total = amountPaid || Number(order.total || 0).toFixed(2);

    const itemsRows = (order.items || []).map((item: any) => {
      const itemName = item.item?.name || item.name || 'Item';
      const itemPrice = Number(item.item?.price || item.price || 0);
      const qty = Number(item.quantity || 1);
      const selectedOption = item.selectedOption || '';
      let details = selectedOption ? `<span style="display:block;color:#888888;font-size:12px;margin-top:2px;">Option: ${selectedOption}</span>` : '';
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#222222;font-weight:600;font-size:14px;">${qty}x ${itemName}</span>${details}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#222222;text-align:right;font-weight:700;font-size:14px;vertical-align:top;">$${(itemPrice * qty).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const cookDate = order.cookDay
      ? new Date(order.cookDay).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${name}" style="max-height:48px;margin-bottom:8px;" /><br/>` : '';
    const orderTypeLabel = order.type === 'CATERING' ? '🍖 Catering Order' : '🛒 Takeaway Order';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#16a34a;border-radius:12px 12px 0 0;padding:30px 28px;text-align:center;">
          ${logoHtml}
          <div style="display:inline-block;width:56px;height:56px;background-color:#ffffff;border-radius:50%;text-align:center;line-height:56px;font-size:28px;margin-bottom:12px;">&#10003;</div>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">Payment Received!</h1>
          <p style="margin:6px 0 0;color:#ffffff;font-size:13px;opacity:0.9;">Order #${orderNum} &bull; ${orderTypeLabel}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px 28px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="color:#333333;font-size:15px;margin:0 0 4px;">Hey <strong>${order.customerName || 'there'}</strong>,</p>
          <p style="color:#666666;font-size:14px;line-height:1.6;margin:0 0 20px;">We've received your payment of <strong style="color:#16a34a;">$${total} AUD</strong>. Your order is now confirmed.</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="color:#166534;font-size:14px;font-weight:bold;">Amount Paid</td><td style="color:#166534;font-size:18px;font-weight:bold;text-align:right;">$${total} AUD</td></tr>
                <tr><td style="color:#888888;font-size:12px;padding-top:4px;">Status</td><td style="color:#16a34a;font-size:12px;font-weight:bold;text-align:right;padding-top:4px;">&#10003; PAID</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        ${cookDate ? `<tr><td style="background-color:#ffffff;padding:16px 28px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
            <tr><td style="padding:14px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="color:#888888;font-size:13px;">Date</td><td style="color:#333333;text-align:right;font-size:13px;">${cookDate}</td></tr>
                ${order.pickupTime ? `<tr><td style="color:#888888;font-size:13px;">Pickup</td><td style="color:#333333;text-align:right;font-size:13px;">${order.pickupTime}</td></tr>` : ''}
              </table>
            </td></tr>
          </table>
        </td></tr>` : ''}
        <tr><td style="background-color:#ffffff;padding:16px 28px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:2px solid ${headerColor};font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#999999;">Item</td>
              <td style="padding:8px 0;border-bottom:2px solid ${headerColor};font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#999999;text-align:right;">Amount</td>
            </tr>
            ${itemsRows}
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:8px 28px 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #222222;">
            <tr>
              <td style="padding:14px 0;font-size:18px;font-weight:bold;color:#111111;">Total Paid</td>
              <td style="padding:14px 0;font-size:20px;font-weight:bold;color:#16a34a;text-align:right;">$${total}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
          <p style="color:#999999;font-size:12px;line-height:1.6;margin:0;">${footerNote}</p>
          <p style="color:#bbbbbb;font-size:11px;margin:10px 0 0;">&mdash; The ${name} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `Payment Confirmed - ${name}\n\nHey ${order.customerName || 'there'},\n\nPayment of $${total} AUD received. Order #${orderNum} confirmed!\n\n${footerNote}\n\n— ${name}`;

    await sendEmail(env, settings, order.customerEmail, `Payment Confirmed ✓ Order #${orderNum} — ${name}`, text, html);
    return json({ success: true });
  } catch (error: any) {
    console.error('Payment confirmation email error:', error);
    return json({ error: error.message }, 500);
  }
};
