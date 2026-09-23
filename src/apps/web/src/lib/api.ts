import {
  type AccountProfile,
  accountProfileSchema,
  type Avatar,
  authHeader,
  type LeaderboardEntry,
  leaderboardEntrySchema,
  type MatchRecord,
  matchRecordSchema,
  type MatchSummary,
  matchSummarySchema,
} from '@dooz/protocol';
import { z } from 'zod';
import { httpBaseUrl } from './server-url';

/**
 * The HTTP half of the client.
 *
 * Every response is parsed against the schema the server promised rather than
 * cast, for the same reason the socket frames are: a server that has moved on
 * should produce a clear failure here rather than a screen of `undefined` three
 * components deep.
 */

export interface Credentials {
  accountId: string;
  token: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: string;
    body?: unknown;
    credentials?: Credentials | null;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.credentials) {
    headers['authorization'] = authHeader(options.credentials.accountId, options.credentials.token);
  }

  let response: Response;
  try {
    response = await fetch(`${httpBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    // A failed fetch is a network problem, not a server answer, and the two
    // want different words in front of the player.
    throw new ApiError('Could not reach the server', 0);
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : 'Something went wrong';
    throw new ApiError(message, response.status);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ApiError('The server sent something unexpected', response.status);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

const credentialsResponse = z.object({
  accountId: z.string(),
  token: z.string(),
  profile: accountProfileSchema,
});

const profileResponse = z.object({
  profile: accountProfileSchema,
  ranks: z.array(
    z.object({ mode: z.string(), rank: z.number().int().nullable(), division: z.string() }),
  ),
});

const leaderboardResponse = z.object({
  mode: z.string(),
  placementGames: z.number().int(),
  entries: z.array(leaderboardEntrySchema),
});

const matchesResponse = z.object({ matches: z.array(matchSummarySchema) });

export type ProfileResponse = z.infer<typeof profileResponse>;
export type LeaderboardResponse = z.infer<typeof leaderboardResponse>;

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export const api = {
  createAccount: (displayName?: string, avatar?: Avatar) =>
    request('/api/accounts', credentialsResponse, {
      method: 'POST',
      body: { ...(displayName ? { displayName } : {}), ...(avatar ? { avatar } : {}) },
    }),

  login: (displayName: string, password: string) =>
    request('/api/accounts/login', credentialsResponse, {
      method: 'POST',
      body: { displayName, password },
    }),

  claim: (credentials: Credentials, password: string) =>
    request('/api/accounts/claim', z.object({ profile: accountProfileSchema }), {
      method: 'POST',
      credentials,
      body: { password },
    }),

  profile: (credentials: Credentials, signal?: AbortSignal) =>
    request('/api/profile', profileResponse, { credentials, ...(signal ? { signal } : {}) }),

  updateProfile: (
    credentials: Credentials,
    changes: { displayName?: string; avatar?: Avatar },
  ): Promise<{ profile: AccountProfile }> =>
    request('/api/profile', z.object({ profile: accountProfileSchema }), {
      method: 'PATCH',
      credentials,
      body: changes,
    }),

  leaderboard: (mode: string, limit = 25, signal?: AbortSignal): Promise<LeaderboardResponse> =>
    request(
      `/api/leaderboard?mode=${encodeURIComponent(mode)}&limit=${limit}`,
      leaderboardResponse,
      signal ? { signal } : {},
    ),

  matches: (
    credentials: Credentials,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<{ matches: MatchSummary[] }> =>
    request(`/api/matches?limit=${limit}`, matchesResponse, {
      credentials,
      ...(signal ? { signal } : {}),
    }),

  match: (
    matchId: string,
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<MatchRecord> =>
    request(`/api/matches/${encodeURIComponent(matchId)}`, matchRecordSchema, {
      credentials,
      ...(signal ? { signal } : {}),
    }),

  report: (
    credentials: Credentials,
    matchId: string,
    reason: 'name' | 'stalling' | 'cheating' | 'other',
    detail?: string,
  ) =>
    request('/api/reports', z.object({ ok: z.boolean() }), {
      method: 'POST',
      credentials,
      body: { matchId, reason, ...(detail ? { detail } : {}) },
    }),
};

export type { LeaderboardEntry, MatchRecord, MatchSummary, AccountProfile };
