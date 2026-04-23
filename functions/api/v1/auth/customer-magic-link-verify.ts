/**
 * Customer magic-link verify — step 2 of customer sign-in.
 *
 * Accept a token, look it up in magic_links, check it's not expired or
 * consumed, mark it consumed, ensure a customers row exists for the email
 * (creating one if first sign-in), mint a 30-day customer session token,
 * and return it along with the customer profile.
 *
 * One-shot: each token can only be exchanged once. Subsequent calls 404.
 */

import { getDB } from '../_lib/db';
import { issueCustomerSession } from '../_lib/customerSession';

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
    } else {
      // Touch email_verified_at on every successful magic-link click so we
      // can tell when an account is dormant vs actively used.
      await db
        .prepare("UPDATE customers SET email_verified_at = ? WHERE email = ?")
        .bind(now, email)
        .run();
    }

    const sessionToken = await issueCustomerSession(env, email);

    return json({
      success: true,
      token: sessionToken,
      customer: {
        email,
        name: existing?.name || '',
        phone: existing?.phone || '',
        cateringSpendCents: existing?.catering_spend_cents || 0,
        totalOrders: existing?.total_orders || 0,
        lastOrderAt: existing?.last_order_at || null,
      },
    });
  } catch (e: any) {
    return json({ error: e.message || 'Verification failed' }, 500);
  }
};
