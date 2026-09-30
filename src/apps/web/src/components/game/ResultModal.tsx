import { type GameState, type Player, X } from '@dooz/engine';
import type { EndReason } from '@dooz/protocol';
import { type ReactNode, useEffect, useState } from 'react';
import { Confetti } from '@/components/art/Confetti';
import { HappyFace, NeutralFace, SadFace } from '@/components/art/faces';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { useDialog } from '@/lib/useDialog';

interface ResultModalProps {
  title: string;
  art: ReactNode;
  /** Extra line under the title - how the game ended, a rematch prompt. */
  note?: ReactNode;
  /** The rating change, the streak: anything worth a moment's attention. */
  detail?: ReactNode;
  /** The buttons. Given rather than assembled here, because they differ by screen. */
  actions: ReactNode;
  /** Fires the confetti. Set only when the person at this device won. */
  celebrate?: boolean;
  /**
   * Milliseconds to leave the finished board uncovered before arriving.
   * `revealDelayFor` works it out from the game; zero arrives immediately.
   */
  revealDelay?: number;
}

/**
 * The end-of-game panel.
 *
 * It holds off for `revealDelay` first. The panel dims and blurs the whole
 * board behind it, so arriving the instant the game ends means covering the
 * winning line while it is still being drawn - the one thing the player has
 * been waiting the whole game to see.
 *
 * The wait is a delay to the mount rather than a hidden panel, so the panel and
 * its focus trap come up together and nothing invisible is holding focus over
 * the board in the meantime. A tap or a keypress ends it early.
 */
export function ResultModal({ revealDelay = 0, ...panel }: ResultModalProps) {
  return useRevealed(revealDelay) ? <ResultPanel {...panel} /> : null;
}

/** `true` once `delay` has passed since mounting, or the player cuts it short. */
function useRevealed(delay: number): boolean {
  const [revealed, setRevealed] = useState(delay <= 0);

  useEffect(() => {
    if (revealed) return;

    const reveal = () => setRevealed(true);
    const timer = setTimeout(reveal, delay);
    // Somebody who has seen enough should not have to sit through the rest of
    // it, so any tap or key brings the panel in early. The interaction that
    // ended the game is already over by the time this is listening.
    document.addEventListener('pointerdown', reveal);
    document.addEventListener('keydown', reveal);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', reveal);
      document.removeEventListener('keydown', reveal);
    };
  }, [delay, revealed]);

  return revealed;
}

/**
 * How long to leave a finished board alone before the panel covers it.
 *
 * A win line takes 0.55s to draw itself - a 0.1s delay and a 0.45s sweep - and
 * is the point of the whole game, so the panel waits for that and leaves it on
 * screen a beat longer. A draw has no line to watch, only the board settling,
 * so its pause is just long enough that the panel does not feel like a cut.
 * A game that ended without a final move - a resignation, a flag - has nothing
 * to watch at all. Under gravity the last mark has to fall before any of it
 * starts, and the shockwave off a finished line is worth its half second.
 */
export function revealDelayFor(game: GameState, reason?: EndReason): number {
  if (reason && reason !== 'line' && reason !== 'draw') return 0;
  const falling = game.config.variant === 'gravity' ? 450 : 0;
  if (game.winLine) return 1450 + falling;
  if (game.ultimate?.winBoards) return 1400;
  return 700 + falling;
}

/**
 * There is deliberately no dismiss affordance: the ways out of a finished game
 * are in the panel. That is also why `useDialog` is given no escape handler -
 * there is nothing for Escape to do that the buttons do not.
 *
 * It arrives in pieces - dim, then panel, then the face, the verdict and the
 * buttons - because the result is the one moment in the game worth pausing on.
 * The whole sequence is under half a second, so it never delays a rematch.
 */
function ResultPanel({
  title,
  art,
  note,
  detail,
  actions,
  celebrate = false,
}: Omit<ResultModalProps, 'revealDelay'>) {
  // Moves focus in, traps Tab, and makes the board behind it inert - without
  // which `aria-modal` below would be a claim the page does not honour.
  const panelRef = useDialog<HTMLDivElement>();

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-scrim p-5 backdrop-blur-[2px]">
      {celebrate ? <Confetti /> : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative w-full max-w-80 animate-panel-in rounded-[2.5rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
        )}
        style={{ animationDelay: '0.06s' }}
      >
        <div className="flex max-h-[85vh] flex-col items-center gap-4 overflow-y-auto rounded-[2rem] bg-surface px-6 py-8">
          <div
            className="animate-pop text-[4.5rem] leading-none"
            style={{ animationDelay: '0.22s' }}
          >
            {/* A slow bob under the one-shot entrance, so the face stays alive
                while the panel waits for a decision. */}
            <span className="block animate-bob">{art}</span>
          </div>

          <h2
            className="animate-rise text-center font-display text-2xl"
            style={{ animationDelay: '0.34s' }}
          >
            {title}
          </h2>

          {note ? (
            <p
              className="-mt-2 animate-rise text-center text-sm text-ink-muted"
              style={{ animationDelay: '0.4s' }}
            >
              {note}
            </p>
          ) : null}

          {detail ? (
            <div className="w-full animate-rise" style={{ animationDelay: '0.44s' }}>
              {detail}
            </div>
          ) : null}

          <div
            className="flex w-full animate-rise flex-col items-center gap-3 pt-1"
            style={{ animationDelay: '0.48s' }}
          >
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The face shown for a game played against the bot, or online. */
export function outcomeFace(outcome: 'win' | 'loss' | 'draw') {
  if (outcome === 'win') return <HappyFace />;
  if (outcome === 'loss') return <SadFace />;
  return <NeutralFace />;
}

/** The winner's mark, shown for two-human games. A draw has no mark. */
export function outcomeMark(winner: Player | null) {
  if (!winner) return <NeutralFace />;
  return (
    <Mark
      player={winner}
      hole="var(--color-surface)"
      className={cx('size-20', winner === X && 'p-0.5')}
    />
  );
}

/** Whether a finished game was a win, a loss, or a draw for `you`. */
export function outcomeFor(game: GameState, you: Player): 'win' | 'loss' | 'draw' {
  if (game.status !== 'won' || game.winner === null) return 'draw';
  return game.winner === you ? 'win' : 'loss';
}

/** Plain words for how a match ended, from the point of view of the reader. */
export function describeReason(reason: EndReason, outcome: 'win' | 'loss' | 'draw'): string {
  switch (reason) {
    case 'line':
      return outcome === 'win' ? 'You completed the line' : 'Your opponent completed the line';
    case 'draw':
      return 'The board filled up';
    case 'agreed':
      return 'Draw by agreement';
    case 'resign':
      return outcome === 'win' ? 'Your opponent resigned' : 'You resigned';
    case 'timeout':
      return outcome === 'win' ? 'Your opponent ran out of time' : 'You ran out of time';
    case 'abandoned':
      return outcome === 'win' ? 'Your opponent left the game' : 'You left the game';
  }
}
