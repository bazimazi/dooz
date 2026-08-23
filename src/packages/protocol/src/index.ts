import { z } from 'zod';

/**
 * Wire protocol for online play.
 *
 * Everything here is validated on arrival at both ends. The server treats
 * clients as hostile — it keeps the authoritative game state and only ever
 * accepts a move index, never a board — and the client validates too so that a
 * server-side change cannot crash the UI with an unexpected shape.
 */

export const PROTOCOL_VERSION = 1;

/** Room codes people read aloud, so ambiguous glyphs (0/O, 1/I/L) are excluded. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`), 'Invalid room code');

export const boardSizeSchema = z.union([z.literal(3), z.literal(6), z.literal(9)]);
export const playerSchema = z.union([z.literal(1), z.literal(2)]);
export const cellSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export const displayNameSchema = z.string().trim().min(1).max(24);

/** Authoritative game state, as the server sees it. */
export const snapshotSchema = z.object({
  size: boardSizeSchema,
  board: z.array(cellSchema),
  currentPlayer: playerSchema,
  status: z.enum(['playing', 'won', 'draw']),
  winner: playerSchema.nullable(),
  winLine: z.array(z.number().int().nonnegative()).nullable(),
  lastMove: z.number().int().nonnegative().nullable(),
});

export const opponentSchema = z.object({
  name: displayNameSchema,
  connected: z.boolean(),
});

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion('type', [
  /**
   * First message on every connection. Establishes the display name and, when
   * reconnecting, the identity used to reclaim a seat in an in-progress room.
   */
  z.object({
    type: z.literal('hello'),
    version: z.number().int(),
    name: displayNameSchema.optional(),
    clientId: z.uuid().optional(),
  }),
  /** Join the public queue for the given board size. */
  z.object({ type: z.literal('quickMatch'), boardSize: boardSizeSchema }),
  /** Open a private room and get back a code to share. */
  z.object({ type: z.literal('createRoom'), boardSize: boardSizeSchema }),
  z.object({ type: z.literal('joinRoom'), code: roomCodeSchema }),
  /** Leave the queue or the current room. */
  /** Change the display name shown to the opponent. */
  z.object({ type: z.literal('setName'), name: displayNameSchema }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('move'), index: z.number().int().nonnegative() }),
  /** Ask for another game. The board resets once both sides have asked. */
  z.object({ type: z.literal('rematch') }),
  z.object({ type: z.literal('ping') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  'badMessage',
  'versionMismatch',
  'roomNotFound',
  'roomFull',
  'notInRoom',
  'notYourTurn',
  'illegalMove',
  'rateLimited',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = (typeof ERROR_CODES)[number];

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), clientId: z.string(), version: z.number().int() }),
  z.object({ type: z.literal('searching'), boardSize: boardSizeSchema }),
  z.object({
    type: z.literal('roomCreated'),
    code: roomCodeSchema,
    boardSize: boardSizeSchema,
  }),
  z.object({
    type: z.literal('matched'),
    code: roomCodeSchema,
    /** Which mark this client plays. */
    you: playerSchema,
    opponent: opponentSchema,
    snapshot: snapshotSchema,
  }),
  z.object({ type: z.literal('state'), snapshot: snapshotSchema }),
  /** The opponent has asked for a rematch and is waiting on this client. */
  z.object({ type: z.literal('rematchOffered') }),
  /** The opponent's name or connection state changed. */
  z.object({ type: z.literal('opponentPresence'), opponent: opponentSchema }),
  z.object({ type: z.literal('opponentLeft') }),
  z.object({ type: z.literal('error'), code: errorCodeSchema, message: z.string() }),
  z.object({ type: z.literal('pong') }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Opponent = z.infer<typeof opponentSchema>;

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

/** Parse an inbound frame. Returns `null` rather than throwing on bad input. */
export function decodeClientMessage(raw: string): ClientMessage | null {
  return decodeWith(clientMessageSchema, raw);
}

export function decodeServerMessage(raw: string): ServerMessage | null {
  return decodeWith(serverMessageSchema, raw);
}

function decodeWith<T>(schema: z.ZodType<T>, raw: string): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
