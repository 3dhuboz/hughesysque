/**
 * Square Webhook handler for Cloudflare Pages Functions.
 * Uses Web Crypto API for HMAC verification (no nodejs_compat needed for this file).
 * Reads raw body text BEFORE parsing to preserve signature integrity.
 */

const FIRESTORE_BASE_TPL = (projectId: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function getAuthToken(env: any): Promise<string> {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || '';
  const email = env.WEBHOOK_USER_EMAIL || '';
  const password = env.WEBHOOK_USER_PASSWORD || '';
  if (!apiKey || !email || !password) {
    throw new Error('Missing FIREBASE_API_KEY, WEBHOOK_USER_EMAIL, or WEBHOOK_USER_PASSWORD env vars');
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) }
  );
  if (!res.ok) { const e: any = await res.json().catch(() => ({})); throw new Error(`Firebase Auth failed: ${e?.error?.message || res.status}`); }
  return (await res.json()).idToken;
}

async function firestoreQuery(projectId: string, collection: string, field: string, value: string, token: string) {
  const base = FIRESTORE_BASE_TPL(projectId);
  const res = await fetch(`${base}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } }, limit: 1 } }),
  });
  if (!res.ok) throw new Error(`Firestore query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function firestoreGet(projectId: string, path: string, token: string) {
  const base = FIRESTORE_BASE_TPL(projectId);
  const res = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Firestore get failed: ${res.status}`);
  return res.json();
}

async function firestoreUpdate(projectId: string, path: string, fields: Record<string, any>, token: string) {
  const base = FIRESTORE_BASE_TPL(projectId);
  const params = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const firestoreFields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'number') firestoreFields[k] = { integerValue: String(v) };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
  }
  const res = await fetch(`${base}/${path}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: firestoreFields }),
  });
  if (!res.ok) throw new Error(`Firestore update failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = v.doubleValue;
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('mapValue' in v) out[k] = decodeFields(v.mapValue.fields || {});
    else if ('arrayValue' in v) out[k] = (v.arrayValue.values || []).map((item: any) => {
      if ('mapValue' in item) return decodeFields(item.mapValue.fields || {});
      if ('stringValue' in item) return item.stringValue;
      if ('integerValue' in item) return Number(item.integerValue);
      return item;
    });
    else if ('nullValue' in v) out[k] = null;
    else out[k] = v;
  }
  return out;
}

async function verifySignature(rawBody: string, signature: string, signatureKey: string, notificationUrl: string): Promise<boolean> {
  const combined = notificationUrl + rawBody;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(signatureKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(combined));
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return sigBase64 === signature;
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const rawBody = await request.text();
    const event = JSON.parse(rawBody);

    const signature = request.headers.get('x-square-hmacsha256-signature');
    const webhookSignatureKey = env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (webhookSignatureKey && signature) {
      const host = new URL(request.url).host;
      const notificationUrl = env.SQUARE_WEBHOOK_URL || `https://${host}/api/v1/payment/square-webhook`;
      const valid = await verifySignature(rawBody, signature, webhookSignatureKey, notificationUrl);
      if (!valid) {
        console.error('[Square Webhook] Signature verification failed');
        return json({ error: 'Invalid signature' }, 403);
      }
    }

    const eventType = event.type;
    console.log(`[Square Webhook] Received event: ${eventType}`);

    if (eventType !== 'payment.completed' && eventType !== 'payment.updated') {
      return json({ received: true });
    }

    const payment = event.data?.object?.payment;
    if (!payment || payment.status !== 'COMPLETED') return json({ received: true });

    const squareOrderId = payment.order_id;
    console.log(`[Square Webhook] Payment COMPLETED for Square order: ${squareOrderId}`);

    const projectId = env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || 'hughesys-que-bbq';
    const token = await getAuthToken(env);

    const queryResults = await firestoreQuery(projectId, 'orders', 'squareCheckoutId', squareOrderId, token);
    const matchedDoc = queryResults?.find((r: any) => r.document);
    if (!matchedDoc?.document) {
      console.warn(`[Square Webhook] No matching order for squareCheckoutId: ${squareOrderId}`);
      return json({ received: true, matched: false });
    }

    const docName = matchedDoc.document.name;
    const orderId = docName.split('/').pop();
    const order = decodeFields(matchedDoc.document.fields || {});

    if (order.status !== 'Awaiting Payment') {
      console.log(`[Square Webhook] Order ${orderId} status is '${order.status}', skipping.`);
      return json({ received: true, matched: true, skipped: true });
    }

    await firestoreUpdate(projectId, `orders/${orderId}`, { status: 'Paid', paymentIntentId: payment.id }, token);
    console.log(`[Square Webhook] Order ${orderId} updated to 'Paid'`);

    const settingsDoc = await firestoreGet(projectId, 'settings/general', token);
    const settings = settingsDoc?.fields ? decodeFields(settingsDoc.fields) : null;

    const baseUrl = `https://${new URL(request.url).host}`;
    const confirmResults: string[] = [];
    const amountPaid = ((payment.amount_money?.amount || 0) / 100).toFixed(2);

    if (order.customerEmail && settings?.emailSettings?.enabled) {
      try {
        const emailRes = await fetch(`${baseUrl}/api/v1/email/payment-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: settings.emailSettings, order: { ...order, id: orderId, status: 'Paid' }, businessName: settings.businessName || 'My Business', invoiceSettings: settings.invoiceSettings || {}, amountPaid }),
        });
        if (emailRes.ok) confirmResults.push('email');
        else console.warn('[Square Webhook] Confirmation email failed:', await emailRes.text());
      } catch (e) { console.warn('[Square Webhook] Confirmation email error:', e); }
    }

    if (order.customerPhone && settings?.smsSettings?.enabled) {
      try {
        const smsRes = await fetch(`${baseUrl}/api/v1/sms/payment-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: settings.smsSettings, order: { ...order, id: orderId, status: 'Paid' }, businessName: settings.businessName || 'My Business', amountPaid }),
        });
        if (smsRes.ok) confirmResults.push('sms');
        else console.warn('[Square Webhook] Confirmation SMS failed:', await smsRes.text());
      } catch (e) { console.warn('[Square Webhook] Confirmation SMS error:', e); }
    }

    return json({ received: true, matched: true, orderId, status: 'Paid', confirmations: confirmResults });
  } catch (error: any) {
    console.error('[Square Webhook] Error:', error);
    return json({ error: error.message }, 500);
  }
};
