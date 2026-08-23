import { type BoardSize, Empty, type GameState, O, X } from '@dooz/engine';
import { type KeyboardEvent, useRef, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { WinLine } from './WinLine';

interface BoardProps {
  game: GameState;
  onPlay: (index: number) => void;
  /** Blocks input while it is the bot's or the opponent's turn. */
  disabled?: boolean;
}

/**
 * Corner radii per board size, from the Figma frames.
 *
 * A 9x9 grid inside the same 64px rounding the 3x3 uses would clip its corner
 * cells, so the rounding tightens as the cells shrink.
 */
const RADII: Record<BoardSize, { frame: string; inner: string }> = {
  3: { frame: '2rem', inner: '1.75rem' },
  6: { frame: '1.5rem', inner: '1.125rem' },
  9: { frame: '1.25rem', inner: '0.75rem' },
};

export function Board({ game, onPlay, disabled = false }: BoardProps) {
  const { size, board, winLine, status } = game;
  const radii = RADII[size];
  const gridRef = useRef<HTMLDivElement>(null);
  // Roving tabindex: the grid is one tab stop and the arrow keys move within
  // it, so a 9x9 board does not put 81 stops in the page's tab order.
  const [focusIndex, setFocusIndex] = useState(0);

  const winning = new Set(winLine ?? []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: size,
      ArrowUp: -size,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;

    // Left and right must not jump between rows.
    const row = Math.floor(focusIndex / size);
    const next = focusIndex + delta;
    if (next < 0 || next >= board.length) return;
    if (Math.abs(delta) === 1 && Math.floor(next / size) !== row) return;

    event.preventDefault();
    setFocusIndex(next);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
  }

  return (
    <div
      className="glass-edge relative w-full max-w-78 p-3 backdrop-blur-[3px]"
      style={{ borderRadius: radii.frame }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden bg-surface"
        style={{ borderRadius: radii.inner }}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${size} by ${size} board`}
          onKeyDown={handleKeyDown}
          className="grid h-full w-full"
          style={{
            // Both axes need explicit 1fr tracks. With auto rows, the row that
            // holds a mark sizes to the mark and steals height from the others.
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
          }}
        >
          {board.map((cell, index) => {
            const row = Math.floor(index / size);
            const col = index % size;
            const isPlayable = cell === Empty && status === 'playing' && !disabled;

            return (
              <button
                key={index}
                type="button"
                data-cell={index}
                role="gridcell"
                tabIndex={index === focusIndex ? 0 : -1}
                disabled={!isPlayable}
                onFocus={() => setFocusIndex(index)}
                onClick={() => onPlay(index)}
                aria-label={describeCell(row, col, cell)}
                className={cx(
                  'relative flex items-center justify-center',
                  // Dashed rules between cells only — the outer edge is the
                  // frame, so the first row and last column stay clean.
                  'border-t border-r border-dashed border-grid/85',
                  row === 0 && 'border-t-0',
                  col === size - 1 && 'border-r-0',
                  // A disabled button still needs to look inert rather than
                  // dimmed: the marks on it are the point of the screen.
                  'disabled:opacity-100',
                  isPlayable && 'cursor-pointer',
                )}
              >
                {cell !== Empty ? (
                  <Mark
                    player={cell}
                    hole="var(--color-surface)"
                    className={cx(
                      'w-[68%] animate-pop',
                      winning.has(index) && 'drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]',
                    )}
                  />
                ) : null}

                {/* Faint hint of the mark that would land here. */}
                {isPlayable ? (
                  <Mark
                    player={game.currentPlayer}
                    hole="var(--color-surface)"
                    className="pointer-events-none absolute w-[68%] opacity-0 transition-opacity duration-150 group-hover:opacity-20 hover:opacity-20"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {winLine ? <WinLine line={winLine} size={size} winner={game.winner ?? X} /> : null}
      </div>
    </div>
  );
}

function describeCell(row: number, col: number, cell: number): string {
  const position = `row ${row + 1}, column ${col + 1}`;
  if (cell === X) return `${position}, X`;
  if (cell === O) return `${position}, O`;
  return `${position}, empty`;
}
