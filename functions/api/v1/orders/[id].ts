import { getDB, rowToOrder } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);

    if (request.method === 'PUT') {
      requireAuth(await verifyAuth(request, env), 'ADMIN');
      const data = await request.json();
      const fields: string[] = [];
      const values: any[] = [];
      const map: Record<string, string> = {
        status: 'status', trackingNumber: 'tracking_number', courier: 'courier',
        collectionPin: 'collection_pin', pickupLocation: 'pickup_location',
        squareCheckoutId: 'square_checkout_id', paymentIntentId: 'payment_intent_id',
        customerName: 'customer_name', customerEmail: 'customer_email', customerPhone: 'customer_phone',
        pickupTime: 'pickup_time', fulfillmentMethod: 'fulfillment_method',
        deliveryAddress: 'delivery_address', deliveryFee: 'delivery_fee',
        total: 'total', depositAmount: 'deposit_amount', temperature: 'temperature',
      };
      for (const [key, col] of Object.entries(map)) {
        if (data[key] !== undefined) { fields.push(`${col} = ?`); values.push(data[key]); }
      }
      if (data.items !== undefined) { fields.push('items = ?'); values.push(JSON.stringify(data.items)); }
      if (data.discountApplied !== undefined) { fields.push('discount_applied = ?'); values.push(data.discountApplied ? 1 : 0); }
      if (fields.length === 0) return json({ error: 'No fields to update' }, 400);
      values.push(params.id);
      await db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
      const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(params.id).first();
      return json(rowToOrder(row));
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
