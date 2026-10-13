import { X } from '@/game/engine';
import type { Tournament } from '@/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { Seasons } from './seasons.js';
import {
  type Client,
  CONFIGS,
  createHarness,
  currentSnapshot,
  type Harness,
} from './test-support.js';
import { seedOrder, Tournaments } from './tournaments.js';

const MINUTE = 60_000;

let harness: Harness | null = null;
afterEach(() => {
  harness?.close();
  harness = null;
});

function setup() {
  const h = createHarness();
  harness = h;
  const tournaments = new Tournaments(h.db, h.accounts, { now: () => h.now(), arenas: false });
  tournaments.attach(h.lobby);
  h.lobby.use(tournaments);
  return { h, tournaments };
}

function arena(tournaments: Tournaments, h: Harness, config = CONFIGS.grid6) {
  return tournaments.create({
    kind: 'arena',
    name: 'Test Arena',
    mode: 'grid-6',
    config,
    startsAt: h.now(),
    endsAt: h.now() + 30 * MINUTE,
    maxPlayers: 300,
    berserk: true,
    hostId: null,
  });
}

function latest(client: Client): Tournament | undefined {
  return client.last('tournament')?.tournament;
}

function standing(tournament: Tournament | undefined, client: Client) {
  return tournament?.standings.find((entry) => entry.profile.accountId === client.accountId);
}

/** Of two seated clients, the one to move and the other. */
function toMove(a: Client, b: Client) {
  const you = a.last('matched')!.you;
  return currentSnapshot(a)!.currentPlayer === you
    ? { mover: a, waiter: b }
    : { mover: b, waiter: a };
}

/** Let `winner` complete four in a row on a 6x6 board against `loser`, seven moves in all. */
function winGrid6(winner: Client, loser: Client): void {
  const { mover } = toMove(winner, loser);
  if (mover !== winner) loser.send({ type: 'move', index: 35 });
  const own = [0, 1, 2, 3];
  const theirs = [6, 7, 8, 9];
  for (let index = 0; index < own.length; index++) {
    winner.send({ type: 'move', index: own[index]! });
    if (index < own.length - 1) loser.send({ type: 'move', index: theirs[index]! });
  }
}

