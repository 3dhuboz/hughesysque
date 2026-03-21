export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const appId = env.VITE_FACEBOOK_APP_ID;
  const appSecret = env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return json({ error: 'Facebook App ID or Secret not configured on server.' }, 500);
  }

  try {
    const { shortLivedToken } = await request.json();
    if (!shortLivedToken) return json({ error: 'shortLivedToken is required' }, 400);

    const longLivedUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
    const llRes = await fetch(longLivedUrl);
    if (!llRes.ok) {
      const err: any = await llRes.json().catch(() => ({}));
      return json({ error: err?.error?.message || `Facebook token exchange failed (${llRes.status})` }, llRes.status);
    }
    const llData: any = await llRes.json();
    const longLivedToken = llData.access_token;

    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedToken}`;
    const pagesRes = await fetch(pagesUrl);
    if (!pagesRes.ok) {
      const err: any = await pagesRes.json().catch(() => ({}));
      return json({ error: err?.error?.message || `Failed to fetch pages (${pagesRes.status})` }, pagesRes.status);
    }
    const pagesData: any = await pagesRes.json();

    return json({
      longLivedToken,
      expiresIn: llData.expires_in,
      pages: pagesData.data || [],
    });
  } catch (error: any) {
    console.error('Facebook token exchange error:', error);
    return json({ error: error.message }, 500);
  }
};
