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

      // Loyalty bookkeeping: when an order has a customer email that matches
      // a registered customer, bump their cumulative spend + order count so
      // the rewards page reflects this order on next refresh. Stored as
      // cents to avoid float drift when summing many orders. Failure here
      // shouldn't fail the order — wrap in a try/catch.
      const email = (order.customerEmail || '').toString().trim().toLowerCase();
      if (email) {
        try {
          const existing = await db.prepare("SELECT email FROM customers WHERE email = ?").bind(email).first();
          if (existing) {
            const cents = Math.round(Number(order.total || 0) * 100);
            const now = Date.now();
            await db.prepare(
              "UPDATE customers SET catering_spend_cents = catering_spend_cents + ?, total_orders = total_orders + 1, last_order_at = ? WHERE email = ?"
            ).bind(cents, now, email).run();
          }
          // No auto-creation of customers row from orders — staying intentional.
          // Customers exist only after a deliberate magic-link sign-up so the
          // loyalty pool isn't polluted by guest one-offs.
        } catch (e) {
          console.error('Failed to update customer loyalty spend', e);
        }
      }

      const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
      return json(rowToOrder(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
