/**
 * RTMP Relay Worker — bridges browser WebSocket to Facebook RTMP.
 * Simplified: receives raw FLV data from browser, forwards to Facebook via TCP.
 */
import { connect } from 'cloudflare:sockets';

export interface Env {
  RTMP_RELAY: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (url.pathname === '/start' && request.method === 'POST') {
      const { rtmpUrl, streamKey } = await request.json() as any;
      if (!rtmpUrl || !streamKey) return Response.json({ error: 'rtmpUrl and streamKey required' }, { status: 400, headers: cors });
      const sessionId = crypto.randomUUID();
      const doId = env.RTMP_RELAY.idFromName(sessionId);
      const stub = env.RTMP_RELAY.get(doId);
      await stub.fetch(new Request('https://internal/init', { method: 'POST', body: JSON.stringify({ rtmpUrl, streamKey }) }));
      return Response.json({ sessionId }, { headers: cors });
    }

    if (url.pathname.startsWith('/ws/')) {
      const sessionId = url.pathname.split('/ws/')[1];
      if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });
      const doId = env.RTMP_RELAY.idFromName(sessionId);
      return env.RTMP_RELAY.get(doId).fetch(request);
    }

    if (url.pathname.startsWith('/status/')) {
      const sessionId = url.pathname.split('/status/')[1];
      const doId = env.RTMP_RELAY.idFromName(sessionId);
      return env.RTMP_RELAY.get(doId).fetch(new Request('https://internal/status'));
    }

    return Response.json({ service: 'rtmp-relay', routes: ['/start', '/ws/:id', '/status/:id'] }, { headers: cors });
  },
};

// ── RTMP Protocol helpers ──────────────────────────────────────────────

function u8(v: number) { return v & 0xff; }

function rtmpHandshakeC0C1(): Uint8Array {
  const buf = new Uint8Array(1 + 1536);
  buf[0] = 3; // Version
  const view = new DataView(buf.buffer);
  view.setUint32(1, 0); // Timestamp
  view.setUint32(5, 0); // Zero
  for (let i = 9; i < 1537; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

function rtmpHandshakeC2(s1: Uint8Array): Uint8Array {
  // C2 = echo of S1 with our timestamp
  const buf = new Uint8Array(1536);
  buf.set(s1.subarray(0, 1536));
  return buf;
}

function amfString(s: string): Uint8Array {
  const enc = new TextEncoder().encode(s);
  const buf = new Uint8Array(3 + enc.length);
  buf[0] = 0x02; // AMF0 String
  buf[1] = (enc.length >> 8) & 0xff;
  buf[2] = enc.length & 0xff;
  buf.set(enc, 3);
  return buf;
}

function amfNumber(n: number): Uint8Array {
  const buf = new Uint8Array(9);
  buf[0] = 0x00; // AMF0 Number
  const view = new DataView(buf.buffer);
  view.setFloat64(1, n);
  return buf;
}

function amfNull(): Uint8Array { return new Uint8Array([0x05]); }

function amfObject(props: Record<string, Uint8Array>): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x03])]; // AMF0 Object
  for (const [key, val] of Object.entries(props)) {
    const keyEnc = new TextEncoder().encode(key);
    const keyBuf = new Uint8Array(2 + keyEnc.length);
    keyBuf[0] = (keyEnc.length >> 8) & 0xff;
    keyBuf[1] = keyEnc.length & 0xff;
    keyBuf.set(keyEnc, 2);
    parts.push(keyBuf);
    parts.push(val);
  }
  parts.push(new Uint8Array([0x00, 0x00, 0x09])); // Object End
  let total = 0;
  parts.forEach(p => total += p.length);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach(p => { result.set(p, offset); offset += p.length; });
  return result;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  arrays.forEach(a => total += a.length);
  const result = new Uint8Array(total);
  let offset = 0;
  arrays.forEach(a => { result.set(a, offset); offset += a.length; });
  return result;
}

