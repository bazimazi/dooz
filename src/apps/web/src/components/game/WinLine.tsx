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
 * just cell centres and the whole thing scales with the board - no arithmetic
 * against a hard-coded pixel width, which is what made the original version
 * break on the 6x6 and 9x9 boards.
 *
 * Two strokes are drawn, not one: a blurred copy underneath that breathes, and
 * the solid line on top. Both sweep on together by animating the dash offset,
 * so the win reads as being drawn rather than switched on.
 */
export function WinLine({ line, size, winner }: WinLineProps) {
  const first = line[0];
  const last = line[line.length - 1];
  if (first === undefined || last === undefined) return null;

  const from = centre(first, size);
  const to = centre(last, size);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const colour = winner === X ? 'var(--color-p3)' : 'var(--color-y3)';

  // The dash pair is what makes the sweep: start fully offset, animate to zero.
  const sweep = { strokeDasharray: length, strokeDashoffset: length };

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <filter id="dooz-win-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.07" />
        </filter>
      </defs>

      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={colour}
        strokeWidth={0.16}
        strokeLinecap="round"
        filter="url(#dooz-win-glow)"
        style={{
          ...sweep,
          // Two animations on one element, so they have to share the shorthand:
          // a Tailwind `animate-*` class each would have the later one win.
          animation:
            'draw-line 0.45s 0.1s cubic-bezier(0.22, 1, 0.36, 1) forwards,' +
            ' line-glow 1.8s 0.5s ease-in-out infinite',
        }}
      />

      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={colour}
        strokeWidth={0.075}
        strokeLinecap="round"
        className="animate-draw-line"
        style={sweep}
      />
    </svg>
  );
}

function centre(index: number, size: BoardSize) {
  return { x: (index % size) + 0.5, y: Math.floor(index / size) + 0.5 };
}
