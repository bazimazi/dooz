import { type BoardSize, Empty, O, WIN_LENGTH, X } from '@dooz/engine';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';

/**
 * A small, non-interactive board used as the preview on the home screen.
 *
 * The sample position is generated rather than hand-listed so it stays honest:
 * the highlighted run is exactly `WIN_LENGTH` long for the size on show, which
 * is the one thing the preview is there to communicate.
 */
function samplePosition(size: BoardSize): { cells: number[]; winLine: number[] } {
  const cells: number[] = Array.from({ length: size * size }, () => Empty);
  const need = WIN_LENGTH[size];

  // A diagonal of X starting one cell in from the top-left corner.
  const offset = size === 3 ? 0 : 1;
  const winLine: number[] = [];
  for (let step = 0; step < need; step++) {
    const index = (offset + step) * size + (offset + step);
    cells[index] = X;
    winLine.push(index);
  }

  // Some O replies below the diagonal, to show both marks.
  for (let step = 0; step < need - 1; step++) {
    const row = offset + step + 1;
    const col = offset + step;
    if (row < size) cells[row * size + col] = O;
  }

  return { cells, winLine };
}

interface MiniBoardProps {
  size: BoardSize;
  /**
   * True for the preview currently centred in the carousel. The sample position
   * replays itself when a preview takes the centre, which is what makes the
   * carousel feel like it is showing you a board rather than a thumbnail.
   */
  active?: boolean;
  className?: string;
}

export function MiniBoard({ size, active = false, className }: MiniBoardProps) {
  const { cells, winLine } = samplePosition(size);
  const first = winLine[0]!;
  const last = winLine[winLine.length - 1]!;

  const from = { x: (first % size) + 0.5, y: Math.floor(first / size) + 0.5 };
  const to = { x: (last % size) + 0.5, y: Math.floor(last / size) + 0.5 };
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  // Keying on `active` remounts the contents as a preview takes or gives up the
  // centre, which is the only way to replay a one-shot CSS animation.
  const replayKey = active ? 'active' : 'idle';

  return (
    <div
      className={cx(
        'relative aspect-square overflow-hidden rounded-2xl border border-b8/70 bg-surface/70',
        'transition-shadow duration-300 ease-soft',
        active && 'shadow-[0_10px_30px_-14px_rgb(0_0_0/0.8)]',
        className,
      )}
    >
      <div
        key={replayKey}
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {cells.map((cell, index) => (
          <div
            key={index}
            className={cx(
              'flex items-center justify-center border-t border-r border-dashed border-grid/40',
              index < size && 'border-t-0',
              index % size === size - 1 && 'border-r-0',
            )}
          >
            {cell !== Empty ? (
              <Mark
                player={cell as 1 | 2}
                hole="var(--color-surface)"
                className={cx(
                  'w-[70%]',
                  active && (cell === X ? 'animate-mark-x' : 'animate-mark-o'),
                )}
                // The marks land in reading order rather than all together, so
                // the eye is led along the run the preview is demonstrating.
                style={active ? { animationDelay: `${0.06 + index * 0.012}s` } : undefined}
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
          stroke="var(--color-p3)"
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
