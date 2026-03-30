import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const auth = await verifyAuth(request, env);
    requireAuth(auth, 'ADMIN');

    if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_API_TOKEN) {
      return json({ error: 'Stream API not configured' }, 500);
    }

    // Parse the incoming multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || 'Recorded Video';

    if (!file) {
      return json({ error: 'No file provided' }, 400);
    }

    // Build a new FormData to forward to Cloudflare Stream API
    const cfFormData = new FormData();
    cfFormData.append('file', file, file.name || `${title}.webm`);
    cfFormData.append('meta', JSON.stringify({ name: title }));

    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_STREAM_API_TOKEN}`,
        // Do NOT set Content-Type — let fetch set multipart boundary
      },
      body: cfFormData,
    });

    const data = await res.json() as any;
    if (!data.success) {
      return json({ error: data.errors?.[0]?.message || 'Failed to upload to Cloudflare Stream' }, res.status);
    }

    const video = data.result;
    return json({
      success: true,
      video: {
        uid: video.uid,
        playbackUrl: video.playback?.hls || `https://customer-${env.CF_ACCOUNT_ID}.cloudflarestream.com/${video.uid}/manifest/video.m3u8`,
        dashUrl: video.playback?.dash,
        thumbnail: video.thumbnail,
        duration: video.duration,
      },
    }, 201);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
