import { O, type Player, X } from '@/game/engine';
import type { Clock } from '@/protocol';

/**
 * A two-sided game clock with an increment.
 *
 * The server owns it outright. The client is sent remaining times and a "whose
 * clock is running" flag and counts down locally for the look of the thing, but
 * every decision - whether a move arrived in time, whether a match has been
 * lost on time - is made here against the server's own clock. A client that
 * lies about its time is describing a countdown nobody is listening to.
 *
 * The increment is added after a move rather than before it, so a player cannot
 * bank time by sitting on a position, and the first move of a game is played
 * out of the initial allowance like any other.
 */
export class MatchClock {
  private remainingX: number;
  private remainingO: number;
  private running: Player | null = null;
  private since = 0;
  /** Sides that gave up their increment by going berserk. */
  private readonly noIncrement = new Set<Player>();

  constructor(
    initialMs: number,
    private readonly incrementMs: number,
    private readonly now: () => number = Date.now,
  ) {
    this.remainingX = initialMs;
    this.remainingO = initialMs;
  }

  /** Time left for `player`, with any time already spent this turn deducted. */
  remaining(player: Player): number {
    const base = player === X ? this.remainingX : this.remainingO;
    if (this.running !== player) return base;
    return Math.max(0, base - (this.now() - this.since));
  }

  isRunning(): boolean {
    return this.running !== null;
  }

  /** Begin counting down for `player`, banking whatever the previous one spent. */
  start(player: Player): void {
    this.settle();
    this.running = player;
    this.since = this.now();
  }

  /** Stop the clock without an increment - the game is over or paused. */
  stop(): void {
    this.settle();
    this.running = null;
  }

  /**
   * Record that `player` moved: bank their time, add the increment, and hand
   * the clock to their opponent.
   */
  moved(player: Player, next: Player): void {
    this.settle();
    const increment = this.noIncrement.has(player) ? 0 : this.incrementMs;
    if (player === X) this.remainingX += increment;
    else this.remainingO += increment;
    this.running = next;
    this.since = this.now();
  }

  /**
   * Berserk: halve what `player` has left and take away their increment for
   * the rest of the game. Arena tournaments pay a bonus point for winning
   * like that.
   */
  halve(player: Player): void {
    this.settle();
    if (player === X) this.remainingX = Math.floor(this.remainingX / 2);
    else this.remainingO = Math.floor(this.remainingO / 2);
    this.noIncrement.add(player);
  }

  /** The player whose time has run out, or `null`. */
  flagged(): Player | null {
    if (this.running === null) return null;
    return this.remaining(this.running) <= 0 ? this.running : null;
  }

  snapshot(): Clock {
    return {
      x: Math.round(this.remaining(X)),
      o: Math.round(this.remaining(O)),
      running: this.running,
      incrementMs: this.incrementMs,
      asOf: this.now(),
    };
  }

  /** Both budgets as plain numbers, for writing a live game down at shutdown. */
  toJSON(): { x: number; o: number; running: Player | null; incrementMs: number } {
    return {
      x: Math.round(this.remaining(X)),
      o: Math.round(this.remaining(O)),
      running: this.running,
      incrementMs: this.incrementMs,
    };
  }

  /**
   * A clock picked up where `saved` left off.
   *
   * The running side's clock restarts from the moment of restoring, so the
   * time the server spent down is nobody's loss.
   */
  static restore(
    saved: { x: number; o: number; running: Player | null; incrementMs: number },
    now: () => number = Date.now,
  ): MatchClock {
    const clock = new MatchClock(0, saved.incrementMs, now);
    clock.remainingX = Math.max(0, saved.x);
    clock.remainingO = Math.max(0, saved.o);
    if (saved.running !== null) clock.start(saved.running);
    return clock;
  }

  /** Move the elapsed time out of the running side's budget and into the past. */
  private settle(): void {
    if (this.running === null) return;
    const elapsed = this.now() - this.since;
    if (this.running === X) this.remainingX = Math.max(0, this.remainingX - elapsed);
    else this.remainingO = Math.max(0, this.remainingO - elapsed);
    this.since = this.now();
  }
}
