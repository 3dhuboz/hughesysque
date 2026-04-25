/**
 * Loyalty crediting — central helper, single source of truth for when and
 * how a customer's catering_spend_cents is bumped by an order.
 *
 * Called from both:
 *   - square-webhook.ts (after auto-flipping an order to Paid via webhook)
 *   - orders/[id].ts PUT (when admin manually moves an order to Paid /
 *     Completed via the OrderManager UI)
 *
 * Self-gating: if the order isn't in Paid/Completed, or has already been
 * credited (loyalty_credited=1), or has no registered customer, this is a
 * no-op. So callers can fire it after every status change without worrying
 * about double-credit or unintended side effects.
 *
 * Catering filter: only line items flagged as catering (item.isCatering ===
 * true OR item.category in {'Catering', 'Catering Packs'}) contribute to
 * catering_spend_cents — a non-catering pickup order does NOT pump up
 * loyalty regardless of total. Mirrors the deposit-vs-full split logic in
 * StorefrontOrder.js (commit b4fc99a).
 *
 * Audit reference: 2026-04-25 audit, Backend Critical #3 + Payments
 * Critical #2.
 */

import { getDB, parseJson } from './db';

export interface LoyaltyResult {
  credited: boolean;
  cateringCents?: number;
  reason?: string;
}

const CATERING_CATEGORIES = new Set(['Catering', 'Catering Packs']);
const PAID_STATUSES = new Set(['Paid', 'Completed']);

export async function creditLoyaltyIfNeeded(env: any, orderId: string): Promise<LoyaltyResult> {
  const db = getDB(env);

  const order: any = await db
    .prepare('SELECT id, customer_email, status, items, loyalty_credited FROM orders WHERE id = ?')
    .bind(orderId)
    .first();

  if (!order) return { credited: false, reason: 'order not found' };
  if (order.loyalty_credited) return { credited: false, reason: 'already credited' };
  if (!PAID_STATUSES.has(order.status)) {
    return { credited: false, reason: `status is ${order.status} (need Paid or Completed)` };
  }

  const email = (order.customer_email || '').toString().trim().toLowerCase();
  if (!email) return { credited: false, reason: 'no customer email' };

  // Customer must already exist (i.e. has signed in via magic link at least
  // once). Guest orders for never-registered emails do not retroactively
  // create a customers row — the audit explicitly noted that as a
  // deliberate design choice.
  const customer: any = await db
    .prepare('SELECT email FROM customers WHERE email = ?')
    .bind(email)
    .first();
  if (!customer) return { credited: false, reason: 'no registered customer' };

  // Sum catering subtotal from the items JSON. Each line is shaped as
  // { item: MenuItem, quantity: number, packSelections?, specialRequests? }.
  const items = parseJson<Array<{ item: any; quantity: number }>>(order.items, []);
  let cateringCents = 0;
  for (const line of items) {
    const it = line?.item || {};
    const isCatering = it.isCatering === true || CATERING_CATEGORIES.has(it.category);
    if (!isCatering) continue;
    const price = Number(it.price) || 0;
    const qty = Number(line?.quantity) || 0;
    cateringCents += Math.round(price * qty * 100);
  }

  // Even if cateringCents is 0 (non-catering paid order), we still set
  // loyalty_credited=1 so we don't keep retrying. Customer still gets
  // total_orders incremented on actual catering credits only — keeps the
  // counter aligned with what the rewards page is summing.
  if (cateringCents === 0) {
    await db.prepare('UPDATE orders SET loyalty_credited = 1 WHERE id = ?').bind(orderId).run();
    return { credited: true, cateringCents: 0, reason: 'no catering items' };
  }

  // Atomic-ish: D1 batch keeps the customer credit and the flag flip
  // together. If the batch errors, neither runs, and we'll retry on the
  // next status change.
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        'UPDATE customers SET catering_spend_cents = catering_spend_cents + ?, total_orders = total_orders + 1, last_order_at = ? WHERE email = ?',
      )
      .bind(cateringCents, now, email),
    db.prepare('UPDATE orders SET loyalty_credited = 1 WHERE id = ?').bind(orderId),
  ]);

  return { credited: true, cateringCents };
}
