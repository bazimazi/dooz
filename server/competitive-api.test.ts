import { authHeader } from '@/protocol';
import {
  competitiveProfileSchema,
  ladderResponseSchema,
  liveGamesResponseSchema,
  seasonsResponseSchema,
  tournamentResponseSchema,
  tournamentsResponseSchema,
} from '@/protocol/competitive';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi } from './api.js';
import { createCompetitiveApi } from './competitive-api.js';
import { PLACEMENT_GAMES } from './rating.js';
import { Seasons } from './seasons.js';
import { CONFIGS, createHarness, type Harness } from './test-support.js';
import { Tournaments } from './tournaments.js';

const LENGTH = 28 * 24 * 60 * 60 * 1000;

let harness: Harness | null = null;
afterEach(() => {
  harness?.close();
  harness = null;
});

function setup() {
  const h = createHarness();
  harness = h;
  const seasons = new Seasons(h.db, { now: () => h.now(), lengthMs: LENGTH });
  // Opened at boot, as the server does.
  seasons.current();
  const tournaments = new Tournaments(h.db, h.accounts, { now: () => h.now(), arenas: false });
  tournaments.attach(h.lobby);
  h.lobby.use(seasons);
  h.lobby.use(tournaments);

  const app = new Hono();
  app.route(
    '/',
    createApi({
      accounts: h.accounts,
      matches: h.matches,
      db: h.db,
      now: () => h.now(),
      seasons,
      health: () => ({ sessions: 0, rooms: 0, queued: 0 }),
    }),
  );
  app.route(
    '/',
    createCompetitiveApi({
      accounts: h.accounts,
      seasons,
      tournaments,
      live: (limit) => h.lobby.liveGames(limit),
    }),
  );

  async function get(path: string, auth?: { accountId: string; token: string }) {
    const headers = new Headers();
    if (auth) headers.set('authorization', authHeader(auth.accountId, auth.token));
    const response = await app.request(path, { headers });
    return { status: response.status, body: (await response.json()) as unknown };
  }

  /** An account with credentials and a placed rating this season. */
  function placed(name: string, rating: number) {
    const { account, token } = h.accounts.create(name, 'fox');
    for (let game = 0; game < PLACEMENT_GAMES; game++) {
      h.accounts.recordResult(
        account.id,
        'grid-6',
        'win',
        { rating, rd: 60, volatility: 0.06 },
        true,
        seasons.seasonId(),
      );
    }
    return { accountId: account.id, token };
  }

  return { h, seasons, tournaments, get, placed };
}

describe('GET /api/leaderboard', () => {
  it('returns the current season’s ladder with tiers', async () => {
    const { get, placed } = setup();
    placed('High', 1750);
    placed('Low', 1150);

    const { status, body } = await get('/api/leaderboard?mode=grid-6');
    expect(status).toBe(200);
    const page = ladderResponseSchema.parse(body);
    expect(page.season.id).toBe(1);
    expect(page.total).toBe(2);
    expect(page.entries.map((entry) => entry.label)).toEqual(['Diamond III', 'Silver III']);
    expect(page.me).toBeNull();
  });

  it('centres on the asker and reports their own row', async () => {
    const { get, placed } = setup();
    const players = Array.from({ length: 40 }, (_, index) =>
      placed(`P${index + 10}`, 1000 + index * 10),
    );
    const me = players[5]!;

    const { body } = await get('/api/leaderboard?mode=grid-6&limit=11&around=me', me);
    const page = ladderResponseSchema.parse(body);
    expect(page.me?.rank).toBe(35);
    expect(page.entries.some((entry) => entry.profile.accountId === me.accountId)).toBe(true);
    expect(page.offset).toBe(29);
  });

  it('serves a closed season as it ended', async () => {
    const { h, get, placed, seasons } = setup();
    placed('Old', 1500);
    h.advance(LENGTH);
    expect(seasons.current().id).toBe(2);

    const past = ladderResponseSchema.parse(
      (await get('/api/leaderboard?mode=grid-6&season=1')).body,
    );
    expect(past.season.closedAt).not.toBeNull();
    expect(past.entries[0]!.profile.displayName).toBe('Old');

    const now = ladderResponseSchema.parse((await get('/api/leaderboard?mode=grid-6')).body);
    expect(now.entries).toEqual([]);
  });

  it('refuses a season that does not exist', async () => {
    const { get } = setup();
    expect((await get('/api/leaderboard?season=99')).status).toBe(404);
    expect((await get('/api/leaderboard?season=abc')).status).toBe(404);
  });
});

