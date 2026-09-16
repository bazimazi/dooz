import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { serve } from '@hono/node-server';
import { decodeClientMessage, encode, PROTOCOL_VERSION } from '@dooz/protocol';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebSocketServer, type WebSocket } from 'ws';
import { Lobby } from './lobby.js';
import type { Session } from './types.js';

const PORT = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65_535) {
  throw new Error(`PORT must be a port number, got ${process.env.PORT}`);
}

const HOST = process.env.HOST ?? '0.0.0.0';
/** Comma-separated list, or `*` to allow any origin (the default in development). */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? '*';
const ORIGIN_ALLOWLIST = ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const SWEEP_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
/** Refuse frames larger than any legitimate client message could possibly be. */
const MAX_FRAME_BYTES = 4 * 1024;
/** How long a shutdown waits for sockets to close before forcing the issue. */
const SHUTDOWN_GRACE_MS = 5_000;

/**
 * Whether a WebSocket handshake carrying this `Origin` may proceed.
 *
 * The CORS middleware below does not cover this: a WebSocket handshake is not
 * subject to the same-origin policy, so without an explicit check here any page
 * on the internet could open a socket to this server and drive a game on it.
 *
 * A missing `Origin` is allowed through - it is what the desktop and mobile
 * builds send, and any non-browser client can set the header to anything it
 * likes anyway. The header defends browser users against other websites; it was
 * never a way to authenticate a client.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (ALLOWED_ORIGINS === '*' || origin === undefined) return true;
  return ORIGIN_ALLOWLIST.includes(origin);
}

const lobby = new Lobby();

const app = new Hono();

app.use('*', cors({ origin: ALLOWED_ORIGINS === '*' ? '*' : ORIGIN_ALLOWLIST }));

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    version: PROTOCOL_VERSION,
    sessions: lobby.sessionCount,
    rooms: lobby.roomCount,
    queued: lobby.queuedCount,
  }),
);

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST, createServer }, (info) => {
  console.log(`dooz server listening on http://${HOST}:${info.port} (ws: /ws)`);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });

server.on('upgrade', (request, socket, head) => {
  const { url } = request;
  if (!url || new URL(url, 'http://localhost').pathname !== '/ws') {
    socket.destroy();
    return;
  }
  if (!isOriginAllowed(request.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  if (lobby.atCapacity) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
});

wss.on('connection', (socket: WebSocket) => {
  const session: Session = lobby.connect({
    send: (message) => {
      if (socket.readyState === socket.OPEN) socket.send(encode(message));
    },
    close: () => socket.close(),
  });

  // Terminate connections that stop answering pings, so dead sockets do not
  // hold seats open past the reconnect grace period.
  let alive = true;
  socket.on('pong', () => {
    alive = true;
  });
  const heartbeat = setInterval(() => {
    if (!alive) {
      socket.terminate();
      return;
    }
    alive = false;
    socket.ping();
  }, HEARTBEAT_INTERVAL_MS);

  socket.on('message', (data, isBinary) => {
    // A client is only ever expected to send JSON text. Anything binary, or a
    // frame arriving as fragments, is rejected rather than coerced.
    if (isBinary || Array.isArray(data)) {
      session.transport.send({
        type: 'error',
        code: 'badMessage',
        message: 'Expected a text frame.',
      });
      return;
    }

    // `ws` hands over a Buffer or an ArrayBuffer depending on how the frame
    // arrived; normalise before decoding rather than relying on `toString()`.
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : Buffer.from(data).toString('utf8');
    const message = decodeClientMessage(text);
    if (!message) {
      session.transport.send({
        type: 'error',
        code: 'badMessage',
        message: 'Unrecognised message.',
      });
      return;
    }
    try {
      lobby.handle(session, message);
    } catch (error) {
      console.error('failed to handle message', message.type, error);
      session.transport.send({ type: 'error', code: 'badMessage', message: 'Server error.' });
    }
  });

  socket.on('close', () => {
    clearInterval(heartbeat);
    lobby.disconnect(session);
  });

  socket.on('error', () => socket.close());
});

const sweeper = setInterval(() => lobby.sweep(), SWEEP_INTERVAL_MS);

/**
 * Stop accepting work and go.
 *
 * `wss.close()` only refuses new connections; established ones stay open, and
 * an HTTP server with a live socket on it never finishes closing. So every
 * client is terminated explicitly, and a timer forces the exit in case one of
 * them still will not let go - a container runtime that asked politely with
 * SIGTERM will otherwise follow up with SIGKILL.
 */
let shuttingDown = false;

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  clearInterval(sweeper);
  for (const client of wss.clients) client.terminate();
  wss.close();

  const forced = setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS);
  forced.unref();
  server.close(() => {
    clearTimeout(forced);
    process.exit(0);
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, shutdown);
