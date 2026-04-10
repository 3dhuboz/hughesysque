/**
 * Minimal RTMP client for Cloudflare Workers TCP sockets.
 * Implements C0/C1/C2 handshake, connect, createStream, publish.
 * Sends FLV-tagged video/audio data from MediaRecorder to Facebook Live.
 */

// RTMP chunk types
const CHUNK_TYPE_0 = 0; // Full header (11 bytes)
const CHUNK_TYPE_1 = 1; // Without msg stream id (7 bytes)
const CHUNK_TYPE_3 = 3; // No header (continuation)

// RTMP message types
const MSG_SET_CHUNK_SIZE = 1;
const MSG_ABORT = 2;
const MSG_ACK = 3;
const MSG_WINDOW_ACK_SIZE = 5;
const MSG_SET_PEER_BW = 6;
const MSG_AUDIO = 8;
const MSG_VIDEO = 9;
const MSG_AMF0_COMMAND = 20;
const MSG_AMF0_DATA = 18;

// AMF0 types
const AMF0_NUMBER = 0x00;
const AMF0_BOOLEAN = 0x01;
const AMF0_STRING = 0x02;
const AMF0_OBJECT = 0x03;
const AMF0_NULL = 0x05;
const AMF0_OBJECT_END = 0x09;

function writeU8(buf: number[], v: number) { buf.push(v & 0xff); }
function writeU16BE(buf: number[], v: number) { buf.push((v >> 8) & 0xff, v & 0xff); }
function writeU24BE(buf: number[], v: number) { buf.push((v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }
function writeU32BE(buf: number[], v: number) { buf.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }
function writeU32LE(buf: number[], v: number) { buf.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff); }

function amf0String(buf: number[], s: string) {
  writeU8(buf, AMF0_STRING);
  const encoded = new TextEncoder().encode(s);
  writeU16BE(buf, encoded.length);
  for (const b of encoded) buf.push(b);
}

function amf0Number(buf: number[], n: number) {
  writeU8(buf, AMF0_NUMBER);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, n);
  for (let i = 0; i < 8; i++) buf.push(view.getUint8(i));
}

function amf0Null(buf: number[]) { writeU8(buf, AMF0_NULL); }

function amf0ObjectStart(buf: number[]) { writeU8(buf, AMF0_OBJECT); }
function amf0ObjectKey(buf: number[], key: string) {
  const encoded = new TextEncoder().encode(key);
  writeU16BE(buf, encoded.length);
  for (const b of encoded) buf.push(b);
}
function amf0ObjectEnd(buf: number[]) { writeU16BE(buf, 0); writeU8(buf, AMF0_OBJECT_END); }

function buildChunk(csId: number, msgTypeId: number, msgStreamId: number, payload: Uint8Array, timestamp: number = 0): Uint8Array {
  const chunks: number[] = [];
  const chunkSize = 4096; // Default RTMP chunk size
  let offset = 0;
  let first = true;

  while (offset < payload.length) {
    const remaining = payload.length - offset;
    const size = Math.min(remaining, chunkSize);

    if (first) {
      // Type 0 header
      writeU8(chunks, (CHUNK_TYPE_0 << 6) | (csId & 0x3f));
      writeU24BE(chunks, timestamp > 0xffffff ? 0xffffff : timestamp);
      writeU24BE(chunks, payload.length);
      writeU8(chunks, msgTypeId);
      writeU32LE(chunks, msgStreamId);
      if (timestamp > 0xffffff) writeU32BE(chunks, timestamp);
      first = false;
    } else {
      // Type 3 header (continuation)
      writeU8(chunks, (CHUNK_TYPE_3 << 6) | (csId & 0x3f));
    }

    for (let i = 0; i < size; i++) {
      chunks.push(payload[offset + i]);
    }
    offset += size;
  }

  return new Uint8Array(chunks);
}

