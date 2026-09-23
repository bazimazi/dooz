import {
  type Cell,
  colOf,
  Empty,
  type GameState,
  legalMoves,
  O,
  rowOf,
  ultimateBoardOf,
  ultimateCells,
  X,
} from '@dooz/engine';
import { type KeyboardEvent, memo, useMemo, useRef, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { UltimateOverlay } from './UltimateOverlay';
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
  /** Mark the squares that win or must be blocked this move. Practice only. */
  hints?: readonly { index: number; kind: 'win' | 'threat' }[];
  /** Read-only: a replay, or a game being watched. */
  readOnly?: boolean;
}

/**
 * Corner radii by board size.
 *
 * A 15x15 grid inside the same rounding a 3x3 uses would clip its corner cells,
 * so the rounding tightens as the cells shrink. Interpolated rather than
 * tabulated now that any size between 3 and 15 is playable.
 */
function radiiFor(size: number): { frame: string; inner: string } {
  if (size <= 3) return { frame: '2rem', inner: '1.75rem' };
  if (size <= 6) return { frame: '1.5rem', inner: '1.125rem' };
  if (size <= 9) return { frame: '1.25rem', inner: '0.75rem' };
  return { frame: '1rem', inner: '0.5rem' };
}

/**
 * Below this many cells a board gets the full landing animation per mark; above
 * it, marks appear without one. A 15x15 board can take 60 marks in a game and
 * animating every one of them on a mid-range phone drops frames exactly when
 * the player is trying to read the position.
 */
const ANIMATION_CELL_LIMIT = 100;

