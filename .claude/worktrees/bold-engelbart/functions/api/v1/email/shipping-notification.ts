import { sendEmail } from '../_lib/sendEmail';

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
    const { settings, order, businessName, invoiceSettings, trackingNumber, courier } = await request.json();

    if (!settings || !settings.enabled) return json({ error: 'Email settings not configured or disabled' }, 400);
    if (!order?.customerEmail) return json({ error: 'Customer email is required' }, 400);

    const inv = invoiceSettings || {};
    const name = businessName || 'Hughesys Que';
    const headerColor = inv.headerColor || '#d9381e';
    const logoUrl = inv.logoUrl || '';
    const footerNote = inv.footerNote || 'Thank you for your business! If you have questions, reply to this email or give us a call.';
    const orderNum = order.id?.slice(-6) || order.id || '000000';
    const total = Number(order.total || 0).toFixed(2);
    const courierName = courier || order.courier || 'Australia Post';
    const tracking = trackingNumber || order.trackingNumber || '';
    const trackingUrl = getTrackingUrl(courierName, tracking);

    const itemsRows = (order.items || []).map((item: any) => {
      const itemName = item.item?.name || item.name || 'Item';
      const itemPrice = Number(item.item?.price || item.price || 0);
      const qty = Number(item.quantity || 1);
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#222222;font-size:14px;">${qty}x ${itemName}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#222222;text-align:right;font-weight:600;font-size:14px;">$${(itemPrice * qty).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="${name}" style="max-height:48px;margin-bottom:8px;" /><br/>` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#7c3aed;border-radius:12px 12px 0 0;padding:30px 28px;text-align:center;">
          ${logoHtml}
          <div style="display:inline-block;width:56px;height:56px;background-color:#ffffff;border-radius:50%;text-align:center;line-height:56px;font-size:28px;margin-bottom:12px;">&#128230;</div>
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">Your Order Has Shipped!</h1>
          <p style="margin:6px 0 0;color:#ffffff;font-size:13px;opacity:0.9;">Order #${orderNum}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px 28px 0;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="color:#333333;font-size:15px;margin:0 0 4px;">Hey <strong>${order.customerName || 'there'}</strong>,</p>
          <p style="color:#666666;font-size:14px;line-height:1.6;margin:0 0 20px;">Your order has been shipped via <strong>${courierName}</strong>. Track your package below.</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="color:#888888;font-size:13px;">Courier</td><td style="color:#333333;text-align:right;font-size:13px;font-weight:bold;">${courierName}</td></tr>
                <tr><td style="color:#888888;font-size:13px;">Tracking #</td><td style="color:#7c3aed;text-align:right;font-size:13px;font-weight:bold;font-family:monospace;">${tracking}</td></tr>
                <tr><td style="color:#888888;font-size:13px;">Est. Delivery</td><td style="color:#333333;text-align:right;font-size:13px;">3-5 Business Days</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:20px 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;text-align:center;">
          <a href="${trackingUrl}" target="_blank" style="display:inline-block;background-color:#7c3aed;color:#ffffff;font-weight:bold;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:16px;">&#128666;&nbsp; Track My Package</a>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:2px solid ${headerColor};font-size:10px;font-weight:bold;text-transform:uppercase;color:#999999;">Item</td>
              <td style="padding:8px 0;border-bottom:2px solid ${headerColor};font-size:10px;font-weight:bold;text-transform:uppercase;color:#999999;text-align:right;">Amount</td>
            </tr>
            ${itemsRows}
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:8px 28px 24px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #222222;">
            <tr>
              <td style="padding:12px 0;font-size:16px;font-weight:bold;color:#111111;">Order Total</td>
              <td style="padding:12px 0;font-size:18px;font-weight:bold;color:${headerColor};text-align:right;">$${total}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
          <p style="color:#999999;font-size:12px;margin:0;">${footerNote}</p>
          <p style="color:#bbbbbb;font-size:11px;margin:10px 0 0;">&mdash; The ${name} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `Your Order Has Shipped! - ${name}\n\nHey ${order.customerName || 'there'},\n\nYour order #${orderNum} shipped via ${courierName}.\nTracking: ${tracking}\nTrack: ${trackingUrl}\n\n— ${name}`;

    await sendEmail(env, settings, order.customerEmail, `Shipped! Track Order #${orderNum} — ${name}`, text, html);
    return json({ success: true });
  } catch (error: any) {
    console.error('Shipping notification email error:', error);
    return json({ error: error.message }, 500);
  }
};
