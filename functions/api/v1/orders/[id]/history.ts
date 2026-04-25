/**
 * Order edit-history viewer (admin-only).
 *
 * GET /api/v1/orders/:id/history — returns rows from order_history for the
 * given order, newest first, capped at 200. Used by the admin order detail
 * UI to show "who changed what, when" for an order.
 *
 * The `field` column holds the camelCase API field name (e.g. customerName,
 * trackingNumber, status) — same name the admin sees in the rest of the UI,
 * so no snake_case decoder is needed.
 *
 * Audit reference: 2026-04-25 audit BACKLOG — order-edit audit trail.
 */

import { getDB } from '../../_lib/db';
import { verifyAuth, requireAuth } from '../../_lib/auth';

export const onRequestGet = async (context: any) => {
  const { request, env, params } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    requireAuth(await verifyAuth(request, env), 'ADMIN');
    const db = getDB(env);

    const { results } = await db
      .prepare(
        'SELECT id, order_id, actor_email, field, old_value, new_value, changed_at FROM order_history WHERE order_id = ? ORDER BY changed_at DESC LIMIT 200'
      )
      .bind(params.id)
      .all();

    const history = (results ?? []).map((r: any) => ({
      id: r.id,
      orderId: r.order_id,
      actorEmail: r.actor_email,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      changedAt: r.changed_at,
    }));

    return json({ history });
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
