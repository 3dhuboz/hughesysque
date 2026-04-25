import { getDB, generateId, rowToOrder } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'GET') {
      const auth = await verifyAuth(request, env);
      let results;
      if (auth?.role === 'ADMIN' || auth?.role === 'DEV') {
        ({ results } = await db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all());
      } else if (auth) {
        ({ results } = await db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').bind(auth.userId).all());
      } else {
        return json({ error: 'Unauthorized' }, 401);
      }
      return json(results.map(rowToOrder));
    }

    if (request.method === 'POST') {
      const order = await request.json();
      const id = order.id || generateId();
      await db.prepare(`INSERT INTO orders (id, user_id, customer_name, customer_email, customer_phone, items, total, deposit_amount, status, cook_day, type, pickup_time, created_at, temperature, fulfillment_method, delivery_address, delivery_fee, collection_pin, pickup_location, discount_applied, payment_intent_id, square_checkout_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, order.userId || '', order.customerName, order.customerEmail || null, order.customerPhone || null, JSON.stringify(order.items), order.total, order.depositAmount || null, order.status || 'Pending', order.cookDay, order.type, order.pickupTime || null, order.createdAt || new Date().toISOString(), order.temperature || 'HOT', order.fulfillmentMethod || 'PICKUP', order.deliveryAddress || null, order.deliveryFee || null, order.collectionPin || null, order.pickupLocation || null, order.discountApplied ? 1 : 0, order.paymentIntentId || null, order.squareCheckoutId || null).run();

      // NOTE: Loyalty crediting moved out of order CREATE and into the
      // status-flips-to-Paid path (square-webhook + orders/[id] PUT) via
      // _lib/loyalty.ts. Crediting on create was wrong on three axes:
      //   1. Counted unpaid orders (Pending status credited too)
      //   2. Used order.total instead of catering subtotal — rewarded
      //      non-catering pickup orders against catering thresholds
      //   3. No idempotency — a retried POST could double-credit
      // See: 2026-04-25 audit, Backend Critical #3 + Payments Critical #2.

      const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
      return json(rowToOrder(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
