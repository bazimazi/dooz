import {
  competitiveProfileSchema,
  type CompetitiveProfile,
  ladderResponseSchema,
  type LadderResponse,
  type LiveGame,
  liveGamesResponseSchema,
  seasonsResponseSchema,
  type Season,
  tournamentResponseSchema,
  tournamentsResponseSchema,
} from '@/protocol/competitive';
import type { Tournament } from '@/protocol';
import { type Credentials, request } from '@/lib/api';

/**
 * HTTP calls for seasons, ladders, live games and tournaments.
 *
 * Every response is parsed against the shared schema like the rest of the
 * client's API. Live lists are never served from the offline cache: a list of
 * games in progress from an hour ago is worse than none.
 */
export const competitiveApi = {
  seasons: (signal?: AbortSignal): Promise<{ current: Season; seasons: Season[] }> =>
    request('/api/seasons', seasonsResponseSchema, signal ? { signal } : {}),

  ladder: (
    options: {
      mode: string;
      season?: number | 'current';
      limit?: number;
      offset?: number;
      aroundMe?: boolean;
    },
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<LadderResponse> => {
    const query = new URLSearchParams({
      mode: options.mode,
      season: String(options.season ?? 'current'),
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
      ...(options.aroundMe ? { around: 'me' } : {}),
    });
    return request(`/api/leaderboard?${query.toString()}`, ladderResponseSchema, {
      credentials,
      ...(signal ? { signal } : {}),
    });
  },

  profile: (credentials: Credentials, signal?: AbortSignal): Promise<CompetitiveProfile> =>
    request('/api/competitive/profile', competitiveProfileSchema, {
      credentials,
      ...(signal ? { signal } : {}),
    }),

  player: (accountId: string, signal?: AbortSignal): Promise<CompetitiveProfile> =>
    request(
      `/api/players/${encodeURIComponent(accountId)}/competitive`,
      competitiveProfileSchema,
      signal ? { signal } : {},
    ),

  live: async (limit = 20, signal?: AbortSignal): Promise<LiveGame[]> =>
    (
      await request(`/api/live?limit=${limit}`, liveGamesResponseSchema, {
        cache: false,
        ...(signal ? { signal } : {}),
      })
    ).games,

  tournaments: async (
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<Tournament[]> =>
    (
      await request('/api/tournaments', tournamentsResponseSchema, {
        credentials,
        cache: false,
        ...(signal ? { signal } : {}),
      })
    ).tournaments,

  tournament: async (
    id: string,
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<Tournament> =>
    (
      await request(`/api/tournaments/${encodeURIComponent(id)}`, tournamentResponseSchema, {
        credentials,
        cache: false,
        ...(signal ? { signal } : {}),
      })
    ).tournament,
};
