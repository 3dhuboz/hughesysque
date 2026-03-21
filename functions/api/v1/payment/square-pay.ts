export const onRequest = async (context: any) => {
  const { request } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { sourceId, amount, currency, locationId, accessToken, environment } = await request.json();

    if (!sourceId || !amount || !locationId || !accessToken) {
      return json({ error: 'Missing required fields: sourceId, amount, locationId, accessToken' }, 400);
    }

    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const idempotencyKey = `pay_${Date.now()}_${Math.random().toString(36).slice(2)}`.substring(0, 45);

    const payRes = await fetch(`${baseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: Math.round(amount * 100),
          currency: currency || 'AUD',
        },
        location_id: locationId,
      }),
    });

    const data: any = await payRes.json();

    if (!payRes.ok) {
      const errMsg = data.errors?.[0]?.detail || data.errors?.[0]?.code || `Square API error ${payRes.status}`;
      return json({ error: errMsg, errors: data.errors }, payRes.status);
    }

    return json({ success: true, payment: data.payment });
  } catch (error: any) {
    console.error('Square pay error:', error);
    return json({ error: error.message }, 500);
  }
};
