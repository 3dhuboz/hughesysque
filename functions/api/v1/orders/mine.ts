/**
 * Customer-self order listing.
 *
 * GET /api/v1/orders/mine — returns the current signed-in customer's orders
 * keyed on customer_email = session.sub. Used by the rewards page and any
 * future "my orders" view.
 *
 * Returns a trimmed projection of each order — enough to render the list
 * (id, status, totals, cook day, item summary) without leaking admin-only
 * fields like collection_pin, square_checkout_id, balance_checkout_id, or
 * payment_intent_id.
 *
 * Audit reference: 2026-04-25 audit, Backend High #8 + Security Medium
 * (order GET access-control split).
 */

import { getDB, parseJson } from '../_lib/db';
import { readCustomerFromRequest } from '../_lib/customerSession';

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const session = await readCustomerFromRequest(request, env);
    if (!session) return json({ error: 'not signed in' }, 401);

    const db = getDB(env);
    const { results } = await db
      .prepare(
        'SELECT id, customer_name, items, total, deposit_amount, status, cook_day, type, pickup_time, created_at, fulfillment_method, balance_checkout_id, loyalty_credited FROM orders WHERE customer_email = ? ORDER BY created_at DESC LIMIT 50',
      )
      .bind(session.sub)
      .all();

    const orders = results.map((r: any) => ({
      id: r.id,
      customerName: r.customer_name,
      items: parseJson(r.items, []),
      total: r.total,
      depositAmount: r.deposit_amount,
      status: r.status,
      cookDay: r.cook_day,
      type: r.type,
      pickupTime: r.pickup_time,
      createdAt: r.created_at,
      fulfillmentMethod: r.fulfillment_method,
      hasBalanceLink: !!r.balance_checkout_id,
      loyaltyCredited: !!r.loyalty_credited,
    }));

    return json({ orders });
  } catch (e: any) {
    return json({ error: e.message || 'Failed to load orders' }, e.status || 500);
  }
};
