import { sendEmail } from '../_lib/sendEmail';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { settings, order, businessName, invoiceSettings } = await request.json();

    if (!settings || !settings.enabled) return json({ error: 'Email settings not configured or disabled' }, 400);
    if (!order?.customerEmail) return json({ error: 'Customer email is required' }, 400);

    const inv = invoiceSettings || {};
    const name = businessName || 'Hughesys Que';
    const headerColor = inv.headerColor || '#d9381e';
    const accentColor = inv.accentColor || '#eab308';
    const paymentUrl = inv.paymentUrl || '';
    const paymentLabel = inv.paymentLabel || 'Pay Now';
    const logoUrl = inv.logoUrl || '';
    const thankYou = inv.thankYouMessage || "Here's your invoice. Please review the details below and arrange payment at your earliest convenience.";
    const footerNote = inv.footerNote || 'Thank you for your business! If you have questions about this invoice, reply to this email or give us a call.';
    const bankDetails = inv.bankDetails || '';
    const orderNum = order.id?.slice(-6) || order.id || '000000';
    const total = Number(order.total || 0).toFixed(2);

    const itemsRows = (order.items || []).map((item: any) => {
      const itemName = item.item?.name || item.name || 'Item';
      const itemPrice = Number(item.item?.price || item.price || 0);
      const qty = Number(item.quantity || 1);
      const selectedOption = item.selectedOption || '';
      let details = selectedOption ? `<span style="display:block;color:#888;font-size:12px;margin-top:2px;">Option: ${selectedOption}</span>` : '';
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#222;font-weight:600;font-size:14px;">${qty}x ${itemName}</span>${details}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;color:#222;text-align:right;font-weight:700;font-size:14px;vertical-align:top;">$${(itemPrice * qty).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const cookDate = order.cookDay
      ? new Date(order.cookDay).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBC';

    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${name}" style="max-height:48px;margin-bottom:8px;" /><br/>` : '';
    const orderTypeLabel = order.type === 'CATERING' ? '🍖 Catering Order' : '🛒 Takeaway Order';

    const fulfillmentInfo = order.fulfillmentMethod === 'DELIVERY' && order.deliveryAddress
      ? `<tr><td style="padding:6px 0;color:#888;font-size:12px;">Delivery</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;">${order.deliveryAddress}</td></tr>` : '';
    const deliveryFeeRow = order.deliveryFee && Number(order.deliveryFee) > 0
      ? `<tr><td style="padding:6px 0;color:#888;font-size:12px;">Delivery Fee</td><td style="padding:6px 0;color:#333;text-align:right;font-size:13px;">$${Number(order.deliveryFee).toFixed(2)}</td></tr>` : '';

    let paymentSection = '';
    if (paymentUrl) {
      paymentSection = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
        <tr><td align="center">
          <a href="${paymentUrl}" target="_blank" style="display:inline-block;background-color:${headerColor};color:#ffffff;font-weight:bold;padding:16px 44px;border-radius:8px;text-decoration:none;font-size:18px;">&#9654;&nbsp; ${paymentLabel} &mdash; $${total}</a>
        </td></tr>
        <tr><td align="center" style="padding-top:12px;"><a href="${paymentUrl}" style="color:${accentColor};font-size:11px;word-break:break-all;">${paymentUrl}</a></td></tr>
      </table>`;
    } else if (bankDetails) {
      paymentSection = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr><td style="background-color:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px;">
          <p style="margin:0 0 8px;font-weight:bold;font-size:13px;color:#555555;text-transform:uppercase;">Payment Details</p>
          <pre style="margin:0;font-family:monospace;font-size:13px;color:#333333;white-space:pre-wrap;">${bankDetails}</pre>
        </td></tr>
      </table>`;
    } else {
      paymentSection = `<p style="text-align:center;color:${accentColor};font-size:22px;font-weight:bold;padding:16px 0;">Amount Due: $${total}</p>`;
    }

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:${headerColor};border-radius:12px 12px 0 0;padding:30px 28px;text-align:center;">
          ${logoHtml}
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">Invoice from ${name}</h1>
          <p style="margin:6px 0 0;color:#ffffff;font-size:13px;opacity:0.9;">Order #${orderNum} &bull; ${orderTypeLabel}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px 28px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="color:#333333;font-size:15px;margin:0 0 4px;">Hey <strong>${order.customerName || 'there'}</strong>,</p>
          <p style="color:#666666;font-size:14px;line-height:1.6;margin:0 0 20px;">${thankYou}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
            <tr><td style="padding:14px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:4px 0;color:#888888;font-size:13px;">Date</td><td style="padding:4px 0;color:#333333;text-align:right;font-size:13px;">${cookDate}</td></tr>
                ${order.pickupTime ? `<tr><td style="padding:4px 0;color:#888888;font-size:13px;">Pickup</td><td style="padding:4px 0;color:#333333;text-align:right;font-size:13px;">${order.pickupTime}</td></tr>` : ''}
                ${fulfillmentInfo}${deliveryFeeRow}
                <tr><td style="padding:4px 0;color:#888888;font-size:13px;">Order #</td><td style="padding:4px 0;color:#333333;text-align:right;font-size:13px;font-weight:bold;">${orderNum}</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:20px 28px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:2px solid ${headerColor};font-size:10px;font-weight:bold;text-transform:uppercase;color:#999999;">Item</td>
              <td style="padding:8px 0;border-bottom:2px solid ${headerColor};font-size:10px;font-weight:bold;text-transform:uppercase;color:#999999;text-align:right;">Amount</td>
            </tr>
            ${itemsRows}
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:8px 28px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #222222;">
            <tr>
              <td style="padding:14px 0;font-size:18px;font-weight:bold;color:#111111;">Total Due</td>
              <td style="padding:14px 0;font-size:20px;font-weight:bold;color:${headerColor};text-align:right;">$${total}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:4px 28px 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">${paymentSection}</td></tr>
        <tr><td style="background-color:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
          <p style="color:#999999;font-size:12px;line-height:1.6;margin:0;">${footerNote}</p>
          <p style="color:#bbbbbb;font-size:11px;margin:10px 0 0;">&mdash; The ${name} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `Invoice from ${name}\n\nHey ${order.customerName || 'there'},\n\n${thankYou}\n\nOrder #${orderNum}\nDate: ${cookDate}\nTotal: $${total}\n\n${paymentUrl ? `${paymentLabel}: ${paymentUrl}` : bankDetails || 'Please arrange payment at your earliest convenience.'}\n\n${footerNote}\n\n— ${name}`;

    await sendEmail(env, settings, order.customerEmail, `Invoice #${orderNum}: $${total} — ${name}`, text, html);
    return json({ success: true });
  } catch (error: any) {
    console.error('Invoice email error:', error);
    return json({ error: error.message }, 500);
  }
};
