import { z } from 'zod';
import {
  isGameConfig,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  moveSpace,
  OPENING_RULES,
  VARIANT_IDS,
} from '@/game/engine';

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
 * draw offers, emotes, spectators and rating results. Version 4 added the
 * gravity and vanish rule sets - an older client cannot parse a snapshot of
 * either, so it is told to reload rather than handed a board it would reject.
 * Version 5 added blocked squares, config options (exact runs, opening rules,
 * seeds), move codes beyond the cell range, and per-variant extra state.
 */

export const PROTOCOL_VERSION = 5;

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
/** Empty, X, O, or a blocked square. */
export const cellSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

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

export { VARIANT_IDS };
export const variantSchema = z.enum(VARIANT_IDS);

export { MAX_BOARD_SIZE, MIN_BOARD_SIZE };

/**
 * The rules a game is played under.
 *
 * The shape is checked here and the meaning by the engine's own
 * `isGameConfig`: the board sizes each rule set is defined for, and which
 * options it supports, belong to the variant, so the transport asks the rules
 * rather than keeping a second copy that could drift from them.
 */
export const gameConfigSchema = z
  .object({
    variant: variantSchema,
    size: z.number().int().min(MIN_BOARD_SIZE).max(MAX_BOARD_SIZE),
    winLength: z.number().int().min(3).max(6),
    exact: z.boolean().optional(),
    opening: z.enum(OPENING_RULES).optional(),
    seed: z.number().int().min(0).max(0xffff_ffff).optional(),
  })
  .refine((config) => config.winLength <= config.size, {
    message: 'Win length cannot exceed the board size',
    path: ['winLength'],
  })
  .refine((config) => isGameConfig(config), {
    message: 'These rules do not support that board or option',
    path: ['variant'],
  });

export const ultimateMetaSchema = z
  .object({
    boards: z.array(cellSchema).length(9),
    drawn: z.array(z.boolean()).length(9),
    activeBoard: z.number().int().min(0).max(8).nullable(),
    winBoards: z.array(z.number().int().min(0).max(8)).length(3).nullable(),
  })
  .nullable();

const cellIndexSchema = z.number().int().min(0).max(255);
const powerChargesSchema = z.object({
  bomb: z.number().int().min(0).max(9),
  wall: z.number().int().min(0).max(9),
});
const quantumMarkSchema = z.object({
  player: playerSchema,
  move: z.number().int().min(1).max(9),
  cells: z.tuple([cellIndexSchema, cellIndexSchema]),
  at: cellIndexSchema.nullable(),
});

/**
 * The state a rule set carries beyond the board, one shape per `kind`.
 *
 * It is all derived from the config and the moves, so the client could rebuild
 * it by replaying them - but the board components read it on every render,
 * and the server already has it. A rule set that adds a `VariantExtra` member
 * adds its shape here; the cross-field check below insists the kind matches
 * the variant, so a snapshot cannot dress one rule set's state up as another's.
 */
export const variantExtraSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('pente'),
    captures: z.tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)]),
    captured: z.array(cellIndexSchema).max(16),
  }),
  z.object({
    kind: z.literal('quantum'),
    marks: z.array(quantumMarkSchema).max(9),
    pending: z.number().int().min(0).max(8).nullable(),
    cycle: z.array(cellIndexSchema).max(9).nullable(),
    classical: z.array(z.number().int().min(1).max(9).nullable()).length(9),
    collapsed: z.array(cellIndexSchema).max(9),
  }),
  z.object({ kind: z.literal('powers'), x: powerChargesSchema, o: powerChargesSchema }),
]);

