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
  className?: string;
}

export function MiniBoard({ size, className }: MiniBoardProps) {
  const { cells, winLine } = samplePosition(size);
  const first = winLine[0]!;
  const last = winLine[winLine.length - 1]!;

  return (
    <div
      className={cx(
        'relative aspect-square overflow-hidden rounded-2xl border border-b8/70 bg-surface/70',
        className,
      )}
    >
      <div
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
              <Mark player={cell as 1 | 2} hole="var(--color-surface)" className="w-[70%]" />
            ) : null}
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <line
          x1={(first % size) + 0.5}
          y1={Math.floor(first / size) + 0.5}
          x2={(last % size) + 0.5}
          y2={Math.floor(last / size) + 0.5}
          stroke="var(--color-p3)"
          strokeWidth={0.08}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
