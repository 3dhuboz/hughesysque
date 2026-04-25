import { getDB, generateId, rowToOrder } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

const VALID_TYPES = new Set(['TAKEAWAY', 'CATERING']);
const VALID_STATUSES = new Set([
  'Pending', 'Awaiting Payment', 'Paid', 'Confirmed',
  'Cooking', 'Ready', 'Shipped', 'Completed', 'Cancelled', 'Rejected',
]);
const VALID_TEMPS = new Set(['HOT', 'COLD']);
const VALID_FULFILLMENT = new Set(['PICKUP', 'DELIVERY']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidationError { field: string; message: string; }

/**
 * Hand-rolled validator for order POST body. Returns null on pass, an array
 * of error objects on fail. Intentionally minimal — catches negative totals,
 * empty carts, missing required fields, and obviously wrong enum values.
 * Mirrors the storefront's StorefrontOrder.handlePlaceOrder shape.
 *
 * Audit reference: 2026-04-25 audit, Backend Critical #2.
 */
function validateOrderBody(order: any): ValidationError[] | null {
  const errs: ValidationError[] = [];
  if (!order || typeof order !== 'object') {
    return [{ field: 'body', message: 'request body must be a JSON object' }];
  }
  if (typeof order.customerName !== 'string' || !order.customerName.trim() || order.customerName.length > 200) {
    errs.push({ field: 'customerName', message: 'required string, 1-200 chars' });
  }
  if (order.customerEmail !== undefined && order.customerEmail !== null && order.customerEmail !== '') {
    if (typeof order.customerEmail !== 'string' || !EMAIL_RE.test(order.customerEmail) || order.customerEmail.length > 320) {
      errs.push({ field: 'customerEmail', message: 'must be a valid email (or omit)' });
    }
  }
  if (order.customerPhone !== undefined && order.customerPhone !== null && order.customerPhone !== '') {
    if (typeof order.customerPhone !== 'string' || order.customerPhone.length > 30) {
      errs.push({ field: 'customerPhone', message: 'must be a string up to 30 chars (or omit)' });
    }
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    errs.push({ field: 'items', message: 'required non-empty array' });
  }
  if (typeof order.total !== 'number' || !isFinite(order.total) || order.total < 0 || order.total > 100_000) {
    errs.push({ field: 'total', message: 'required finite number, 0-100000' });
  }
  if (order.depositAmount !== undefined && order.depositAmount !== null) {
    if (typeof order.depositAmount !== 'number' || !isFinite(order.depositAmount) || order.depositAmount < 0) {
      errs.push({ field: 'depositAmount', message: 'must be a non-negative number (or omit)' });
    } else if (typeof order.total === 'number' && order.depositAmount > order.total) {
      errs.push({ field: 'depositAmount', message: 'cannot exceed total' });
    }
  }
  if (typeof order.cookDay !== 'string' || !order.cookDay.trim()) {
    errs.push({ field: 'cookDay', message: 'required ISO date string' });
  }
  if (typeof order.type !== 'string' || !VALID_TYPES.has(order.type)) {
    errs.push({ field: 'type', message: `must be one of ${Array.from(VALID_TYPES).join(', ')}` });
  }
  if (order.status !== undefined && order.status !== null) {
    if (typeof order.status !== 'string' || !VALID_STATUSES.has(order.status)) {
      errs.push({ field: 'status', message: `must be one of ${Array.from(VALID_STATUSES).join(', ')} (or omit)` });
    }
  }
  if (order.temperature !== undefined && order.temperature !== null) {
    if (typeof order.temperature !== 'string' || !VALID_TEMPS.has(order.temperature)) {
      errs.push({ field: 'temperature', message: `must be one of ${Array.from(VALID_TEMPS).join(', ')} (or omit)` });
    }
  }
  if (order.fulfillmentMethod !== undefined && order.fulfillmentMethod !== null) {
    if (typeof order.fulfillmentMethod !== 'string' || !VALID_FULFILLMENT.has(order.fulfillmentMethod)) {
      errs.push({ field: 'fulfillmentMethod', message: `must be one of ${Array.from(VALID_FULFILLMENT).join(', ')} (or omit)` });
    }
  }
  return errs.length ? errs : null;
}

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
      // Public endpoint — guest checkout submits orders here without auth.
      // Validate aggressively to catch garbage / hostile bodies before
      // they're persisted. The audit explicitly flagged the previous
      // free-for-all (negative totals, missing required fields, etc.).
      const order = await request.json().catch(() => null);
      const validationErrors = validateOrderBody(order);
      if (validationErrors) {
        return json({ error: 'Validation failed', errors: validationErrors }, 400);
      }
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
