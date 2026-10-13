import { RANKED_MODES } from '@/game/engine';
import { parseAuthHeader, roomCodeSchema } from '@/protocol';
import type {
  CompetitiveProfile,
  LadderResponse,
  LiveGame as WireLiveGame,
} from '@/protocol/competitive';
import { Hono } from 'hono';
import type { Accounts, AccountRow } from './db/accounts.js';
import type { LiveGame } from './lobby-hooks.js';
import { PLACEMENT_GAMES } from './rating.js';
import type { Seasons } from './seasons.js';
import type { Tournaments } from './tournaments.js';

/**
 * Read-only HTTP routes for the competitive layer: seasons, ladders, a
 * player's competitive record, the live games list and tournaments.
 *
 * Nothing here writes. Joining a tournament or spectating goes over the
 * socket, where the lobby can check the connection behind it.
 */

export interface CompetitiveApiOptions {
  readonly accounts: Accounts;
  readonly seasons: Seasons;
  readonly tournaments?: Tournaments;
  /** Public games in progress, strongest first. */
  readonly live?: (limit: number) => LiveGame[];
}

const MAX_PAGE = 100;
const MAX_LIVE = 50;

export function createCompetitiveApi(options: CompetitiveApiOptions): Hono {
  const { accounts, seasons, tournaments } = options;
  const app = new Hono();

  function viewer(header: string | undefined): AccountRow | null {
    const credentials = parseAuthHeader(header);
    return credentials ? accounts.authenticate(credentials.accountId, credentials.token) : null;
  }

  app.get('/api/seasons', (c) => c.json({ current: seasons.current(), seasons: seasons.list(50) }));

  /** The signed-in player's competitive record. */
  app.get('/api/competitive/profile', (c) => {
    const account = viewer(c.req.header('authorization'));
    if (!account) return c.json({ error: 'Unauthorized' }, 401);
    return c.json(competitiveProfile(seasons, account.id));
  });

  /** Anybody's competitive record, as their public profile shows it. */
  app.get('/api/players/:id/competitive', (c) => {
    const account = accounts.get(c.req.param('id'));
    if (!account || account.bot) return c.json({ error: 'Not found' }, 404);
    return c.json(competitiveProfile(seasons, account.id));
  });

  /** Public games in progress, for the "watch live" list. Private rooms never appear. */
  app.get('/api/live', (c) => {
    const limit = clampNumber(c.req.query('limit'), 20, 1, MAX_LIVE);
    const games: WireLiveGame[] = options.live?.(limit) ?? [];
    return c.json({ games });
  });

  app.get('/api/tournaments', (c) => {
    if (!tournaments) return c.json({ tournaments: [] });
    const account = viewer(c.req.header('authorization'));
    return c.json({ tournaments: tournaments.list(account?.id ?? null) });
  });

  app.get('/api/tournaments/:id', (c) => {
    const id = roomCodeSchema.safeParse(c.req.param('id'));
    if (!id.success || !tournaments) return c.json({ error: 'Not found' }, 404);
    const account = viewer(c.req.header('authorization'));
    const tournament = tournaments.get(id.data, account?.id ?? null);
    if (!tournament) return c.json({ error: 'Not found' }, 404);
    return c.json({ tournament });
  });

  return app;
}

export function competitiveProfile(seasons: Seasons, accountId: string): CompetitiveProfile {
  return {
    season: seasons.current(),
    standings: seasons.standings(accountId).slice(0, 50),
    history: seasons.history(accountId, 50),
    awards: seasons.awards(accountId, 50),
  };
}

/**
 * A page of a season's ladder, for `GET /api/leaderboard`.
 *
 * `season` is `current` or a season number; `around=me` (signed in) centres
 * the page on the asker. The asker's own rank and row come back as `me`
 * whenever they are on the ladder, so the client can pin them under the list.
 */
export function ladder(
  seasons: Seasons,
  query: {
    mode: string | undefined;
    season: string | undefined;
    limit: string | undefined;
    offset: string | undefined;
    around: string | undefined;
  },
  viewerId: string | null,
): LadderResponse | null {
  const mode = query.mode ?? RANKED_MODES[0]?.id ?? 'classic';
  const current = seasons.current();
  const seasonId =
    query.season === undefined || query.season === 'current' ? current.id : Number(query.season);
  if (!Number.isInteger(seasonId) || seasonId < 1) return null;

  const limit = clampNumber(query.limit, 25, 1, MAX_PAGE);
  let offset = clampNumber(query.offset, 0, 0, 1_000_000);

  const rank = viewerId ? seasons.rankOf(viewerId, mode, seasonId) : null;
  if (query.around === 'me' && rank !== null) {
    offset = Math.max(0, rank - 1 - Math.floor(limit / 2));
  }

  const page = seasons.ladder(mode, seasonId, limit, offset);
  if (!page) return null;

  let me: LadderResponse['me'] = null;
  if (viewerId && rank !== null) {
    const entry =
      page.entries.find((row) => row.profile.accountId === viewerId) ??
      seasons.ladder(mode, seasonId, 1, rank - 1)?.entries[0];
    if (entry) me = { rank, entry };
  }

  return {
    mode,
    placementGames: PLACEMENT_GAMES,
    season: page.season,
    total: page.total,
    offset,
    entries: page.entries,
    me,
  };
}

function clampNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}
