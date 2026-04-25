import { sendEmail } from '../_lib/sendEmail';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const { settings, order } = await request.json();

    if (!settings || !settings.enabled) return json({ error: 'Email settings not configured or disabled' }, 400);

    // Each line is { item: {name, price}, quantity, packSelections? }
    // packSelections is the meat/side picks a customer made on a catering
    // package. The kitchen needs to see them, so we render each group
    // (Meats / Sides / etc) with counts so '2x Brisket' shows as '2× Brisket'.
    const renderPackSelections = (packSelections: any) => {
      if (!packSelections || typeof packSelections !== 'object') return '';
      const entries = Object.entries(packSelections)
        .map(([group, picks]: [string, any]) => {
          if (!Array.isArray(picks) || picks.length === 0) return '';
          const counts: Record<string, number> = {};
          picks.forEach((p: string) => { counts[p] = (counts[p] || 0) + 1; });
          const summary = Object.entries(counts).map(([n, c]) => c > 1 ? `${c}× ${n}` : n).join(', ');
          return `<div style="margin-top:4px;font-size:13px;"><strong style="color:#eab308;">${group}:</strong> <span style="color:#ddd;">${summary}</span></div>`;
        })
        .filter(Boolean)
        .join('');
      return entries ? `<div style="background:#0a0a0a;border:1px solid #333;border-radius:6px;padding:8px 12px;margin:6px 0 8px;">${entries}</div>` : '';
    };

    // Customer's free-text "no onion / no pickles / sauce on side" note,
    // captured on the storefront and surfaced to the kitchen here.
    const renderSpecialRequests = (line: any) => {
      const note = (line.specialRequests || line.item?.specialRequests || '').toString().trim();
      if (!note) return '';
      const safe = note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div style="background:#3a2a05;border-left:3px solid #fbbf24;padding:8px 12px;margin:6px 0 8px;border-radius:0 6px 6px 0;"><strong style="color:#fbbf24;">⚠ Special request:</strong> <span style="color:#fef3c7;">${safe}</span></div>`;
    };

    const itemsList = order.items.map((line: any) => {
      const it = line.item || line;
      const name = it.name || 'Item';
      const price = typeof it.price === 'number' ? it.price : 0;
      const qty = line.quantity || 1;
      return `<li style="margin-bottom:10px;">${qty}x ${name} - $${(price * qty).toFixed(2)}${renderPackSelections(line.packSelections)}${renderSpecialRequests(line)}</li>`;
    }).join('');

    const cookDate = new Date(order.cookDay).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const adminHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1a;color:#fff;border-radius:12px;overflow:hidden;">
        <div style="background:#d9381e;padding:20px;text-align:center;">
          <h1 style="margin:0;color:#fff;">🔥 New Order Received!</h1>
        </div>
        <div style="padding:24px;">
          <p><strong>Order ID:</strong> #${order.id?.slice(-6) || order.id}</p>
          <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
          <p><strong>Cook Day:</strong> ${cookDate} at ${order.pickupTime}</p>
          <p><strong>Type:</strong> ${order.type}</p>
          <h3 style="color:#eab308;">Items:</h3>
          <ul>${itemsList}</ul>
          <hr style="border-color:#333;"/>
          <p style="font-size:18px;"><strong>Total:</strong> $${order.total.toFixed(2)}</p>
          <p><strong>Deposit:</strong> $${(order.depositAmount || 0).toFixed(2)}</p>
        </div>
      </div>`;

    await sendEmail(env, settings, settings.adminEmail,
      `New Order: ${order.customerName} - $${order.total.toFixed(2)}`,
      `New Order from ${order.customerName} for $${order.total.toFixed(2)}`,
      adminHtml
    );

    if (order.customerEmail) {
      const customerHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#1a1a1a;color:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:#d9381e;padding:20px;text-align:center;">
            <h1 style="margin:0;color:#fff;">🔥 Order Confirmed!</h1>
            <p style="margin:4px 0 0;color:#ffdddd;">Hughesys Que</p>
          </div>
          <div style="padding:24px;">
            <p>Hey <strong>${order.customerName}</strong>,</p>
            <p>Thanks for your order! Here's your summary:</p>
            <div style="background:#222;padding:16px;border-radius:8px;margin:16px 0;">
              <h3 style="color:#eab308;margin-top:0;">Your Order</h3>
              <ul style="padding-left:20px;">${itemsList}</ul>
              <hr style="border-color:#333;"/>
              <p style="font-size:18px;margin-bottom:0;"><strong>Total: $${order.total.toFixed(2)}</strong></p>
            </div>
            <div style="background:#222;padding:16px;border-radius:8px;margin:16px 0;">
              <p style="margin:0;"><strong>📅 Cook Day:</strong> ${cookDate}</p>
              <p style="margin:8px 0 0;"><strong>⏰ Pickup Time:</strong> ${order.pickupTime}</p>
            </div>
            <p style="color:#aaa;font-size:13px;">We'll SMS you when your food is ready with the exact pickup location.</p>
          </div>
        </div>`;

      await sendEmail(env, settings, order.customerEmail,
        `Your Hughesys Que Order is Confirmed! 🔥`,
        `Thanks for your order ${order.customerName}! Total: $${order.total.toFixed(2)}. Cook Day: ${cookDate} at ${order.pickupTime}.`,
        customerHtml
      );
    }

    return json({ success: true, provider: env.AWS_SES_ACCESS_KEY_ID ? 'ses' : 'smtp' });
  } catch (error: any) {
    console.error('Order email error:', error);
    return json({ error: error.message }, error.status || 500);
  }
};
