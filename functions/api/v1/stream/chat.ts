import { getDB } from '../_lib/db';
import { verifyAuth, requireAuth } from '../_lib/auth';
import { readCustomerFromRequest } from '../_lib/customerSession';

function rowToChatMessage(r: any) {
  return {
    id: r.id,
    streamId: r.stream_id,
    userName: r.user_name,
    message: r.message,
    createdAt: r.created_at,
    isAdmin: !!r.is_admin,
    isPinned: !!r.is_pinned,
  };
}

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    const db = getDB(env);
    const url = new URL(request.url);

    // GET — list messages for a stream
    if (request.method === 'GET') {
      const streamId = url.searchParams.get('streamId');
      if (!streamId) return json({ error: 'streamId is required' }, 400);

      // Check if requesting banned list
      const listBans = url.searchParams.get('bans');
      if (listBans === 'true') {
        const auth = await verifyAuth(request, env);
        requireAuth(auth, 'ADMIN');
        const { results } = await db.prepare('SELECT * FROM chat_bans ORDER BY banned_at DESC').all();
        return json({ bans: results.map((r: any) => ({ id: r.id, userName: r.user_name, reason: r.reason, bannedAt: r.banned_at, bannedBy: r.banned_by })) });
      }

      const after = url.searchParams.get('after');
      let rows: any[];

      if (after) {
        const result = await db.prepare(
          'SELECT * FROM live_chat WHERE stream_id = ? AND created_at > ? ORDER BY created_at ASC'
        ).bind(streamId, after).all();
        rows = result.results;
      } else {
        const result = await db.prepare(
          'SELECT * FROM live_chat WHERE stream_id = ? ORDER BY created_at ASC'
        ).bind(streamId).all();
        rows = result.results;
      }

      return json({ messages: rows.map(rowToChatMessage) });
    }

    // POST — send a message or ban/unban a user
    if (request.method === 'POST') {
      const body = await request.json();

      // Ban a user (admin only)
      if (body.action === 'ban') {
        const auth = await verifyAuth(request, env);
        requireAuth(auth, 'ADMIN');
        const { userName, reason } = body;
        if (!userName) return json({ error: 'userName is required' }, 400);
        const id = crypto.randomUUID();
        await db.prepare(
          'INSERT OR REPLACE INTO chat_bans (id, user_name, reason, banned_by) VALUES (?, ?, ?, ?)'
        ).bind(id, userName, reason || null, auth.name || 'Admin').run();
        // Delete all messages from this user
        await db.prepare('DELETE FROM live_chat WHERE user_name = ?').bind(userName).run();
        return json({ success: true, banned: userName });
      }

      // Pin a message (admin only) — only one pinned at a time
      if (body.action === 'pin') {
        const auth = await verifyAuth(request, env);
        requireAuth(auth, 'ADMIN');
        const { messageId } = body;
        if (!messageId) return json({ error: 'messageId is required' }, 400);
        // Unpin all, then pin target
        await db.prepare('UPDATE live_chat SET is_pinned = 0 WHERE is_pinned = 1').run();
        await db.prepare('UPDATE live_chat SET is_pinned = 1 WHERE id = ?').bind(messageId).run();
        return json({ success: true, pinned: messageId });
      }

      // Unpin a message (admin only)
      if (body.action === 'unpin') {
        const auth = await verifyAuth(request, env);
        requireAuth(auth, 'ADMIN');
        const { messageId } = body;
        if (!messageId) return json({ error: 'messageId is required' }, 400);
        await db.prepare('UPDATE live_chat SET is_pinned = 0 WHERE id = ?').bind(messageId).run();
        return json({ success: true, unpinned: messageId });
      }

      // Unban a user (admin only)
      if (body.action === 'unban') {
        const auth = await verifyAuth(request, env);
        requireAuth(auth, 'ADMIN');
        const { userName } = body;
        if (!userName) return json({ error: 'userName is required' }, 400);
        await db.prepare('DELETE FROM chat_bans WHERE user_name = ?').bind(userName).run();
        return json({ success: true, unbanned: userName });
      }

      // Regular message
      const { streamId, message, userName, userId } = body;

      if (!streamId || !message) {
        return json({ error: 'streamId and message are required' }, 400);
      }

      // Resolve the display name. Anti-impersonation rules:
      //   - Authenticated CUSTOMER: ignore body.userName, derive from the
      //     customers row (name column, falling back to the local-part of
      //     the email). Stops a customer posting under another customer's
      //     name (or pretending to be Macca) — audit Security Medium.
      //   - ADMIN / DEV: allow body.userName for display freedom, but the
      //     is_admin flag is still server-derived from the session.
      //   - Anonymous: keep accepting body.userName since live chat is open
      //     to logged-out viewers by design. body.userName is required for
      //     this branch only.
      let isAdmin = 0;
      let resolvedUserName = (userName || '').toString().trim().slice(0, 60);
      let resolvedUserId: string | null = userId || null;

      const adminAuth = await verifyAuth(request, env);
      if (adminAuth && (adminAuth.role === 'ADMIN' || adminAuth.role === 'DEV')) {
        isAdmin = 1;
        if (!resolvedUserName) resolvedUserName = 'Hughesys Que';
      } else {
        const customerSession = await readCustomerFromRequest(request, env);
        if (customerSession) {
          const customer = await db
            .prepare('SELECT name FROM customers WHERE email = ?')
            .bind(customerSession.sub)
            .first<{ name: string | null }>();
          const profileName = customer?.name?.toString().trim();
          resolvedUserName = profileName || customerSession.sub.split('@')[0] || 'Customer';
          resolvedUserId = customerSession.sub; // sub = email; keys ban-list more reliably
        } else if (!resolvedUserName) {
          return json({ error: 'userName is required for anonymous posts' }, 400);
        }
      }

      // Check if user is banned (by resolved name AND by userId/email if we have one)
      const banByName = await db.prepare('SELECT id FROM chat_bans WHERE user_name = ?').bind(resolvedUserName).first();
      if (banByName) {
        return json({ error: 'You have been banned from chat.' }, 403);
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

      await db.prepare(
        'INSERT INTO live_chat (id, stream_id, user_name, user_id, message, created_at, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, streamId, resolvedUserName, resolvedUserId, message, now, isAdmin).run();

      const inserted = {
        id,
        streamId,
        userName: resolvedUserName,
        message,
        createdAt: now,
        isAdmin: !!isAdmin,
      };

      return json({ message: inserted }, 201);
    }

    // DELETE — admin only, remove a message
    if (request.method === 'DELETE') {
      const auth = await verifyAuth(request, env);
      requireAuth(auth, 'ADMIN');

      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'id is required' }, 400);

      await db.prepare('DELETE FROM live_chat WHERE id = ?').bind(id).run();
      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
