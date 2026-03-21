import { sendEmail } from '../_lib/sendEmail';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = env.EMAIL_API_SECRET;
  if (secret && request.headers.get('x-api-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  try {
    const { settings, order, location, businessName } = await request.json();
    const name = businessName || 'Hughesys Que';

    if (!settings || !settings.enabled) return json({ error: 'Email settings not configured or disabled' }, 400);
    if (!order.customerEmail) return json({ error: 'No customer email on this order' }, 400);

    const mapLink = `https://maps.google.com/?q=${encodeURIComponent(location || 'Ipswich QLD')}`;

    const pinSection = order.collectionPin ? `
        <tr><td style="background-color:#ffffff;padding:0 28px 20px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border:1px solid #eeeeee;border-radius:8px;">
            <tr><td style="padding:16px;text-align:center;">
              <p style="margin:0 0 4px;color:#888888;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">Your Collection PIN</p>
              <p style="margin:0;font-size:36px;font-weight:bold;color:#111111;letter-spacing:8px;font-family:monospace;">${order.collectionPin}</p>
            </td></tr>
          </table>
        </td></tr>` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#16a34a;border-radius:12px 12px 0 0;padding:30px 28px;text-align:center;">
          <div style="display:inline-block;width:56px;height:56px;background-color:#ffffff;border-radius:50%;text-align:center;line-height:56px;font-size:28px;margin-bottom:12px;">&#127860;</div>
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">Your Food is READY!</h1>
          <p style="margin:6px 0 0;color:#ffffff;font-size:13px;opacity:0.9;">${name}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px 28px 20px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="color:#333333;font-size:15px;margin:0 0 4px;">Hey <strong>${order.customerName}</strong>,</p>
          <p style="color:#666666;font-size:14px;line-height:1.6;margin:0;">Your order is ready for collection! Head to the pickup location below.</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 28px 20px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
            <tr><td style="padding:16px;text-align:center;">
              <p style="margin:0 0 6px;color:#166534;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">Pickup Location</p>
              <p style="margin:0;color:#111111;font-size:18px;font-weight:bold;">${location || 'See map below'}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 28px 20px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;text-align:center;">
          <a href="${mapLink}" target="_blank" style="display:inline-block;background-color:#d9381e;color:#ffffff;font-weight:bold;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:16px;">&#128205;&nbsp; Open Map Directions</a>
        </td></tr>
        ${pinSection}
        <tr><td style="background-color:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
          <p style="color:#bbbbbb;font-size:11px;margin:10px 0 0;">&mdash; The ${name} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `Your ${name} order is READY!\n\nHey ${order.customerName}, pickup at: ${location}\nMap: ${mapLink}${order.collectionPin ? `\nCollection PIN: ${order.collectionPin}` : ''}\n\n— ${name}`;

    await sendEmail(env, settings, order.customerEmail, `Your ${name} order is READY! &#127860;`, text, html);
    return json({ success: true, provider: env.AWS_SES_ACCESS_KEY_ID ? 'ses' : 'smtp' });
  } catch (error: any) {
    console.error('Order ready email error:', error);
    return json({ error: error.message }, 500);
  }
};
