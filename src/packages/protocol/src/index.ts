import { z } from 'zod';

/**
 * Wire protocol for online play.
 *
 * Everything here is validated on arrival at both ends. The server treats
 * clients as hostile - it keeps the authoritative game state and only ever
 * accepts a move index, never a board - and the client validates too so that a
 * server-side change cannot crash the UI with an unexpected shape.
 *
 * Version 3 replaced the fixed board-size field with a full game config, folded
 * the resume token into the account credentials, and added clocks, resignation,
 * draw offers, emotes, spectators and rating results.
 */

export const PROTOCOL_VERSION = 3;

/** Room codes people read aloud, so ambiguous glyphs (0/O, 1/I/L) are excluded. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`), 'Invalid room code');

export const playerSchema = z.union([z.literal(1), z.literal(2)]);
export const cellSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;

/**
 * Display names.
 *
 * Restricted rather than free text: this is the one string one player can put
 * in front of another, so it is limited to letters, digits and a few
 * separators, with no leading or trailing space and no runs of them. That rules
 * out impersonation by padding, right-to-left overrides and zero-width
 * characters without needing a moderation queue behind it.
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(DISPLAY_NAME_MIN)
  .max(DISPLAY_NAME_MAX)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u, 'Letters, numbers, spaces, . _ - only')
  .refine((name) => !/\s{2,}/.test(name), 'No double spaces');

/** Account id and token, both server-issued. The token is the secret half. */
export const ACCOUNT_TOKEN_LENGTH = 43;
export const accountIdSchema = z.uuid();
export const accountTokenSchema = z
  .string()
  .length(ACCOUNT_TOKEN_LENGTH)
  .regex(/^[\w-]+$/, 'Invalid token');

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

// ---------------------------------------------------------------------------
// Game shape
// ---------------------------------------------------------------------------

export const VARIANT_IDS = ['classic', 'gomoku', 'misere', 'ultimate'] as const;
export const variantSchema = z.enum(VARIANT_IDS);

export const MIN_BOARD_SIZE = 3;
export const MAX_BOARD_SIZE = 15;

/**
 * The rules a game is played under.
 *
 * The cross-field checks mirror the engine's own: a run longer than the board
 * could never be completed, and Ultimate is defined on one geometry only. They
 * are repeated here rather than imported so the protocol package stays free of
 * a dependency on the engine - the server checks both, and disagreeing would be
 * a bug either way.
 */
export const gameConfigSchema = z
  .object({
    variant: variantSchema,
    size: z.number().int().min(MIN_BOARD_SIZE).max(MAX_BOARD_SIZE),
    winLength: z.number().int().min(3).max(6),
  })
  .refine((config) => config.winLength <= config.size, {
    message: 'Win length cannot exceed the board size',
    path: ['winLength'],
  })
  .refine(
    (config) => config.variant !== 'ultimate' || (config.size === 9 && config.winLength === 3),
    {
      message: 'Ultimate is played on a 9x9 board with three in a row',
      path: ['variant'],
    },
  );

export const ultimateMetaSchema = z
  .object({
    boards: z.array(cellSchema).length(9),
    drawn: z.array(z.boolean()).length(9),
    activeBoard: z.number().int().min(0).max(8).nullable(),
    winBoards: z.array(z.number().int().min(0).max(8)).length(3).nullable(),
  })
  .nullable();

/**
 * Authoritative game state, as the server sees it.
 *
 * The cross-field checks are what stop a malformed frame reaching the board
 * components: a config and a board that disagree, or an index pointing off the
 * end of it, would otherwise render as a broken grid rather than be rejected.
 *
 * `moves` travels with it so the client can show the move history and replay a
 * finished game without a second round trip. It costs at most one number per
 * cell, which is never more than the board already costs.
 */
export const snapshotSchema = z
  .object({
    config: gameConfigSchema,
    board: z.array(cellSchema),
    currentPlayer: playerSchema,
    status: z.enum(['playing', 'won', 'draw']),
    winner: playerSchema.nullable(),
    winLine: z.array(z.number().int().nonnegative()).nullable(),
    lastMove: z.number().int().nonnegative().nullable(),
    moves: z.array(z.number().int().nonnegative()),
    ultimate: ultimateMetaSchema,
  })
  .refine((snapshot) => snapshot.board.length === snapshot.config.size * snapshot.config.size, {
    message: 'Board length does not match the board size',
    path: ['board'],
  })
  .refine(
    (snapshot) =>
      [
        ...(snapshot.winLine ?? []),
        ...snapshot.moves,
        ...(snapshot.lastMove === null ? [] : [snapshot.lastMove]),
      ].every((index) => index < snapshot.board.length),
    { message: 'Cell index outside the board', path: ['winLine'] },
  )
  .refine((snapshot) => (snapshot.config.variant === 'ultimate') === (snapshot.ultimate !== null), {
    message: 'Ultimate state must accompany an Ultimate game and no other',
    path: ['ultimate'],
  });