describe('seedOrder', () => {
  it('keeps the top seeds apart until the end', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe('arena', () => {
  it('pairs players who join once it starts, inside the tournament', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    const a = h.join('Ada');
    const b = h.join('Bob');
    a.send({ type: 'tournamentJoin', id: event.id });
    b.send({ type: 'tournamentJoin', id: event.id });
    expect(latest(a)?.joined).toBe(true);

    h.advance(1000);
    const matched = a.last('matched')!;
    expect(matched.tournament).toMatchObject({ id: event.id, berserk: true });
    expect(matched.kind).toBe('casual');
    expect(tournaments.get(event.id, null)!.status).toBe('running');
  });

  it('scores a win, puts a streak on fire, and doubles while it lasts', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    const a = h.join('Ada');
    const b = h.join('Bob');
    for (const client of [a, b]) client.send({ type: 'tournamentJoin', id: event.id });

    for (let game = 0; game < 3; game++) {
      a.clear();
      h.advance(7000);
      expect(a.last('matched')).toBeDefined();
      b.send({ type: 'resign' });
    }
    h.advance(3000);

    const view = tournaments.get(event.id, a.accountId)!;
    // 2 + 2, then on fire: 4.
    expect(standing(view, a)).toMatchObject({ score: 8, won: 3, played: 3, fire: true, rank: 1 });
    expect(standing(view, b)).toMatchObject({ score: 0, fire: false });
  });

  it('gives a berserk winner a bonus point, but only for a real game', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    const a = h.join('Ada');
    const b = h.join('Bob');
    for (const client of [a, b]) client.send({ type: 'tournamentJoin', id: event.id });
    h.advance(1000);

    const before = a.last('state')?.clock ?? a.last('matched')!.clock!;
    a.send({ type: 'berserk' });
    const you = a.last('matched')!.you!;
    expect(a.last('berserk')?.player).toBe(you);
    const after = a.last('state')!.clock!;
    expect(you === X ? after.x : after.o).toBeLessThanOrEqual(
      (you === X ? before.x : before.o) / 2,
    );

    // A second berserk changes nothing.
    a.send({ type: 'berserk' });
    expect(a.all('berserk')).toHaveLength(1);

    winGrid6(a, b);
    h.advance(3000);
    expect(standing(tournaments.get(event.id, null)!, a)?.score).toBe(3);
  });

  it('refuses berserk outside an arena and after the first move', () => {
    const { h, tournaments } = setup();
    const a = h.join('Ada');
    const b = h.join('Bob');
    a.send({ type: 'queue', config: CONFIGS.grid6, ranked: false });
    b.send({ type: 'queue', config: CONFIGS.grid6, ranked: false });
    a.send({ type: 'berserk' });
    expect(a.last('berserk')).toBeUndefined();

    const event = arena(tournaments, h);
    for (const client of [a, b]) client.send({ type: 'tournamentJoin', id: event.id });
    a.send({ type: 'leave' });
    h.advance(1000);
    const { mover, waiter } = toMove(a, b);
    mover.send({ type: 'move', index: 0 });
    waiter.send({ type: 'move', index: 5 });
    mover.send({ type: 'berserk' });
    expect(mover.last('berserk')).toBeUndefined();
  });

  it('never rematches a tournament game by hand', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    const a = h.join('Ada');
    const b = h.join('Bob');
    for (const client of [a, b]) client.send({ type: 'tournamentJoin', id: event.id });
    h.advance(1000);
    b.send({ type: 'resign' });
    a.clear();
    a.send({ type: 'rematch' });
    b.send({ type: 'rematch' });
    expect(a.last('matched')).toBeUndefined();
  });

  it('stops pairing a player who leaves, and keeps their points', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    const a = h.join('Ada');
    const b = h.join('Bob');
    for (const client of [a, b]) client.send({ type: 'tournamentJoin', id: event.id });
    h.advance(1000);
    b.send({ type: 'resign' });
    a.send({ type: 'tournamentLeave', id: event.id });
    a.clear();
    h.advance(10_000);
    expect(a.last('matched')).toBeUndefined();
    const view = tournaments.get(event.id, a.accountId)!;
    expect(view.joined).toBe(false);
    expect(standing(view, a)).toMatchObject({ score: 2, active: false });
  });

  it('finishes when time is up, and rewards the podium', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    const a = h.join('Ada');
    const b = h.join('Bob');
    for (const client of [a, b]) client.send({ type: 'tournamentJoin', id: event.id });
    h.advance(1000);
    b.send({ type: 'resign' });

    h.advance(31 * MINUTE);
    expect(tournaments.get(event.id, null)!.status).toBe('finished');
    expect(latest(a)?.status).toBe('finished');

    const seasons = new Seasons(h.db, { now: () => h.now() });
    expect(seasons.awards(a.accountId)[0]).toMatchObject({
      badge: 'arena-gold',
      source: 'tournament',
    });
    expect(seasons.awards(b.accountId)[0]).toMatchObject({ badge: 'arena-silver' });
  });

  it('lists arenas publicly, and refuses a join once finished', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    expect(tournaments.list(null).map((entry) => entry.id)).toContain(event.id);

    h.advance(31 * MINUTE);
    const late = h.join('Late');
    late.send({ type: 'tournamentJoin', id: event.id });
    expect(late.last('error')?.code).toBe('tournamentUnavailable');
  });

  it('keeps the points across a restart', () => {
    const { h, tournaments } = setup();
    const event = arena(tournaments, h);
    const a = h.join('Ada');
    const b = h.join('Bob');
    for (const client of [a, b]) client.send({ type: 'tournamentJoin', id: event.id });
    h.advance(1000);
    b.send({ type: 'resign' });
    h.advance(11_000);

    const again = new Tournaments(h.db, h.accounts, { now: () => h.now(), arenas: false });
    const view = again.get(event.id, a.accountId)!;
    expect(standing(view, a)?.score).toBe(2);
    // Back in the arena only once they say so.
    expect(view.joined).toBe(false);
  });

  it('publishes arenas on a schedule, rotating through the ranked modes', () => {
    const h = createHarness();
    harness = h;
    const tournaments = new Tournaments(h.db, h.accounts, {
      now: () => h.now(),
      arenaEveryMs: 60 * MINUTE,
      arenaLengthMs: 30 * MINUTE,
      announceMs: 120 * MINUTE,
    });
    tournaments.tick(h.now());
    const listed = tournaments.list(null);
    expect(listed.length).toBeGreaterThanOrEqual(2);
    expect(new Set(listed.map((entry) => entry.mode)).size).toBeGreaterThan(1);
    // Ticking again does not duplicate them.
    tournaments.tick(h.now());
    expect(tournaments.list(null)).toHaveLength(listed.length);
  });
});

