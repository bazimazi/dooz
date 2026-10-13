import type { ArtStyle } from '@/lib/preferences';

/**
 * Drawing that belongs to a style's board rather than to the game: the lines
 * of a goban, an ensō brushed faintly into rice paper, chalk smudges, the
 * corner brackets of an arcade screen.
 *
 * It sits under the squares - which are transparent - and over the board's
 * own colour and material (see `.board-surface` in `art-styles.css`), so
 * nothing here can cover a mark or take a tap. Static SVG only: every style
 * looks finished on Low, where nothing moves.
 */
export function BoardMaterial({
  style,
  size,
  goban = false,
}: {
  style: ArtStyle;
  size: number;
  /** Draw the lines through the squares' centres, for stones on intersections. */
  goban?: boolean;
}) {
  if (goban) return <Goban size={size} />;
  if (style === 'ink') return <InkWash />;
  if (style === 'chalkboard') return <ChalkSmudges />;
  if (style === 'neon') return <ArcadeBrackets />;
  return null;
}

/** Tabletop draws the larger boards as a goban: stones on the intersections. */
export function isGoban(size: number): boolean {
  return size >= 9;
}

/**
 * Star points (hoshi) by board size: the four corner points a fixed step in
 * from the edge, and the centre - the same marks a real 9, 13 or 15 line board
 * carries, which is what makes it read as a goban at a glance.
 */
export function starPoints(size: number): number[][] {
  const step = size >= 13 ? 3 : 2;
  const far = size - 1 - step;
  const middle = Math.floor(size / 2);
  const points = [
    [step, step],
    [step, far],
    [far, step],
    [far, far],
  ];
  if (size % 2 === 1) points.push([middle, middle]);
  return points;
}

function Goban({ size }: { size: number }) {
  // User units are squares, so a line through the middle of square `n` is at
  // `n + 0.5` and the board scales with its container.
  const first = 0.5;
  const last = size - 0.5;
  let rules = '';
  for (let at = 0; at < size; at++) {
    const offset = at + 0.5;
    rules += `M${first} ${offset}H${last}M${offset} ${first}V${last}`;
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        d={rules}
        fill="none"
        stroke="var(--color-grid)"
        strokeOpacity="0.62"
        strokeWidth={0.035}
      />
      {/* The outermost lines are drawn heavier, as on a real board. */}
      <rect
        x={first}
        y={first}
        width={last - first}
        height={last - first}
        fill="none"
        stroke="var(--color-grid)"
        strokeOpacity="0.75"
        strokeWidth={0.06}
      />
      {starPoints(size).map(([row, col]) => (
        <circle
          key={`${row}-${col}`}
          cx={col! + 0.5}
          cy={row! + 0.5}
          r={0.1}
          fill="var(--color-grid)"
          fillOpacity="0.8"
        />
      ))}
    </svg>
  );
}

/** An ensō brushed into the paper long ago, and the artist's red seal. */
function InkWash() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <path
        d="M58 18 C 80 22, 88 44, 82 62 C 76 80, 54 88, 38 82 C 20 75, 13 56, 19 39 C 24 25, 36 18, 47 17"
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity="0.06"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <rect
        x="86"
        y="86"
        width="8"
        height="8"
        rx="1"
        fill="var(--color-mark-x)"
        fillOpacity="0.32"
      />
      <path
        d="M88.2 88.4h3.6M90 88.4v5M88.4 91h3.2"
        stroke="var(--color-board)"
        strokeOpacity="0.8"
        strokeWidth="0.8"
        fill="none"
      />
    </svg>
  );
}

/** The ghosts of earlier lessons, wiped but not quite gone. */
function ChalkSmudges() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g fill="none" stroke="var(--color-ink)" strokeLinecap="round">
        <path d="M8 22 C 26 14, 44 30, 62 20" strokeOpacity="0.05" strokeWidth="6" />
        <path d="M40 84 C 56 76, 74 90, 94 80" strokeOpacity="0.045" strokeWidth="8" />
        <path d="M70 46 l6 -4 m-3 9 l7 -2" strokeOpacity="0.06" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

/** The corner brackets of an arcade screen. */
function ArcadeBrackets() {
  const corner = 'M2 10V2H10';
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g fill="none" stroke="var(--color-accent)" strokeOpacity="0.45" strokeWidth="0.8">
        <path d={corner} />
        <path d={corner} transform="rotate(90 50 50)" />
        <path d={corner} transform="rotate(180 50 50)" />
        <path d={corner} transform="rotate(270 50 50)" />
      </g>
    </svg>
  );
}