function rtmpChunk(csId: number, msgType: number, streamId: number, payload: Uint8Array, timestamp = 0): Uint8Array {
  // Type 0 chunk header (12 bytes) + payload (chunked at 128 bytes default)
  const chunkSize = 128;
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let first = true;

  while (offset < payload.length) {
    const remaining = payload.length - offset;
    const size = Math.min(remaining, chunkSize);

    if (first) {
      // Fmt 0: 1 + 3 + 3 + 1 + 4 = 12 bytes
      const hdr = new Uint8Array(12);
      hdr[0] = (0 << 6) | (csId & 0x3f);
      hdr[1] = (timestamp >> 16) & 0xff;
      hdr[2] = (timestamp >> 8) & 0xff;
      hdr[3] = timestamp & 0xff;
      hdr[4] = (payload.length >> 16) & 0xff;
      hdr[5] = (payload.length >> 8) & 0xff;
      hdr[6] = payload.length & 0xff;
      hdr[7] = msgType;
      // Stream ID in little-endian
      hdr[8] = streamId & 0xff;
      hdr[9] = (streamId >> 8) & 0xff;
      hdr[10] = (streamId >> 16) & 0xff;
      hdr[11] = (streamId >> 24) & 0xff;
      chunks.push(hdr);
      first = false;
    } else {
      // Fmt 3: continuation
      chunks.push(new Uint8Array([(3 << 6) | (csId & 0x3f)]));
    }

    chunks.push(payload.subarray(offset, offset + size));
    offset += size;
  }

  return concat(...chunks);
}

// ── Durable Object ─────────────────────────────────────────────────────

