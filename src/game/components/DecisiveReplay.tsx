import { type GameState, isMark, replayFrames, startingPlayerOf, X } from '@/game/engine';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { useGraphics } from '@/lib/graphics';
import { usePageVisible } from '@/lib/usePageVisible';

/** How many of the final moves the replay plays back. */
const MOVES = 5;
const STEP_MS = 620;
const HOLD_MS = 1600;

/**
 * The last few moves of a finished game, playing themselves on a loop beside
 * the result - the moment it was decided, seen again while the verdict sinks
 * in.
 *
 * On a big board the view is cropped to the part where it happened, because a
 * 15x15 board at thumbnail size is a grid of specks. On Low it shows the final
 * position and does not move. It is decoration over a result that is already
 * stated in words, so it is hidden from assistive technology.
 */
export function DecisiveReplay({ game, className }: { game: GameState; className?: string }) {
  const graphics = useGraphics();
  const visible = usePageVisible();
  const plan = useMemo(() => replayPlan(game), [game]);
  const [step, setStep] = useState(0);
  const playing = graphics !== 'low' && visible && plan !== null && plan.frames.length > 1;

  useEffect(() => {
    if (!playing || !plan) return;
    const last = plan.frames.length - 1;
    // Start from the position before the run, then walk through it; hold on
    // the finish so the line can be seen, then go again.
    let current = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      current = current >= last ? 0 : current + 1;
      setStep(current);
      timer = setTimeout(advance, current === last ? HOLD_MS : STEP_MS);
    };
    timer = setTimeout(advance, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, plan]);

  if (!plan) return null;
  const shown = playing ? Math.min(step, plan.frames.length - 1) : plan.frames.length - 1;
  const frame = plan.frames[shown]!;
  const { view } = plan;
  const final = shown === plan.frames.length - 1;
  const line = final ? plan.line : null;

  return (
    <div
      aria-hidden="true"
      // A board is a coordinate grid: it never mirrors with the language.
      dir="ltr"
      className={cx(
        'board-surface relative aspect-square overflow-hidden rounded-xl border border-stroke-soft',
        className,
      )}
      style={{ '--board-size': view.span } as CSSProperties}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${view.span}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${view.span}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: view.span * view.span }, (_, at) => {
          const row = view.row + Math.floor(at / view.span);
          const col = view.col + (at % view.span);
          const index = row * plan.size + col;
          const cell = frame.board[index];
          const latest = frame.lastMove === index;
          return (
            <div
              key={at}
              className={cx(
                'relative flex items-center justify-center border-t border-r border-dashed border-grid/40',
                at < view.span && 'border-t-0',
                at % view.span === view.span - 1 && 'border-r-0',
              )}
            >
              {isMark(cell) ? (
                <Mark
                  key={`${index}-${cell}`}
                  player={cell}
                  hole="var(--color-board)"
                  className={cx('w-[70%]', playing && 'hero-mark')}
                />
              ) : null}
              {latest && playing ? (
                <span className="absolute inset-[8%] rounded-full ring-2 ring-ink/60" />
              ) : null}
            </div>
          );
        })}
      </div>
      {line ? (
        <svg
          key={`line-${shown}`}
          viewBox={`0 0 ${view.span} ${view.span}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <path
            d={`M${line.from.x} ${line.from.y}L${line.to.x} ${line.to.y}`}
            stroke={line.winner === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)'}
            strokeWidth={0.12}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={playing ? 1 : 0}
            className={playing ? 'hero-line' : undefined}
          />
        </svg>
      ) : null}
    </div>
  );
}

interface ReplayPlan {
  size: number;
  frames: GameState[];
  /** The square view shown, in board rows and columns. */
  view: { row: number; col: number; span: number };
  line: { from: { x: number; y: number }; to: { x: number; y: number }; winner: number } | null;
}

/**
 * What to play back: the last few positions, and the part of the board to
 * show them on. `null` for a game with nothing to replay, or one that is not
 * a flat grid of squares (a cube, a superposition) and would not read as one.
 */
export function replayPlan(game: GameState): ReplayPlan | null {
  const { size } = game.config;
  if (game.moves.length === 0 || game.board.length !== size * size) return null;
  if (game.config.variant === 'qubic' || game.config.variant === 'quantum') return null;
  const frames = replayFrames(game.config, startingPlayerOf(game), game.moves);
  if (!frames) return null;
  const recent = frames.slice(-(MOVES + 1));

  // Frame the squares that changed, plus the winning run, with a margin;
  // never smaller than the run needs, never bigger than the board.
  const focus = recent
    .map((frame) => frame.lastMove)
    .filter((cell): cell is number => cell !== null && cell < size * size);
  focus.push(...(game.winLine ?? []));
  const span = Math.min(size, Math.max(game.config.winLength + 2, 5, spread(focus, size) + 2));
  const rows = focus.map((cell) => Math.floor(cell / size));
  const cols = focus.map((cell) => cell % size);
  const centre = (values: number[]) =>
    values.length === 0 ? (size - 1) / 2 : (Math.min(...values) + Math.max(...values)) / 2;
  const clamp = (start: number) => Math.max(0, Math.min(size - span, Math.round(start)));
  const view = {
    row: clamp(centre(rows) - (span - 1) / 2),
    col: clamp(centre(cols) - (span - 1) / 2),
    span,
  };

  const run = game.winLine;
  const line =
    run && run.length > 1 && game.winner !== null
      ? {
          from: point(run[0]!, size, view),
          to: point(run.at(-1)!, size, view),
          winner: game.winner,
        }
      : null;

  return { size, frames: recent, view, line };
}

/** The larger of the rows and columns the squares cover. */
function spread(cells: readonly number[], size: number): number {
  if (cells.length === 0) return 0;
  const rows = cells.map((cell) => Math.floor(cell / size));
  const cols = cells.map((cell) => cell % size);
  return Math.max(Math.max(...rows) - Math.min(...rows), Math.max(...cols) - Math.min(...cols)) + 1;
}

function point(cell: number, size: number, view: { row: number; col: number }) {
  return {
    x: (cell % size) - view.col + 0.5,
    y: Math.floor(cell / size) - view.row + 0.5,
  };
}
