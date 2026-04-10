/**
 * Facebook Live — create a live video on the connected Facebook Page.
 * POST /api/v1/stream/facebook-live
 *
 * Creates a live video via Graph API, extracts the RTMP URL + stream key,
 * and auto-adds a Cloudflare simulcast output so the stream goes to Facebook.
 */
import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const auth = await verifyAuth(request, env);
    requireAuth(auth, 'ADMIN');

    const { title, description } = await request.json();

    // Get Facebook credentials from D1 settings
    const db = getDB(env);
    const row: any = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first();
    const settings = row ? parseJson(row.data, {}) : {};

    const pageId = settings.facebookPageId;
    const pageToken = settings.facebookPageAccessToken;

    if (!pageId || !pageToken) {
      return json({ error: 'Facebook not connected. Add your Page ID and Page Access Token in Settings.' }, 400);
    }

    // Create live video on Facebook
    const fbRes = await fetch(`https://graph.facebook.com/v18.0/${pageId}/live_videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || 'Live from Hughesys Que',
        description: description || 'We\'re live! Join us for a cook session.',
        status: 'LIVE_NOW',
        access_token: pageToken,
      }),
    });

    const fbData: any = await fbRes.json();

    if (!fbRes.ok || fbData.error) {
      const errMsg = fbData.error?.message || `Facebook API error (${fbRes.status})`;
      console.error('[Facebook Live] Error:', JSON.stringify(fbData.error || fbData));
      return json({ error: errMsg }, fbRes.status);
    }

    const liveVideoId = fbData.id;

    // The creation response has a stream_url with query params like:
    // rtmps://...rtmp/123456?s_bl=1&s_ow=10&...
    // But the ACTUAL stream key is in the FB-xxxx format from the video object.
    // Fetch the video object to get the correct stream_url with FB- prefix.
    let streamUrl = '';
    try {
      const videoRes = await fetch(
        `https://graph.facebook.com/v18.0/${liveVideoId}?fields=stream_url&access_token=${pageToken}`
      );
      const videoData: any = await videoRes.json();
      streamUrl = videoData.stream_url || fbData.stream_url || fbData.secure_stream_url || '';
    } catch {
      streamUrl = fbData.stream_url || fbData.secure_stream_url || '';
    }

    if (!streamUrl) {
      return json({ error: 'Facebook did not return a stream URL' }, 500);
    }

    const rtmpUrl = 'rtmps://live-api-s.facebook.com:443/rtmp/';
    const streamKey = streamUrl.split('/rtmp/')[1] || streamUrl;

    // Video is relayed via WebSocket → RTMP relay Worker (not Cloudflare simulcast)

    return json({
      success: true,
      liveVideoId,
      streamUrl,
      rtmpUrl,
      streamKey,
      relay: 'fly.io',
    });
  } catch (err: any) {
    const status = err.status || 500;
    console.error('[Facebook Live] Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
