import { applyMove, type GameState } from '@/game/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptics, sfx } from '@/lib/sound';
import { type Puzzle, puzzleStart } from './puzzles';
import { type Refutation, useRefutation } from './refute';

/**
 * Playing one puzzle: the board, the stored defence, and what a miss shows.
 *
 * Shared by the puzzle screen and the rush. The player plays the side to move;
 * the defence is the one the generator proved was the most stubborn, played
 * back from the pack. A wrong answer is shown - the mark lands, the defence
 * that beats it is played and named, and then it is lifted again - rather
 * than silently refused, because seeing why a move fails is most of what a
 * puzzle teaches. In a rush a miss is final instead: the refutation plays and
 * the puzzle ends there.
 */
export type SolverPhase = 'solving' | 'replying' | 'wrong' | 'solved' | 'failed';

/** The defence arrives after a beat, as if it were being thought about. */
const REPLY_MS = 520;
/** A wrong mark stands alone this long before the refutation answers it. */
const REFUTE_DELAY_MS = 480;
/** How long a refuted position stays on the board, all told. */
const REFUTED_HOLD_MS = 1900;
/** A miss with nothing to show - the board simply says no. */
const WRONG_MS = 1000;

interface SolverOptions {
  /** Lift a wrong move and let the player try again. Off for a rush. */
  readonly retract: boolean;
  readonly onSolved?: () => void;
  readonly onMiss?: () => void;
}

export interface Solver {
  readonly start: GameState;
  readonly game: GameState;
  /** The solver's step: 0 for the first move of the combination. */
  readonly step: number;
  readonly phase: SolverPhase;
  /** Why the last wrong move failed, while it is on the board. */
  readonly refutation: Refutation | null;
  /** Moves that solve the current step. */
  readonly accepted: readonly number[];
  readonly attempt: (index: number) => void;
  readonly retry: () => void;
}

export function usePuzzleSolver(puzzle: Puzzle, options: SolverOptions): Solver {
  const start = useMemo(() => puzzleStart(puzzle), [puzzle]);
  const solver = start.currentPlayer;
  const [game, setGame] = useState<GameState>(start);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<SolverPhase>('solving');
  const [refutation, setRefutation] = useState<Refutation | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Bumped on every attempt and retry, so a refutation that arrives late for
  // a position already gone is dropped.
  const attemptId = useRef(0);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  const refute = useRefutation();

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const later = (run: () => void, ms: number) => {
    timers.current.push(setTimeout(run, ms));
  };

  const accepted = puzzle.accept[step] ?? [];

  function attempt(index: number) {
    if (phase !== 'solving') return;
    const next = applyMove(game, index);
    if (!next) return;
    const id = ++attemptId.current;

    if (!accepted.includes(index)) {
      const before = game;
      setGame(next);
      setPhase('wrong');
      setRefutation(null);
      later(() => {
        sfx.wrong();
        haptics.buzz([12, 40, 12], 'error');
      }, 180);
      const finish = () => {
        if (attemptId.current !== id) return;
        setRefutation(null);
        if (callbacks.current.retract) {
          setGame(before);
          setPhase('solving');
        } else {
          setPhase('failed');
        }
        callbacks.current.onMiss?.();
      };
      void refute(next, solver, step === puzzle.mateIn - 1).then((found) => {
        if (attemptId.current !== id) return;
        const reply = found.move;
        later(() => {
          if (attemptId.current !== id) return;
          setRefutation(found);
          if (reply !== null) setGame((current) => applyMove(current, reply) ?? current);
        }, REFUTE_DELAY_MS);
        later(finish, reply === null ? WRONG_MS : REFUTED_HOLD_MS);
        return undefined;
      });
      return;
    }

    setGame(next);
    if (next.status === 'won') {
      setPhase('solved');
      callbacks.current.onSolved?.();
      return;
    }

    // The stored defence, after a beat. Under misère the last of it is the
    // defender's forced move, which completes their line and ends the puzzle.
    const reply = puzzle.line[step * 2 + 1];
    setPhase('replying');
    later(() => {
      if (attemptId.current !== id) return;
      const replied = reply === undefined ? next : (applyMove(next, reply) ?? next);
      setGame(replied);
      if (replied.status === 'won') {
        setPhase('solved');
        callbacks.current.onSolved?.();
        return;
      }
      setStep((current) => current + 1);
      setPhase('solving');
    }, REPLY_MS);
  }

  const retry = useCallback(() => {
    attemptId.current++;
    clearTimers();
    setGame(start);
    setStep(0);
    setPhase('solving');
    setRefutation(null);
  }, [clearTimers, start]);

  return { start, game, step, phase, refutation, accepted, attempt, retry };
}
