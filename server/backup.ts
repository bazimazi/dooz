import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db/database.js';
import { log } from './log.js';

/**
 * Periodic online backups of the SQLite database.
 *
 * `better-sqlite3`'s `backup()` uses SQLite's online backup API: it copies the
 * live database page by page without stopping writers, and the copy is a
 * consistent snapshot - unlike copying the file, which with WAL mode on can
 * capture a database and a log that disagree.
 *
 * Each backup is written under a temporary name and renamed into place, so a
 * crash mid-copy never leaves a truncated file that looks like a good backup.
 * The newest `keep` are kept and older ones deleted.
 */

export interface BackupOptions {
  readonly dir: string;
  readonly intervalMs: number;
  readonly keep: number;
  readonly now?: () => number;
}

export interface BackupStatus {
  readonly enabled: boolean;
  readonly dir: string | null;
  readonly lastAt: number | null;
  readonly lastFile: string | null;
  readonly lastError: string | null;
  readonly lastDurationMs: number | null;
  readonly count: number;
}

const PREFIX = 'dooz-';
const SUFFIX = '.sqlite';

export class Backups {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<string> | null = null;
  private lastAt: number | null = null;
  private lastFile: string | null = null;
  private lastError: string | null = null;
  private lastDurationMs: number | null = null;
  private readonly now: () => number;

  constructor(
    private readonly db: Db,
    private readonly options: BackupOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  /** Start the schedule. The timer does not keep the process alive on its own. */
  start(): void {
    if (this.timer) return;
    mkdirSync(this.options.dir, { recursive: true });
    this.timer = setInterval(() => {
      void this.run().catch(() => undefined);
    }, this.options.intervalMs);
    this.timer.unref();
    log.info('backup.scheduled', {
      dir: this.options.dir,
      everyMinutes: Math.round(this.options.intervalMs / 60_000),
      keep: this.options.keep,
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Take one backup now. Concurrent calls share the one in progress. */
  run(): Promise<string> {
    if (this.running) return this.running;
    const started = this.now();
    const stamp = new Date(started).toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
    const file = join(this.options.dir, `${PREFIX}${stamp}${SUFFIX}`);
    const partial = `${file}.partial`;

    this.running = (async () => {
      try {
        mkdirSync(this.options.dir, { recursive: true });
        await this.db.backup(partial);
        renameSync(partial, file);
        this.prune();
        this.lastAt = this.now();
        this.lastFile = file;
        this.lastError = null;
        this.lastDurationMs = this.now() - started;
        log.info('backup.done', { file, durationMs: this.lastDurationMs });
        return file;
      } catch (error) {
        rmSync(partial, { force: true });
        this.lastError = error instanceof Error ? error.message : String(error);
        log.exception('backup.failed', error, { file });
        throw error;
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  /** Backups on disk, newest first. */
  list(): string[] {
    try {
      return readdirSync(this.options.dir)
        .filter((name) => name.startsWith(PREFIX) && name.endsWith(SUFFIX))
        .toSorted()
        .toReversed();
    } catch {
      return [];
    }
  }

  status(): BackupStatus {
    return {
      enabled: this.timer !== null,
      dir: this.options.dir,
      lastAt: this.lastAt,
      lastFile: this.lastFile,
      lastError: this.lastError,
      lastDurationMs: this.lastDurationMs,
      count: this.list().length,
    };
  }

  private prune(): void {
    // Names sort by timestamp, so everything past the newest `keep` is older.
    for (const name of this.list().slice(Math.max(1, this.options.keep))) {
      const path = join(this.options.dir, name);
      try {
        if (statSync(path).isFile()) rmSync(path);
      } catch (error) {
        log.exception('backup.prune.failed', error, { file: path });
      }
    }
  }
}

/**
 * Backup settings from the environment. `BACKUP_DIR=off` turns backups off;
 * an in-memory database has nothing to back up.
 */
export function backupOptionsFromEnv(
  env: NodeJS.ProcessEnv,
  dataFile: string,
): BackupOptions | null {
  const dir =
    env['BACKUP_DIR']?.trim() || join(dataFile === ':memory:' ? '.' : dataFile, '..', 'backups');
  if (dir === 'off' || dataFile === ':memory:') return null;
  const hours = Number(env['BACKUP_INTERVAL_HOURS'] ?? 6);
  const keep = Number(env['BACKUP_KEEP'] ?? 14);
  return {
    dir,
    intervalMs: Math.max(5, Number.isFinite(hours) && hours > 0 ? hours * 60 : 360) * 60_000,
    keep: Number.isInteger(keep) && keep > 0 ? keep : 14,
  };
}
