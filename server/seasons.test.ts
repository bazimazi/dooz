import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Accounts } from './db/accounts.js';
import { type Db, openDatabase } from './db/database.js';
import { Matches } from './db/matches.js';
import {
  freshGlicko,
  type Glicko,
  PLACEMENT_GAMES,
  RATING_PERIOD_MS,
  STARTING_RATING,
} from './rating.js';
import { Seasons } from './seasons.js';

const DAY = 24 * 60 * 60 * 1000;
const LENGTH = 28 * DAY;

let db: Db;
let accounts: Accounts;
let seasons: Seasons;
let clock: number;

beforeEach(() => {
  clock = 1_700_000_000_000;
  db = openDatabase(':memory:');
  accounts = new Accounts(db, () => clock);
  seasons = new Seasons(db, { now: () => clock, lengthMs: LENGTH });
});

afterEach(() => db.close());

function rated(rating: number, rd = 60): Glicko {
  return { rating, rd, volatility: 0.06 };
}

/** A player with `games` ranked results this season, ending on `rating`. */
function player(name: string, rating: number, games = PLACEMENT_GAMES, mode = 'grid-6'): string {
  const { account } = accounts.create(name, 'fox');
  for (let game = 0; game < games; game++) {
    accounts.recordResult(account.id, mode, 'win', rated(rating), true, seasons.seasonId());
  }
  return account.id;
}

describe('the first season', () => {
  it('opens on first use and lasts the configured length', () => {
    const season = seasons.current();
    expect(season.id).toBe(1);
    expect(season.startsAt).toBe(clock);
    expect(season.endsAt).toBe(clock + LENGTH);
    expect(season.closedAt).toBeNull();
  });

  it('carries the ranked record that existed before seasons did', () => {
    const fresh = openDatabase(':memory:');
    try {
      const before = new Accounts(fresh, () => clock);
      const matches = new Matches(fresh);
      const { account: ada } = before.create('Ada', 'fox');
      const { account: bob } = before.create('Bob', 'owl');
      for (let game = 0; game < PLACEMENT_GAMES; game++) {
        matches.record({
          mode: 'grid-6',
          config: { variant: 'classic', size: 6, winLength: 4 },
          kind: 'ranked',
          xId: ada.id,
          oId: bob.id,
          startingPlayer: 1,
          moves: [],
          moveTimesMs: [],
          winner: 1,
          reason: 'resign',
          playedAt: clock,
          durationMs: 1,
          rating: null,
        });
        before.recordResult(ada.id, 'grid-6', 'win', rated(1400), true);
        before.recordResult(bob.id, 'grid-6', 'loss', rated(1100), true);
      }

      const later = new Seasons(fresh, { now: () => clock, lengthMs: LENGTH });
      const page = later.ladder('grid-6', later.seasonId(), 10, 0)!;
      expect(page.entries.map((entry) => entry.profile.displayName)).toEqual(['Ada', 'Bob']);
      expect(page.entries[0]).toMatchObject({ won: PLACEMENT_GAMES, lost: 0 });
      expect(page.entries[1]).toMatchObject({ won: 0, lost: PLACEMENT_GAMES });
    } finally {
      fresh.close();
    }
  });
});

