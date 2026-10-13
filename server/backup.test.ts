import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Backups, backupOptionsFromEnv } from './backup.js';
import { Accounts } from './db/accounts.js';
import { type Db, openDatabase } from './db/database.js';

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dooz-backup-'));
  db = openDatabase(join(dir, 'live.sqlite'));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('backups', () => {
  it('writes a consistent copy that opens and holds the data', async () => {
    new Accounts(db).create('Ada', 'fox');
    const backups = new Backups(db, { dir: join(dir, 'backups'), intervalMs: 60_000, keep: 3 });
    const file = await backups.run();

    const copy = new Database(file, { readonly: true });
    const row = copy.prepare('SELECT display_name FROM accounts').get() as { display_name: string };
    copy.close();
    expect(row.display_name).toBe('Ada');
    expect(backups.status()).toMatchObject({ lastFile: file, lastError: null, count: 1 });
    expect(readdirSync(join(dir, 'backups')).some((name) => name.endsWith('.partial'))).toBe(false);
  });

  it('keeps only the newest few', async () => {
    let clock = Date.UTC(2026, 0, 1);
    const backups = new Backups(db, {
      dir: join(dir, 'backups'),
      intervalMs: 60_000,
      keep: 2,
      now: () => clock,
    });
    for (let i = 0; i < 4; i++) {
      await backups.run();
      clock += 60_000;
    }
    const files = backups.list();
    expect(files).toHaveLength(2);
    expect(files[0]).toBe('dooz-20260101T000300.sqlite');
  });

  it('reads its settings from the environment', () => {
    expect(backupOptionsFromEnv({ BACKUP_DIR: 'off' }, './data/dooz.sqlite')).toBeNull();
    expect(backupOptionsFromEnv({}, ':memory:')).toBeNull();
    const defaults = backupOptionsFromEnv({}, './data/dooz.sqlite');
    expect(defaults?.dir).toBe(join('data', 'backups'));
    expect(defaults?.intervalMs).toBe(6 * 3600_000);
    expect(defaults?.keep).toBe(14);
    expect(
      backupOptionsFromEnv(
        { BACKUP_INTERVAL_HOURS: '1', BACKUP_KEEP: '3', BACKUP_DIR: '/b' },
        'x.db',
      ),
    ).toEqual({ dir: '/b', intervalMs: 3600_000, keep: 3 });
  });
});
