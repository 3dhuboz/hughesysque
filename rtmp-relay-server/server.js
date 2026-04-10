/**
 * RTMP Relay Server for Fly.io
 *
 * Accepts WebSocket connections from the browser with MediaRecorder video chunks.
 * Uses ffmpeg to remux WebM → FLV and pipe to Facebook's RTMP endpoint.
 *
 * Flow:
 * 1. Browser POST /start { rtmpUrl, streamKey } → returns sessionId
 * 2. Browser connects WebSocket /ws/:sessionId → sends video chunks
 * 3. Server spawns ffmpeg: stdin (WebM from browser) → RTMP output to Facebook
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const sessions = new Map();

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /start — create a relay session
  if (req.method === 'POST' && req.url === '/start') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { rtmpUrl, streamKey } = JSON.parse(body);
        if (!rtmpUrl || !streamKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'rtmpUrl and streamKey required' }));
          return;
        }

        const sessionId = crypto.randomUUID();
        const fullRtmpUrl = rtmpUrl + streamKey;

        sessions.set(sessionId, {
          rtmpUrl: fullRtmpUrl,
          status: 'waiting',
          ffmpeg: null,
          bytesReceived: 0,
          startTime: null,
          error: null,
        });

        console.log(`[Session ${sessionId.slice(0, 8)}] Created — target: ${rtmpUrl}${streamKey.slice(0, 20)}...`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessionId }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // GET /status/:sessionId
  if (req.method === 'GET' && req.url.startsWith('/status/')) {
    const sessionId = req.url.split('/status/')[1];
    const session = sessions.get(sessionId);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: session.status,
      bytesReceived: session.bytesReceived,
      uptime: session.startTime ? Math.floor((Date.now() - session.startTime) / 1000) : 0,
      error: session.error,
    }));
    return;
  }

  // Health check
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'rtmp-relay', sessions: sessions.size, uptime: process.uptime() }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (!url.pathname.startsWith('/ws/')) {
    socket.destroy();
    return;
  }

  const sessionId = url.pathname.split('/ws/')[1];
  const session = sessions.get(sessionId);

  if (!session) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log(`[Session ${sessionId.slice(0, 8)}] WebSocket connected`);
    session.status = 'connecting';
    session.startTime = Date.now();

    // Spawn ffmpeg — reads WebM from stdin, outputs FLV to RTMP
    const ffmpeg = spawn('ffmpeg', [
      '-fflags', '+genpts+discardcorrupt+nobuffer',
      '-analyzeduration', '2000000',  // 2 seconds to analyze input
      '-probesize', '1000000',        // 1MB probe size
      '-i', 'pipe:0',           // Read from stdin (auto-detect format)
      '-c:v', 'libx264',        // Transcode to H.264 (required for RTMP/FLV)
      '-preset', 'veryfast',    // Fast encoding for real-time
      '-tune', 'zerolatency',   // Minimize latency
      '-b:v', '2500k',          // Video bitrate
      '-maxrate', '2500k',
      '-bufsize', '5000k',
      '-pix_fmt', 'yuv420p',    // Required for compatibility
      '-g', '60',               // Keyframe every 2 seconds at 30fps
      '-c:a', 'aac',            // Transcode audio to AAC
      '-ar', '44100',           // Audio sample rate
      '-b:a', '128k',           // Audio bitrate
      '-f', 'flv',              // Output format
      '-flvflags', 'no_duration_filesize',
      session.rtmpUrl           // RTMP destination
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    session.ffmpeg = ffmpeg;

    ffmpeg.stderr.on('data', (data) => {
      const msg = data.toString();
      // Log all ffmpeg output for debugging
      console.log(`[Session ${sessionId.slice(0, 8)}] ffmpeg: ${msg.trim().substring(0, 200)}`);
      // Look for connection success
      if (msg.includes('Output #0') || msg.includes('muxing started') || msg.includes('frame=')) {
        if (session.status !== 'live') {
          session.status = 'live';
          try { ws.send(JSON.stringify({ type: 'connected', status: 'live' })); } catch {}
          console.log(`[Session ${sessionId.slice(0, 8)}] LIVE — streaming to Facebook`);
        }
      }
    });

    ffmpeg.on('error', (err) => {
      session.error = err.message;
      session.status = 'error';
      console.error(`[Session ${sessionId.slice(0, 8)}] ffmpeg error:`, err.message);
      ws.send(JSON.stringify({ type: 'error', error: err.message }));
    });

    ffmpeg.on('close', (code) => {
      session.status = code === 0 ? 'ended' : 'error';
      if (code !== 0) session.error = `ffmpeg exited with code ${code}`;
      console.log(`[Session ${sessionId.slice(0, 8)}] ffmpeg closed (code ${code})`);
    });

    // After a brief delay, mark as live (ffmpeg takes a moment to connect)
    setTimeout(() => {
      if (session.status === 'connecting') {
        session.status = 'live';
        ws.send(JSON.stringify({ type: 'connected', status: 'live' }));
        console.log(`[Session ${sessionId.slice(0, 8)}] Assumed LIVE`);
      }
    }, 5000);

    // Handle incoming video chunks from browser
    let firstDataReceived = false;
    ws.on('message', (data) => {
      if (typeof data === 'string') {
        try {
          const cmd = JSON.parse(data);
          if (cmd.type === 'end') {
            console.log(`[Session ${sessionId.slice(0, 8)}] End requested`);
            if (ffmpeg.stdin.writable) ffmpeg.stdin.end();
            ws.send(JSON.stringify({ type: 'ended', bytesReceived: session.bytesReceived }));
            ws.close(1000);
            return;
          }
          if (cmd.type === 'format') {
            console.log(`[Session ${sessionId.slice(0, 8)}] Browser format: ${cmd.mimeType}`);
          }
        } catch {}
        return;
      }

      // Binary data — WebM/MP4 chunks from MediaRecorder
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data);
      session.bytesReceived += chunk.length;

      if (!firstDataReceived) {
        firstDataReceived = true;
        console.log(`[Session ${sessionId.slice(0, 8)}] First data chunk: ${chunk.length} bytes, header: ${chunk.slice(0, 4).toString('hex')}`);
      }

      if (ffmpeg.stdin.writable) {
        ffmpeg.stdin.write(chunk, (err) => {
          if (err && !err.message.includes('EPIPE')) {
            console.error(`[Session ${sessionId.slice(0, 8)}] stdin write error:`, err.message);
          }
        });
      }
    });

    ws.on('close', () => {
      console.log(`[Session ${sessionId.slice(0, 8)}] WebSocket closed`);
      if (ffmpeg.stdin.writable) ffmpeg.stdin.end();
      setTimeout(() => sessions.delete(sessionId), 30000);
    });

    ws.on('error', (err) => {
      console.error(`[Session ${sessionId.slice(0, 8)}] WS error:`, err.message);
      if (ffmpeg.stdin.writable) ffmpeg.stdin.end();
    });
  });
});

server.listen(PORT, () => {
  console.log(`RTMP Relay Server running on port ${PORT}`);
});