describe('the live ladder', () => {
  it('orders placed players by rating and labels their tier', () => {
    player('Low', 1150);
    player('High', 1720);
    player('Mid', 1380);

    const page = seasons.ladder('grid-6', seasons.seasonId(), 10, 0)!;
    expect(page.total).toBe(3);
    expect(page.entries.map((entry) => [entry.rank, entry.profile.displayName])).toEqual([
      [1, 'High'],
      [2, 'Mid'],
      [3, 'Low'],
    ]);
    expect(page.entries[0]!.label).toBe('Diamond III');
    expect(page.entries[1]!.label).toBe('Gold II');
  });

  it('leaves out players still in their placement matches', () => {
    player('Placed', 1300);
    player('Placing', 1900, PLACEMENT_GAMES - 1);
    const page = seasons.ladder('grid-6', seasons.seasonId(), 10, 0)!;
    expect(page.entries.map((entry) => entry.profile.displayName)).toEqual(['Placed']);
  });

  it('leaves out a rating that has gone untested too long', () => {
    player('Active', 1300);
    const idle = player('Idle', 1800);
    expect(seasons.rankOf(idle, 'grid-6', seasons.seasonId())).toBe(1);

    clock += 400 * RATING_PERIOD_MS;
    // Rolled over many times by now; look at a season that is still open.
    expect(seasons.rankOf(idle, 'grid-6', 1)).toBeNull();
  });

  it('leaves out bots and accounts under review', () => {
    const cheat = player('Cheat', 2000);
    player('Honest', 1300);
    db.prepare(
      `INSERT INTO anticheat_flags (id, account_id, kind, severity, score, detail, created_at)
       VALUES ('f1', ?, 'engine', 'high', 1, '{}', ?)`,
    ).run(cheat, clock);
    const bot = player('Robo', 2100);
    db.prepare('UPDATE accounts SET bot = 1 WHERE id = ?').run(bot);

    const page = seasons.ladder('grid-6', seasons.seasonId(), 10, 0)!;
    expect(page.entries.map((entry) => entry.profile.displayName)).toEqual(['Honest']);
  });

  it('pages, and centres a page on one player', () => {
    const ids = Array.from({ length: 30 }, (_, index) =>
      player(`P${index + 10}`, 1000 + index * 10),
    );
    const second = seasons.ladder('grid-6', seasons.seasonId(), 10, 10)!;
    expect(second.total).toBe(30);
    expect(second.entries[0]!.rank).toBe(11);

    // P10 has the lowest rating: last place.
    const around = seasons.around(ids[0]!, 'grid-6', seasons.seasonId(), 3)!;
    expect(around.entries.at(-1)!.rank).toBe(30);
    expect(around.entries.at(-1)!.profile.displayName).toBe('P10');
    expect(seasons.around('nobody', 'grid-6', seasons.seasonId())).toBeNull();
  });
});

describe('rolling over', () => {
  it('closes the season on the tick after it ends and opens the next', () => {
    seasons.tick(clock + LENGTH - 1);
    expect(seasons.current().id).toBe(1);

    clock += LENGTH;
    seasons.tick(clock);
    const next = seasons.current();
    expect(next.id).toBe(2);
    expect(next.startsAt).toBe(clock);
    expect(seasons.get(1)!.closedAt).toBe(clock);
  });

  it('archives the standings, rewards those who placed, and soft-resets ratings', () => {
    const champion = player('Champ', 1950);
    const runner = player('Runner', 1350);
    const unplaced = player('Late', 1600, 2);

    clock += LENGTH;
    seasons.tick(clock);

    const final = seasons.ladder('grid-6', 1, 10, 0)!;
    expect(final.entries.map((entry) => entry.profile.displayName)).toEqual(['Champ', 'Runner']);

    const history = seasons.history(champion);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ seasonId: 1, rank: 1, label: 'Master', rating: 1950 });
    expect(seasons.history(unplaced)[0]).toMatchObject({ rank: null, played: 2 });

    expect(seasons.awards(champion)[0]).toMatchObject({ badge: 'season-champion', mode: 'grid-6' });
    expect(seasons.awards(runner)[0]!.badge).toBe('season-top10');
    expect(seasons.awards(unplaced)).toEqual([]);

    // Pulled towards the start, still in order, and uncertain again.
    const after = accounts.statsFor(champion, 'grid-6');
    expect(after.rating).toBeLessThan(1950);
    expect(after.rating).toBeGreaterThan(accounts.statsFor(runner, 'grid-6').rating);
    expect(after.rd).toBeGreaterThanOrEqual(150);

    // Everybody starts the new season unplaced.
    expect(seasons.ladder('grid-6', 2, 10, 0)!.entries).toEqual([]);
  });

  it('never rates a player who never played ranked', () => {
    const { account } = accounts.create('Casual', 'fox');
    accounts.recordResult(account.id, 'grid-6', 'win', STARTING_RATING, false);
    clock += LENGTH;
    seasons.tick(clock);
    expect(accounts.statsFor(account.id, 'grid-6').rating).toBe(STARTING_RATING);
  });

  it('counts a new season from zero for a returning player', () => {
    const id = player('Back', 1400);
    clock += LENGTH;
    seasons.tick(clock);

    accounts.recordResult(id, 'grid-6', 'win', freshGlicko(), true, seasons.seasonId());
    expect(accounts.statsFor(id, 'grid-6')).toMatchObject({ seasonId: 2, seasonPlayed: 1 });
  });

  it('reports where a player stands this season, placements included', () => {
    const id = player('Me', 1380, 2);
    const [standing] = seasons.standings(id);
    expect(standing).toMatchObject({
      mode: 'grid-6',
      label: 'Gold II',
      seasonPlayed: 2,
      placementGames: PLACEMENT_GAMES,
      rank: null,
    });
    clock += DAY;
    expect(seasons.standings(id)[0]!.rd).toBeGreaterThanOrEqual(60);
  });
});