/**
 * Both clocks, as of `asOf`.
 *
 * Remaining time is sent rather than a deadline because the two ends do not
 * share a clock: the client subtracts its own elapsed time from `asOf`, which
 * is wrong only by the network delay rather than by the whole offset between
 * the two machines. `running` says whose clock the client should be counting
 * down, and is `null` whenever nothing is ticking.
 */
export const clockSchema = z.object({
  x: z.number().int().nonnegative(),
  o: z.number().int().nonnegative(),
  running: playerSchema.nullable(),
  incrementMs: z.number().int().nonnegative(),
  /** Server time when these values were taken, in epoch milliseconds. */
  asOf: z.number().int().nonnegative(),
});

export const EMOTES = ['gg', 'nice', 'oops', 'thinking', 'hurry', 'hello'] as const;
export const emoteSchema = z.enum(EMOTES);
export type Emote = (typeof EMOTES)[number];

export const AVATARS = [
  'fox',
  'owl',
  'cat',
  'bear',
  'frog',
  'whale',
  'robot',
  'ghost',
  'star',
  'bolt',
] as const;
export const avatarSchema = z.enum(AVATARS);
export type Avatar = (typeof AVATARS)[number];

/** How a match ended. Drives both the result copy and the rating update. */
export const END_REASONS = ['line', 'draw', 'resign', 'timeout', 'abandoned', 'agreed'] as const;
export const endReasonSchema = z.enum(END_REASONS);
export type EndReason = (typeof END_REASONS)[number];

export const MATCH_KINDS = ['ranked', 'casual', 'private'] as const;
export const matchKindSchema = z.enum(MATCH_KINDS);
export type MatchKind = (typeof MATCH_KINDS)[number];

/** The public half of an account: everything one player may see of another. */
export const publicProfileSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  avatar: avatarSchema,
  /** Rating in the mode currently being played, when there is one. */
  rating: z.number().int().nullable(),
  /** True for a bot seat, so the client can label it honestly. */
  bot: z.boolean().optional(),
});

export const seatSchema = z.object({
  player: playerSchema,
  profile: publicProfileSchema,
  connected: z.boolean(),
  wantsRematch: z.boolean(),
});

// ---------------------------------------------------------------------------
// Client -> server
// ---------------------------------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion('type', [
  /**
   * First message on every connection, and only ever sent once.
   *
   * The account credentials are the whole identity: the same pair reconnects
   * into a seat, so there is no separate resume token to keep in step with
   * them. A client with no account calls `POST /api/accounts` first.
   */
  z.object({
    type: z.literal('hello'),
    version: z.number().int(),
    accountId: accountIdSchema,
    token: accountTokenSchema,
  }),
  /** Join the queue. Ranked games are matched by rating and affect it. */
  z.object({
    type: z.literal('queue'),
    config: gameConfigSchema,
    ranked: z.boolean(),
  }),
  /** Open a private room and get back a code to share. Never rated. */
  z.object({ type: z.literal('createRoom'), config: gameConfigSchema }),
  z.object({ type: z.literal('joinRoom'), code: roomCodeSchema }),
  /** Watch a room without taking a seat. */
  z.object({ type: z.literal('spectate'), code: roomCodeSchema }),
  /** Leave the queue, the room, or the audience. */
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('move'), index: z.number().int().nonnegative() }),
  z.object({ type: z.literal('resign') }),
  z.object({ type: z.literal('offerDraw') }),
  z.object({ type: z.literal('respondDraw'), accept: z.boolean() }),
  /** Ask for another game. The board resets once both sides have asked. */
  z.object({ type: z.literal('rematch') }),
  z.object({ type: z.literal('emote'), emote: emoteSchema }),
  /** Stop showing the opponent's emotes for the rest of this match. */
  z.object({ type: z.literal('mute'), muted: z.boolean() }),
  z.object({ type: z.literal('ping') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---------------------------------------------------------------------------
// Server -> client
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  'badMessage',
  'versionMismatch',
  'unauthorized',
  'roomNotFound',
  'roomFull',
  'notInRoom',
  'notYourTurn',
  'illegalMove',
  'rateLimited',
  'serverFull',
  'notRankable',
  'alreadyPlaying',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = (typeof ERROR_CODES)[number];

/** What a finished match did to a player's rating. */
export const ratingChangeSchema = z.object({
  before: z.number().int(),
  after: z.number().int(),
});

export const matchResultSchema = z.object({
  matchId: z.string(),
  winner: playerSchema.nullable(),
  reason: endReasonSchema,
  kind: matchKindSchema,
  /** Present only for a ranked match, keyed by player. */
  rating: z.object({ x: ratingChangeSchema, o: ratingChangeSchema }).nullable(),
});

export const serverMessageSchema = z.discriminatedUnion('type', [
  /** Issued once per connection, in answer to `hello`. */
  z.object({
    type: z.literal('welcome'),
    version: z.number().int(),
    profile: publicProfileSchema,
    /**
     * This account already holds a seat, and a `matched` frame is on its way.
     *
     * Without it a client that reloads mid-game cannot tell "connected, idle,
     * do what you came here to do" from "connected, about to be put back into
     * the game you were already in" - and acting on the first reading sends a
     * queue request that abandons the second.
     */
    resumed: z.boolean(),
  }),
  z.object({
    type: z.literal('searching'),
    config: gameConfigSchema,
    ranked: z.boolean(),
    /** Players waiting in this queue, so the client can say something true. */
    queued: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('roomCreated'),
    code: roomCodeSchema,
    config: gameConfigSchema,
  }),
  z.object({
    type: z.literal('matched'),
    code: roomCodeSchema,
    kind: matchKindSchema,
    /** Which mark this client plays, or `null` when spectating. */
    you: playerSchema.nullable(),
    seats: z.array(seatSchema).max(2),
    snapshot: snapshotSchema,
    clock: clockSchema.nullable(),
    spectators: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('state'),
    snapshot: snapshotSchema,
    clock: clockSchema.nullable(),
  }),
  /** A match is over. Arrives with the final state, not instead of it. */
  z.object({ type: z.literal('result'), result: matchResultSchema }),
  z.object({ type: z.literal('rematchOffered') }),
  z.object({ type: z.literal('drawOffered') }),
  z.object({ type: z.literal('drawDeclined') }),
  /** Any seat's name, avatar or connection state changed. */
  z.object({ type: z.literal('seats'), seats: z.array(seatSchema).max(2) }),
  z.object({ type: z.literal('spectators'), count: z.number().int().nonnegative() }),
  z.object({ type: z.literal('emote'), from: playerSchema, emote: emoteSchema }),
  z.object({ type: z.literal('opponentLeft') }),
  z.object({ type: z.literal('error'), code: errorCodeSchema, message: z.string() }),
  z.object({ type: z.literal('pong') }),
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Clock = z.infer<typeof clockSchema>;
export type Seat = z.infer<typeof seatSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;
export type WireGameConfig = z.infer<typeof gameConfigSchema>;

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------

/** Everything a player may see of their own account. */
export const accountProfileSchema = publicProfileSchema.extend({
  createdAt: z.number().int(),
  /** True once a password has been set, so the account can move between devices. */
  claimed: z.boolean(),
  stats: z.array(
    z.object({
      mode: z.string(),
      rating: z.number().int(),
      played: z.number().int().nonnegative(),
      won: z.number().int().nonnegative(),
      lost: z.number().int().nonnegative(),
      drawn: z.number().int().nonnegative(),
      /** Longest run of wins ever, and the current one. */
      bestStreak: z.number().int().nonnegative(),
      streak: z.number().int(),
    }),
  ),
  achievements: z.array(z.object({ id: z.string(), unlockedAt: z.number().int() })),
});

export type AccountProfile = z.infer<typeof accountProfileSchema>;

export const createAccountRequestSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatar: avatarSchema.optional(),
});

export const credentialsSchema = z.object({
  accountId: accountIdSchema,
  token: accountTokenSchema,
});

export const loginRequestSchema = z.object({
  displayName: displayNameSchema,
  password: passwordSchema,
});

export const claimRequestSchema = z.object({ password: passwordSchema });

export const updateProfileRequestSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatar: avatarSchema.optional(),
});

