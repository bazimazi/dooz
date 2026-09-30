import { type GameConfig, Empty, O, X } from '@dooz/engine';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';

/**
 * A small, non-interactive board used as the preview on the mode picker.
 *
 * The sample position is generated rather than hand-listed so it stays honest:
 * the highlighted run is exactly as long as the mode's win length, which is the
 * one thing the preview is there to communicate. Ultimate gets its sub-board
 * grid instead of a run, because that is what makes it different.
 */
function samplePosition(config: GameConfig): {
  cells: number[];
  winLine: number[];
  faded: readonly number[];
} {
  const { size, winLength } = config;
  const cells: number[] = Array.from({ length: size * size }, () => Empty);

  // Gravity's sample has to obey gravity: a staircase built up from the floor,
  // with O's marks holding up X's climbing diagonal.
  if (config.variant === 'gravity') {
    const at = (row: number, col: number) => row * size + col;
    const floor = size - 1;
    const x = [at(floor, 0), at(floor - 1, 1), at(floor - 2, 2), at(floor - 3, 3), at(floor, 3)];
    const o = [at(floor, 1), at(floor, 2), at(floor - 1, 2), at(floor - 1, 3), at(floor - 2, 3)];
    for (const index of x) cells[index] = X;
    for (const index of o) cells[index] = O;
    return { cells, winLine: x.slice(0, 4), faded: [] };
  }

  // Vanish: a finished row, with the loser's oldest mark already on its way out.
  if (config.variant === 'vanish') {
    for (const index of [0, 1, 2]) cells[index] = X;
    for (const index of [4, 6, 8]) cells[index] = O;
    return { cells, winLine: [0, 1, 2], faded: [6] };
  }

  // A diagonal of X, centred so it reads as part of a board rather than an
  // edge case, with O replies below it to show both marks.
  const offset = Math.max(0, Math.floor((size - winLength) / 2));
  const winLine: number[] = [];

  for (let step = 0; step < winLength; step++) {
    const index = (offset + step) * size + (offset + step);
    cells[index] = X;
    winLine.push(index);
  }

  for (let step = 0; step < winLength - 1; step++) {
    const row = offset + step + 1;
    const col = offset + step;
    if (row < size && col < size) cells[row * size + col] = O;
  }

  return { cells, winLine, faded: [] };
}

interface MiniBoardProps {
  config: GameConfig;
  /**
   * True for the preview currently selected. The sample position replays
   * itself when a preview is chosen, which is what makes the picker feel like
   * it is showing you a board rather than a thumbnail.
   */
  active?: boolean;
  className?: string;
}

export function MiniBoard({ config, active = false, className }: MiniBoardProps) {
  const { size } = config;
  const { cells, winLine, faded } = samplePosition(config);
  const first = winLine[0] ?? 0;
  const last = winLine.at(-1) ?? 0;

  const from = { x: (first % size) + 0.5, y: Math.floor(first / size) + 0.5 };
  const to = { x: (last % size) + 0.5, y: Math.floor(last / size) + 0.5 };
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  // Keying on `active` remounts the contents as a preview is chosen or dropped,
  // which is the only way to replay a one-shot CSS animation.
  const replayKey = active ? 'active' : 'idle';
  // Above this the marks are smaller than the animation is worth, and there are
  // enough of them for the stagger to take longer than anybody will watch.
  const animate = active && size <= 9;

  return (
    <div
      className={cx(
        'relative aspect-square overflow-hidden rounded-2xl border border-stroke-soft bg-surface/70',
        'transition-shadow duration-300 ease-soft',
        active && 'shadow-[0_10px_30px_-14px_var(--color-shadow)]',
        className,
      )}
    >
      <div
        key={replayKey}
        className="grid h-full w-full"
        style={{
          // Both axes need explicit 1fr tracks. Left on `auto`, a row holding a
          // mark sizes to that mark and takes height from the empty ones, so
          // the cells stop being square - and the win line, which is drawn in
          // an overlay whose units are cells, no longer lands on them.
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell, index) => (
          <div
            key={index}
            className={cx(
              'flex items-center justify-center border-t border-r border-dashed border-grid/40',
              index < size && 'border-t-0',
              index % size === size - 1 && 'border-r-0',
              // Ultimate's sub-board rules, so its preview looks like itself.
              config.variant === 'ultimate' &&
                index % 3 === 0 &&
                index % size !== 0 &&
                'border-l-2 border-l-stroke/70',
              config.variant === 'ultimate' &&
                Math.floor(index / size) % 3 === 0 &&
                index >= size &&
                'border-t-2 border-t-stroke/70',
            )}
          >
            {cell !== Empty ? (
              <Mark
                player={cell === X ? X : O}
                hole="var(--color-surface)"
                className={cx(
                  'w-[70%]',
                  animate && (cell === X ? 'animate-mark-x' : 'animate-mark-o'),
                  faded.includes(index) && 'opacity-40',
                )}
                // The marks land in reading order rather than all together, so
                // the eye is led along the run the preview is demonstrating.
                style={animate ? { animationDelay: `${0.06 + index * 0.012}s` } : undefined}
              />
            ) : null}
          </div>
        ))}
      </div>

      <svg
        key={`line-${replayKey}`}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="var(--color-mark-x-soft)"
          strokeWidth={0.08}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={active ? length : 0}
          style={
            active
              ? { animation: 'draw-line 0.5s 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards' }
              : undefined
          }
        />
      </svg>
    </div>
  );
}