describe('GET /api/seasons', () => {
  it('lists the current season and its predecessors', async () => {
    const { h, get } = setup();
    h.advance(LENGTH);
    const body = seasonsResponseSchema.parse((await get('/api/seasons')).body);
    expect(body.current.id).toBe(2);
    expect(body.seasons.map((season) => season.id)).toEqual([2, 1]);
  });
});

describe('competitive profiles', () => {
  it('shows a player’s standing, history and awards', async () => {
    const { h, get, placed } = setup();
    const me = placed('Me', 1960);
    h.advance(LENGTH);

    const own = await get('/api/competitive/profile', me);
    const profile = competitiveProfileSchema.parse(own.body);
    expect(profile.history[0]).toMatchObject({ seasonId: 1, rank: 1, label: 'Master' });
    expect(profile.awards[0]!.badge).toBe('season-champion');
    expect(profile.standings[0]).toMatchObject({ mode: 'grid-6', seasonPlayed: 0 });

    const theirs = await get(`/api/players/${me.accountId}/competitive`);
    expect(competitiveProfileSchema.parse(theirs.body).history).toHaveLength(1);
  });

  it('needs credentials for the own-profile route', async () => {
    const { get } = setup();
    expect((await get('/api/competitive/profile')).status).toBe(401);
    expect((await get('/api/players/nobody/competitive')).status).toBe(404);
  });
});

describe('GET /api/live', () => {
  it('lists public games in progress, ranked first, and never private rooms', async () => {
    const { h, get } = setup();
    const a = h.join('Ada');
    const b = h.join('Bob');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    const c = h.join('Cat');
    const d = h.join('Dan');
    c.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
    d.send({ type: 'queue', config: CONFIGS.grid6, ranked: true });
    const host = h.join('Host');
    host.send({ type: 'createRoom', config: CONFIGS.classic });
    h.join('Guest').send({ type: 'joinRoom', code: host.last('roomCreated')!.code });

    const body = liveGamesResponseSchema.parse((await get('/api/live')).body);
    expect(body.games.map((game) => game.kind)).toEqual(['ranked', 'casual']);
    expect(body.games[0]!.code).toBe(c.last('matched')!.code);

    // Anyone can watch from the list.
    const watcher = h.join('Watcher');
    watcher.send({ type: 'spectate', code: body.games[0]!.code });
    expect(watcher.last('matched')?.you).toBeNull();
  });

  it('drops a game from the list once it is decided', async () => {
    const { h, get } = setup();
    const a = h.join('Ada');
    const b = h.join('Bob');
    a.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    b.send({ type: 'queue', config: CONFIGS.classic, ranked: false });
    a.send({ type: 'resign' });
    expect(liveGamesResponseSchema.parse((await get('/api/live')).body).games).toEqual([]);
  });
});

describe('tournaments', () => {
  it('lists arenas and opens one by id, saying whether the asker joined', async () => {
    const { h, tournaments, get } = setup();
    const event = tournaments.create({
      kind: 'arena',
      name: 'Grid Arena',
      mode: 'grid-6',
      config: CONFIGS.grid6,
      startsAt: h.now() + 60_000,
      endsAt: h.now() + 1_860_000,
      maxPlayers: 300,
      berserk: true,
      hostId: null,
    });
    const player = h.join('Ada');
    player.send({ type: 'tournamentJoin', id: event.id });

    const list = tournamentsResponseSchema.parse((await get('/api/tournaments')).body);
    expect(list.tournaments.map((entry) => entry.id)).toEqual([event.id]);

    const one = await get(`/api/tournaments/${event.id}`, {
      accountId: player.accountId,
      token: player.token,
    });
    const parsed = tournamentResponseSchema.parse(one.body);
    expect(parsed.tournament).toMatchObject({ status: 'scheduled', joined: true, players: 1 });

    expect((await get('/api/tournaments/not-a-code')).status).toBe(404);
    expect((await get('/api/tournaments/ZZZZZZ')).status).toBe(404);
  });
});