export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  profile: publicProfileSchema,
  rating: z.number().int(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
});

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

/** A finished match, as listed in a profile's history. */
export const matchSummarySchema = z.object({
  matchId: z.string(),
  mode: z.string(),
  config: gameConfigSchema,
  kind: matchKindSchema,
  opponent: publicProfileSchema,
  /** From the point of view of the account that asked. */
  outcome: z.enum(['win', 'loss', 'draw']),
  reason: endReasonSchema,
  ratingDelta: z.number().int().nullable(),
  playedAt: z.number().int(),
  durationMs: z.number().int().nonnegative(),
  moveCount: z.number().int().nonnegative(),
});

export type MatchSummary = z.infer<typeof matchSummarySchema>;

/** Everything needed to replay a match, and nothing that is not. */
export const matchRecordSchema = matchSummarySchema.extend({
  config: gameConfigSchema,
  startingPlayer: playerSchema,
  moves: z.array(z.number().int().nonnegative()),
  /** Milliseconds spent on each move, parallel to `moves`. */
  moveTimesMs: z.array(z.number().int().nonnegative()),
  players: z.object({ x: publicProfileSchema, o: publicProfileSchema }),
  winner: playerSchema.nullable(),
});

export type MatchRecord = z.infer<typeof matchRecordSchema>;

export const reportRequestSchema = z.object({
  matchId: z.string().min(1).max(64),
  reason: z.enum(['name', 'stalling', 'cheating', 'other']),
  detail: z.string().max(300).optional(),
});

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

/** The `Authorization` header value a client sends with every HTTP call. */
export function authHeader(accountId: string, token: string): string {
  return `Bearer ${accountId}.${token}`;
}

/** Split an `Authorization` header back into its two halves, or `null`. */
export function parseAuthHeader(header: string | undefined): {
  accountId: string;
  token: string;
} | null {
  if (!header?.startsWith('Bearer ')) return null;
  const value = header.slice('Bearer '.length);
  const dot = value.indexOf('.');
  if (dot <= 0) return null;

  const accountId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  const parsed = credentialsSchema.safeParse({ accountId, token });
  return parsed.success ? parsed.data : null;
}
