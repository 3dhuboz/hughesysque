import { getDB, generateId, rowToOrder } from '../_lib/db';
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

/**
 * Field-name map shared by the UPDATE path and the order_history audit
 * trail. Keys are the camelCase API field names; values are the snake_case
 * DB columns. The history table records `field` as the camelCase key —
 * that's what callers/admins see and what shows up in logs, so storing
 * the API name keeps the trail readable without a column-name decoder.
 */
const FIELD_MAP: Record<string, string> = {
  status: 'status', trackingNumber: 'tracking_number', courier: 'courier',
  collectionPin: 'collection_pin', pickupLocation: 'pickup_location',
  squareCheckoutId: 'square_checkout_id', balanceCheckoutId: 'balance_checkout_id',
  paymentIntentId: 'payment_intent_id',
  customerName: 'customer_name', customerEmail: 'customer_email', customerPhone: 'customer_phone',
  pickupTime: 'pickup_time', fulfillmentMethod: 'fulfillment_method',
  deliveryAddress: 'delivery_address', deliveryFee: 'delivery_fee',
  total: 'total', depositAmount: 'deposit_amount', temperature: 'temperature',
};

/** Stringify objects, leave primitives as strings. Used for audit-trail values. */
function stringifyAuditValue(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'PUT') {
      const auth = requireAuth(await verifyAuth(request, env), 'ADMIN');
      const data = await request.json();

      // Pull current row up-front. We need it for two reasons:
      //   1. Status-machine guard — compare current.status vs data.status
      //      before applying the UPDATE.
      //   2. Audit trail — diff old vs new per-field after the UPDATE.
      const currentRow: any = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
      if (!currentRow) return json({ error: 'Not found' }, 404);

      // Status-machine guard. Only enforced when caller is actually changing
      // status (data.status set AND different from current). forceStatus: true
      // bypasses the check — Macca needs an out for unusual edge cases like
      // recovering from a stuck webhook or a manual support correction.
      if (data.status !== undefined && data.status !== currentRow.status) {
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

      const fields: string[] = [];
      const values: any[] = [];
      // Track changed fields for the audit trail. Each entry is the
      // camelCase API field name + its old/new value (already stringified).
      const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

      for (const [key, col] of Object.entries(FIELD_MAP)) {
        if (data[key] !== undefined) {
          const val = data[key];
          // D1 only accepts primitives — stringify any objects that slip through
          const dbVal = val !== null && typeof val === 'object' ? JSON.stringify(val) : val;
          fields.push(`${col} = ?`);
          values.push(dbVal);
          // Audit diff — compare stringified old/new and only record if changed.
          const oldStr = stringifyAuditValue(currentRow[col]);
          const newStr = stringifyAuditValue(val);
          if (oldStr !== newStr) {
            changes.push({ field: key, oldValue: oldStr, newValue: newStr });
          }
        }
      }
      if (data.items !== undefined) {
        const newItems = JSON.stringify(data.items);
        fields.push('items = ?'); values.push(newItems);
        const oldItems = currentRow.items ?? null;
        if (oldItems !== newItems) {
          changes.push({ field: 'items', oldValue: oldItems, newValue: newItems });
        }
      }
      if (data.discountApplied !== undefined) {
        const newVal = data.discountApplied ? 1 : 0;
        fields.push('discount_applied = ?'); values.push(newVal);
        const oldVal = currentRow.discount_applied ?? 0;
        if (oldVal !== newVal) {
          changes.push({ field: 'discountApplied', oldValue: String(!!oldVal), newValue: String(!!newVal) });
        }
      }
      if (data.cookDay !== undefined) {
        fields.push('cook_day = ?'); values.push(data.cookDay);
        const oldVal = currentRow.cook_day ?? null;
        const newVal = data.cookDay ?? null;
        if (oldVal !== newVal) {
          changes.push({ field: 'cookDay', oldValue: oldVal, newValue: newVal });
        }
      }
      if (fields.length === 0) return json({ error: 'No fields to update' }, 400);
      values.push(params.id);
      await db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

      // Audit trail — one row per changed field, batched so the lot rolls
      // back together if any insert fails. History-write failure must NOT
      // fail the original update — Macca's edits take priority over the
      // bookkeeping. Wrapped in try/catch + console.error.
      if (changes.length > 0) {
        try {
          const now = Date.now();
          const stmts = changes.map((c) =>
            db.prepare(
              'INSERT INTO order_history (id, order_id, actor_email, field, old_value, new_value, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(generateId(), params.id, auth.email, c.field, c.oldValue, c.newValue, now)
          );
          await db.batch(stmts);
        } catch (e) {
          console.error(`[order_history] failed to write audit rows for order ${params.id}:`, e);
        }
      }

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
