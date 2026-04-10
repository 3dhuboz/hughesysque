/**
 * RTMP Relay Worker — bridges browser WebSocket to Facebook RTMP.
 * Uses Durable Objects for long-lived connections + TCP sockets for RTMP.
 *
 * Flow:
 * 1. Browser POSTs /start with { rtmpUrl, streamKey } → creates DO session
 * 2. Browser connects WebSocket to /ws/:sessionId → sends FLV data chunks
 * 3. DO connects to Facebook RTMP via TCP, performs handshake, publishes stream
 * 4. Browser sends MediaRecorder data → DO forwards to Facebook
 */

import { connect } from 'cloudflare:sockets';

import {
  buildConnectPayload, buildReleaseStreamPayload, buildFCPublishPayload,
  buildCreateStreamPayload, buildPublishPayload, buildSetChunkSize,
  buildWindowAckSize, buildChunk, MSG_AMF0_COMMAND, MSG_VIDEO, MSG_AUDIO
} from './rtmp';

export interface Env {
  RTMP_RELAY: DurableObjectNamespace;
}

// Worker entrypoint — routes requests to Durable Objects
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // POST /start — create a relay session
    if (url.pathname === '/start' && request.method === 'POST') {
      const { rtmpUrl, streamKey } = await request.json() as any;
      if (!rtmpUrl || !streamKey) {
        return Response.json({ error: 'rtmpUrl and streamKey required' }, { status: 400, headers: corsHeaders });
      }

      const sessionId = crypto.randomUUID();
      const doId = env.RTMP_RELAY.idFromName(sessionId);
      const stub = env.RTMP_RELAY.get(doId);

      // Initialize the DO with RTMP details
      await stub.fetch(new Request('https://internal/init', {
        method: 'POST',
        body: JSON.stringify({ rtmpUrl, streamKey }),
      }));

      return Response.json({ sessionId }, { headers: corsHeaders });
    }

    // GET /ws/:sessionId — WebSocket upgrade for video data
    if (url.pathname.startsWith('/ws/')) {
      const sessionId = url.pathname.split('/ws/')[1];
      if (!sessionId) return Response.json({ error: 'sessionId required' }, { status: 400 });

      const doId = env.RTMP_RELAY.idFromName(sessionId);
      const stub = env.RTMP_RELAY.get(doId);
      return stub.fetch(request);
    }

    // GET /status/:sessionId — check session status
    if (url.pathname.startsWith('/status/')) {
      const sessionId = url.pathname.split('/status/')[1];
      const doId = env.RTMP_RELAY.idFromName(sessionId);
      const stub = env.RTMP_RELAY.get(doId);
      return stub.fetch(new Request('https://internal/status'));
    }

    return Response.json({ error: 'Not found', routes: ['/start', '/ws/:id', '/status/:id'] }, { status: 404, headers: corsHeaders });
  },
};

// Durable Object — manages one RTMP relay session
export class RtmpRelaySession {
  private state: DurableObjectState;
  private rtmpUrl = '';
  private streamKey = '';
  private tcpSocket: any = null;
  private tcpWriter: WritableStreamDefaultWriter | null = null;
  private connected = false;
  private handshakeComplete = false;
  private ws: WebSocket | null = null;
  private status = 'idle';
  private error = '';
  private bytesRelayed = 0;
  private startTime = 0;
  private readBuffer = new Uint8Array(0);

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Init with RTMP details
    if (url.pathname === '/init') {
      const { rtmpUrl, streamKey } = await request.json() as any;
      this.rtmpUrl = rtmpUrl;
      this.streamKey = streamKey;
      this.status = 'initialized';
      return new Response('OK');
    }

