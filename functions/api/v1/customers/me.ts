/**
 * Return the current signed-in customer's profile + loyalty progress.
 *
 * Reads the customer session from the Authorization header (Bearer token
 * issued by /auth/customer-magic-link-verify). Used by the storefront to
 * hydrate the AppContext on page load and to render the rewards page.
 *
 * Loyalty math is done here so the storefront doesn't have to know the
 * threshold/percent — it just renders whatever we send. Threshold + percent
 * come from settings.hostRewards (defaults: $1000 / 10%) so the customer-
 * facing banner promise matches the actual eligibility check.
 */

import { getDB, parseJson } from '../_lib/db';
import { readCustomerFromRequest } from '../_lib/customerSession';

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const session = await readCustomerFromRequest(request, env);
    if (!session) return json({ error: 'not signed in' }, 401);

    const db = getDB(env);

    const customer = await db
      .prepare("SELECT email, name, phone, catering_spend_cents, total_orders, last_order_at FROM customers WHERE email = ?")
      .bind(session.sub)
      .first<{
        email: string;
        name: string | null;
        phone: string | null;
        catering_spend_cents: number;
        total_orders: number;
        last_order_at: number | null;
      }>();

    if (!customer) return json({ error: 'customer not found' }, 404);

    const settingsRow = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = settingsRow ? parseJson(settingsRow.data as string, {}) : {};
    const thresholdAmount = Number(settings.hostRewards?.thresholdAmount) > 0 ? Number(settings.hostRewards.thresholdAmount) : 1000;
    const discountPercent = Number(settings.hostRewards?.discountPercent) > 0 ? Number(settings.hostRewards.discountPercent) : 10;

    const cateringSpend = (customer.catering_spend_cents || 0) / 100;
    const eligible = cateringSpend >= thresholdAmount;
    const remainingToThreshold = Math.max(0, thresholdAmount - cateringSpend);

    return json({
      customer: {
        email: customer.email,
        name: customer.name || '',
        phone: customer.phone || '',
        cateringSpend,
        totalOrders: customer.total_orders || 0,
        lastOrderAt: customer.last_order_at || null,
      },
      loyalty: {
        thresholdAmount,
        discountPercent,
        eligible,
        remainingToThreshold,
      },
    });
  } catch (e: any) {
    return json({ error: e.message || 'Failed to load profile' }, 500);
  }
};

/**
 * Update name and/or phone on the current customer's profile.
 * Email is the PK and intentionally not editable here — to change email,
 * sign in with the new one (creates a separate account).
 */
export const onRequestPatch = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const session = await readCustomerFromRequest(request, env);
    if (!session) return json({ error: 'not signed in' }, 401);

    const body = await request.json().catch(() => ({} as any));
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : undefined;
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 30) : undefined;

    const db = getDB(env);

    if (name !== undefined && phone !== undefined) {
      await db.prepare("UPDATE customers SET name = ?, phone = ? WHERE email = ?")
        .bind(name, phone, session.sub).run();
    } else if (name !== undefined) {
      await db.prepare("UPDATE customers SET name = ? WHERE email = ?")
        .bind(name, session.sub).run();
    } else if (phone !== undefined) {
      await db.prepare("UPDATE customers SET phone = ? WHERE email = ?")
        .bind(phone, session.sub).run();
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message || 'Update failed' }, 500);
  }
};
