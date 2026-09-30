import { type Player, type WinLine as WinLineCells, X } from '@dooz/engine';
import { useId } from 'react';

interface WinLineProps {
  line: WinLineCells;
  size: number;
  winner: Player;
  /** Seconds to hold off - a gravity mark has to finish falling first. */
  delay?: number;
}

/**
 * The stroke drawn through a winning run.
 *
 * Laid out in an SVG whose user units are board cells, so the endpoints are
 * just cell centres and the whole thing scales with the board - no arithmetic
 * against a hard-coded pixel width, which is what made the original version
 * break on the 6x6 and 9x9 boards. The same component draws Ultimate's win
 * across three small boards by being told the board is 3 wide.
 *
 * Two strokes are drawn, not one: a blurred copy underneath that breathes, and
 * the solid line on top. Both sweep on together by animating the dash offset,
 * so the win reads as being drawn rather than switched on. Once it is complete
 * two rings pulse out from its middle, which is the moment the win lands.
 */
export function WinLine({ line, size, winner, delay = 0 }: WinLineProps) {
  const filterId = `dooz-win-glow-${useId().replace(/:/g, '')}`;
  const first = line[0];
  const last = line[line.length - 1];
  if (first === undefined || last === undefined) return null;

  const from = centre(first, size);
  const to = centre(last, size);
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const colour = winner === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)';

  // The dash pair is what makes the sweep: start fully offset, animate to zero.
  const sweep = { strokeDasharray: length, strokeDashoffset: length };
  const drawn = delay + 0.55;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={0.07 * (size / 3) ** 0.2} />
        </filter>
      </defs>

      {[0, 0.16].map((stagger) => (
        <circle
          key={stagger}
          cx={middle.x}
          cy={middle.y}
          r={Math.max(1.2, size * 0.7)}
          fill="none"
          stroke={colour}
          strokeWidth={0.05 * Math.max(1, size / 6)}
          className="animate-shockwave"
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
            animationDelay: `${drawn + stagger}s`,
          }}
        />
      ))}

      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={colour}
        strokeWidth={0.16}
        strokeLinecap="round"
        filter={`url(#${filterId})`}
        style={{
          ...sweep,
          // Two animations on one element, so they have to share the shorthand:
          // a Tailwind `animate-*` class each would have the later one win.
          animation:
            `draw-line 0.45s ${delay + 0.1}s cubic-bezier(0.22, 1, 0.36, 1) forwards,` +
            ` line-glow 1.8s ${delay + 0.5}s ease-in-out infinite`,
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
        style={{
          ...sweep,
          animation: `draw-line 0.45s ${delay + 0.1}s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
        }}
      />
    </svg>
  );
}

function centre(index: number, size: number) {
  return { x: (index % size) + 0.5, y: Math.floor(index / size) + 0.5 };
}