export function Board({
  game,
  onPlay,
  disabled = false,
  finishTone = null,
  hints,
  readOnly = false,
}: BoardProps) {
  const { board, winLine, status, config } = game;
  const { size } = config;
  const radii = radiiFor(size);
  const gridRef = useRef<HTMLDivElement>(null);

  // Roving tabindex: the grid is one tab stop and the arrow keys move within
  // it, so a 15x15 board does not put 225 stops in the page's tab order.
  const [focusIndex, setFocusIndex] = useState(0);
  // The board changes size without this component remounting, so the anchor can
  // be left pointing past the end of a smaller board - which would leave the
  // grid with no tab stop at all. Falling back to the first cell keeps it
  // reachable without discarding the anchor when the size comes back.
  const focus = focusIndex < board.length ? focusIndex : 0;

  const interactive = !readOnly && !disabled && status === 'playing';

  /**
   * The moves the rules actually allow right now.
   *
   * On the line variants this is "every empty cell", but Ultimate confines the
   * mover to one sub-board, and a board that lets you click a square the rules
   * will refuse is worse than one that looks slightly busier.
   */
  const playable = useMemo(() => {
    if (status !== 'playing') return new Set<number>();
    return new Set(legalMoves(game));
  }, [game, status]);

  // Position in the winning run, so the run can light up cell by cell along
  // its own direction rather than all at once.
  const winOrder = useMemo(
    () => new Map((winLine ?? []).map((cell, order) => [cell, order])),
    [winLine],
  );

  const hintFor = useMemo(() => {
    const map = new Map<number, 'win' | 'threat'>();
    for (const hint of hints ?? []) map.set(hint.index, hint.kind);
    return map;
  }, [hints]);

  const animate = board.length <= ANIMATION_CELL_LIMIT;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: size,
      ArrowUp: -size,
    };

    // Home and End jump to the ends of the row, which on a 15-wide board saves
    // fourteen key presses and is what every other grid widget does.
    let next: number | null = null;
    const row = Math.floor(focus / size);

    if (event.key === 'Home') next = row * size;
    else if (event.key === 'End') next = row * size + size - 1;
    else {
      const delta = deltas[event.key];
      if (delta === undefined) return;
      const candidate = focus + delta;
      if (candidate < 0 || candidate >= board.length) return;
      // Left and right must not jump between rows.
      if (Math.abs(delta) === 1 && Math.floor(candidate / size) !== row) return;
      next = candidate;
    }

    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
  }

  return (
    <div
      className={cx(
        'glass-edge relative w-full max-w-board p-3 backdrop-blur-[3px]',
        // The radius is part of the transition because it changes with the
        // board size, which happens in place: the frame eases to the new
        // rounding instead of snapping to it.
        'transition-[box-shadow,opacity,border-radius] duration-500 ease-soft',
        // Waiting on the bot or the opponent: the board steps back rather than
        // going grey, so it is clear input is not wanted without the position
        // becoming harder to read.
        disabled && status === 'playing' && 'opacity-90',
        finishTone === 'win' && 'animate-board-settle shadow-[0_0_36px_-6px_var(--color-glow-win)]',
        finishTone === 'draw' && 'animate-board-settle',
        finishTone === 'loss' && 'animate-shake',
      )}
      style={{ borderRadius: radii.frame }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden bg-surface transition-[border-radius] duration-500 ease-soft"
        style={{ borderRadius: radii.inner }}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-label={boardLabel(game)}
          aria-busy={disabled && status === 'playing'}
          aria-readonly={readOnly || undefined}
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
          {Array.from({ length: size }, (_row, row) => (
            <div
              key={row}
              role="row"
              className="grid"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: size }, (_col, col) => {
                const index = row * size + col;
                return (
                  <BoardCell
                    key={index}
                    index={index}
                    row={row}
                    col={col}
                    size={size}
                    cell={board[index] ?? Empty}
                    currentPlayer={game.currentPlayer}
                    playable={interactive && playable.has(index)}
                    isLastMove={game.lastMove === index}
                    tabStop={index === focus}
                    winOrder={winOrder.get(index)}
                    hint={hintFor.get(index)}
                    animate={animate}
                    label={describeCell(game, index)}
                    onFocus={setFocusIndex}
                    onPlay={onPlay}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {game.ultimate ? <UltimateOverlay game={game} /> : null}
        {winLine ? <WinLine line={winLine} size={size} winner={game.winner ?? X} /> : null}
      </div>
    </div>
  );
}

interface BoardCellProps {
  index: number;
  row: number;
  col: number;
  size: number;
  cell: Cell;
  currentPlayer: GameState['currentPlayer'];
  playable: boolean;
  isLastMove: boolean;
  tabStop: boolean;
  winOrder: number | undefined;
  hint: 'win' | 'threat' | undefined;
  animate: boolean;
  label: string;
  onFocus: (index: number) => void;
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
 *
 * Memoised because a 15x15 board is 225 of these and a move changes one: React
 * would otherwise re-render every cell on every mark.
 */
const BoardCell = memo(function BoardCell({
  index,
  row,
  col,
  size,
  cell,
  currentPlayer,
  playable,
  isLastMove,
  tabStop,
  winOrder,
  hint,
  animate,
  label,
  onFocus,
  onPlay,
}: BoardCellProps) {
  const big = size > 9;

  return (
    <button
      type="button"
      data-cell={index}
      role="gridcell"
      tabIndex={tabStop ? 0 : -1}
      aria-disabled={!playable}
      onFocus={() => onFocus(index)}
      onClick={() => {
        if (playable) onPlay(index);
      }}
      aria-label={label}
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
              ever plays once, on mount, and not at all on a board big enough
              for the cost to show. */}
          {animate ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[14%] animate-stamp rounded-full"
              style={{
                boxShadow: `0 0 0 2px ${cell === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)'}`,
              }}
            />
          ) : null}
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
              className={cx(
                'w-full',
                animate && (cell === X ? 'animate-mark-x' : 'animate-mark-o'),
              )}
            />
          </span>

          {/* The last move played, ringed so a glance finds it. On a large
              board this is the difference between reading a position and
              hunting for what just changed. */}
          {isLastMove ? (
            <span
              aria-hidden="true"
              className={cx(
                'pointer-events-none absolute rounded-full ring-2 ring-g10/70',
                big ? 'inset-[6%]' : 'inset-[10%]',
              )}
            />
          ) : null}
        </>
      ) : null}

      {/* Practice hints: where the game is won, and where it must be saved. */}
      {hint && cell === Empty ? (
        <span
          aria-hidden="true"
          className={cx(
            'pointer-events-none absolute inset-[18%] rounded-full border-2 animate-pulse-soft',
            hint === 'win' ? 'border-ok' : 'border-warn',
          )}
        />
      ) : null}

      {/* Faint hint of the mark that would land here. Suppressed on a big
          board, where 225 hover previews is a lot of DOM for one pointer. */}
      {playable && !big ? (
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
});

function boardLabel(game: GameState): string {
  const { size, variant } = game.config;
  if (variant !== 'ultimate') {
    return `${size} by ${size} board, ${game.config.winLength} in a row to win`;
  }

  const active = game.ultimate?.activeBoard;
  const where =
    active === null || active === undefined
      ? 'you may play in any unfinished small board'
      : `you must play in small board ${active + 1}`;
  return `Ultimate board, nine small boards. ${where}`;
}

/**
 * What a screen reader says about a square.
 *
 * Position, contents, and - on an Ultimate board - which small board it belongs
 * to and whether that board has been won, because without it the grid is
 * eighty-one indistinguishable squares.
 */
function describeCell(game: GameState, index: number): string {
  const { size } = game.config;
  const cell = game.board[index] ?? Empty;
  const position = `row ${rowOf(size, index) + 1}, column ${colOf(size, index) + 1}`;
  const contents = cell === X ? 'X' : cell === O ? 'O' : 'empty';

  if (!game.ultimate) return `${position}, ${contents}`;

  const board = ultimateBoardOf(index);
  const owner = game.ultimate.boards[board] ?? Empty;
  const won =
    owner === X
      ? ', board won by X'
      : owner === O
        ? ', board won by O'
        : game.ultimate.drawn[board]
          ? ', board drawn'
          : '';
  return `${position}, small board ${board + 1}${won}, ${contents}`;
}

/** The cells of a sub-board, for callers that need to highlight one. */
export { ultimateCells };
