import { availableParallelism } from 'node:os';
import type { Hono } from 'hono';
import { AntiCheat } from './anticheat.js';
import { Bots } from './bots.js';
import { createCompetitiveApi } from './competitive-api.js';
import type { Accounts } from './db/accounts.js';
import type { Db } from './db/database.js';
import { WorkerPool } from './engine/pool.js';
import type { Lobby, LobbyOptions } from './lobby.js';
import { log } from './log.js';
import { DEFAULT_SEASON_LENGTH_MS, Seasons } from './seasons.js';
import { Tournaments } from './tournaments.js';

/**
 * Wiring for the competitive layer, so the entry point only has to ask for it.
 *
 * Configuration, all optional:
 *
 * - `SEASON_LENGTH_DAYS` - default 56.
 * - `ENGINE_WORKERS` - worker threads for bots and analysis; default one less
 *   than the core count, at most two, so the event loop keeps a core.
 * - `BOT_BACKFILL_SECONDS` - casual wait before a bot is offered; default 20,
 *   0 turns bots off.
 * - `BOT_RANKED_BACKFILL_SECONDS` - the same for the ranked queue, played
 *   unrated; unset (the default) means never.
 * - `ARENAS=0` turns the arena schedule off; `ARENA_EVERY_HOURS` (default 3)
 *   and `ARENA_MINUTES` (default 30) shape it.
 */
export interface Competitive {
  readonly seasons: Seasons;
  readonly tournaments: Tournaments;
  readonly antiCheat: AntiCheat;
  readonly bots: Bots | null;
  /** Options to construct the lobby with. */
  readonly lobbyOptions: Pick<LobbyOptions, 'bots'>;
  /** Plug everything into the lobby once it exists. */
  attach(lobby: Lobby): void;
  /** The read-only HTTP routes. */
  api(lobby: Lobby): Hono;
  close(): Promise<void>;
}

export function createCompetitive(
  db: Db,
  accounts: Accounts,
  env: Record<string, string | undefined> = process.env,
): Competitive {
  const days = positive(env['SEASON_LENGTH_DAYS']);
  const seasons = new Seasons(db, {
    lengthMs: days === null ? DEFAULT_SEASON_LENGTH_MS : days * 24 * 60 * 60 * 1000,
  });

  const workers =
    positive(env['ENGINE_WORKERS']) ?? Math.min(2, Math.max(1, availableParallelism() - 1));
  const engine = new WorkerPool({ size: workers, maxQueue: 256, timeoutMs: 20_000 });

  const casualSeconds = nonNegative(env['BOT_BACKFILL_SECONDS']) ?? 20;
  const rankedSeconds = positive(env['BOT_RANKED_BACKFILL_SECONDS']);
  const bots = casualSeconds > 0 ? new Bots(db, accounts, engine) : null;

  const everyHours = positive(env['ARENA_EVERY_HOURS']) ?? 3;
  const minutes = positive(env['ARENA_MINUTES']) ?? 30;
  const tournaments = new Tournaments(db, accounts, {
    arenas: env['ARENAS'] !== '0',
    arenaEveryMs: everyHours * 60 * 60 * 1000,
    arenaLengthMs: Math.min(minutes, everyHours * 60) * 60 * 1000,
  });

  const antiCheat = new AntiCheat(db, engine);

  log.info('competitive.ready', {
    season: seasons.current().id,
    workers,
    botsAfterSeconds: bots ? casualSeconds : null,
    arenas: env['ARENAS'] !== '0',
  });

  return {
    seasons,
    tournaments,
    antiCheat,
    bots,
    lobbyOptions: bots
      ? {
          bots: {
            provider: bots,
            casualAfterMs: casualSeconds * 1000,
            rankedAfterMs: rankedSeconds === null ? null : rankedSeconds * 1000,
          },
        }
      : {},
    attach(lobby) {
      lobby.use(seasons);
      lobby.use(tournaments);
      lobby.use(antiCheat);
      tournaments.attach(lobby);
      if (bots) {
        bots.attach(lobby);
        lobby.use(bots);
      }
    },
    api(lobby) {
      return createCompetitiveApi({
        accounts,
        seasons,
        tournaments,
        live: (limit) => lobby.liveGames(limit),
      });
    },
    close: () => engine.close(),
  };
}

function positive(raw: string | undefined): number | null {
  const value = Number(raw);
  return raw !== undefined && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegative(raw: string | undefined): number | null {
  const value = Number(raw);
  return raw !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
}
