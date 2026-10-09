import {
  type Cell,
  colOf,
  Empty,
  type GameState,
  gravityLanding,
  legalMoves,
  O,
  type Player,
  rowOf,
  ultimateBoardOf,
  ultimateCells,
  vanishedBy,
  vanishingNext,
  X,
} from '@/game/engine';
import {
  type CSSProperties,
  type KeyboardEvent,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { haptics, sfx } from '@/lib/sound';
import { UltimateOverlay } from './UltimateOverlay';
import { WinLine } from './WinLine';

/** How the game ended, from the point of view of the person at this device. */
export type FinishTone = 'win' | 'loss' | 'draw';

export interface BoardHint {
  index: number;
  /** `best` is a suggested move rather than a forced one. */
  kind: 'win' | 'threat' | 'best';
}

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
  hints?: readonly BoardHint[];
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
 * Small boards retain each piece's entrance. Above this limit only the latest
 * move animates, keeping large positions quiet and limiting active effects.
 */
const ANIMATION_CELL_LIMIT = 100;

/** Seconds a gravity mark takes to fall `rows` squares. Grows like real falling: with the root. */
function dropTime(rows: number): number {
  return 0.22 + Math.sqrt(rows) * 0.13;
}

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
  const gravity = config.variant === 'gravity';
  const radii = radiiFor(size);
  const gridRef = useRef<HTMLDivElement>(null);
  const [enlarged, setEnlarged] = useState(false);
  const canEnlarge = size > 9;
  const zoomed = canEnlarge && enlarged;
  useEffect(() => {
    if (!zoomed || game.lastMove === null) return;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-cell="${game.lastMove}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [zoomed, game.lastMove]);

  // Roving tabindex: the grid is one tab stop and the arrow keys move within
  // it, so a 15x15 board does not put 225 stops in the page's tab order.
  const [focusIndex, setFocusIndex] = useState(0);
  // The board changes size without this component remounting, so the anchor can
  // be left pointing past the end of a smaller board - which would leave the
  // grid with no tab stop at all. Falling back to the first cell keeps it
  // reachable without discarding the anchor when the size comes back.
  const focus = focusIndex < board.length ? focusIndex : 0;

  // Under gravity the pointer picks a column, not a square, so the whole column
  // lights and the square the mark would land on previews it.
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  const interactive = !readOnly && !disabled && status === 'playing';

  /**
   * The moves the rules actually allow right now.
   *
   * On most variants this is "every empty cell", but Ultimate confines the
   * mover to one sub-board and gravity to one square per column, and a board
   * that lets you click a square the rules will refuse is worse than one that
   * looks slightly busier.
   */
  const playable = useMemo(() => {
    if (status !== 'playing') return new Set<number>();
    return new Set(legalMoves(game));
  }, [game, status]);

  // Where each column's next mark lands, for gravity's tap-a-column input.
  const landing = useMemo(
    () =>
      gravity && status === 'playing'
        ? Array.from({ length: size }, (_, col) => gravityLanding(board, size, col))
        : null,
    [gravity, status, board, size],
  );

  // Position in the winning run, so the run can light up cell by cell along
  // its own direction rather than all at once.
  const winOrder = useMemo(
    () => new Map((winLine ?? []).map((cell, order) => [cell, order])),
    [winLine],
  );

  // The wave that crosses the board from a win: each square's delay is its
  // distance from the middle of the line (or of the three winning boards).
  const ripple = useMemo(() => rippleDelays(game), [game]);

  const hintFor = useMemo(() => {
    const map = new Map<number, BoardHint['kind']>();
    for (const hint of hints ?? []) map.set(hint.index, hint.kind);
    return map;
  }, [hints]);

  const fading = useMemo(() => vanishingNext(game), [game]);
  const lifted = useMemo(() => vanishedBy(game), [game]);

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

  const winner = game.winner ?? X;
  const glow = winner === X ? 'var(--color-glow-x)' : 'var(--color-glow-o)';

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
        finishTone === 'draw' && 'animate-board-draw',
        finishTone === 'loss' && 'animate-shake',
      )}
      style={{ borderRadius: radii.frame }}
    >
      {canEnlarge ? (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-muted">
          <span>
            {zoomed
              ? 'Scroll to explore the board'
              : `${size} × ${size} · ${config.winLength} in a row`}
          </span>
          <button
            type="button"
            aria-pressed={zoomed}
            onClick={() => setEnlarged((value) => !value)}
            className="min-h-8 shrink-0 rounded-lg border border-stroke px-2 text-ink hover:bg-stroke-soft"
          >
            {zoomed ? 'Fit board' : 'Enlarge board'}
          </button>
        </div>
      ) : null}
      <div
        className="w-full overflow-auto overscroll-contain"
        style={{ borderRadius: radii.inner, maxHeight: zoomed ? 'min(60dvh, 26rem)' : undefined }}
        role={canEnlarge ? 'region' : undefined}
        aria-label={canEnlarge ? 'Scrollable game board' : undefined}
      >
        <div
          className="relative aspect-square w-full overflow-hidden bg-surface transition-[border-radius] duration-500 ease-soft"
          style={{ borderRadius: radii.inner, minWidth: zoomed ? `${size * 36}px` : undefined }}
          onPointerLeave={gravity ? () => setHoverCol(null) : undefined}
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
                  const drop = landing ? (landing[col] ?? -1) : -1;
                  // Under gravity every square of a column plays the column; the
                  // mark goes wherever it lands.
                  const target = gravity ? (drop >= 0 ? drop : null) : index;
                  const canPlay = interactive && target !== null && playable.has(target);
                  return (
                    <BoardCell
                      key={index}
                      index={index}
                      row={row}
                      col={col}
                      size={size}
                      cell={board[index] ?? Empty}
                      currentPlayer={game.currentPlayer}
                      target={canPlay ? target : null}
                      interactive={interactive}
                      isLastMove={game.lastMove === index}
                      tabStop={index === focus}
                      winOrder={winOrder.get(index)}
                      hint={hintFor.get(index)}
                      animate={animate || game.lastMove === index}
                      gravity={gravity}
                      columnLit={gravity && interactive && hoverCol === col && drop >= 0}
                      preview={gravity ? interactive && hoverCol === col && drop === index : true}
                      fade={
                        fading.mover === index
                          ? 'mover'
                          : fading.waiting === index
                            ? 'waiting'
                            : null
                      }
                      ghost={lifted === index ? ghostOf(game) : null}
                      ghostKey={lifted === index ? game.moves.length : 0}
                      ripple={ripple?.get(index)}
                      rippleColour={glow}
                      label={`${describeCell(game, index, drop)}${
                        hintFor.has(index)
                          ? hintFor.get(index) === 'win'
                            ? ', winning move'
                            : hintFor.get(index) === 'threat'
                              ? ', block opponent’s winning move'
                              : ', suggested move'
                          : ''
                      }`}
                      onFocus={setFocusIndex}
                      onHover={gravity ? setHoverCol : undefined}
                      onPlay={onPlay}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {status === 'won' ? (
            <span
              aria-hidden="true"
              className="victory-burst pointer-events-none absolute inset-0"
              style={{ '--burst-color': glow } as CSSProperties}
            />
          ) : null}
          {game.ultimate ? <UltimateOverlay game={game} /> : null}
          {winLine ? (
            <WinLine
              line={winLine}
              size={size}
              winner={winner}
              delay={gravity ? dropTime(Math.floor((game.lastMove ?? 0) / size) + 1) * 0.66 : 0}
            />
          ) : null}
          {game.ultimate?.winBoards ? (
            <WinLine line={game.ultimate.winBoards} size={3} winner={winner} delay={0.15} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The mark that just left a vanish board: the one the last mover owned. */
function ghostOf(game: GameState): Player | null {
  const mover = game.lastMove === null ? Empty : game.board[game.lastMove];
  return mover === X || mover === O ? mover : null;
}

/**
 * Milliseconds each square waits before the win ripple reaches it.
 *
 * Measured from the middle of the winning line - or, on Ultimate, the middle of
 * the winning boards - in squares, so the wave spreads out from the win itself
 * rather than sweeping across the board in reading order.
 */
function rippleDelays(game: GameState): Map<number, number> | null {
  if (game.status !== 'won') return null;
  const { size } = game.config;

  let centre: { row: number; col: number } | null = null;
  if (game.winLine && game.winLine.length > 0) {
    const first = game.winLine[0]!;
    const last = game.winLine.at(-1)!;
    centre = {
      row: (rowOf(size, first) + rowOf(size, last)) / 2,
      col: (colOf(size, first) + colOf(size, last)) / 2,
    };
  } else if (game.ultimate?.winBoards) {
    const middle = game.ultimate.winBoards[1]!;
    centre = { row: Math.floor(middle / 3) * 3 + 1, col: (middle % 3) * 3 + 1 };
  }
  if (!centre) return null;

  // Big boards ripple faster per square, so the wave takes the same time to
  // cross a 15x15 board as a 3x3 one takes to cross it.
  const step = Math.max(18, 110 / size);
  const delays = new Map<number, number>();
  for (let index = 0; index < game.board.length; index++) {
    const distance = Math.hypot(rowOf(size, index) - centre.row, colOf(size, index) - centre.col);
    delays.set(index, 380 + distance * step);
  }
  return delays;
}

interface BoardCellProps {
  index: number;
  row: number;
  col: number;
  size: number;
  cell: Cell;
  currentPlayer: GameState['currentPlayer'];
  /** The square a tap here plays, or `null` when a tap here plays nothing. */
  target: number | null;
  /** The board as a whole is taking input, whether or not this square is. */
  interactive: boolean;
  isLastMove: boolean;
  tabStop: boolean;
  winOrder: number | undefined;
  hint: BoardHint['kind'] | undefined;
  animate: boolean;
  gravity: boolean;
  /** Gravity: this square's column is under the pointer. */
  columnLit: boolean;
  /** Whether this square shows the hover preview of the mark to come. */
  preview: boolean;
  /** Vanish: this mark leaves on its owner's next move. */
  fade: 'mover' | 'waiting' | null;
  /** Vanish: the mark that just left this square, to see it off. */
  ghost: Player | null;
  ghostKey: number;
  /** Milliseconds until the win ripple reaches this square. */
  ripple: number | undefined;
  rippleColour: string;
  label: string;
  onFocus: (index: number) => void;
  onHover: ((col: number | null) => void) | undefined;
  onPlay: (index: number) => void;
}

/** Directions the sparks fly off a landing mark: eight, evenly, slightly turned. */
const SPARKS = Array.from({ length: 8 }, (_, spark) => {
  const angle = (spark / 8) * Math.PI * 2 + 0.3;
  const reach = spark % 2 === 0 ? 62 : 46;
  return {
    dx: Math.cos(angle) * reach,
    dy: Math.sin(angle) * reach,
    big: spark % 2 === 0,
  };
});

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
 *
 * The mark's wrappers are always rendered, whatever state the square is in,
 * and only their classes change. Swapping the element tree when a square stops
 * being the last move would remount the mark and replay its entrance.
 */
const BoardCell = memo(function BoardCell({
  index,
  row,
  col,
  size,
  cell,
  currentPlayer,
  target,
  interactive,
  isLastMove,
  tabStop,
  winOrder,
  hint,
  animate,
  gravity,
  columnLit,
  preview,
  fade,
  ghost,
  ghostKey,
  ripple,
  rippleColour,
  label,
  onFocus,
  onHover,
  onPlay,
}: BoardCellProps) {
  const [rejected, setRejected] = useState(false);
  const big = size > 9;
  const playable = target !== null;
  const soft = cell === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)';
  const falling = gravity && isLastMove && animate;
  const fall = row + 1;
  const landedAt = falling ? dropTime(fall) * 0.66 : 0;

  return (
    <button
      type="button"
      data-cell={index}
      role="gridcell"
      tabIndex={tabStop ? 0 : -1}
      aria-disabled={!playable}
      onFocus={(event) => {
        onFocus(index);
        // Keyboard focus previews the column; the focus a tap brings with it
        // does not, or a phone would be left with a ghost mark where it tapped.
        if (isKeyboardFocus(event.currentTarget)) onHover?.(col);
      }}
      onPointerEnter={
        onHover
          ? (event) => {
              if (event.pointerType !== 'touch') onHover(col);
            }
          : undefined
      }
      onClick={() => {
        if (target !== null) onPlay(target);
        else if (interactive) {
          // Refused, but heard: a tap that does nothing silently reads as a
          // tap the game missed.
          setRejected(true);
          sfx.invalid();
          haptics.buzz([10, 30, 10]);
        }
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setRejected(false);
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
        columnLit && 'bg-b8/10',
        ripple !== undefined && 'animate-ripple',
        rejected && 'animate-cell-reject',
      )}
      style={
        ripple !== undefined
          ? ({ animationDelay: `${ripple}ms`, '--ripple': rippleColour } as CSSProperties)
          : undefined
      }
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
              style={{ boxShadow: `0 0 0 2px ${soft}`, animationDelay: `${landedAt}s` }}
            />
          ) : null}

          {isLastMove && animate ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 animate-cell-impact"
              style={{ '--impact': soft, animationDelay: `${landedAt}s` } as CSSProperties}
            />
          ) : null}

          {/* Falls into place under gravity. A full square tall, so the drop
              keyframes can move it in whole squares. */}
          <span
            className={cx(
              'absolute inset-0 flex origin-bottom items-center justify-center',
              falling && 'animate-drop',
            )}
            style={
              falling
                ? ({ '--fall': fall, '--drop-time': `${dropTime(fall)}s` } as CSSProperties)
                : undefined
            }
          >
            <span
              className={cx(
                'relative flex w-[68%] items-center justify-center transition-opacity duration-300',
                // The throb lives on the wrapper, the entrance on the mark
                // itself: two animations, two `transform`s, no fight over which
                // one owns the element.
                winOrder !== undefined && 'animate-win-throb',
                fade === 'mover' && 'animate-fading',
                fade === 'waiting' && 'opacity-70',
              )}
              style={winOrder !== undefined ? { animationDelay: `${winOrder * 0.11}s` } : undefined}
            >
              {animate && !gravity ? (
                <svg
                  viewBox="0 0 100 100"
                  aria-hidden="true"
                  className="piece-trace pointer-events-none absolute inset-0 h-full w-full"
                  fill="none"
                  stroke={soft}
                  strokeWidth="5"
                  strokeLinecap="round"
                >
                  {cell === X ? (
                    <>
                      <path pathLength="1" d="M18 18 82 82" />
                      <path pathLength="1" d="M82 18 18 82" style={{ animationDelay: '65ms' }} />
                    </>
                  ) : (
                    <circle pathLength="1" cx="50" cy="50" r="40" />
                  )}
                </svg>
              ) : null}
              <Mark
                player={cell}
                hole="var(--color-surface)"
                className={cx(
                  'w-full origin-center',
                  animate && !gravity && (cell === X ? 'animate-mark-x' : 'animate-mark-o'),
                )}
              />
            </span>
          </span>

          {/* The mark that leaves next on a vanish board is ringed in a broken
              line - it is still in play, but not for long. */}
          {fade === 'mover' ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[9%] animate-fade-in rounded-full border-2 border-dashed"
              style={{ borderColor: soft }}
            />
          ) : null}

          {/* Sparks thrown off the mark that just landed. */}
          {isLastMove && animate ? (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0">
              {SPARKS.map((spark, at) => (
                <span
                  key={at}
                  className={cx(
                    'absolute top-1/2 left-1/2 -mt-0.5 -ml-0.5 animate-spark rounded-full',
                    spark.big ? 'size-1.5' : 'size-1',
                  )}
                  style={
                    {
                      '--dx': `${(spark.dx * 2.5) / size}px`,
                      '--dy': `${(spark.dy * 2.5) / size}px`,
                      background: soft,
                      animationDelay: `${landedAt + 0.04}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          ) : null}

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
              style={falling ? { animation: `fade-in 0.2s ${landedAt}s both` } : undefined}
            />
          ) : null}
        </>
      ) : null}

      {/* A vanish mark leaving: it dissolves where it stood. Keyed on the move
          count so it plays for each mark that leaves, not just the first. */}
      {ghost !== null && cell === Empty ? (
        <span
          key={ghostKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="flex w-[68%] animate-vanish-out">
            <Mark player={ghost} hole="var(--color-surface)" className="w-full" />
          </span>
        </span>
      ) : null}

      {/* Practice hints: where the game is won, where it must be saved, and
          - when asked - the move the engine would play. */}
      {hint && cell === Empty ? (
        <span
          aria-hidden="true"
          className={cx(
            'pointer-events-none absolute inset-[18%] flex items-center justify-center border-2 animate-pulse-soft',
            hint === 'win' && 'rounded-full border-ok',
            hint === 'threat' && 'rounded-sm border-warn text-warn',
            hint === 'best' && 'rounded-full border-dashed border-ink',
          )}
        >
          {hint === 'threat' ? <span className="text-xs font-bold">!</span> : null}
        </span>
      ) : null}

      {/* Faint hint of the mark that would land here. Suppressed on a big
          board, where 225 hover previews is a lot of DOM for one pointer.
          Under gravity it shows only on the square the column would fill. */}
      {playable && !big && preview && cell === Empty ? (
        <Mark
          player={currentPlayer}
          hole="var(--color-surface)"
          className={cx(
            'pointer-events-none absolute w-[68%]',
            'transition-[opacity,transform] duration-200 ease-spring',
            gravity
              ? 'scale-100 opacity-30'
              : cx(
                  'scale-75 opacity-0',
                  'group-hover:scale-100 group-hover:opacity-25',
                  'group-focus-visible:scale-100 group-focus-visible:opacity-25',
                ),
          )}
        />
      ) : null}
    </button>
  );
});

function boardLabel(game: GameState): string {
  const { size, variant, winLength } = game.config;
  if (variant === 'gravity') {
    return `${size} by ${size} gravity board, ${winLength} in a row to win. Choose a column; your mark drops to its lowest empty square`;
  }
  if (variant === 'vanish') {
    return `Vanish board, three in a row to win. Each player keeps only their three newest marks`;
  }
  if (variant !== 'ultimate') {
    return `${size} by ${size} board, ${winLength} in a row to win`;
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
 * Position, contents, and whatever the variant adds: on an Ultimate board which
 * small board it belongs to and whether that board has been won, because
 * without it the grid is eighty-one indistinguishable squares; under gravity
 * where a mark played in its column would land; under vanish which mark is the
 * next to go.
 */
function describeCell(game: GameState, index: number, landing: number): string {
  const { size } = game.config;
  const cell = game.board[index] ?? Empty;
  const position = `row ${rowOf(size, index) + 1}, column ${colOf(size, index) + 1}`;
  const contents = cell === X ? 'X' : cell === O ? 'O' : 'empty';

  if (game.config.variant === 'gravity') {
    if (cell !== Empty || game.status !== 'playing') return `${position}, ${contents}`;
    return landing >= 0
      ? `${position}, empty, plays column ${colOf(size, index) + 1} at row ${rowOf(size, landing) + 1}`
      : `${position}, empty, column full`;
  }

  if (game.config.variant === 'vanish') {
    const next = vanishingNext(game);
    const leaving = next.mover === index || next.waiting === index ? ', vanishes next' : '';
    return `${position}, ${contents}${leaving}`;
  }

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

/** Whether an element's focus came from the keyboard rather than a tap or click. */
function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    // An engine that cannot answer - an old webview, a test DOM - errs towards
    // showing the preview, which is harmless.
    return true;
  }
}
