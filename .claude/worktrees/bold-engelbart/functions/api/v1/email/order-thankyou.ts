import { sendEmail } from '../_lib/sendEmail';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = env.EMAIL_API_SECRET;
  if (secret && request.headers.get('x-api-secret') !== secret) return json({ error: 'Unauthorized' }, 401);

  try {
    const { settings, order, businessName, appUrl } = await request.json();
    const name = businessName || 'Hughesys Que';
    const url = appUrl || '';

    if (!settings || !settings.enabled) return json({ error: 'Email settings not configured or disabled' }, 400);
    if (!order?.customerEmail) return json({ error: 'Customer email required' }, 400);

    const orderNum = order.id?.slice(-6) || order.id || '000000';
    const customerName = order.customerName || 'there';

    const appButton = url ? `<tr><td align="center" style="padding:20px 0 0;">
      <a href="${url}" target="_blank" style="display:inline-block;background-color:#d9381e;color:#ffffff;font-weight:bold;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:16px;">Open ${name} App</a>
    </td></tr>` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#d9381e;border-radius:12px 12px 0 0;padding:30px 28px;text-align:center;">
          <div style="display:inline-block;width:56px;height:56px;background-color:#ffffff;border-radius:50%;text-align:center;line-height:56px;font-size:28px;margin-bottom:12px;">&#10084;</div>
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;">Thanks for Your Order!</h1>
          <p style="margin:6px 0 0;color:#ffffff;font-size:13px;opacity:0.9;">${name}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="color:#333333;font-size:15px;margin:0 0 4px;">Hey <strong>${customerName}</strong>,</p>
          <p style="color:#666666;font-size:14px;line-height:1.6;margin:0 0 20px;">We hope you enjoyed your meal! Thanks so much for choosing ${name} &mdash; it means the world to us.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef9f0;border:1px solid #fde68a;border-radius:8px;margin-bottom:20px;">
            <tr><td style="padding:20px;text-align:center;">
              <p style="margin:0;color:#111111;font-size:16px;font-weight:bold;">Order #${orderNum} &mdash; Complete &#10003;</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 28px 28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="color:#333;font-size:15px;font-weight:bold;margin:0 0 12px;">Did you know our app can do all this?</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><p style="margin:0;color:#333;font-size:13px;font-weight:bold;">&#127830; Browse &amp; Order Online</p></td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><p style="margin:0;color:#333;font-size:13px;font-weight:bold;">&#128179; Easy Online Payments</p></td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><p style="margin:0;color:#333;font-size:13px;font-weight:bold;">&#128230; Real-Time Tracking</p></td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><p style="margin:0;color:#333;font-size:13px;font-weight:bold;">&#127881; Events &amp; Pop-Ups</p></td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;"><p style="margin:0;color:#333;font-size:13px;font-weight:bold;">&#11088; Rewards &amp; Loyalty</p></td></tr>
            <tr><td style="padding:8px 0;"><p style="margin:0;color:#333;font-size:13px;font-weight:bold;">&#129382; DIY Catering Builder</p></td></tr>
          </table>
          ${appButton}
        </td></tr>
        <tr><td style="background-color:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
          <p style="color:#bbbbbb;font-size:11px;margin:10px 0 0;">&mdash; The ${name} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `Thanks for Your Order! - ${name}\n\nHey ${customerName},\n\nWe hope you enjoyed your meal! Thanks for choosing ${name}.\n\nOrder #${orderNum} is now complete.\n\n${url ? `Open the app: ${url}\n\n` : ''}— ${name}`;

    await sendEmail(env, settings, order.customerEmail, `Thanks for choosing ${name}! ❤️`, text, html);
    return json({ success: true });
  } catch (error: any) {
    console.error('Thank you email error:', error);
    return json({ error: error.message }, 500);
  }
};
