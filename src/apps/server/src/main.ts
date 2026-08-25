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
const HOST = process.env.HOST ?? '0.0.0.0';
/** Comma-separated list, or `*` to allow any origin (the default in development). */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? '*';

const SWEEP_INTERVAL_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
/** Refuse frames larger than any legitimate client message could possibly be. */
const MAX_FRAME_BYTES = 4 * 1024;

const lobby = new Lobby();

const app = new Hono();

app.use(
  '*',
  cors({
    origin: ALLOWED_ORIGINS === '*' ? '*' : ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
  }),
);

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

    //  hands over a Buffer or an ArrayBuffer depending on how the frame
    // arrived; normalise before decoding rather than relying on .
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

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(sweeper);
    wss.close();
    server.close(() => process.exit(0));
  });
}
