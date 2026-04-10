/**
 * Square Webhook handler for Cloudflare Pages Functions.
 * Uses D1 for order lookup/update (replaces old Firestore version).
 * HMAC signature verification via Web Crypto API.
 */
import { getDB, parseJson, rowToOrder } from '../_lib/db';

async function verifySignature(rawBody: string, signature: string, signatureKey: string, notificationUrl: string): Promise<boolean> {
  const combined = notificationUrl + rawBody;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(signatureKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(combined));
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return sigBase64 === signature;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody);

    // Verify HMAC signature if key is configured
    const signature = request.headers.get('x-square-hmacsha256-signature');
    const webhookSignatureKey = env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (webhookSignatureKey) {
      if (!signature) {
        return json({ error: 'Missing signature' }, 401);
      }
      const host = new URL(request.url).host;
      const notificationUrl = env.SQUARE_WEBHOOK_URL || `https://${host}/api/v1/payment/square-webhook`;
      const valid = await verifySignature(rawBody, signature, webhookSignatureKey, notificationUrl);
      if (!valid) {
        console.error('[Square Webhook] Signature verification failed');
        return json({ error: 'Invalid signature' }, 403);
      }
    }

    const eventType = event.type;
    console.log(`[Square Webhook] Received event: ${eventType}`);

    if (eventType !== 'payment.completed' && eventType !== 'payment.updated') {
      return json({ received: true });
    }

    const payment = event.data?.object?.payment;
    if (!payment || payment.status !== 'COMPLETED') return json({ received: true });

    const squareOrderId = payment.order_id;
    console.log(`[Square Webhook] Payment COMPLETED for Square order: ${squareOrderId}`);

    // Look up order in D1
    const db = getDB(env);
    const orderRow = await db.prepare(
      'SELECT * FROM orders WHERE square_checkout_id = ? LIMIT 1'
    ).bind(squareOrderId).first();

    if (!orderRow) {
      console.warn(`[Square Webhook] No matching order for square_checkout_id: ${squareOrderId}`);
      return json({ received: true, matched: false });
    }

    const order = rowToOrder(orderRow);

    if (order.status !== 'Awaiting Payment') {
      console.log(`[Square Webhook] Order ${order.id} status is '${order.status}', skipping.`);
      return json({ received: true, matched: true, skipped: true });
    }

    // Update order to Paid
    await db.prepare(
      'UPDATE orders SET status = ?, payment_intent_id = ? WHERE id = ?'
    ).bind('Paid', payment.id, order.id).run();
    console.log(`[Square Webhook] Order ${order.id} updated to 'Paid'`);

    // Load settings for email/SMS confirmations
    const settingsRow: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = settingsRow ? parseJson(settingsRow.data, {}) : {};

    const baseUrl = `https://${new URL(request.url).host}`;
    const confirmResults: string[] = [];
    const amountPaid = ((payment.amount_money?.amount || 0) / 100).toFixed(2);

    // Send email confirmation
    if (order.customerEmail && settings.emailSettings?.enabled) {
      try {
        const emailRes = await fetch(`${baseUrl}/api/v1/email/payment-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: settings.emailSettings,
            order: { ...order, status: 'Paid' },
            businessName: settings.businessName || 'Hughesys Que',
            invoiceSettings: settings.invoiceSettings || {},
            amountPaid,
          }),
        });
        if (emailRes.ok) confirmResults.push('email');
        else console.warn('[Square Webhook] Confirmation email failed:', await emailRes.text());
      } catch (e) { console.warn('[Square Webhook] Confirmation email error:', e); }
    }

    // Send SMS confirmation
    if (order.customerPhone && settings.smsSettings?.enabled) {
      try {
        const smsRes = await fetch(`${baseUrl}/api/v1/sms/payment-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: settings.smsSettings,
            order: { ...order, status: 'Paid' },
            businessName: settings.businessName || 'Hughesys Que',
            amountPaid,
          }),
        });
        if (smsRes.ok) confirmResults.push('sms');
        else console.warn('[Square Webhook] Confirmation SMS failed:', await smsRes.text());
      } catch (e) { console.warn('[Square Webhook] Confirmation SMS error:', e); }
    }

    return json({ received: true, matched: true, orderId: order.id, status: 'Paid', confirmations: confirmResults });
  } catch (error: any) {
    console.error('[Square Webhook] Error:', error);
    return json({ error: error.message }, 500);
  }
};
