/**
 * Square connectivity test endpoint.
 * GET /api/v1/payment/square-test
 * Verifies the stored Square credentials by listing locations.
 */
import { getDB, parseJson } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = getDB(env);
    const row: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data, {}) : {};

    const accessToken = settings.squareAccessToken;
    const applicationId = settings.squareApplicationId;
    const locationId = settings.squareLocationId;

    if (!accessToken) return json({ error: 'Square access token not configured in settings' }, 400);
    if (!applicationId) return json({ error: 'Square application ID not configured in settings' }, 400);
    if (!locationId) return json({ error: 'Square location ID not configured in settings' }, 400);

    // Test by fetching the specific location
    const baseUrl = accessToken.startsWith('EAAA')
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const locRes = await fetch(`${baseUrl}/v2/locations/${locationId}`, {
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const locData: any = await locRes.json();

    if (!locRes.ok) {
      const errMsg = locData.errors?.[0]?.detail || `Square API ${locRes.status}`;
      return json({ success: false, error: errMsg, errors: locData.errors }, locRes.status);
    }

    const loc = locData.location;
    return json({
      success: true,
      environment: accessToken.startsWith('EAAA') ? 'production' : 'sandbox',
      applicationId,
      location: {
        id: loc.id,
        name: loc.name,
        status: loc.status,
        currency: loc.currency,
        country: loc.country,
        businessName: loc.business_name,
        capabilities: loc.capabilities,
      },
    });
  } catch (error: any) {
    console.error('Square test error:', error);
    return json({ error: error.message }, 500);
  }
};
