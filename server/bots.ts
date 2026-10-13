import {
  type BotDifficulty,
  type GameConfig,
  type GameState,
  legalMoves,
  profileFor,
  startingPlayerOf,
} from '@/game/engine';
import type { Accounts, AccountRow } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { EngineRunner } from './engine/pool.js';
import type { BotProvider, LobbyExtension } from './lobby-hooks.js';
import { log } from './log.js';
import type { Room } from './types.js';

/**
 * Server bots, for a player nobody else turned up to play.
 *
 * Honesty first: a bot is a real account flagged as one, every seat it takes
 * says so on the wire, its name says so, and its games are never rated. What
 * it borrows from people is only the pacing - it waits a human-looking moment
 * before answering instead of replying the instant a move lands, which would
 * feel like playing a vending machine.
 *
 * The thinking happens on the engine pool's worker threads. The lobby is told
 * the answer later and drops it if the game has moved on in the meantime.
 */

export interface BotLevel {
  readonly difficulty: BotDifficulty;
  /** Nominal rating shown next to the bot, and used to choose it. */
  readonly rating: number;
  readonly name: string;
}

export const BOT_LEVELS: readonly BotLevel[] = [
  { difficulty: 'beginner', rating: 800, name: 'Pebble Bot' },
  { difficulty: 'easy', rating: 1000, name: 'Sprout Bot' },
  { difficulty: 'medium', rating: 1200, name: 'Quill Bot' },
  { difficulty: 'hard', rating: 1400, name: 'Gizmo Bot' },
  { difficulty: 'expert', rating: 1650, name: 'Cobalt Bot' },
  { difficulty: 'master', rating: 1900, name: 'Titan Bot' },
];

/** The level nearest a player's rating. */
export function levelFor(rating: number): BotLevel {
  let best = BOT_LEVELS[0]!;
  for (const level of BOT_LEVELS) {
    if (Math.abs(level.rating - rating) < Math.abs(best.rating - rating)) best = level;
  }
  return best;
}

/** What the bot driver needs from the lobby. */
export interface BotSeatHost {
  playFor(code: string, accountId: string, index: number, game: GameState): boolean;
}

export interface BotsOptions {
  readonly random?: () => number;
  /** Delay before a computed move is played. Injectable so tests need not wait. */
  readonly schedule?: (work: () => void, ms: number) => void;
  /** Human-looking thinking time for one move, in milliseconds. */
  readonly thinkMs?: (game: GameState, difficulty: BotDifficulty) => number;
  readonly now?: () => number;
}

/** A hash no token can ever produce, so a bot account can never be signed into. */
const UNUSABLE_TOKEN_HASH = '!bot';

export class Bots implements BotProvider, LobbyExtension {
  private host: BotSeatHost | null = null;
  private readonly accountsByLevel = new Map<BotDifficulty, AccountRow>();
  /** Rooms with a move being computed, and for which position. Bounded by the room ceiling. */
  private readonly thinking = new Map<string, GameState>();
  private readonly random: () => number;
  private readonly schedule: (work: () => void, ms: number) => void;
  private readonly thinkMs: (game: GameState, difficulty: BotDifficulty) => number;
  private readonly now: () => number;

  constructor(
    private readonly db: Db,
    private readonly accounts: Accounts,
    private readonly engine: EngineRunner,
    options: BotsOptions = {},
  ) {
    this.random = options.random ?? Math.random;
    this.schedule =
      options.schedule ??
      ((work, ms) => {
        const timer = setTimeout(work, ms);
        timer.unref?.();
      });
    this.thinkMs = options.thinkMs ?? ((game, difficulty) => this.humanDelay(game, difficulty));
    this.now = options.now ?? Date.now;
  }

  /** The lobby is created after the bots it is given, so it is attached afterwards. */
  attach(host: BotSeatHost): void {
    this.host = host;
  }

  get pending(): number {
    return this.thinking.size;
  }

