/**
 * Simulcast (restream) management — add/remove/list RTMP outputs on the live input.
 * Used to forward live streams to Facebook, YouTube, etc.
 *
 * GET    /api/v1/stream/simulcast — list current outputs
 * POST   /api/v1/stream/simulcast — add a new output { url, streamKey }
 * DELETE /api/v1/stream/simulcast?outputId=xxx — remove an output
 * PATCH  /api/v1/stream/simulcast — enable/disable an output { outputId, enabled }
 */
import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const auth = await verifyAuth(request, env);
    requireAuth(auth, 'ADMIN');

    if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_API_TOKEN) {
      return json({ error: 'Stream API not configured' }, 500);
    }

    // Get live input ID from settings
    const db = getDB(env);
    const existing = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first() as any;
    const settings = existing ? parseJson(existing.data as string, {}) : {};
    const liveInputId = settings.streamLiveInputId;
    if (!liveInputId) {
      return json({ error: 'No live input configured. Set up live stream first.' }, 400);
    }

    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream/live_inputs/${liveInputId}/outputs`;
    const headers = { Authorization: `Bearer ${env.CF_STREAM_API_TOKEN}`, 'Content-Type': 'application/json' };
    const url = new URL(request.url);

    // GET — list outputs
    if (request.method === 'GET') {
      const res = await fetch(baseUrl, { headers });
      const data = await res.json() as any;
      if (!data.success) return json({ error: data.errors?.[0]?.message || 'Failed to list outputs' }, res.status);
      return json({ outputs: (data.result || []).map((o: any) => ({ uid: o.uid, url: o.url, streamKey: o.streamKey, enabled: o.enabled })) });
    }

    // POST — add output
    if (request.method === 'POST') {
      const body = await request.json();
      if (!body.url || !body.streamKey) return json({ error: 'url and streamKey are required' }, 400);

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: body.url, streamKey: body.streamKey }),
      });
      const data = await res.json() as any;
      if (!data.success) return json({ error: data.errors?.[0]?.message || 'Failed to add output' }, res.status);
      return json({ output: { uid: data.result.uid, url: data.result.url, streamKey: data.result.streamKey, enabled: data.result.enabled } }, 201);
    }

    // DELETE — remove output
    if (request.method === 'DELETE') {
      const outputId = url.searchParams.get('outputId');
      if (!outputId) return json({ error: 'outputId is required' }, 400);

      const res = await fetch(`${baseUrl}/${outputId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        return json({ error: data.errors?.[0]?.message || `Failed to delete output (${res.status})` }, res.status);
      }
      return json({ success: true });
    }

    // PATCH — enable/disable output
    if (request.method === 'PATCH') {
      const body = await request.json();
      if (!body.outputId) return json({ error: 'outputId is required' }, 400);

      const res = await fetch(`${baseUrl}/${body.outputId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ enabled: !!body.enabled }),
      });
      const data = await res.json() as any;
      if (!data.success) return json({ error: data.errors?.[0]?.message || 'Failed to update output' }, res.status);
      return json({ output: { uid: data.result.uid, enabled: data.result.enabled } });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
