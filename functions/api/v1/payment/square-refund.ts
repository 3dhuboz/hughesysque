/**
 * Square refund — cancels an order and refunds the customer's payment.
 *
 * POST /api/v1/payment/square-refund
 * Body: { orderId: string, reason?: string }
 *
 * Admin-only. Looks up the order, calls Square's /v2/refunds API to refund
 * the original payment (payment_intent_id, captured by the webhook on
 * payment.completed), sets order status to 'Cancelled', and reverses any
 * catering loyalty credit that was applied.
 *
 * If the order has no real Square payment id (storefront placeholder, or
 * never paid), the endpoint still marks it Cancelled but skips the Square
 * call and returns refunded:false — Macca can still close out an order
 * customer never paid.
 *
 * Audit reference: 2026-04-25 audit, Payments High #8 (refund flow).
 */

import { getDB, parseJson, rowToOrder } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';
import { fetchWithTimeout } from '../_lib/fetchWithTimeout';

const CATERING_CATEGORIES = new Set(['Catering', 'Catering Packs']);
const NON_REFUNDABLE_PAYMENT_IDS = new Set(['', 'pending_invoice', 'generic_placeholder']);

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const body = await request.json().catch(() => null);
    const orderId = body?.orderId;
    const reason = (body?.reason || 'Order cancelled').toString().slice(0, 200);
    if (!orderId || typeof orderId !== 'string') return json({ error: 'orderId required' }, 400);

    const db = getDB(env);
    const orderRow: any = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!orderRow) return json({ error: 'order not found' }, 404);

    const order = rowToOrder(orderRow);
    const paymentId = (order.paymentIntentId || '').toString();

    // No real payment to refund — just mark cancelled and reverse loyalty.
    if (!paymentId || NON_REFUNDABLE_PAYMENT_IDS.has(paymentId) || paymentId.startsWith('pending_')) {
      await reverseLoyaltyIfCredited(env, orderId, order);
      await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('Cancelled', orderId).run();
      return json({ success: true, refunded: false, status: 'Cancelled', reason: 'no Square payment to refund' });
    }

    // Pull Square creds from settings (matches square-checkout.ts pattern).
    const settingsRow: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = settingsRow ? parseJson(settingsRow.data, {}) : {};
    const accessToken = settings.squareAccessToken;
    if (!accessToken) return json({ error: 'Square not configured — set access token in Admin > Settings' }, 400);

    const baseUrl = accessToken.startsWith('EAAA')
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    const idempotencyKey = `refund_${orderId}_${Date.now()}`.substring(0, 45);

    const refundRes = await fetchWithTimeout(`${baseUrl}/v2/refunds`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        payment_id: paymentId,
        reason,
      }),
      // Refunds are non-idempotent without Square's idempotency_key match —
      // rely on Square's handling, don't retry on 5xx.
      retryOn5xx: false,
    });

    const data: any = await refundRes.json().catch(() => ({}));
    if (!refundRes.ok) {
      const errMsg = data.errors?.[0]?.detail || data.errors?.[0]?.code || `Square refund error ${refundRes.status}`;
      console.error('[square-refund] Square API error:', JSON.stringify(data.errors));
      return json({ error: errMsg, errors: data.errors }, refundRes.status);
    }

    // Square accepted the refund. Update order + reverse loyalty.
    await reverseLoyaltyIfCredited(env, orderId, order);
    await db.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('Cancelled', orderId).run();

    return json({
      success: true,
      refunded: true,
      status: 'Cancelled',
      refundId: data.refund?.id,
      refundStatus: data.refund?.status,
    });
  } catch (e: any) {
    console.error('Square refund error:', e);
    return json({ error: e.message || 'Refund failed' }, e.status || 500);
  }
};

/**
 * If the order's catering loyalty was previously credited (loyalty_credited=1),
 * compute the catering subtotal that was credited and decrement the customer's
 * catering_spend_cents + total_orders. Resets loyalty_credited to 0 so the
 * order is no longer counted as credited. Floors at 0 to defend against drift
 * from manual edits.
 */
async function reverseLoyaltyIfCredited(env: any, orderId: string, order: any): Promise<void> {
  const db = getDB(env);
  const row: any = await db
    .prepare('SELECT loyalty_credited FROM orders WHERE id = ?')
    .bind(orderId)
    .first();
  if (!row?.loyalty_credited) return;

  const email = (order.customerEmail || '').toString().trim().toLowerCase();
  if (!email) {
    await db.prepare('UPDATE orders SET loyalty_credited = 0 WHERE id = ?').bind(orderId).run();
    return;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  let cateringCents = 0;
  for (const line of items) {
    const it = line?.item || {};
    const isCatering = it.isCatering === true || CATERING_CATEGORIES.has(it.category);
    if (!isCatering) continue;
    const price = Number(it.price) || 0;
    const qty = Number(line?.quantity) || 0;
    cateringCents += Math.round(price * qty * 100);
  }

  if (cateringCents > 0) {
    await db.batch([
      db
        .prepare(
          'UPDATE customers SET catering_spend_cents = MAX(0, catering_spend_cents - ?), total_orders = MAX(0, total_orders - 1) WHERE email = ?',
        )
        .bind(cateringCents, email),
      db.prepare('UPDATE orders SET loyalty_credited = 0 WHERE id = ?').bind(orderId),
    ]);
  } else {
    await db.prepare('UPDATE orders SET loyalty_credited = 0 WHERE id = ?').bind(orderId).run();
  }
}