/** Which `extra` kind each variant carries, for the ones that carry one. */
const EXTRA_KIND: Partial<Record<string, string>> = {
  pente: 'pente',
  quantum: 'quantum',
  powers: 'powers',
};

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
    extra: variantExtraSchema.optional(),
  })
  .refine((snapshot) => snapshot.board.length === snapshot.config.size * snapshot.config.size, {
    message: 'Board length does not match the board size',
    path: ['board'],
  })
  .refine(
    (snapshot) =>
      [
        ...(snapshot.winLine ?? []),
        ...(snapshot.lastMove === null ? [] : [snapshot.lastMove]),
      ].every((index) => index < snapshot.board.length),
    { message: 'Cell index outside the board', path: ['winLine'] },
  )
  .refine(
    // Moves are codes rather than cells for rule sets with more than one kind
    // of action, so they are bounded by the rules' move space instead.
    (snapshot) => {
      const limit = moveSpace(snapshot.config);
      return snapshot.moves.every((move) => move < limit);
    },
    { message: 'Move outside the rules', path: ['moves'] },
  )
  .refine((snapshot) => (snapshot.config.variant === 'ultimate') === (snapshot.ultimate !== null), {
    message: 'Ultimate state must accompany an Ultimate game and no other',
    path: ['ultimate'],
  })
  .refine(
    (snapshot) =>
      (snapshot.extra?.kind ?? 'none') === 'none' ||
      EXTRA_KIND[snapshot.config.variant] === snapshot.extra?.kind,
    { message: 'Extra state belongs to a different rule set', path: ['extra'] },
  )
  .refine(
    (snapshot) =>
      [
        ...(snapshot.extra?.kind === 'pente' ? snapshot.extra.captured : []),
        ...(snapshot.extra?.kind === 'quantum'
          ? [
              ...snapshot.extra.collapsed,
              ...(snapshot.extra.cycle ?? []),
              ...snapshot.extra.marks.flatMap((mark) => [...mark.cells, mark.at ?? 0]),
            ]
          : []),
      ].every((index) => index < snapshot.board.length),
    { message: 'Cell index outside the board', path: ['extra'] },
  );

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

/**
 * Something for one player's attention that is not part of a game: a friend's
 * challenge, a friend request, a correspondence move, a tournament starting.
 *
 * Delivered over the socket when the player is connected, kept in a short
 * server-side inbox the app polls when it is not, and sent as a Web Push when
 * the player has opted in. The same id arrives on every channel, so a client
 * that hears about it twice shows it once.
 */
export const NOTICE_KINDS = [
  'challenge',
  'challengeDeclined',
  'friendRequest',
  'friendAccepted',
  'correspondenceInvite',
  'correspondenceTurn',
  'correspondenceResult',
  'tournament',
  'system',
] as const;
export const noticeKindSchema = z.enum(NOTICE_KINDS);
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const noticeSchema = z.object({
  id: z.string().min(1).max(64),
  kind: noticeKindSchema,
  title: z.string().max(120),
  body: z.string().max(300),
  at: z.number().int().nonnegative(),
  /** In-app path to open, always relative so a notice cannot send anyone off-site. */
  url: z
    .string()
    .max(200)
    .regex(/^\/(?!\/)[\w\-./?=&%]*$/, 'Relative path only')
    .optional(),
  from: publicProfileSchema.optional(),
  /** Room to join, for a challenge. */
  code: roomCodeSchema.optional(),
  config: gameConfigSchema.optional(),
});
export type Notice = z.infer<typeof noticeSchema>;

// ---------------------------------------------------------------------------
// Tournaments
// ---------------------------------------------------------------------------

/** Tournament ids share the room-code alphabet, so they can be read aloud too. */
export const tournamentIdSchema = roomCodeSchema;

export const TOURNAMENT_KINDS = ['arena', 'bracket'] as const;
export const tournamentKindSchema = z.enum(TOURNAMENT_KINDS);
export type TournamentKind = (typeof TOURNAMENT_KINDS)[number];

export const TOURNAMENT_STATUSES = ['scheduled', 'running', 'finished'] as const;
export const tournamentStatusSchema = z.enum(TOURNAMENT_STATUSES);

/** Bracket sizes a private tournament may be created with. */
export const BRACKET_SIZES = [4, 8, 16] as const;

