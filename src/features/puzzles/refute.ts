import { applyMove, type GameState, legalMoves, opponentOf, type Player } from '@/game/engine';
import { BotSearch } from '@/game/bot/BotSearch';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Why a wrong answer to a puzzle fails, shown on the board.
 *
 * "Not that one" teaches nothing on its own. Playing the defence that beats
 * the move - their win, their block, their escape - and naming it is what
 * turns a miss into a lesson. Most refutations are read straight off the
 * position: a win the defender now has, the one square that stops the only
 * threat. Only a quiet wrong move needs the engine, and then a short search
 * for the defender's best reply is enough to show where the attack dies.
 */
export type Refutation =
  /** Misère: the move completed the solver's own line, which loses. */
  | { readonly kind: 'self-line'; readonly move: null }
  /** The move filled the board without a line. */
  | { readonly kind: 'draw'; readonly move: null }
  /** The defender now wins on the spot, here. */
  | { readonly kind: 'wins'; readonly move: number }
  /** A win was on the board and the move passed it by; the defender closes it. */
  | { readonly kind: 'missed'; readonly move: number }
  /** The move made one threat; the defender blocks it and the attack is over. */
  | { readonly kind: 'blocks'; readonly move: number }
  /** A quieter defence, found by the engine. */
  | { readonly kind: 'escapes'; readonly move: number | null };

// What each refutation says is translated: see `refutationText` in
// `@/i18n/messages/puzzles`.

/** Squares where `player` would win with their next mark in `game`. */
function winningSquares(game: GameState, player: Player): number[] {
  if (game.status !== 'playing') return [];
  const probe = player === game.currentPlayer ? game : { ...game, currentPlayer: player };
  try {
    return legalMoves(probe).filter((move) => {
      const next = applyMove(probe, move);
      return next?.status === 'won' && next.winner === player;
    });
  } catch {
    return [];
  }
}

/**
 * The refutation that needs no search, or null when the engine must look.
 *
 * `after` is the position the wrong move made; `solver` played it; `final`
 * says the move was the puzzle's last step, where a win was on the board.
 */
export function quickRefutation(
  after: GameState,
  solver: Player,
  final: boolean,
): Refutation | null {
  if (after.status === 'won') {
    return after.winner === solver ? null : { kind: 'self-line', move: null };
  }
  if (after.status === 'draw') return { kind: 'draw', move: null };

  const defender = opponentOf(solver);
  const theirs = winningSquares(after, defender);
  if (theirs[0] !== undefined) return { kind: 'wins', move: theirs[0] };

  const mine = winningSquares(after, solver);
  if (final && mine[0] !== undefined) return { kind: 'missed', move: mine[0] };
  if (mine.length === 1) return { kind: 'blocks', move: mine[0]! };
  return null;
}

/** How long the engine may think about a quiet refutation. */
const REFUTE_BUDGET_MS = 160;

/**
 * Finds refutations, asking the bot worker when the position needs a search.
 * Abandons a search still running when the screen moves on or unmounts.
 */
export function useRefutation(): (
  after: GameState,
  solver: Player,
  final: boolean,
) => Promise<Refutation> {
  const searchRef = useRef<BotSearch | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const search = new BotSearch();
    searchRef.current = search;
    return () => {
      cancelRef.current?.();
      search.dispose();
    };
  }, []);

  return useCallback((after, solver, final) => {
    const quick = quickRefutation(after, solver, final);
    if (quick) return Promise.resolve(quick);
    const search = searchRef.current;
    if (!search) return Promise.resolve({ kind: 'escapes', move: null });
    cancelRef.current?.();
    return new Promise<Refutation>((resolve) => {
      cancelRef.current = search.search(
        after,
        { difficulty: 'hard', timeBudgetMs: REFUTE_BUDGET_MS },
        (chosen) => {
          cancelRef.current = null;
          resolve({ kind: 'escapes', move: chosen?.move ?? null });
        },
      );
    });
  }, []);
}
