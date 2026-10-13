import {
  Blocked,
  type GameConfig,
  Empty,
  O,
  obstacleCells,
  ORDER,
  qubicIndex,
  X,
} from '@/game/engine';
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
  // with O's marks holding up X's climbing diagonal. Connect Four is the same
  // staircase under its blocked top row, which the preview crops off.
  if (config.variant === 'gravity' || config.variant === 'connect4') {
    if (config.variant === 'connect4') for (let col = 0; col < size; col++) cells[col] = Blocked;
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

  // Qubic: a pillar straight down through the four layers, which sit as the
  // board's quadrants. No line is drawn - on the flat layout the run crosses
  // the gaps between layers - so the marks themselves carry it.
  if (config.variant === 'qubic') {
    const pillar = [0, 1, 2, 3].map((layer) => qubicIndex(layer, 1, 2));
    for (const index of pillar) cells[index] = X;
    for (const index of [qubicIndex(0, 2, 1), qubicIndex(1, 1, 1), qubicIndex(3, 2, 2)]) {
      cells[index] = O;
    }
    return { cells, winLine: [], faded: [] };
  }

  // Quantum: the classic diagonal, with two faded O marks for a spooky one
  // still in two places at once.
  if (config.variant === 'quantum') {
    for (const index of [0, 4, 8]) cells[index] = X;
    for (const index of [2, 3]) cells[index] = O;
    return { cells, winLine: [0, 4, 8], faded: [2, 3] };
  }

  // Wild: a row of Os - whoever placed the last one won with it - among
  // spoiled lines of both marks.
  if (config.variant === 'wild') {
    const winLine = Array.from({ length: winLength }, (_, col) => col);
    for (const index of winLine) cells[index] = O;
    for (let row = 1; row < size; row++) {
      cells[row * size + ((row + 1) % size)] = X;
      cells[row * size + ((row + 2) % size)] = row % 2 === 0 ? O : X;
    }
    return { cells, winLine, faded: [] };
  }

  // Order and Chaos: Order's five alike across the middle, and the marks of
  // both kinds Chaos scattered to spoil the other lines.
  if (config.variant === 'order-chaos') {
    const winLine = Array.from({ length: winLength }, (_, col) => 2 * size + col + 1);
    for (const index of winLine) cells[index] = ORDER;
    const spoilers = [0, 7, 9, 16, 20, 26, 29, 33];
    spoilers.forEach((index, at) => {
      cells[index] = at % 2 === 0 ? X : O;
    });
    return { cells, winLine, faded: [] };
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

  // Pente: an X O O X capture under the run, its pair on the way out.
  if (config.variant === 'pente') {
    const row = Math.min(size - 1, offset + winLength + 1);
    const start = Math.max(0, offset - 1);
    cells[row * size + start] = X;
    cells[row * size + start + 1] = O;
    cells[row * size + start + 2] = O;
    cells[row * size + start + 3] = X;
    return { cells, winLine, faded: [row * size + start + 1, row * size + start + 2] };
  }

  // Obstacles: the rocks of one layout, around the run.
  if (config.variant === 'obstacles') {
    for (const index of obstacleCells(config)) {
      if (cells[index] === Empty) cells[index] = Blocked;
    }
  }

  // Powers: a wall built beside the run, and an O mark being bombed away.
  if (config.variant === 'powers') {
    const wall = Math.min(size * size - 1, (offset + winLength) * size + offset);
    if (cells[wall] === Empty) cells[wall] = Blocked;
    const bombed = offset * size + offset + 2;
    if (cells[bombed] === Empty) {
      cells[bombed] = O;
      return { cells, winLine, faded: [bombed] };
    }
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
  // Rows at the top the preview leaves off: Connect Four's blocked one.
  const hidden = config.variant === 'connect4' ? 1 : 0;
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
      // A board is a coordinate grid: it never mirrors with the language.
      dir="ltr"
      className={cx(
        'relative aspect-square overflow-hidden rounded-2xl border border-stroke-soft bg-surface/70',
        'transition-shadow duration-300 ease-soft',
        active && 'shadow-[0_10px_30px_-14px_var(--color-shadow)]',
        className,
      )}
      style={hidden > 0 ? { aspectRatio: `${size} / ${size - hidden}` } : undefined}
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
          gridTemplateRows: `repeat(${size - hidden}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell, index) =>
          index < hidden * size ? null : (
            <div
              key={index}
              className={cx(
                'relative flex items-center justify-center border-t border-r border-dashed border-grid/40',
                index < (hidden + 1) * size && 'border-t-0',
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
                // Qubic's four layers, as the quadrants they are stored in.
                config.variant === 'qubic' && index % size === 4 && 'border-l-2 border-l-stroke/70',
                config.variant === 'qubic' &&
                  Math.floor(index / size) === 4 &&
                  'border-t-2 border-t-stroke/70',
              )}
            >
              {cell === Blocked ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-[14%] rounded-[32%] bg-ink/18 shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]"
                />
              ) : cell !== Empty ? (
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
          ),
        )}
      </div>

      {winLine.length > 1 ? (
        <svg
          key={`line-${replayKey}`}
          viewBox={`0 ${hidden} ${size} ${size - hidden}`}
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
      ) : null}
    </div>
  );
}
