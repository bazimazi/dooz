import { type BoardSize, type Cell, Empty, type GameState, O, X } from '@dooz/engine';
import { type KeyboardEvent, useRef, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { WinLine } from './WinLine';

/** How the game ended, from the point of view of the person at this device. */
export type FinishTone = 'win' | 'loss' | 'draw';

interface BoardProps {
  game: GameState;
  onPlay: (index: number) => void;
  /** Blocks input while it is the bot's or the opponent's turn. */
  disabled?: boolean;
  /**
   * Set once the game is over, to pick the board's reaction: a settle for a
   * win, a shake for a loss. Omitted while the game is still running.
   */
  finishTone?: FinishTone | null;
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

/** `[0, 1, ... size - 1]` per board size, so the grid is not rebuilt each render. */
const ROWS: Record<BoardSize, readonly number[]> = {
  3: [0, 1, 2],
  6: [0, 1, 2, 3, 4, 5],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

export function Board({ game, onPlay, disabled = false, finishTone = null }: BoardProps) {
  const { size, board, winLine, status } = game;
  const radii = RADII[size];
  const gridRef = useRef<HTMLDivElement>(null);
  // Roving tabindex: the grid is one tab stop and the arrow keys move within
  // it, so a 9x9 board does not put 81 stops in the page's tab order.
  const [focusIndex, setFocusIndex] = useState(0);

  // Position in the winning run, so the run can light up cell by cell along
  // its own direction rather than all at once.
  const winOrder = new Map((winLine ?? []).map((cell, order) => [cell, order]));

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
      className={cx(
        'glass-edge relative w-full max-w-78 p-3 backdrop-blur-[3px]',
        'transition-[box-shadow,opacity] duration-500 ease-soft',
        // Waiting on the bot or the opponent: the board steps back rather than
        // going grey, so it is clear input is not wanted without the position
        // becoming harder to read.
        disabled && status === 'playing' && 'opacity-90',
        finishTone === 'win' && 'animate-board-settle shadow-[0_0_36px_-6px_rgb(255_255_255/0.35)]',
        finishTone === 'draw' && 'animate-board-settle',
        finishTone === 'loss' && 'animate-shake',
      )}
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
          aria-busy={disabled && status === 'playing'}
          onKeyDown={handleKeyDown}
          className="grid h-full w-full"
          style={{
            // Rows are real elements, because `role="grid"` is only valid with
            // `role="row"` between it and the cells. Each row is its own grid of
            // columns, which keeps the layout to plain `1fr` tracks: with auto
            // sizing the row holding a mark grows to the mark and steals height
            // from the others.
            gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
          }}
        >
          {ROWS[size].map((row) => (
            <div
              key={row}
              role="row"
              className="grid"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {ROWS[size].map((col) => {
                const index = row * size + col;
                const cell = board[index] ?? Empty;

                return (
                  <BoardCell
                    key={index}
                    index={index}
                    row={row}
                    col={col}
                    size={size}
                    cell={cell}
                    currentPlayer={game.currentPlayer}
                    playable={cell === Empty && status === 'playing' && !disabled}
                    tabStop={index === focusIndex}
                    winOrder={winOrder.get(index)}
                    onFocus={() => setFocusIndex(index)}
                    onPlay={onPlay}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {winLine ? <WinLine line={winLine} size={size} winner={game.winner ?? X} /> : null}
      </div>
    </div>
  );
}

interface BoardCellProps {
  index: number;
  row: number;
  col: number;
  size: BoardSize;
  cell: Cell;
  currentPlayer: GameState['currentPlayer'];
  playable: boolean;
  tabStop: boolean;
  winOrder: number | undefined;
  onFocus: () => void;
  onPlay: (index: number) => void;
}

/**
 * One square.
 *
 * Cells are never `disabled`, only `aria-disabled`. A disabled button cannot
 * take focus, and with a roving tabindex that means a board whose anchor cell
 * has been played has no tab stop at all - the grid becomes unreachable by
 * keyboard the moment somebody plays there. Marking them instead keeps every
 * square focusable and readable while the click is still refused.
 */
function BoardCell({
  index,
  row,
  col,
  size,
  cell,
  currentPlayer,
  playable,
  tabStop,
  winOrder,
  onFocus,
  onPlay,
}: BoardCellProps) {
  return (
    <button
      type="button"
      data-cell={index}
      role="gridcell"
      tabIndex={tabStop ? 0 : -1}
      aria-disabled={!playable}
      onFocus={onFocus}
      onClick={() => {
        if (playable) onPlay(index);
      }}
      aria-label={describeCell(row, col, cell)}
      className={cx(
        'group relative flex items-center justify-center',
        // Dashed rules between cells only - the outer edge is the frame, so the
        // first row and last column stay clean.
        'border-t border-r border-dashed border-grid/85',
        row === 0 && 'border-t-0',
        col === size - 1 && 'border-r-0',
        // An empty cell warms under the pointer and presses in when tapped, so
        // a miss still reads as a registered touch.
        playable
          ? 'cursor-pointer transition-colors duration-150 hover:bg-b8/12 active:bg-b8/25'
          : 'cursor-default',
      )}
    >
      {cell !== Empty ? (
        <>
          {/* The ring that expands out from under a piece as it lands. It only
              ever plays once, on mount. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-[14%] animate-stamp rounded-full"
            style={{
              boxShadow: `0 0 0 2px ${cell === X ? 'var(--color-p3)' : 'var(--color-y3)'}`,
            }}
          />
          <span
            className={cx(
              'relative flex w-[68%] items-center justify-center',
              // The throb lives on the wrapper, the entrance on the mark
              // itself: two animations, two `transform`s, no fight over which
              // one owns the element.
              winOrder !== undefined && 'animate-win-throb',
            )}
            style={winOrder !== undefined ? { animationDelay: `${winOrder * 0.11}s` } : undefined}
          >
            <Mark
              player={cell}
              hole="var(--color-surface)"
              className={cx('w-full', cell === X ? 'animate-mark-x' : 'animate-mark-o')}
            />
          </span>
        </>
      ) : null}

      {/* Faint hint of the mark that would land here. */}
      {playable ? (
        <Mark
          player={currentPlayer}
          hole="var(--color-surface)"
          className={cx(
            'pointer-events-none absolute w-[68%] scale-75 opacity-0',
            'transition-[opacity,transform] duration-200 ease-spring',
            'group-hover:scale-100 group-hover:opacity-25',
            'group-focus-visible:scale-100 group-focus-visible:opacity-25',
          )}
        />
      ) : null}
    </button>
  );
}

function describeCell(row: number, col: number, cell: number): string {
  const position = `row ${row + 1}, column ${col + 1}`;
  if (cell === X) return `${position}, X`;
  if (cell === O) return `${position}, O`;
  return `${position}, empty`;
}