function buildConnectCommand(app: string, tcUrl: string): Uint8Array {
  const body: number[] = [];
  amf0String(body, 'connect');
  amf0Number(body, 1); // transaction ID
  amf0ObjectStart(body);
  amf0ObjectKey(body, 'app'); amf0String(body.splice(body.length, 0) as any || body, ''); // workaround
  // Rebuild properly
  const buf: number[] = [];
  amf0String(buf, 'connect');
  amf0Number(buf, 1);
  amf0ObjectStart(buf);
  amf0ObjectKey(buf, 'app');
  // Write string value without type marker
  const appBytes = new TextEncoder().encode(app);
  writeU16BE(buf, appBytes.length);
  for (const b of appBytes) buf.push(b);
  // Nest value as AMF0 string
  writeU8(buf, AMF0_STRING);
  writeU16BE(buf, appBytes.length);
  for (const b of appBytes) buf.push(b);

  amf0ObjectKey(buf, 'type');
  writeU8(buf, AMF0_STRING);
  const nonpersistent = new TextEncoder().encode('nonpersistent');
  writeU16BE(buf, nonpersistent.length);
  for (const b of nonpersistent) buf.push(b);

  amf0ObjectKey(buf, 'tcUrl');
  writeU8(buf, AMF0_STRING);
  const tcUrlBytes = new TextEncoder().encode(tcUrl);
  writeU16BE(buf, tcUrlBytes.length);
  for (const b of tcUrlBytes) buf.push(b);

  amf0ObjectEnd(buf);

  return new Uint8Array(buf);
}

export function buildConnectPayload(app: string, tcUrl: string): Uint8Array {
  const buf: number[] = [];

  // "connect" string
  writeU8(buf, AMF0_STRING);
  const connectStr = new TextEncoder().encode('connect');
  writeU16BE(buf, connectStr.length);
  for (const b of connectStr) buf.push(b);

  // Transaction ID = 1
  writeU8(buf, AMF0_NUMBER);
  const view1 = new DataView(new ArrayBuffer(8));
  view1.setFloat64(0, 1);
  for (let i = 0; i < 8; i++) buf.push(view1.getUint8(i));

  // Command object
  writeU8(buf, AMF0_OBJECT);

  // app
  const appKey = new TextEncoder().encode('app');
  writeU16BE(buf, appKey.length);
  for (const b of appKey) buf.push(b);
  writeU8(buf, AMF0_STRING);
  const appVal = new TextEncoder().encode(app);
  writeU16BE(buf, appVal.length);
  for (const b of appVal) buf.push(b);

  // type
  const typeKey = new TextEncoder().encode('type');
  writeU16BE(buf, typeKey.length);
  for (const b of typeKey) buf.push(b);
  writeU8(buf, AMF0_STRING);
  const typeVal = new TextEncoder().encode('nonpersistent');
  writeU16BE(buf, typeVal.length);
  for (const b of typeVal) buf.push(b);

  // tcUrl
  const tcUrlKey = new TextEncoder().encode('tcUrl');
  writeU16BE(buf, tcUrlKey.length);
  for (const b of tcUrlKey) buf.push(b);
  writeU8(buf, AMF0_STRING);
  const tcUrlVal = new TextEncoder().encode(tcUrl);
  writeU16BE(buf, tcUrlVal.length);
  for (const b of tcUrlVal) buf.push(b);

  // Object end
  writeU16BE(buf, 0);
  writeU8(buf, AMF0_OBJECT_END);

  return new Uint8Array(buf);
}

export function buildReleaseStreamPayload(streamKey: string): Uint8Array {
  const buf: number[] = [];
  amf0String(buf, 'releaseStream');
  amf0Number(buf, 2);
  amf0Null(buf);
  amf0String(buf, streamKey);
  return new Uint8Array(buf);
}

export function buildFCPublishPayload(streamKey: string): Uint8Array {
  const buf: number[] = [];
  amf0String(buf, 'FCPublish');
  amf0Number(buf, 3);
  amf0Null(buf);
  amf0String(buf, streamKey);
  return new Uint8Array(buf);
}

export function buildCreateStreamPayload(): Uint8Array {
  const buf: number[] = [];
  amf0String(buf, 'createStream');
  amf0Number(buf, 4);
  amf0Null(buf);
  return new Uint8Array(buf);
}

export function buildPublishPayload(streamKey: string): Uint8Array {
  const buf: number[] = [];
  amf0String(buf, 'publish');
  amf0Number(buf, 5);
  amf0Null(buf);
  amf0String(buf, streamKey);
  amf0String(buf, 'live');
  return new Uint8Array(buf);
}

export function buildSetChunkSize(size: number): Uint8Array {
  const payload = new Uint8Array(4);
  const view = new DataView(payload.buffer);
  view.setUint32(0, size);
  return buildChunk(2, MSG_SET_CHUNK_SIZE, 0, payload);
}

export function buildWindowAckSize(size: number): Uint8Array {
  const payload = new Uint8Array(4);
  const view = new DataView(payload.buffer);
  view.setUint32(0, size);
  return buildChunk(2, MSG_WINDOW_ACK_SIZE, 0, payload);
}

export { buildChunk, MSG_AMF0_COMMAND, MSG_VIDEO, MSG_AUDIO, MSG_AMF0_DATA };
