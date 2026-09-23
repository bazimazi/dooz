import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLACEMENT_GAMES, STARTING_RATING } from '../rating.js';
import { Accounts } from './accounts.js';
import { type Db, openDatabase } from './database.js';

let db: Db;
let accounts: Accounts;
let clock = 1_700_000_000_000;

beforeEach(() => {
  clock = 1_700_000_000_000;
  db = openDatabase(':memory:');
  accounts = new Accounts(db, () => clock);
});

afterEach(() => db.close());

describe('create', () => {
  it('issues an id and a token, and never stores the token itself', () => {
    const { account, token } = accounts.create('Ada', 'fox');

    expect(account.id).toHaveLength(36);
    expect(token).toHaveLength(43);
    expect(account.claimed).toBe(false);

    const stored = db
      .prepare<[string], { token_hash: string }>('SELECT token_hash FROM accounts WHERE id = ?')
      .get(account.id);
    expect(stored?.token_hash).not.toBe(token);
    expect(stored?.token_hash).toBeTruthy();
  });

  it('issues a different token every time', () => {
    const tokens = new Set(
      Array.from({ length: 20 }, () => accounts.create(undefined, 'fox').token),
    );
    expect(tokens.size).toBe(20);
  });

  it('makes up a name when none is asked for', () => {
    const { account } = accounts.create(undefined, undefined);
    expect(account.displayName.length).toBeGreaterThan(1);
  });

  it('suffixes a name that is already taken rather than refusing', () => {
    const first = accounts.create('Ada', 'fox');
    const second = accounts.create('Ada', 'owl');

    expect(second.account.displayName).not.toBe(first.account.displayName);
    expect(second.account.displayName.startsWith('Ada')).toBe(true);
  });

  it('treats names as case-insensitive for collisions', () => {
    accounts.create('Ada', 'fox');
    const second = accounts.create('ADA', 'owl');
    expect(second.account.displayName.toLowerCase()).not.toBe('ada');
  });
});

describe('authenticate', () => {
  it('accepts the token it issued', () => {
    const { account, token } = accounts.create('Ada', 'fox');
    expect(accounts.authenticate(account.id, token)?.id).toBe(account.id);
  });

  it('rejects a wrong token', () => {
    const { account } = accounts.create('Ada', 'fox');
    expect(accounts.authenticate(account.id, 'x'.repeat(43))).toBeNull();
  });

  it('rejects a token belonging to another account', () => {
    const ada = accounts.create('Ada', 'fox');
    const bob = accounts.create('Bob', 'owl');
    expect(accounts.authenticate(ada.account.id, bob.token)).toBeNull();
  });

  it('rejects an unknown account', () => {
    expect(
      accounts.authenticate('00000000-0000-4000-8000-000000000000', 'x'.repeat(43)),
    ).toBeNull();
  });
});

describe('passwords', () => {
  it('lets a claimed account log in and issues a fresh token', () => {
    const { account, token } = accounts.create('Ada', 'fox');
    accounts.claim(account.id, 'correct horse battery');

    const login = accounts.login('Ada', 'correct horse battery');
    expect(login?.account.id).toBe(account.id);
    expect(login?.token).not.toBe(token);
  });

  it('retires the old token when a new one is issued', () => {
    const { account, token } = accounts.create('Ada', 'fox');
    accounts.claim(account.id, 'correct horse battery');
    accounts.login('Ada', 'correct horse battery');

    expect(accounts.authenticate(account.id, token)).toBeNull();
  });

  it('rejects a wrong password', () => {
    const { account } = accounts.create('Ada', 'fox');
    accounts.claim(account.id, 'correct horse battery');
    expect(accounts.login('Ada', 'wrong')).toBeNull();
  });

  it('rejects an account that has never been claimed', () => {
    accounts.create('Ada', 'fox');
    expect(accounts.login('Ada', 'anything at all')).toBeNull();
  });

  it('rejects a name nobody has', () => {
    expect(accounts.login('Nobody', 'anything at all')).toBeNull();
  });

  it('never stores the password in the clear', () => {
    const { account } = accounts.create('Ada', 'fox');
    accounts.claim(account.id, 'correct horse battery');

    const stored = db
      .prepare<[string], { password_hash: string }>(
        'SELECT password_hash FROM accounts WHERE id = ?',
      )
      .get(account.id);
    expect(stored?.password_hash).not.toContain('correct horse battery');
    expect(stored?.password_hash?.startsWith('scrypt$')).toBe(true);
  });

  it('marks the account as claimed once a password is set', () => {
    const { account } = accounts.create('Ada', 'fox');
    expect(accounts.get(account.id)?.claimed).toBe(false);
    accounts.claim(account.id, 'correct horse battery');
    expect(accounts.get(account.id)?.claimed).toBe(true);
  });
});

