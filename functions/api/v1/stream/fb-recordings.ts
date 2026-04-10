/**
 * Fetch past Facebook Live videos for the connected page.
 * GET /api/v1/stream/fb-recordings
 * Returns past live streams from Facebook as playable recordings.
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

    const pageId = settings.facebookPageId;
    const pageToken = settings.facebookPageAccessToken;

    if (!pageId || !pageToken) {
      return json({ recordings: [] });
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const fbRes = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/live_videos?fields=id,title,description,status,embed_html,permalink_url,creation_time,live_views&limit=${limit}&access_token=${pageToken}`
    );

    const fbData: any = await fbRes.json();

    if (!fbRes.ok || fbData.error) {
      console.error('[FB Recordings] Error:', fbData.error);
      return json({ recordings: [], error: fbData.error?.message });
    }

    // Transform to a clean format — only VOD (completed) recordings
    const recordings = (fbData.data || [])
      .filter((v: any) => v.status === 'VOD')
      .map((v: any) => {
        // Extract embed src from embed_html
        const srcMatch = v.embed_html?.match(/src="([^"]+)"/);
        const embedUrl = srcMatch ? srcMatch[1].replace(/&amp;/g, '&') : null;
        const fbVideoUrl = v.permalink_url ? `https://www.facebook.com${v.permalink_url}` : null;

        return {
          id: v.id,
          title: v.title || 'Live Stream',
          description: v.description || '',
          embedUrl,
          fbVideoUrl,
          createdAt: v.creation_time,
          liveViews: v.live_views || 0,
          source: 'facebook',
        };
      });

    return json({ recordings });
  } catch (err: any) {
    console.error('[FB Recordings] Error:', err);
    return json({ recordings: [], error: err.message }, 500);
  }
};