  // -------------------------------------------------------------------------
  // Provider
  // -------------------------------------------------------------------------

  /** Every rule set has a bot: the engine plays them all. Only the level depends on the player. */
  pick(
    rating: number,
    _config: GameConfig,
  ): { account: AccountRow; difficulty: BotDifficulty; rating: number } | null {
    const level = levelFor(rating);
    const account = this.accountFor(level);
    return account ? { account, difficulty: level.difficulty, rating: level.rating } : null;
  }

  private accountFor(level: BotLevel): AccountRow | null {
    const cached = this.accountsByLevel.get(level.difficulty);
    if (cached) return cached;

    const existing = this.db
      .prepare<[string], { id: string }>(
        'SELECT id FROM accounts WHERE bot = 1 AND name_key LIKE ? ORDER BY created_at LIMIT 1',
      )
      .get(`${level.name.toLocaleLowerCase('en-US')}%`);
    let account = existing ? this.accounts.get(existing.id) : null;

    if (!account) {
      const created = this.accounts.create(level.name, 'robot').account;
      this.db
        .prepare('UPDATE accounts SET bot = 1, token_hash = ? WHERE id = ?')
        .run(UNUSABLE_TOKEN_HASH, created.id);
      account = this.accounts.get(created.id);
      log.info('bot.account', { difficulty: level.difficulty, accountId: created.id });
    }
    if (!account) return null;
    this.accountsByLevel.set(level.difficulty, account);
    return account;
  }

  // -------------------------------------------------------------------------
  // Driver
  // -------------------------------------------------------------------------

  turn(room: Room): void {
    if (room.settled || room.game.status !== 'playing' || room.seats.length < 2) return;
    const seat = room.seats.find((candidate) => candidate.player === room.game.currentPlayer);
    if (!seat?.bot) return;
    if (this.thinking.get(room.code) === room.game) return;

    const game = room.game;
    const difficulty = seat.bot;
    const accountId = seat.accountId;
    const code = room.code;
    this.thinking.set(code, game);

    const remaining = room.clock?.remaining(seat.player) ?? Number.POSITIVE_INFINITY;
    const budget = Math.max(20, Math.min(profileFor(difficulty).timeMs || 20, remaining / 30));
    const started = this.now();

    const play = (move: number | null) => {
      if (this.thinking.get(code) === game) this.thinking.delete(code);
      if (move === null) return;
      // Never let the pause cost the bot the game on time.
      const pause = Math.min(this.thinkMs(game, difficulty), remaining / 20);
      const wait = Math.max(0, pause - (this.now() - started));
      this.schedule(() => {
        this.host?.playFor(code, accountId, move, game);
      }, wait);
    };

    this.engine
      .run({
        type: 'move',
        config: game.config,
        startingPlayer: startingPlayerOf(game),
        moves: game.moves,
        difficulty,
        timeBudgetMs: budget,
        seed: Math.floor(this.random() * 0xffff_ffff),
      })
      .then((result) => play(result.move))
      .catch((error: unknown) => {
        // A busy or broken pool must not freeze a game: play any legal move.
        log.warn('bot.move.fallback', {
          room: code,
          error: error instanceof Error ? error.message : String(error),
        });
        const legal = legalMoves(game);
        play(legal.length ? legal[Math.floor(this.random() * legal.length)]! : null);
      });
  }

  /**
   * How long a person of this strength might look at this position.
   *
   * Quicker in the opening and on small boards, slower in the middle of a big
   * one, and never the same twice.
   */
  private humanDelay(game: GameState, difficulty: BotDifficulty): number {
    const cells = game.config.size * game.config.size;
    const opening = game.moves.length < 2;
    const base = opening ? 450 : cells <= 9 ? 700 : 1100;
    const careful = difficulty === 'expert' || difficulty === 'master' ? 1.25 : 1;
    return Math.round((base + this.random() * base * 1.4) * careful);
  }
}