    // Status check
    if (url.pathname === '/status') {
      return Response.json({
        status: this.status,
        connected: this.connected,
        handshakeComplete: this.handshakeComplete,
        bytesRelayed: this.bytesRelayed,
        error: this.error,
        uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      });
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    this.ws = server;
    this.startTime = Date.now();
    this.status = 'connecting';

    // Connect to Facebook RTMP in background
    this.connectRtmp().catch(err => {
      this.error = err.message;
      this.status = 'error';
      try { server.send(JSON.stringify({ type: 'error', error: err.message })); } catch {}
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (typeof message === 'string') {
      // Control messages
      try {
        const cmd = JSON.parse(message);
        if (cmd.type === 'end') {
          this.status = 'ending';
          await this.disconnect();
          ws.send(JSON.stringify({ type: 'ended', bytesRelayed: this.bytesRelayed }));
          ws.close(1000, 'Stream ended');
        }
      } catch {}
      return;
    }

    // Binary data — FLV video/audio chunks from MediaRecorder
    if (!this.connected || !this.tcpWriter) {
      return; // Drop data until RTMP is connected
    }

    try {
      const data = new Uint8Array(message);
      this.bytesRelayed += data.length;

      // Forward raw FLV data to RTMP connection
      // The browser sends FLV-tagged data which we wrap in RTMP chunks
      await this.sendVideoData(data);
    } catch (err: any) {
      this.error = `Send error: ${err.message}`;
      console.error('[RTMP Relay] Send error:', err);
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.status = 'closed';
    await this.disconnect();
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    this.error = String(error);
    this.status = 'error';
    await this.disconnect();
  }

  private async connectRtmp() {
    // Parse RTMP URL — rtmps://live-api-s.facebook.com:443/rtmp/
    const url = new URL(this.rtmpUrl.replace('rtmps://', 'https://').replace('rtmp://', 'http://'));
    const host = url.hostname;
    const port = parseInt(url.port) || (this.rtmpUrl.startsWith('rtmps') ? 443 : 1935);
    const useTls = this.rtmpUrl.startsWith('rtmps');
    const app = url.pathname.replace(/^\//, '').replace(/\/$/, '') || 'rtmp';

    console.log(`[RTMP Relay] Connecting to ${host}:${port} (TLS: ${useTls}), app: ${app}`);

    // Open TCP connection
    this.tcpSocket = connect({ hostname: host, port }, { secureTransport: useTls ? 'on' : 'off' });
    this.tcpWriter = this.tcpSocket.writable.getWriter();

    // Start reading responses
    this.readRtmpResponses(this.tcpSocket.readable);

    // RTMP Handshake — C0 + C1
    const c0c1 = new Uint8Array(1 + 1536);
    c0c1[0] = 3; // RTMP version 3
    // C1: timestamp (4 bytes) + zero (4 bytes) + random (1528 bytes)
    const view = new DataView(c0c1.buffer);
    view.setUint32(1, Math.floor(Date.now() / 1000));
    view.setUint32(5, 0);
    for (let i = 9; i < 1537; i++) c0c1[i] = Math.floor(Math.random() * 256);

    await this.tcpWriter.write(c0c1);
    this.status = 'handshaking';

    // Wait for S0 + S1 + S2 response
    await this.waitForHandshake();

    // Send C2 (echo of S1)
    const c2 = this.readBuffer.slice(1, 1537); // S1 data
    await this.tcpWriter.write(c2);

    this.handshakeComplete = true;
    this.status = 'rtmp_connecting';
    console.log('[RTMP Relay] Handshake complete, sending connect');

    // Clear read buffer after handshake
    this.readBuffer = new Uint8Array(0);

    // Set chunk size
    await this.tcpWriter.write(buildSetChunkSize(4096));

    // Send connect command
    const tcUrl = `${this.rtmpUrl.replace(/\/$/, '')}`;
    const connectPayload = buildConnectPayload(app, tcUrl);
    const connectChunk = buildChunk(3, MSG_AMF0_COMMAND, 0, connectPayload);
    await this.tcpWriter.write(connectChunk);

    // Wait a moment for server response
    await new Promise(r => setTimeout(r, 1000));

    // Send releaseStream
    const releasePayload = buildReleaseStreamPayload(this.streamKey);
    await this.tcpWriter.write(buildChunk(3, MSG_AMF0_COMMAND, 0, releasePayload));

    // Send FCPublish
    const fcPublishPayload = buildFCPublishPayload(this.streamKey);
    await this.tcpWriter.write(buildChunk(3, MSG_AMF0_COMMAND, 0, fcPublishPayload));

    // Send createStream
    const createStreamPayload = buildCreateStreamPayload();
    await this.tcpWriter.write(buildChunk(3, MSG_AMF0_COMMAND, 0, createStreamPayload));

    await new Promise(r => setTimeout(r, 500));

    // Send publish
    const publishPayload = buildPublishPayload(this.streamKey);
    await this.tcpWriter.write(buildChunk(4, MSG_AMF0_COMMAND, 1, publishPayload));

    await new Promise(r => setTimeout(r, 500));

    this.connected = true;
    this.status = 'live';
    console.log('[RTMP Relay] Published — relay is LIVE');

    // Notify browser
    try { this.ws?.send(JSON.stringify({ type: 'connected', status: 'live' })); } catch {}
  }

  private async waitForHandshake() {
    // Wait until we have at least S0(1) + S1(1536) + S2(1536) = 3073 bytes
    const maxWait = 10000;
    const start = Date.now();
    while (this.readBuffer.length < 3073) {
      if (Date.now() - start > maxWait) throw new Error('RTMP handshake timeout');
      await new Promise(r => setTimeout(r, 100));
    }
  }

  private async readRtmpResponses(readable: ReadableStream) {
    const reader = readable.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Append to buffer
        const newBuf = new Uint8Array(this.readBuffer.length + value.length);
        newBuf.set(this.readBuffer);
        newBuf.set(value, this.readBuffer.length);
        this.readBuffer = newBuf;
      }
    } catch (err: any) {
      console.error('[RTMP Relay] Read error:', err.message);
      this.error = `Read error: ${err.message}`;
    }
  }

  private async sendVideoData(data: Uint8Array) {
    if (!this.tcpWriter) return;
    // Send raw FLV tag data wrapped as RTMP video message
    const chunk = buildChunk(6, MSG_VIDEO, 1, data, Math.floor((Date.now() - this.startTime)));
    await this.tcpWriter.write(chunk);
  }

  private async disconnect() {
    try {
      if (this.tcpWriter) {
        await this.tcpWriter.close().catch(() => {});
        this.tcpWriter = null;
      }
      if (this.tcpSocket) {
        this.tcpSocket.close();
        this.tcpSocket = null;
      }
    } catch {}
    this.connected = false;
    this.status = 'disconnected';
  }
}
