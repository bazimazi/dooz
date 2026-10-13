import { z } from 'zod';
import {
  accountIdSchema,
  displayNameSchema,
  endReasonSchema,
  gameConfigSchema,
  noticeSchema,
  playerSchema,
  publicProfileSchema,
  ROOM_CODE_ALPHABET,
  snapshotSchema,
} from './index';

/**
 * HTTP shapes for the social, account-data and telemetry routes.
 *
 * Kept apart from the socket protocol in `index.ts` because none of it travels
 * over the socket except `notice`, and because the two change for different
 * reasons. Both ends parse against these, as they do the socket frames.
 */

// ---------------------------------------------------------------------------
// Friends and presence
// ---------------------------------------------------------------------------

export const FRIEND_CODE_LENGTH = 8;

/**
 * A friend code as a person types it: any case, with or without the dash the
 * app shows in the middle, from the same unambiguous alphabet as room codes.
 */
export const friendCodeSchema = z
  .string()
  .max(20)
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .length(FRIEND_CODE_LENGTH)
      .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`), 'Invalid friend code'),
  );

/** `XXXX-XXXX`, the form the app shows and people read aloud. */
export function formatFriendCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export const PRESENCES = ['offline', 'online', 'queue', 'playing'] as const;
export const presenceSchema = z.enum(PRESENCES);
export type Presence = (typeof PRESENCES)[number];

export const friendSchema = z.object({
  profile: publicProfileSchema,
  presence: presenceSchema,
  since: z.number().int(),
});
export type Friend = z.infer<typeof friendSchema>;

export const pendingFriendSchema = z.object({
  profile: publicProfileSchema,
  at: z.number().int(),
});
export type PendingFriend = z.infer<typeof pendingFriendSchema>;

export const MAX_FRIENDS = 200;

export const friendsResponseSchema = z.object({
  code: z.string().length(FRIEND_CODE_LENGTH),
  friends: z.array(friendSchema).max(MAX_FRIENDS),
  incoming: z.array(pendingFriendSchema),
  outgoing: z.array(pendingFriendSchema),
  blocked: z.array(pendingFriendSchema),
});
export type FriendsResponse = z.infer<typeof friendsResponseSchema>;

export const RELATIONS = ['none', 'friend', 'incoming', 'outgoing'] as const;
export const friendSearchResponseSchema = z.object({
  results: z.array(z.object({ profile: publicProfileSchema, relation: z.enum(RELATIONS) })).max(20),
});

/** Ask by code (typed or shared) or by account id (picked from a search). */
export const friendRequestSchema = z.union([
  z.object({ code: friendCodeSchema }),
  z.object({ accountId: accountIdSchema }),
]);

export const friendRequestResultSchema = z.object({
  status: z.enum(['sent', 'accepted']),
  profile: publicProfileSchema,
});

/** What the app learns each time it checks in: anything that arrived meanwhile. */
export const pulseResponseSchema = z.object({
  notices: z.array(noticeSchema).max(50),
  incomingRequests: z.number().int().nonnegative(),
  correspondenceTurns: z.number().int().nonnegative(),
});
export type PulseResponse = z.infer<typeof pulseResponseSchema>;

// ---------------------------------------------------------------------------
// Correspondence games
// ---------------------------------------------------------------------------

export const CORRESPONDENCE_DAYS = [1, 2, 3] as const;
export const CORRESPONDENCE_STATUSES = [
  'invited',
  'active',
  'finished',
  'declined',
  'expired',
] as const;

export const correspondenceGameSchema = z.object({
  id: z.uuid(),
  mode: z.string(),
  status: z.enum(CORRESPONDENCE_STATUSES),
  /** Which mark the asking player has. */
  you: playerSchema,
  opponent: publicProfileSchema,
  /** Whether the asking player sent the invitation. */
  invitedByYou: z.boolean(),
  snapshot: snapshotSchema,
  yourTurn: z.boolean(),
  moveWindowMs: z.number().int().positive(),
  /** When the player to move loses on time, or the invitation lapses. */
  deadlineAt: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  result: z
    .object({
      winner: playerSchema.nullable(),
      reason: endReasonSchema,
      matchId: z.string().nullable(),
    })
    .nullable(),
});
export type CorrespondenceGame = z.infer<typeof correspondenceGameSchema>;

export const correspondenceListSchema = z.object({
  games: z.array(correspondenceGameSchema).max(100),
});

export const createCorrespondenceSchema = z.object({
  opponentId: accountIdSchema,
  config: gameConfigSchema,
  daysPerMove: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const correspondenceMoveSchema = z.object({
  index: z.number().int().nonnegative(),
  /**
   * How many moves the client saw before this one. A move sent twice (a retry
   * after a dropped response) or against a position that has moved on is
   * refused rather than played somewhere the player did not intend.
   */
  ply: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

export const pushKeyResponseSchema = z.object({ publicKey: z.string().nullable() });

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1024),
  keys: z.object({
    p256dh: z
      .string()
      .min(80)
      .max(100)
      .regex(/^[\w-]+=*$/),
    auth: z
      .string()
      .min(16)
      .max(32)
      .regex(/^[\w-]+=*$/),
  }),
});

// ---------------------------------------------------------------------------
// Account data
// ---------------------------------------------------------------------------

export const RECOVERY_CODE_COUNT = 8;
/** `XXXX-XXXX-XXXX`: 12 characters of a 31-letter alphabet, about 59 bits. */
export const recoveryCodeSchema = z
  .string()
  .max(30)
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .length(12)
      .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`)),
  );

