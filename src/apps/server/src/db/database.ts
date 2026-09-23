import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { log } from '../log.js';
import { migrate } from './schema.js';

export type Db = Database.Database;

/**
 * Open the database and bring it up to date.
 *
 * `:memory:` is a first-class option rather than a test hack: every test opens
 * its own, which is what makes the repositories testable without a temp
 * directory and without one test's data reaching another's.
 *
 * The pragmas are the three that matter for a small server: WAL so a reader
 * never blocks the writer, `NORMAL` synchronous because losing the last few
 * milliseconds of a rating update to a power cut is not worth an fsync per
 * transaction, and foreign keys on, which SQLite otherwise leaves off.
 */
export function openDatabase(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  // A write that collides waits rather than failing outright. Nothing here
  // holds a transaction open long enough for this to mask a deadlock.
  db.pragma('busy_timeout = 5000');

  migrate(db);
  log.info('db.ready', { file });
  return db;
}
