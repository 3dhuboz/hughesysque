/**
 * Square Checkout — creates a payment link.
 * POST /api/v1/payment/square-checkout
 * Reads Square credentials from D1 settings.
 */
import { getDB, parseJson } from '../_lib/db';

async function getSquareSettings(env: any) {
  const db = getDB(env);
  const row: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
  const s = row ? parseJson(row.data, {}) : {};
  if (!s.squareAccessToken || !s.squareLocationId) {
    throw { status: 400, message: 'Square not configured — set access token and location ID in Admin > Settings' };
  }
  return {
    accessToken: s.squareAccessToken,
    locationId: s.squareLocationId,
    applicationId: s.squareApplicationId || '',
    environment: s.squareAccessToken.startsWith('EAAA') ? 'production' : 'sandbox',
  };
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const sq = await getSquareSettings(env);
    const { amount, currency, orderId, description, redirectUrl, items } = await request.json();

    if (!amount) return json({ error: 'Missing required field: amount' }, 400);

    const baseUrl = sq.environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const cur = currency || 'AUD';
    const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2)}`.substring(0, 45);

    let requestBody: any;
    let usedQuickPay = false;

    if (items && Array.isArray(items) && items.length > 0) {
      const lineItems = items.map((item: any) => {
        const itemName = (item.name || 'Item').substring(0, 512);
        const qty = String(Math.max(1, Number(item.quantity) || 1));
        const unitPrice = Math.round(Number(item.price || 0) * 100);
        const note = item.selectedOption ? `Option: ${item.selectedOption}` : undefined;
        return {
          name: itemName,
          quantity: qty,
          base_price_money: { amount: unitPrice, currency: cur },
          ...(note ? { note } : {}),
        };
      }).filter((li: any) => li.base_price_money.amount > 0);

      if (lineItems.length > 0) {
        const refId = orderId ? orderId.substring(0, 40) : undefined;
        requestBody = {
          idempotency_key: idempotencyKey,
          order: {
            location_id: sq.locationId,
            ...(refId ? { reference_id: refId } : {}),
            line_items: lineItems,
          },
          checkout_options: {
            allow_tipping: false,
            redirect_url: redirectUrl || undefined,
            ask_for_shipping_address: false,
          },
        };
      }
    }

    if (!requestBody) {
      usedQuickPay = true;
      requestBody = {
        idempotency_key: idempotencyKey,
        quick_pay: {
          name: description || `Order #${(orderId || '').slice(-6)}`,
          price_money: { amount: Math.round(amount * 100), currency: cur },
          location_id: sq.locationId,
        },
        checkout_options: {
          allow_tipping: false,
          redirect_url: redirectUrl || undefined,
          ask_for_shipping_address: false,
        },
      };
    }

    const checkoutRes = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${sq.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data: any = await checkoutRes.json();

    if (!checkoutRes.ok) {
      const errMsg = data.errors?.[0]?.detail || data.errors?.[0]?.code || `Square API error ${checkoutRes.status}`;
      console.error('Square checkout error:', JSON.stringify(data.errors));
      return json({ error: errMsg, errors: data.errors }, checkoutRes.status);
    }

    return json({
      success: true,
      url: data.payment_link?.url,
      longUrl: data.payment_link?.long_url,
      id: data.payment_link?.id,
      squareOrderId: data.related_resources?.orders?.[0],
      usedQuickPay,
    });
  } catch (error: any) {
    const status = error.status || 500;
    console.error('Square checkout link error:', error);
    return json({ error: error.message }, status);
  }
};
