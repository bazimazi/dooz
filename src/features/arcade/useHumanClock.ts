import { type GameState, type Player, startingPlayerOf } from '@/game/engine';
import { useEffect, useRef, useState } from 'react';
import { usePageVisible } from '@/lib/usePageVisible';

export interface ClockSpec {
  readonly initialMs: number;
  /** Added after each of your moves. */
  readonly incrementMs: number;
}

export interface HumanClock {
  /** Time left as of the last change; `MatchClock` interpolates between them. */
  remainingMs: number;
  /** Whether the clock is running down right now. */
  ticking: boolean;
  /** The clock reached zero before the game ended. */
  flagged: boolean;
}

/**
 * A clock for the person at this device, in a game against the bot.
 *
 * Only the human is timed. The bot's pace is set by its thinking budget
 * instead, and timing a search that can be cut short at will would be
 * timing nothing. Unlike an online clock this one is the authority, so it
 * flags the game itself.
 *
 * It stops while the page is hidden. Nobody is playing a local game in a tab
 * they cannot see, and losing on time to a phone call is not a result.
 */
export function useHumanClock({
  game,
  you,
  clock,
  round,
  paused = false,
  setupPlies = 0,
  storageKey,
}: {
  game: GameState;
  you: Player;
  clock: ClockSpec | undefined;
  /** The game counter from `useGame`; a new round resets the clock. */
  round: number;
  paused?: boolean;
  /** Moves a setup placed before play; they earn no increment. */
  setupPlies?: number;
  /** Keeps the time left across a reload, alongside the saved position. */
  storageKey?: string;
}): HumanClock {
  const visible = usePageVisible();
  const initial = clock?.initialMs ?? 0;
  // Time spent comes off the bank; the increment is worked out from the moves
  // you have made, so a take-back takes its increment back with it.
  const [bank, setBank] = useState(() => restore(storageKey, initial, game.moves.length));
  const [flagged, setFlagged] = useState(false);
  const [clockRound, setClockRound] = useState(round);
  if (clockRound !== round) {
    setClockRound(round);
    setBank(initial);
    setFlagged(false);
  }

  const increments = clock ? ownMoves(game, you, setupPlies) * clock.incrementMs : 0;
  const remaining = flagged ? 0 : Math.max(0, bank + increments);
  const ticking =
    clock !== undefined &&
    !flagged &&
    !paused &&
    visible &&
    game.status === 'playing' &&
    game.currentPlayer === you;

  // Captured when the countdown starts, so the effect does not restart every
  // time the number it is counting down changes.
  const remainingRef = useRef(remaining);
  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  useEffect(() => {
    if (!ticking) return;
    const started = Date.now();
    const timer = setTimeout(() => setFlagged(true), remainingRef.current);
    return () => {
      clearTimeout(timer);
      const used = Date.now() - started;
      setBank((left) => left - used);
    };
  }, [ticking]);

  useEffect(() => {
    if (!storageKey || !clock) return;
    try {
      if (game.status !== 'playing') localStorage.removeItem(clockKey(storageKey));
      else
        localStorage.setItem(
          clockKey(storageKey),
          JSON.stringify({ bank, moves: game.moves.length }),
        );
    } catch {
      /* The clock simply restarts after a reload without storage. */
    }
  }, [storageKey, clock, bank, game.status, game.moves.length]);

  return { remainingMs: remaining, ticking, flagged };
}

/** Moves `you` made after the setup. */
function ownMoves(game: GameState, you: Player, setupPlies: number): number {
  const opener = startingPlayerOf(game);
  let count = 0;
  for (let ply = setupPlies; ply < game.moves.length; ply++) {
    if ((ply % 2 === 0) === (opener === you)) count++;
  }
  return count;
}

function clockKey(storageKey: string): string {
  return `dooz.clock:${storageKey}`;
}

/** The saved time left, if it belongs to the position being restored. */
function restore(storageKey: string | undefined, initial: number, moves: number): number {
  if (!storageKey || moves === 0) return initial;
  try {
    const saved = JSON.parse(localStorage.getItem(clockKey(storageKey)) ?? 'null') as {
      bank?: unknown;
      moves?: unknown;
    } | null;
    if (saved && typeof saved.bank === 'number' && saved.moves === moves) {
      return Math.min(saved.bank, initial);
    }
  } catch {
    /* Fall through to a full clock. */
  }
  return initial;
}

/** Drops a saved clock, alongside `forgetGame` for the same key. */
export function forgetClock(storageKey: string): void {
  try {
    localStorage.removeItem(clockKey(storageKey));
  } catch {
    /* Nothing was saved. */
  }
}