export const tournamentStandingSchema = z.object({
  rank: z.number().int().positive(),
  profile: publicProfileSchema,
  score: z.number().int().nonnegative(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  /** Two wins in a row puts a player on fire: their wins and draws count double. */
  fire: z.boolean(),
  /** Still taking pairings. A player who left keeps their score but is not paired. */
  active: z.boolean(),
});

export const bracketMatchSchema = z.object({
  a: publicProfileSchema.nullable(),
  b: publicProfileSchema.nullable(),
  /** 1 if `a` went through, 2 if `b` did; `null` until decided. */
  winner: z.union([z.literal(1), z.literal(2)]).nullable(),
  /** Room the match is being played in, for spectators. */
  code: roomCodeSchema.nullable(),
});

export const tournamentSchema = z.object({
  id: tournamentIdSchema,
  kind: tournamentKindSchema,
  name: z.string().max(60),
  mode: z.string().max(80),
  config: gameConfigSchema,
  status: tournamentStatusSchema,
  startsAt: z.number().int().nonnegative(),
  endsAt: z.number().int().nonnegative(),
  /** Players signed up, active or not. */
  players: z.number().int().nonnegative(),
  maxPlayers: z.number().int().positive(),
  /** Whether berserk (half your clock for an extra point) is allowed. */
  berserk: z.boolean(),
  /** Whether the account asking is signed up. */
  joined: z.boolean(),
  /** Account that created a private bracket; it alone may start it early. */
  hostId: z.string().nullable(),
  standings: z.array(tournamentStandingSchema).max(100),
  /** Rounds of a bracket, first round first. `null` for an arena. */
  bracket: z.array(z.array(bracketMatchSchema).max(8)).max(5).nullable(),
});

export type Tournament = z.infer<typeof tournamentSchema>;
export type TournamentStanding = z.infer<typeof tournamentStandingSchema>;

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
    /**
     * Whether a server bot may be offered after a long wait. Defaults to yes
     * for casual games; a bot is always labelled as one.
     */
    bots: z.boolean().optional(),
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
  /** Sign up for a tournament, or come back to one after leaving it. */
  z.object({ type: z.literal('tournamentJoin'), id: tournamentIdSchema }),
  /** Stop taking pairings. Points already scored are kept. */
  z.object({ type: z.literal('tournamentLeave'), id: tournamentIdSchema }),
  /** Create a private single-elimination bracket to invite friends into. */
  z.object({
    type: z.literal('tournamentCreate'),
    config: gameConfigSchema,
    size: z.union([z.literal(4), z.literal(8), z.literal(16)]),
  }),
  /** The host starts a bracket before it has filled up. */
  z.object({ type: z.literal('tournamentStart'), id: tournamentIdSchema }),
  /** In an arena game, before your first move: half your clock for a bonus point. */
  z.object({ type: z.literal('berserk') }),
  /**
   * Open a private room and invite one friend to it. The server answers with
   * the same `roomCreated` a private room gets, and tells the friend.
   */
  z.object({ type: z.literal('challenge'), accountId: accountIdSchema, config: gameConfigSchema }),
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
  /** No such tournament, or it cannot be joined, left or started now. */
  'tournamentUnavailable',
  /** The account is suspended. Not retried: the client says why and stops. */
  'banned',
  /** Not allowed for this account - not friends, blocked, or muted. */
  'forbidden',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = (typeof ERROR_CODES)[number];

/** What a finished match did to a player's rating. */
export const ratingChangeSchema = z.object({
  before: z.number().int(),
  after: z.number().int(),
  /** Rating deviation after the game. High means still settling. */
  rd: z.number().nonnegative().optional(),
  provisional: z.boolean().optional(),
  /** Ranked games this season, for the placement counter. */
  seasonPlayed: z.number().int().nonnegative().optional(),
  placementGames: z.number().int().nonnegative().optional(),
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
    /** Server time at which a bot will be offered if nobody turns up. */
    botAt: z.number().int().nonnegative().nullable().optional(),
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
    /** The tournament this game belongs to, if any. */
    tournament: z
      .object({ id: tournamentIdSchema, name: z.string(), berserk: z.boolean() })
      .nullable()
      .optional(),
    /** Seats that went berserk in this game. */
    berserk: z.array(playerSchema).max(2).optional(),
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
  /** A tournament this player is in changed: standings, pairing, start, end. */
  z.object({ type: z.literal('tournament'), tournament: tournamentSchema }),
  /** A seat went berserk; its clock is in the next `state`. */
  z.object({ type: z.literal('berserk'), player: playerSchema }),
  z.object({ type: z.literal('notice'), notice: noticeSchema }),
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
