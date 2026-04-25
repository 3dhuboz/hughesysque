/**
 * Customer magic-link verify — step 2 of customer sign-in.
 *
 * Accept a token, look it up in magic_links, check it's not expired or
 * consumed, mark it consumed, ensure a customers row exists for the email
 * (creating one if first sign-in), mint a 30-day customer session token,
 * and return it along with the customer profile.
 *
 * One-shot: each token can only be exchanged once. Subsequent calls 404.
 *
 * First-time sign-in backfill: when we create a brand-new `customers` row,
 * scan paid/completed orders that were placed as a guest under this email
 * and seed `catering_spend_cents` + `total_orders` from any catering items
 * found. Backfilled orders are flagged `loyalty_credited = 1` so the next
 * status change won't double-credit them. Backfill failure must NOT fail
 * the sign-in — it's a best-effort enrichment. Audit ref:
 * 2026-04-25 BACKLOG: pre-registration order backfill on customer signup.
 */

import { getDB, parseJson } from '../_lib/db';
import { issueCustomerSession } from '../_lib/customerSession';

// Mirror the catering filter from _lib/loyalty.ts so the same items count.
// Status filter is inlined in the SQL IN ('Paid','Completed') below.
const CATERING_CATEGORIES = new Set(['Catering', 'Catering Packs']);

async function backfillPreRegistrationOrders(env: any, email: string): Promise<void> {
  const db = getDB(env);
  // Pull every Paid/Completed order whose email matches this customer and
  // that hasn't already been credited (loyalty_credited = 0). LOWER() the
  // join column because customer_email might have been stored mixed-case
  // for older guest orders.
  const rows = await db
    .prepare(
      "SELECT id, items FROM orders WHERE LOWER(customer_email) = ? AND status IN ('Paid','Completed') AND (loyalty_credited IS NULL OR loyalty_credited = 0)"
    )
    .bind(email)
    .all<{ id: string; items: string }>();

  const orders = rows?.results || [];
  if (orders.length === 0) return;

  let totalCateringCents = 0;
  let cateringOrderCount = 0;
  const orderIdsToFlag: string[] = [];

  for (const order of orders) {
    const items = parseJson<Array<{ item: any; quantity: number }>>(order.items, []);
    let cents = 0;
    for (const line of items) {
      const it = line?.item || {};
      const isCatering = it.isCatering === true || CATERING_CATEGORIES.has(it.category);
      if (!isCatering) continue;
      const price = Number(it.price) || 0;
      const qty = Number(line?.quantity) || 0;
      cents += Math.round(price * qty * 100);
    }
    if (cents > 0) {
      totalCateringCents += cents;
      cateringOrderCount += 1;
    }
    // Flag every matched order, even ones with zero catering cents — they're
    // still "credited" in the sense that we never need to revisit them. Mirrors
    // the no-catering branch in creditLoyaltyIfNeeded().
    orderIdsToFlag.push(order.id);
  }

  if (orderIdsToFlag.length === 0) return;

  const now = Date.now();
  const updates = orderIdsToFlag.map((id) =>
    db.prepare('UPDATE orders SET loyalty_credited = 1 WHERE id = ?').bind(id),
  );
  if (totalCateringCents > 0 || cateringOrderCount > 0) {
    updates.push(
      db
        .prepare(
          'UPDATE customers SET catering_spend_cents = catering_spend_cents + ?, total_orders = total_orders + ?, last_order_at = ? WHERE email = ?',
        )
        .bind(totalCateringCents, cateringOrderCount, now, email),
    );
  }
  await db.batch(updates);
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    const token = (body?.token || '').toString().trim();
    if (!token) return json({ error: 'token required' }, 400);

    const db = getDB(env);

    const link = await db
      .prepare("SELECT email, expires_at, consumed_at FROM magic_links WHERE token = ?")
      .bind(token)
      .first<{ email: string; expires_at: number; consumed_at: number | null }>();

    if (!link) return json({ error: 'invalid or expired link' }, 400);
    if (link.consumed_at) return json({ error: 'this link has already been used' }, 400);
    if (Date.now() > link.expires_at) return json({ error: 'this link has expired — request a new one' }, 400);

    // Mark the token consumed BEFORE doing anything else, so a flapping
    // request can't double-spend. We don't roll back on later failure;
    // the customer can request a new link if anything below errors.
    await db
      .prepare("UPDATE magic_links SET consumed_at = ? WHERE token = ?")
      .bind(Date.now(), token)
      .run();

    const email = link.email.toLowerCase();
    const now = Date.now();

    // Ensure customers row exists. First-time sign-in => create it.
    const existing = await db
      .prepare("SELECT email, name, phone, catering_spend_cents, total_orders, last_order_at FROM customers WHERE email = ?")
      .bind(email)
      .first<{
        email: string;
        name: string | null;
        phone: string | null;
        catering_spend_cents: number;
        total_orders: number;
        last_order_at: number | null;
      }>();

    if (!existing) {
      await db
        .prepare("INSERT INTO customers (email, created_at, email_verified_at) VALUES (?, ?, ?)")
        .bind(email, now, now)
        .run();
      // Best-effort backfill of any pre-existing paid catering orders for
      // this email (placed as a guest before the account was created).
      // Logged + swallowed — sign-in must succeed even if this errors.
      try {
        await backfillPreRegistrationOrders(env, email);
      } catch (err: any) {
        console.error('[magic-link-verify] backfill failed for', email, err?.message || err);
      }
    } else {
      // Touch email_verified_at on every successful magic-link click so we
      // can tell when an account is dormant vs actively used.
      await db
        .prepare("UPDATE customers SET email_verified_at = ? WHERE email = ?")
        .bind(now, email)
        .run();
    }

    const sessionToken = await issueCustomerSession(env, email);

    // Re-read for first-time sign-in so the response reflects any backfilled
    // catering_spend_cents / total_orders. Cheap query, only runs when there
    // was no `existing` row at the start of this handler.
    let profile = existing;
    if (!existing) {
      profile = await db
        .prepare("SELECT email, name, phone, catering_spend_cents, total_orders, last_order_at FROM customers WHERE email = ?")
        .bind(email)
        .first<{
          email: string;
          name: string | null;
          phone: string | null;
          catering_spend_cents: number;
          total_orders: number;
          last_order_at: number | null;
        }>();
    }

    return json({
      success: true,
      token: sessionToken,
      customer: {
        email,
        name: profile?.name || '',
        phone: profile?.phone || '',
        cateringSpendCents: profile?.catering_spend_cents || 0,
        totalOrders: profile?.total_orders || 0,
        lastOrderAt: profile?.last_order_at || null,
      },
    });
  } catch (e: any) {
    return json({ error: e.message || 'Verification failed' }, 500);
  }
};