describe('brackets', () => {
  function bracketOf(size: 4 | 8, players: number) {
    const { h, tournaments } = setup();
    const host = h.join('Host');
    host.send({ type: 'tournamentCreate', config: CONFIGS.classic, size });
    const id = latest(host)!.id;
    const guests = Array.from({ length: players - 1 }, (_, index) => h.join(`Guest${index}`));
    for (const guest of guests) guest.send({ type: 'tournamentJoin', id });
    return { h, tournaments, host, guests, id, all: [host, ...guests] };
  }

  /** Resign every game in progress from the side of whoever is not `keep`. */
  function resignAll(clients: Client[], keep: (client: Client) => boolean) {
    for (const client of clients) {
      const matched = client.last('matched');
      if (!matched || client.last('result') || keep(client)) continue;
      client.send({ type: 'resign' });
    }
  }

  it('starts by itself when full and plays down to one winner', () => {
    const { h, tournaments, host, all, id } = bracketOf(4, 4);
    h.advance(1000);
    const view = tournaments.get(id, host.accountId)!;
    expect(view.status).toBe('running');
    expect(view.bracket).toHaveLength(2);
    expect(all.filter((client) => client.last('matched')?.kind === 'private')).toHaveLength(4);

    // The host wins every game; in the other semi-final the first guest wins.
    resignAll(all, (client) => client === host || client === all[1]);
    for (const client of all) client.clear();
    h.advance(1000);
    expect(host.last('matched')).toBeDefined();
    resignAll(all, (client) => client === host);
    h.advance(1000);

    const done = tournaments.get(id, host.accountId)!;
    expect(done.status).toBe('finished');
    expect(done.standings[0]!.profile.accountId).toBe(host.accountId);
    const seasons = new Seasons(h.db, { now: () => h.now() });
    expect(seasons.awards(host.accountId)[0]).toMatchObject({ badge: 'bracket-winner' });
  });

  it('tells every entrant once when it starts', () => {
    const { h, tournaments } = setup();
    const heard: { name: string; ids: readonly string[] }[] = [];
    tournaments.onStarted((event, ids) => heard.push({ name: event.name, ids }));
    const host = h.join('Host');
    host.send({ type: 'tournamentCreate', config: CONFIGS.classic, size: 4 });
    const id = latest(host)!.id;
    const guests = Array.from({ length: 3 }, (_, index) => h.join(`Guest${index}`));
    for (const guest of guests) guest.send({ type: 'tournamentJoin', id });
    h.advance(1000);
    h.advance(1000);

    expect(heard).toHaveLength(1);
    expect(new Set(heard[0]!.ids)).toEqual(
      new Set([host, ...guests].map((client) => client.accountId)),
    );
  });

  it('lets only the host start early, giving the top seed a bye', () => {
    const { h, tournaments, guests, host, id } = bracketOf(4, 3);
    guests[0]!.send({ type: 'tournamentStart', id });
    expect(guests[0]!.last('error')?.code).toBe('tournamentUnavailable');

    // Make the host the top seed.
    h.accounts.recordResult(host.accountId, 'classic', 'win', 1500, false);
    host.send({ type: 'tournamentStart', id });
    h.advance(1000);
    const view = tournaments.get(id, null)!;
    const first = view.bracket![0]!;
    expect(first.some((game) => game.b === null && game.winner === 1)).toBe(true);
  });

  it('refuses a second open bracket from the same host and a join once started', () => {
    const { h, host, id } = bracketOf(4, 4);
    host.send({ type: 'tournamentCreate', config: CONFIGS.classic, size: 4 });
    expect(host.last('error')?.code).toBe('tournamentUnavailable');
    const late = h.join('Late');
    late.send({ type: 'tournamentJoin', id });
    expect(late.last('error')?.code).toBe('tournamentUnavailable');
  });

  it('replays a drawn match', () => {
    const { h, tournaments, all, id } = bracketOf(4, 2);
    all[0]!.send({ type: 'tournamentStart', id });
    h.advance(1000);
    const [a, b] = all as [Client, Client];
    a.send({ type: 'offerDraw' });
    b.send({ type: 'respondDraw', accept: true });
    a.clear();
    h.advance(1000);
    expect(a.last('matched')).toBeDefined();
    expect(tournaments.get(id, null)!.status).toBe('running');
  });

  it('forfeits a player who does not turn up', () => {
    const { h, tournaments, all, id } = bracketOf(4, 2);
    const [host, guest] = all as [Client, Client];
    guest.drop();
    host.send({ type: 'tournamentStart', id });
    h.advance(1000);
    h.advance(91_000);
    h.advance(1000);
    const view = tournaments.get(id, null)!;
    expect(view.status).toBe('finished');
    expect(view.standings[0]!.profile.accountId).toBe(host.accountId);
  });

  it('closes a bracket nobody started', () => {
    const { h, tournaments, id } = bracketOf(4, 2);
    h.advance(61 * MINUTE);
    expect(tournaments.get(id, null)!.status).toBe('finished');
  });

  it('is not listed to strangers but can be opened by code', () => {
    const { tournaments, host, id } = bracketOf(4, 2);
    expect(tournaments.list(null).some((entry) => entry.id === id)).toBe(false);
    expect(tournaments.list(host.accountId).some((entry) => entry.id === id)).toBe(true);
    expect(tournaments.get(id, null)?.kind).toBe('bracket');
  });
});
