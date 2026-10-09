import { applyMove, createGame, type GameState, modeById, type ModeId } from '@/game/engine';
import { useMemo, useState } from 'react';
import { Board } from '@/game/components/Board';
import { useGameFeedback } from '@/game/useGameFeedback';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';
import { useClosing } from '@/lib/useClosing';
import { sfx } from '@/lib/sound';
import { useDialog } from '@/lib/useDialog';

/**
 * Learning the game by playing it.
 *
 * Three steps, each a real board the player has to actually touch: place a
 * mark, complete a line, then block one. Nothing advances on a timer and
 * nothing advances on a "Next" button until the move has been made, because a
 * tutorial you can click past is a tutorial nobody has done.
 *
 * The boards are the same `Board` component the game uses, driven by the same
 * engine - so what is learned here is literally the thing that was learned,
 * rather than a diagram of it.
 */
interface Step {
  title: string;
  body: string;
  /** The position to start from, as moves played on a 3x3 board from X. */
  setup: readonly number[];
  /** The square to find, or any empty square for the first step. */
  answer: number | null;
  /** What to say once they find it. */
  success: string;
}

const STEPS: readonly Step[] = [
  {
    title: 'Place your mark',
    body: 'Tap any empty square to play there. You are X and you move first.',
    setup: [],
    answer: null,
    success: 'Your mark is down. Now the other player takes a turn.',
  },
  {
    title: 'Win the game',
    body: 'Three of your marks in a row wins — across, down or diagonally. Find the square that finishes it.',
    // X holds 0 and 1, O holds 3 and 4. X to move: 2 completes the top row.
    setup: [0, 3, 1, 4],
    answer: 2,
    success: 'That is three in a row. The line lights up when a game is won.',
  },
  {
    title: 'Block the other player',
    body: 'O is one move from winning down the left side. Take that square before they do.',
    // X: 1, 2. O: 0, 3. X to move: 6 blocks the 0-3-6 column.
    setup: [1, 0, 2, 3],
    answer: 6,
    success: 'Blocked. Watching your opponent’s lines matters as much as building your own.',
  },
];

export function OnboardingSheet({ mode, onClose }: { mode: ModeId; onClose: () => void }) {
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);

  const [step, setStep] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(false);

  const current = STEPS[step]!;
  const [game, setGame] = useState<GameState>(() => positionFor(current));

  const modeRules = useMemo(() => modeById(mode), [mode]);
  useGameFeedback(game);
  const last = step === STEPS.length - 1;

  function attempt(index: number) {
    if (solved) return;

    if (current.answer !== null && index !== current.answer) {
      // A wrong answer is not punished, only named: the board stays as it was
      // and the hint gets more specific. Nothing is lost by guessing.
      setWrong(true);
      sfx.wrong();
      return;
    }

    setWrong(false);
    setSolved(true);
    setGame((state) => applyMove(state, index) ?? state);
  }

  function advance() {
    if (last) {
      close();
      return;
    }
    const next = STEPS[step + 1]!;
    setStep(step + 1);
    setSolved(false);
    setWrong(false);
    setGame(positionFor(next));
  }

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-[2px]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        tabIndex={-1}
        className={cx(
          'w-full max-w-80 panel-shell rounded-[2rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <div className="flex max-h-[90vh] flex-col gap-3 overflow-y-auto panel-face rounded-[1.5rem] bg-surface px-5 py-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs tracking-wide text-ink-faint uppercase">
              Step {step + 1} of {STEPS.length}
            </span>
            <button
              type="button"
              onClick={close}
              className="text-xs text-ink-faint underline underline-offset-4 hover:text-ink"
            >
              Skip
            </button>
          </div>

          {/* Progress, as dots rather than a bar: three steps is a countable
              number and a bar at 33% says less than "one of three". */}
          <div className="flex gap-1.5" aria-hidden="true">
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={cx(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  index <= step ? 'bg-stroke' : 'bg-stroke-soft',
                )}
              />
            ))}
          </div>

          <h2 className="font-display text-xl">{current.title}</h2>
          <p className="text-sm text-ink-muted">{current.body}</p>

          <div className="mx-auto w-full max-w-60">
            <Board
              game={game}
              onPlay={attempt}
              disabled={solved}
              hints={
                !solved && wrong && current.answer !== null
                  ? [{ index: current.answer, kind: step === 2 ? 'threat' : 'win' }]
                  : []
              }
            />
          </div>

          <p
            aria-live="polite"
            className={cx(
              'min-h-10 text-center text-sm',
              solved ? 'text-ok' : wrong ? 'text-warn' : 'text-ink-faint',
            )}
          >
            {solved
              ? step === 0 && game.lastMove === 4
                ? 'Nice. The middle sits on four different lines. Now the other player takes a turn.'
                : current.success
              : wrong
                ? 'Look for the marked square and try again.'
                : ' '}
          </p>

          {last && solved ? (
            <div className="rounded-tile border border-stroke-soft bg-surface/60 px-3 py-2.5">
              <p className="text-xs text-ink-faint">Next up: {modeRules.name}</p>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-xs text-ink-muted">
                {modeRules.rules.slice(0, 3).map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button size="small" variant="primary" disabled={!solved} onClick={advance} block>
            {last ? 'Start playing' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function positionFor(step: Step): GameState {
  let game = createGame(3);
  for (const move of step.setup) game = applyMove(game, move) ?? game;
  return game;
}
