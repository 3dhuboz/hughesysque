import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    // DELETE — remove a recording (admin only)
    if (request.method === 'DELETE') {
      const auth = await verifyAuth(request, env);
      requireAuth(auth, 'ADMIN');
      if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_API_TOKEN) return json({ error: 'Stream API not configured' }, 500);
      const url = new URL(request.url);
      const videoId = url.searchParams.get('id');
      if (!videoId) return json({ error: 'id is required' }, 400);
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/${videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${env.CF_STREAM_API_TOKEN}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        return json({ error: data.errors?.[0]?.message || `Failed to delete (${res.status})` }, res.status);
      }
      return json({ success: true });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_API_TOKEN) {
      return json({ error: 'Stream API not configured' }, 500);
    }

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const search = url.searchParams.get('search') || '';

    // Fetch all videos from Cloudflare Stream (live recordings + uploads)
    const apiUrl = new URL(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream`);
    apiUrl.searchParams.set('limit', String(limit));
    if (search) {
      apiUrl.searchParams.set('search', search);
    }

    const res = await fetch(apiUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${env.CF_STREAM_API_TOKEN}`,
      },
    });

    const data = await res.json() as any;
    if (!data.success) {
      return json({ error: data.errors?.[0]?.message || 'Stream API error' }, res.status);
    }

    const recordings = (data.result || []).map((video: any) => ({
      uid: video.uid,
      title: video.meta?.name || 'Untitled',
      duration: video.duration,
      thumbnail: video.thumbnail,
      created: video.created,
      previewUrl: `https://iframe.videodelivery.net/${video.uid}`,
      readyToStream: video.readyToStream,
    }));

    return json({ recordings });
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