describe('update', () => {
  it('renames an account', () => {
    const { account } = accounts.create('Ada', 'fox');
    expect(accounts.update(account.id, { displayName: 'Ada L' })?.displayName).toBe('Ada L');
  });

  it('refuses a name another account already holds', () => {
    accounts.create('Ada', 'fox');
    const bob = accounts.create('Bob', 'owl');
    expect(accounts.update(bob.account.id, { displayName: 'Ada' })).toBeNull();
  });

  it('lets an account keep its own name', () => {
    const { account } = accounts.create('Ada', 'fox');
    expect(accounts.update(account.id, { displayName: 'Ada', avatar: 'cat' })?.avatar).toBe('cat');
  });
});

describe('statistics', () => {
  it('starts every mode at the starting rating with nothing played', () => {
    const { account } = accounts.create('Ada', 'fox');
    const stats = accounts.statsFor(account.id, 'classic');

    expect(stats.rating).toBe(STARTING_RATING);
    expect(stats.played).toBe(0);
    expect(stats.streak).toBe(0);
  });

  it('counts each outcome in its own column', () => {
    const { account } = accounts.create('Ada', 'fox');
    accounts.recordResult(account.id, 'classic', 'win', 1210);
    accounts.recordResult(account.id, 'classic', 'loss', 1195);
    accounts.recordResult(account.id, 'classic', 'draw', 1196);

    const stats = accounts.statsFor(account.id, 'classic');
    expect(stats).toMatchObject({ played: 3, won: 1, lost: 1, drawn: 1, rating: 1196 });
  });

  it('keeps modes apart', () => {
    const { account } = accounts.create('Ada', 'fox');
    accounts.recordResult(account.id, 'classic', 'win', 1240);

    expect(accounts.statsFor(account.id, 'grid-6').played).toBe(0);
    expect(accounts.statsFor(account.id, 'grid-6').rating).toBe(STARTING_RATING);
  });

  it('counts a streak of wins and resets it on anything else', () => {
    const { account } = accounts.create('Ada', 'fox');
    for (let win = 0; win < 4; win++) {
      accounts.recordResult(account.id, 'classic', 'win', 1200 + win);
    }
    expect(accounts.statsFor(account.id, 'classic').streak).toBe(4);

    accounts.recordResult(account.id, 'classic', 'draw', 1204);
    const after = accounts.statsFor(account.id, 'classic');
    expect(after.streak).toBe(0);
    // The best is remembered even though the current one is gone.
    expect(after.bestStreak).toBe(4);
  });
});

describe('achievements', () => {
  it('awards each achievement at most once', () => {
    const { account } = accounts.create('Ada', 'fox');
    accounts.award(account.id, ['first-win']);
    clock += 1000;
    accounts.award(account.id, ['first-win', 'ten-wins']);

    const unlocked = accounts.achievements(account.id);
    expect(unlocked).toHaveLength(2);
    expect(unlocked[0]?.unlockedAt).toBe(1_700_000_000_000);
  });
});

describe('leaderboard', () => {
  function seed(name: string, rating: number, played: number): string {
    const { account } = accounts.create(name, 'fox');
    for (let game = 0; game < played; game++) {
      accounts.recordResult(account.id, 'classic', 'win', rating);
    }
    return account.id;
  }

  it('orders by rating and leaves out accounts still in placement', () => {
    seed('Top', 1800, PLACEMENT_GAMES);
    seed('Middle', 1400, PLACEMENT_GAMES);
    const rookie = seed('Rookie', 2400, PLACEMENT_GAMES - 1);

    const table = accounts.leaderboard('classic', 10, PLACEMENT_GAMES);
    expect(table.map((row) => row.account.displayName)).toEqual(['Top', 'Middle']);
    expect(table.some((row) => row.account.id === rookie)).toBe(false);
  });

  it('honours the limit', () => {
    for (let index = 0; index < 8; index++) seed(`P${index}`, 1300 + index, PLACEMENT_GAMES);
    expect(accounts.leaderboard('classic', 3, PLACEMENT_GAMES)).toHaveLength(3);
  });

  it('reports a rank consistent with the table', () => {
    seed('Top', 1800, PLACEMENT_GAMES);
    const middle = seed('Middle', 1400, PLACEMENT_GAMES);
    expect(accounts.rankOf(middle, 'classic', PLACEMENT_GAMES)).toBe(2);
  });

  it('gives no rank to an account still in placement', () => {
    const rookie = seed('Rookie', 1800, 1);
    expect(accounts.rankOf(rookie, 'classic', PLACEMENT_GAMES)).toBeNull();
  });
});
