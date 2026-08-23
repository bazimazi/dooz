import { type BoardSize, type Player, type WinLine as WinLineCells, X } from '@dooz/engine';

interface WinLineProps {
  line: WinLineCells;
  size: BoardSize;
  winner: Player;
}

/**
 * The stroke drawn through a winning run.
 *
 * Laid out in an SVG whose user units are board cells, so the endpoints are
 * just cell centres and the whole thing scales with the board — no arithmetic
 * against a hard-coded pixel width, which is what made the original version
 * break on the 6x6 and 9x9 boards.
 */
export function WinLine({ line, size, winner }: WinLineProps) {
  const first = line[0];
  const last = line[line.length - 1];
  if (first === undefined || last === undefined) return null;

  const from = centre(first, size);
  const to = centre(last, size);
  const length = Math.hypot(to.x - from.x, to.y - from.y);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={winner === X ? 'var(--color-p3)' : 'var(--color-y3)'}
        strokeWidth={0.075}
        strokeLinecap="round"
        // Draw the stroke on by animating the dash offset from its full length
        // down to zero, so the line sweeps from one end of the run to the other.
        strokeDasharray={length}
        strokeDashoffset={length}
        style={{
          animation: 'dooz-draw-line 0.45s 0.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}
      />
      <style>{`@keyframes dooz-draw-line { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

function centre(index: number, size: BoardSize) {
  return { x: (index % size) + 0.5, y: Math.floor(index / size) + 0.5 };
}
