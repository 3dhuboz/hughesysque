import { getDB, parseJson } from '../_lib/db';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_API_TOKEN) {
      return json({ error: 'Stream API not configured' }, 500);
    }

    // Read the live input ID from D1 settings
    const db = getDB(env);
    const existing = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first() as any;
    const settings = existing ? parseJson(existing.data as string, {}) : {};
    const liveInputId = settings.streamLiveInputId;

    if (!liveInputId) {
      return json({
        live: false,
        viewerCount: 0,
        previewUrl: null,
        webRTCPlaybackUrl: null,
        title: null,
      });
    }

    // Check the live input status from Cloudflare Stream API
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/live_inputs/${liveInputId}`;
    const res = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${env.CF_STREAM_API_TOKEN}`,
      },
    });

    const data = await res.json() as any;
    if (!data.success) {
      return json({ error: data.errors?.[0]?.message || 'Stream API error' }, res.status);
    }

    const liveInput = data.result;
    const state = liveInput?.status?.current?.state;
    const isLive = state === 'connected';

    return json({
      live: isLive,
      viewerCount: liveInput?.status?.current?.viewerCount || 0,
      previewUrl: `https://iframe.videodelivery.net/${liveInputId}`,
      webRTCPlaybackUrl: liveInput?.webRTCPlayback?.url || null,
      title: liveInput?.meta?.name || null,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