export const recoveryCodesResponseSchema = z.object({
  codes: z.array(z.string()).length(RECOVERY_CODE_COUNT),
});
export const recoveryStatusSchema = z.object({ remaining: z.number().int().nonnegative() });

export const recoverRequestSchema = z.object({
  displayName: displayNameSchema,
  code: recoveryCodeSchema,
});
export const recoverResponseSchema = z.object({
  accountId: z.string(),
  token: z.string(),
  remaining: z.number().int().nonnegative(),
});

export const deleteAccountRequestSchema = z.object({
  /** The account's display name, typed again: deletion cannot be undone. */
  confirm: z.string().max(40),
});

/** Cloud save payloads are small JSON objects; anything bigger is refused. */
export const CLOUD_SAVE_MAX_BYTES = 64 * 1024;
export const cloudSaveDataSchema = z.record(z.string().max(64), z.unknown());
export const cloudSaveSchema = z.object({
  revision: z.number().int().nonnegative(),
  data: cloudSaveDataSchema.nullable(),
  updatedAt: z.number().int().nullable(),
});
export type CloudSave = z.infer<typeof cloudSaveSchema>;
export const cloudSavePutSchema = z.object({ data: cloudSaveDataSchema });

// ---------------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------------

export const TELEMETRY_MAX_BYTES = 32 * 1024;
export const TELEMETRY_MAX_EVENTS = 50;
export const TELEMETRY_PLATFORMS = ['web', 'pwa', 'desktop', 'android', 'ios', 'unknown'] as const;

const telemetryName = z.string().regex(/^[a-zA-Z][\w.:-]{0,47}$/);
const telemetryData = z
  .record(
    z.string().regex(/^[a-zA-Z][\w]{0,31}$/),
    z.union([z.string().max(100), z.number().finite(), z.boolean()]),
  )
  .refine((data) => Object.keys(data).length <= 12, 'Too many fields');

export const telemetryEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('event'),
    name: telemetryName,
    at: z.number().int().nonnegative(),
    data: telemetryData.optional(),
  }),
  z.object({
    kind: z.literal('error'),
    name: telemetryName,
    at: z.number().int().nonnegative(),
    message: z.string().max(500),
    stack: z.string().max(4000).optional(),
    /** Where it was caught: `window`, `promise`, `route`. */
    source: z.string().max(40).optional(),
  }),
]);
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export const telemetryBatchSchema = z.object({
  v: z.literal(1),
  app: z.object({
    version: z.string().max(20),
    platform: z.enum(TELEMETRY_PLATFORMS),
  }),
  events: z.array(telemetryEventSchema).min(1).max(TELEMETRY_MAX_EVENTS),
});
export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;
