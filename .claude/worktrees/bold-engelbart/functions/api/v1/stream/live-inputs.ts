import { getDB, parseJson } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';

const STREAM_API_BASE = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`;

function streamHeaders(apiToken: string) {
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    if (request.method === 'GET') {
      if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_API_TOKEN) {
        return json({ error: 'Stream API not configured' }, 500);
      }

      // Read stored live input ID from D1 settings
      const db = getDB(env);
      const existing = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first() as any;
      const settings = existing ? parseJson(existing.data as string, {}) : {};
      const liveInputId = settings.streamLiveInputId;

      if (!liveInputId) {
        return json({ liveInput: null });
      }

      const res = await fetch(`${STREAM_API_BASE(env.CF_ACCOUNT_ID)}/${liveInputId}`, {
        headers: streamHeaders(env.CF_STREAM_API_TOKEN),
      });

      const data = await res.json() as any;
      if (!data.success) {
        return json({ liveInput: null });
      }

      const li = data.result;
      return json({
        liveInput: {
          uid: li.uid,
          rtmps: li.rtmps,
          webRTC: li.webRTC,
          meta: li.meta,
          recording: li.recording,
          created: li.created,
        },
      });
    }

    if (request.method === 'POST') {
      const auth = await verifyAuth(request, env);
      requireAuth(auth, 'ADMIN');

      if (!env.CF_ACCOUNT_ID || !env.CF_STREAM_API_TOKEN) {
        return json({ error: 'Stream API not configured' }, 500);
      }

      const res = await fetch(STREAM_API_BASE(env.CF_ACCOUNT_ID), {
        method: 'POST',
        headers: streamHeaders(env.CF_STREAM_API_TOKEN),
        body: JSON.stringify({
          meta: { name: 'Hughesys Que Live' },
          recording: { mode: 'automatic' },
          defaultCreator: 'hughesysque',
        }),
      });

      const data = await res.json() as any;
      if (!data.success) {
        return json({ error: data.errors?.[0]?.message || 'Failed to create live input' }, res.status);
      }

      const liveInput = data.result;

      // Save the live input UID to D1 settings
      const db = getDB(env);
      const existing = await db.prepare("SELECT data FROM settings WHERE key = 'general'").first() as any;
      const current = existing ? parseJson(existing.data as string, {}) : {};
      const updated = { ...current, streamLiveInputId: liveInput.uid };
      await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
        .bind(JSON.stringify(updated)).run();

      return json({
        liveInput: {
          uid: liveInput.uid,
          rtmps: liveInput.rtmps,
          webRTC: liveInput.webRTC,
          meta: liveInput.meta,
          recording: liveInput.recording,
          created: liveInput.created,
        },
      }, 201);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
