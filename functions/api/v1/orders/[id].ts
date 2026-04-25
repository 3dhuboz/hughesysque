import { getDB, rowToOrder } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';
import { creditLoyaltyIfNeeded } from '../_lib/loyalty';

/**
 * Order status state-machine. Forward + permitted-revert legal transitions
 * only — anything else returns 400 unless the caller passes
 * `forceStatus: true` in the body.
 *
 * Revert nuance: this map is deliberately stricter than the UI's
 * PREVIOUS_STATUS map in client/src/pages/admin/OrderManager.tsx. The UI
 * lets Macca undo any forward step (Completed → Ready, Confirmed → Pending,
 * Paid → Pending, etc.) for fat-finger fixes; those non-listed reverts are
 * intentionally illegal here so they require an explicit `forceStatus`
 * acknowledgement from the caller. See PRODUCTION-AUDIT-2026-04-25.md
 * BACKLOG (status-machine guards).
 *
 * Cancelled → Pending IS in the legal map because it's the only undo path
 * the audit explicitly calls out as "revert only" (see PREVIOUS_STATUS).
 */
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  'Pending': ['Confirmed', 'Awaiting Payment', 'Cancelled', 'Rejected'],
  'Awaiting Payment': ['Paid', 'Cancelled', 'Rejected'],
  'Paid': ['Confirmed', 'Cooking', 'Cancelled'],
  'Confirmed': ['Cooking', 'Cancelled'],
  'Cooking': ['Ready', 'Cancelled'],
  'Ready': ['Completed', 'Shipped', 'Cooking'],
  'Shipped': ['Completed', 'Cancelled'],
  'Completed': [],
  'Cancelled': ['Pending'],
  'Rejected': [],
};

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'PUT') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const data = await request.json();

      // Status-machine guard. Look up the current status before applying the
      // UPDATE so we can reject illegal transitions with a 400 + a list of
      // what's allowed. forceStatus: true bypasses the check — Macca needs
      // an out for unusual edge cases like recovering from a stuck webhook
      // or a manual support correction.
      if (data.status !== undefined) {
        const currentRow: any = await db.prepare('SELECT status FROM orders WHERE id = ?').bind(params.id).first();
        if (!currentRow) return json({ error: 'Not found' }, 404);
        if (data.status !== currentRow.status) {
          const from = currentRow.status;
          const to = data.status;
          const allowed = LEGAL_TRANSITIONS[from] ?? [];
          const legal = allowed.includes(to);
          if (!legal && data.forceStatus !== true) {
            return json({ error: `Illegal transition: ${from} -> ${to}`, allowed }, 400);
          }
          if (!legal && data.forceStatus === true) {
            console.warn(`[orders] forceStatus used for ${params.id}: ${from} -> ${to}`);
          }
        }
      }

      const fields: string[] = [];
      const values: any[] = [];
      const map: Record<string, string> = {
        status: 'status', trackingNumber: 'tracking_number', courier: 'courier',
        collectionPin: 'collection_pin', pickupLocation: 'pickup_location',
        squareCheckoutId: 'square_checkout_id', balanceCheckoutId: 'balance_checkout_id',
        paymentIntentId: 'payment_intent_id',
        customerName: 'customer_name', customerEmail: 'customer_email', customerPhone: 'customer_phone',
        pickupTime: 'pickup_time', fulfillmentMethod: 'fulfillment_method',
        deliveryAddress: 'delivery_address', deliveryFee: 'delivery_fee',
        total: 'total', depositAmount: 'deposit_amount', temperature: 'temperature',
      };
      for (const [key, col] of Object.entries(map)) {
        if (data[key] !== undefined) {
          const val = data[key];
          // D1 only accepts primitives — stringify any objects that slip through
          fields.push(`${col} = ?`);
          values.push(val !== null && typeof val === 'object' ? JSON.stringify(val) : val);
        }
      }
      if (data.items !== undefined) { fields.push('items = ?'); values.push(JSON.stringify(data.items)); }
      if (data.discountApplied !== undefined) { fields.push('discount_applied = ?'); values.push(data.discountApplied ? 1 : 0); }
      if (data.cookDay !== undefined) { fields.push('cook_day = ?'); values.push(data.cookDay); }
      if (fields.length === 0) return json({ error: 'No fields to update' }, 400);
      values.push(params.id);
      await db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

      // If admin just moved the order into a paid status, credit catering
      // loyalty (idempotent + self-gating — see _lib/loyalty.ts).
      if (data.status === 'Paid' || data.status === 'Completed') {
        try {
          const result = await creditLoyaltyIfNeeded(env, params.id);
          if (result.credited && result.cateringCents) {
            console.log(`[loyalty] order ${params.id} credited ${result.cateringCents} cents`);
          }
        } catch (e) {
          // Don't fail the status update if loyalty bookkeeping errors —
          // the next status flip will retry (loyalty_credited still 0).
          console.error(`[loyalty] credit attempt failed for order ${params.id}:`, e);
        }
      }

      const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
      if (!row) return json({ error: 'Not found' }, 404);
      return json(rowToOrder(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