export class RtmpRelaySession {
  private state: DurableObjectState;
  private rtmpUrl = '';
  private streamKey = '';
  private socket: any = null;
  private writer: WritableStreamDefaultWriter | null = null;
  private status = 'idle';
  private error = '';
  private bytesRelayed = 0;
  private startTime = 0;
  private connected = false;
  private handshakeDone = false;
  private readBuf = new Uint8Array(0);
  private ws: WebSocket | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      const body = await request.json() as any;
      this.rtmpUrl = body.rtmpUrl;
      this.streamKey = body.streamKey;
      this.status = 'initialized';
      return new Response('OK');
    }

    if (url.pathname === '/status') {
      return Response.json({ status: this.status, connected: this.connected, handshakeDone: this.handshakeDone, bytesRelayed: this.bytesRelayed, error: this.error, uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0 });
    }

    // WebSocket upgrade
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    this.ws = server;
    this.startTime = Date.now();

    // Connect to Facebook RTMP
    this.doRtmpConnect().catch(err => {
      this.error = err.message || String(err);
      this.status = 'error';
      try { server.send(JSON.stringify({ type: 'error', error: this.error })); } catch {}
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (typeof message === 'string') {
      try {
        const cmd = JSON.parse(message);
        if (cmd.type === 'end') {
          await this.cleanup();
          ws.send(JSON.stringify({ type: 'ended', bytesRelayed: this.bytesRelayed }));
          ws.close(1000, 'ended');
        }
      } catch {}
      return;
    }

    if (!this.connected || !this.writer) return;

    // Forward binary data as RTMP video message
    const data = new Uint8Array(message);
    this.bytesRelayed += data.length;

    try {
      // Send as RTMP video chunk on stream ID 1
      const ts = Math.floor((Date.now() - this.startTime)) % 0xFFFFFF;
      const chunk = rtmpChunk(6, 9, 1, data, ts); // 9 = video
      await this.writer.write(chunk);
    } catch (err: any) {
      this.error = `Write error: ${err.message}`;
    }
  }

  async webSocketClose() { await this.cleanup(); }
  async webSocketError() { await this.cleanup(); }

  private async doRtmpConnect() {
    this.status = 'connecting_tcp';

    // Parse URL
    const host = 'live-api-s.facebook.com';
    const port = 443;

    console.log(`[RTMP] Connecting to ${host}:${port} TLS`);

    // TCP connect with TLS
    this.socket = connect({ hostname: host, port }, { secureTransport: 'on' });
    this.writer = this.socket.writable.getWriter();

    // Start reading in background
    this.readLoop(this.socket.readable);

    // C0 + C1 handshake
    this.status = 'handshake_c0c1';
    const c0c1 = rtmpHandshakeC0C1();
    await this.writer.write(c0c1);
    console.log('[RTMP] Sent C0+C1');

    // Wait for S0+S1+S2 (1 + 1536 + 1536 = 3073 bytes)
    await this.waitForBytes(3073, 10000);
    console.log(`[RTMP] Received S0+S1+S2 (${this.readBuf.length} bytes)`);

    // Send C2 (echo S1)
    this.status = 'handshake_c2';
    const s1 = this.readBuf.subarray(1, 1537);
    const c2 = rtmpHandshakeC2(s1);
    await this.writer.write(c2);
    this.handshakeDone = true;
    console.log('[RTMP] Handshake complete');

    // Clear buffer
    this.readBuf = new Uint8Array(0);

    // Send connect command
    this.status = 'rtmp_connect';
    const connectPayload = concat(
      amfString('connect'),
      amfNumber(1),
      amfObject({
        'app': amfString('rtmp').subarray(1), // strip type marker for nested
        'type': amfString('nonpersistent').subarray(1),
        'tcUrl': amfString('rtmps://live-api-s.facebook.com:443/rtmp/').subarray(1),
      })
    );

    // Fix: amfObject values should NOT have type markers stripped when inside object
    const connectPayload2 = concat(
      amfString('connect'),
      amfNumber(1),
      this.buildConnectObject()
    );

    await this.writer.write(rtmpChunk(3, 20, 0, connectPayload2)); // 20 = AMF0 command
    console.log('[RTMP] Sent connect');

    // Wait for response
    await this.sleep(1500);

    // Send createStream
    this.status = 'rtmp_createStream';
    const createStream = concat(amfString('createStream'), amfNumber(2), amfNull());
    await this.writer.write(rtmpChunk(3, 20, 0, createStream));
    console.log('[RTMP] Sent createStream');

    await this.sleep(1000);

    // Send publish
    this.status = 'rtmp_publish';
    const publish = concat(amfString('publish'), amfNumber(3), amfNull(), amfString(this.streamKey), amfString('live'));
    await this.writer.write(rtmpChunk(4, 20, 1, publish));
    console.log('[RTMP] Sent publish');

    await this.sleep(1000);

    this.connected = true;
    this.status = 'live';
    console.log('[RTMP] LIVE — relay active');

    try { this.ws?.send(JSON.stringify({ type: 'connected', status: 'live' })); } catch {}
  }

  private buildConnectObject(): Uint8Array {
    const parts: number[] = [];
    // AMF0 Object marker
    parts.push(0x03);

    // app: "rtmp"
    const app = new TextEncoder().encode('app');
    parts.push(0, app.length); for (const b of app) parts.push(b);
    const appVal = new TextEncoder().encode('rtmp');
    parts.push(0x02, 0, appVal.length); for (const b of appVal) parts.push(b);

    // type: "nonpersistent"
    const type = new TextEncoder().encode('type');
    parts.push(0, type.length); for (const b of type) parts.push(b);
    const typeVal = new TextEncoder().encode('nonpersistent');
    parts.push(0x02, 0, typeVal.length); for (const b of typeVal) parts.push(b);

    // tcUrl
    const tcUrl = new TextEncoder().encode('tcUrl');
    parts.push(0, tcUrl.length); for (const b of tcUrl) parts.push(b);
    const tcUrlVal = new TextEncoder().encode('rtmps://live-api-s.facebook.com:443/rtmp/');
    parts.push(0x02, (tcUrlVal.length >> 8) & 0xff, tcUrlVal.length & 0xff);
    for (const b of tcUrlVal) parts.push(b);

    // flashVer
    const flashVer = new TextEncoder().encode('flashVer');
    parts.push(0, flashVer.length); for (const b of flashVer) parts.push(b);
    const flashVerVal = new TextEncoder().encode('FMLE/3.0');
    parts.push(0x02, 0, flashVerVal.length); for (const b of flashVerVal) parts.push(b);

    // Object end
    parts.push(0, 0, 0x09);

    return new Uint8Array(parts);
  }

  private async readLoop(readable: ReadableStream) {
    const reader = readable.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const newBuf = new Uint8Array(this.readBuf.length + value.length);
        newBuf.set(this.readBuf);
        newBuf.set(new Uint8Array(value), this.readBuf.length);
        this.readBuf = newBuf;
      }
    } catch (err: any) {
      if (this.status !== 'disconnected') {
        console.error('[RTMP] Read error:', err.message);
        this.error = `TCP read: ${err.message}`;
      }
    }
  }

  private async waitForBytes(count: number, timeoutMs: number) {
    const start = Date.now();
    while (this.readBuf.length < count) {
      if (Date.now() - start > timeoutMs) throw new Error(`Timeout waiting for ${count} bytes (got ${this.readBuf.length})`);
      await this.sleep(50);
    }
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  private async cleanup() {
    this.status = 'disconnected';
    this.connected = false;
    try { if (this.writer) await this.writer.close().catch(() => {}); } catch {}
    try { if (this.socket) this.socket.close(); } catch {}
    this.writer = null;
    this.socket = null;
  }
}
