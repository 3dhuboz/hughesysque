import { sendEmail } from '../_lib/sendEmail';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const { settings, order, businessName } = await request.json();
    const name = businessName || 'Hughesys Que';

    if (!settings || !settings.enabled) return json({ error: 'Email not configured' }, 400);
    if (!order?.customerEmail) return json({ error: 'Customer email required' }, 400);

    const customerName = order.customerName || 'there';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#ea580c;border-radius:12px 12px 0 0;padding:30px 28px;text-align:center;">
          <div style="display:inline-block;width:56px;height:56px;background-color:#fff;border-radius:50%;text-align:center;line-height:56px;font-size:28px;margin-bottom:12px;">&#128293;</div>
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:bold;">Your Order is Being Prepared!</h1>
          <p style="margin:6px 0 0;color:#fff;font-size:13px;opacity:0.9;">${name}</p>
        </td></tr>
        <tr><td style="background-color:#fff;padding:28px;border-left:1px solid #e5e5e5;border-right:1px solid #e5e5e5;">
          <p style="color:#333;font-size:15px;margin:0 0 4px;">Hey <strong>${customerName}</strong>,</p>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 20px;">Great news! The smoker is fired up and your order is now being prepared.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin-bottom:20px;">
            <tr><td style="padding:20px;text-align:center;">
              <p style="margin:0;color:#111;font-size:18px;font-weight:bold;">&#128293; Cooking In Progress</p>
            </td></tr>
          </table>
          <p style="color:#666;font-size:14px;line-height:1.6;margin:0;">We&rsquo;ll send you another notification as soon as your food is ready, including the exact pickup location.</p>
        </td></tr>
        <tr><td style="background-color:#fafafa;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
          <p style="color:#bbb;font-size:11px;margin:10px 0 0;">&mdash; The ${name} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const text = `Hey ${customerName}, your ${name} order is now being prepared! We'll send you another message when it's ready. Hang tight!`;

    await sendEmail(env, settings, order.customerEmail, `Your ${name} order is being prepared! 🔥`, text, html);
    return json({ success: true });
  } catch (error: any) {
    console.error('Cooking started email error:', error);
    return json({ error: error.message }, error.status || 500);
  }
};
