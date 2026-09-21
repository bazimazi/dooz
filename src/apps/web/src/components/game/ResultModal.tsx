import { type GameState, type Player, X } from '@dooz/engine';
import { type ReactNode, useEffect, useState } from 'react';
import { Confetti } from '@/components/art/Confetti';
import { HappyFace, NeutralFace, SadFace } from '@/components/art/faces';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { useDialog } from '@/lib/useDialog';
import { GameControls } from './GameControls';

interface ResultModalProps {
  title: string;
  art: ReactNode;
  onRestart: () => void;
  restartLabel?: string;
  restartDisabled?: boolean;
  /** Extra line under the title - a rematch prompt, say. */
  note?: ReactNode;
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
 */
export function revealDelayFor(game: GameState): number {
  return game.winLine ? 1250 : 700;
}

/**
 * There is deliberately no dismiss affordance: the two ways out of a finished
 * game are to play again or to go home, and both are in the panel. That is also
 * why `useDialog` is given no escape handler here - there is nothing for Escape
 * to do that the buttons do not.
 *
 * It arrives in pieces - dim, then panel, then the face, the verdict and the
 * buttons - because the result is the one moment in the game worth pausing on.
 * The whole sequence is under half a second, so it never delays a rematch.
 */
function ResultPanel({
  title,
  art,
  onRestart,
  restartLabel,
  restartDisabled,
  note,
  celebrate = false,
}: Omit<ResultModalProps, 'revealDelay'>) {
  // Moves focus in, traps Tab, and makes the board behind it inert - without
  // which `aria-modal` below would be a claim the page does not honour.
  const panelRef = useDialog<HTMLDivElement>();

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-5 backdrop-blur-[2px]">
      {celebrate ? <Confetti /> : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx(
          'relative w-full max-w-78 animate-panel-in rounded-[3.5rem] border border-b8 p-2 outline-none',
          'shadow-[0_30px_70px_-30px_rgb(0_0_0/0.9)]',
        )}
        style={{ animationDelay: '0.06s' }}
      >
        <div className="flex flex-col items-center gap-4 rounded-[3rem] bg-raised px-6 py-10">
          <div className="animate-pop text-[5rem] leading-none" style={{ animationDelay: '0.22s' }}>
            {/* A slow bob under the one-shot entrance, so the face stays alive
                while the panel waits for a decision. */}
            <span className="block animate-bob">{art}</span>
          </div>

          <h2
            className="animate-rise text-center font-display text-2xl text-g8"
            style={{ animationDelay: '0.34s' }}
          >
            {title}
          </h2>

          {note ? (
            <p
              className="-mt-2 animate-rise text-center text-sm text-g8/80"
              style={{ animationDelay: '0.4s' }}
            >
              {note}
            </p>
          ) : null}

          <div className="animate-rise pt-2" style={{ animationDelay: '0.46s' }}>
            <GameControls
              onRestart={onRestart}
              tone="solid"
              restartLabel={restartLabel}
              restartDisabled={restartDisabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The face shown for a game played against the bot. */
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
      hole="var(--color-raised)"
      className={cx('size-20', winner === X && 'p-0.5')}
    />
  );
}

/** Whether a finished game was a win, a loss, or a draw for `you`. */
export function outcomeFor(game: GameState, you: Player): 'win' | 'loss' | 'draw' {
  if (game.status !== 'won' || game.winner === null) return 'draw';
  return game.winner === you ? 'win' : 'loss';
}
