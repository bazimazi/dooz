import {
  Empty,
  type GameState,
  isMark,
  legalMoves,
  type Player,
  QUBIC_EDGE,
  qubicCoords,
  qubicIndex,
  X,
} from '@/game/engine';
import {
  type CSSProperties,
  type KeyboardEvent,
  memo,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { useGraphics } from '@/lib/graphics';
import { haptics, sfx } from '@/lib/sound';
import { formatNumber, type Translator, useLocale, useT } from '@/i18n';
import { gameBoardMessages } from '@/i18n/messages/gameBoard';
import type { BoardHint, BoardProps } from './Board';

/**
 * The Qubic cube, drawn as four stacked layers.
 *
 * On Balanced and High the layers are tilted planes in an isometric view the
 * player can turn: drag to spin and tilt it (High), or use the buttons (both).
 * It is projected by hand into one SVG rather than built from CSS 3D
 * transforms, so the painting order, the hit areas and the winning line - a
 * straight segment through the cube, across layers - are all exact at every
 * angle. On Low, and whenever the player asks for it, the same cube is shown
 * flat: the four layers side by side, which is also how it is stored.
 *
 * Either way the cells are one `role="grid"`: each layer a row group of four
 * rows, a single tab stop with a roving tabindex. The arrow keys move within a
 * layer; Page Up and Page Down move between layers.
 */

const LAYERS = [0, 1, 2, 3] as const;
const LINES = [0, 1, 2, 3] as const;

/** Distance between layers, in cells. Enough that the tilted planes barely overlap. */
const LAYER_GAP = 2.4;
const DEFAULT_VIEW: View = { spin: -24, tilt: 30 };
const TILT_RANGE = [12, 70] as const;
/** Degrees per button press. */
const SPIN_STEP = 30;
const TILT_STEP = 10;

interface View {
  /** Rotation about the cube's vertical axis, degrees. */
  readonly spin: number;
  /** Elevation of the viewer above the layers' plane, degrees. */
  readonly tilt: number;
}

interface Projection {
  /** SVG transform taking a layer's plane coordinates to the screen. */
  readonly matrix: (layer: number) => string;
  /** A point on a layer's plane, on screen. */
  readonly point: (layer: number, x: number, y: number) => { x: number; y: number };
}

/**
 * Orthographic projection for `view`.
 *
 * Plane coordinates put the layer's centre at the origin, one unit per cell.
 * The layer is turned by `spin` about the vertical, foreshortened by the
 * elevation, and lifted by its height - layer 0 at the top.
 */
function projectionFor(view: View): Projection {
  const spin = (view.spin * Math.PI) / 180;
  const tilt = (view.tilt * Math.PI) / 180;
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);
  const lean = Math.sin(tilt);
  const rise = Math.cos(tilt);
  const lift = (layer: number) => -((QUBIC_EDGE - 1) / 2 - layer) * LAYER_GAP * rise;
  return {
    matrix: (layer) => `matrix(${cos} ${lean * sin} ${-sin} ${lean * cos} 0 ${lift(layer)})`,
    point: (layer, x, y) => ({
      x: cos * x - sin * y,
      y: lean * (sin * x + cos * y) + lift(layer),
    }),
  };
}

/** Plane coordinates of a cell's centre. */
function centreOf(row: number, col: number): { x: number; y: number } {
  return { x: col - (QUBIC_EDGE - 1) / 2, y: row - (QUBIC_EDGE - 1) / 2 };
}

export const QubicBoard = memo(function QubicBoard({
  game,
  onPlay,
  disabled = false,
  finishTone = null,
  hints,
  readOnly = false,
}: BoardProps) {
  const graphics = useGraphics();
  const t = useT(gameBoardMessages);
  const [flatChoice, setFlatChoice] = useState(false);
  const flat = graphics === 'low' || flatChoice;
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [focusIndex, setFocusIndex] = useState(0);
  const focus = focusIndex < game.board.length ? focusIndex : 0;
  const [focused, setFocused] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const { status } = game;
  const interactive = !readOnly && !disabled && status === 'playing';

  const playable = useMemo(
    () => (status === 'playing' ? new Set(legalMoves(game)) : new Set<number>()),
    [game, status],
  );
  const winning = useMemo(() => new Set(game.winLine ?? []), [game.winLine]);
  const hintFor = useMemo(() => {
    const map = new Map<number, BoardHint['kind']>();
    for (const hint of hints ?? []) map.set(hint.index, hint.kind);
    return map;
  }, [hints]);

  function press(index: number) {
    if (interactive && playable.has(index)) {
      onPlay(index);
    } else if (interactive) {
      sfx.invalid();
      haptics.buzz([10, 30, 10], 'warning');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const { layer, row, col } = qubicCoords(focus);
    const moves: Record<string, [number, number, number]> = {
      ArrowLeft: [layer, row, col - 1],
      ArrowRight: [layer, row, col + 1],
      ArrowUp: [layer, row - 1, col],
      ArrowDown: [layer, row + 1, col],
      PageUp: [layer - 1, row, col],
      PageDown: [layer + 1, row, col],
      Home: [layer, row, 0],
      End: [layer, row, QUBIC_EDGE - 1],
    };
    const target = moves[event.key];
    if (!target) return;
    if (target.some((value) => value < 0 || value >= QUBIC_EDGE)) return;
    event.preventDefault();
    const next = qubicIndex(...target);
    setFocusIndex(next);
    gridRef.current?.querySelector<HTMLElement | SVGElement>(`[data-cell="${next}"]`)?.focus();
  }

  const cells = useMemo(
    () =>
      game.board.map((cell, index) => ({
        index,
        cell,
        label: describeCell(game, index, hintFor.get(index), t),
      })),
    [game, hintFor, t],
  );

  return (
    <div
      className={cx(
        'glass-edge relative flex w-full max-w-board flex-col gap-2 p-3 backdrop-blur-[3px]',
        'transition-[box-shadow,opacity] duration-500 ease-soft',
        disabled && status === 'playing' && 'opacity-90',
        finishTone === 'win' && 'animate-board-settle shadow-[0_0_36px_-6px_var(--color-glow-win)]',
        finishTone === 'draw' && 'animate-board-draw',
        finishTone === 'loss' && 'animate-shake',
      )}
      style={{ borderRadius: '1.5rem' }}
      // The cube is a coordinate space: it never mirrors with the language.
      dir="ltr"
    >
      <div
        ref={gridRef}
        role="grid"
        aria-label={t('labelQubic')}
        aria-rowcount={QUBIC_EDGE * QUBIC_EDGE}
        aria-colcount={QUBIC_EDGE}
        aria-busy={disabled && status === 'playing'}
        aria-readonly={readOnly || undefined}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        {flat ? (
          <FlatCube
            game={game}
            cells={cells}
            focus={focus}
            playable={playable}
            interactive={interactive}
            winning={winning}
            hintFor={hintFor}
            animate={graphics !== 'low'}
            onFocus={setFocusIndex}
            onPress={press}
          />
        ) : (
          <IsometricCube
            game={game}
            cells={cells}
            view={view}
            onView={setView}
            draggable={graphics === 'high'}
            effects={graphics === 'high'}
            focus={focus}
            showFocus={focused}
            playable={playable}
            interactive={interactive}
            winning={winning}
            hintFor={hintFor}
            onFocus={setFocusIndex}
            onPress={press}
          />
        )}
      </div>

      {graphics !== 'low' ? (
        <ViewControls flat={flat} onFlat={setFlatChoice} view={view} onView={setView} />
      ) : null}
    </div>
  );
});

interface CubeCell {
  readonly index: number;
  readonly cell: GameState['board'][number];
  readonly label: string;
}

interface CubeViewProps {
  game: GameState;
  cells: readonly CubeCell[];
  focus: number;
  playable: ReadonlySet<number>;
  interactive: boolean;
  winning: ReadonlySet<number>;
  hintFor: ReadonlyMap<number, BoardHint['kind']>;
  onFocus: (index: number) => void;
  onPress: (index: number) => void;
}

/**
 * The tilted, turnable cube.
 *
 * Layers are painted bottom first so the nearer ones cover the farther, and
 * the winning line last of all, so it reads as passing through the cube.
 */
function IsometricCube({
  game,
  cells,
  view,
  onView,
  draggable,
  effects,
  focus,
  showFocus,
  playable,
  interactive,
  winning,
  hintFor,
  onFocus,
  onPress,
}: CubeViewProps & {
  view: View;
  onView: (view: View) => void;
  draggable: boolean;
  effects: boolean;
  showFocus: boolean;
}) {
  const t = useT(gameBoardMessages);
  const locale = useLocale();
  const projection = projectionFor(view);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean; id: number } | null>(
    null,
  );
  // A drag ends in a click on whatever cell it was released over; that click
  // was the end of a turn of the cube, not a move.
  const swallowClick = useRef(false);

  const box = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const layer of LAYERS) {
      for (const [x, y] of [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
      ] as const) {
        const point = projection.point(layer, x, y);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
    const pad = 0.7;
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }, [projection]);

  const line = game.winLine
    ? game.winLine.map((index) => {
        const { layer, row, col } = qubicCoords(index);
        const centre = centreOf(row, col);
        return projection.point(layer, centre.x, centre.y);
      })
    : null;
  const winner = game.winner ?? X;
  const winColour = winner === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)';

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!draggable || event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, view, moved: false, id: event.pointerId };
  }
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 6) return;
    if (!start.moved) {
      start.moved = true;
      // Only now: capturing on press would retarget the click a tap makes.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    onView({
      spin: start.view.spin + dx * 0.45,
      tilt: clamp(start.view.tilt - dy * 0.3, TILT_RANGE[0], TILT_RANGE[1]),
    });
  }
  function onPointerEnd(event: PointerEvent<SVGSVGElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    if (start.moved) {
      swallowClick.current = true;
      setTimeout(() => (swallowClick.current = false), 0);
    }
  }

  return (
    <svg
      viewBox={box}
      className={cx('block aspect-[5/6] w-full select-none', draggable && 'touch-none cursor-grab')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {/* The cube's four vertical edges, behind everything: they tie the
          floating layers together into one solid. */}
      <g
        aria-hidden="true"
        stroke="var(--color-grid)"
        strokeWidth={0.04}
        strokeDasharray="0.12 0.12"
      >
        {(
          [
            [-2, -2],
            [2, -2],
            [2, 2],
            [-2, 2],
          ] as const
        ).map(([x, y]) => {
          const top = projection.point(0, x, y);
          const bottom = projection.point(QUBIC_EDGE - 1, x, y);
          return <line key={`${x}${y}`} x1={top.x} y1={top.y} x2={bottom.x} y2={bottom.y} />;
        })}
      </g>

      {LAYERS.toReversed().map((layer) => (
        <g key={layer} role="rowgroup" aria-label={t('layer', { n: layer + 1 })}>
          <text
            aria-hidden="true"
            x={projection.point(layer, -2.55, 2.2).x}
            y={projection.point(layer, -2.55, 2.2).y}
            fontSize={0.5}
            fill="var(--color-ink-muted)"
            textAnchor="middle"
          >
            {formatNumber(layer + 1, locale)}
          </text>
          <g transform={projection.matrix(layer)}>
            <rect
              aria-hidden="true"
              x={-2.06}
              y={-2.06}
              width={4.12}
              height={4.12}
              rx={0.18}
              fill="var(--color-surface)"
              fillOpacity={0.82}
              stroke="var(--color-stroke)"
              strokeWidth={0.05}
            />
            {LINES.map((row) => (
              <g key={row} role="row" aria-rowindex={layer * QUBIC_EDGE + row + 1}>
                {LINES.map((col) => {
                  const index = qubicIndex(layer, row, col);
                  const { cell, label } = cells[index]!;
                  const centre = centreOf(row, col);
                  const canPlay = interactive && playable.has(index);
                  const hint = hintFor.get(index);
                  return (
                    <g
                      key={col}
                      role="gridcell"
                      data-cell={index}
                      tabIndex={index === focus ? 0 : -1}
                      aria-label={label}
                      aria-disabled={!canPlay}
                      aria-colindex={col + 1}
                      className={cx('outline-none', canPlay && 'group cursor-pointer')}
                      onFocus={() => onFocus(index)}
                      onClick={() => {
                        if (swallowClick.current) return;
                        onPress(index);
                      }}
                    >
                      <rect
                        x={centre.x - 0.46}
                        y={centre.y - 0.46}
                        width={0.92}
                        height={0.92}
                        rx={0.12}
                        className={cx(
                          'transition-[fill] duration-150',
                          canPlay ? 'fill-b8/10 group-hover:fill-b8/30' : 'fill-transparent',
                        )}
                        stroke="var(--color-grid)"
                        strokeOpacity={0.55}
                        strokeWidth={0.03}
                        style={
                          winning.has(index) ? { fill: winColour, fillOpacity: 0.35 } : undefined
                        }
                      />
                      {isMark(cell) ? (
                        <PlaneMark
                          player={cell}
                          x={centre.x}
                          y={centre.y}
                          enter={game.lastMove === index}
                          glow={effects && winning.has(index)}
                        />
                      ) : null}
                      {hint && cell === Empty ? (
                        <circle
                          aria-hidden="true"
                          cx={centre.x}
                          cy={centre.y}
                          r={0.3}
                          fill="none"
                          strokeWidth={0.07}
                          strokeDasharray={hint === 'best' ? '0.1 0.08' : undefined}
                          stroke={
                            hint === 'win'
                              ? 'var(--color-ok)'
                              : hint === 'threat'
                                ? 'var(--color-warn)'
                                : 'var(--color-ink)'
                          }
                          className="animate-pulse-soft"
                        />
                      ) : null}
                      {game.lastMove === index ? (
                        <rect
                          aria-hidden="true"
                          x={centre.x - 0.44}
                          y={centre.y - 0.44}
                          width={0.88}
                          height={0.88}
                          rx={0.12}
                          fill="none"
                          stroke="var(--color-ink)"
                          strokeOpacity={0.7}
                          strokeWidth={0.06}
                        />
                      ) : null}
                      {showFocus && index === focus ? (
                        <rect
                          aria-hidden="true"
                          x={centre.x - 0.5}
                          y={centre.y - 0.5}
                          width={1}
                          height={1}
                          rx={0.14}
                          fill="none"
                          stroke="var(--color-ink)"
                          strokeWidth={0.09}
                        />
                      ) : null}
                    </g>
                  );
                })}
              </g>
            ))}
          </g>
        </g>
      ))}

      {line && line.length > 1 && effects ? (
        <polyline
          aria-hidden="true"
          points={line.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={winColour}
          strokeOpacity={0.35}
          strokeWidth={0.42}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          className="pointer-events-none animate-draw-line"
        />
      ) : null}
      {line && line.length > 1 ? (
        <polyline
          aria-hidden="true"
          points={line.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={winColour}
          strokeWidth={0.16}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          className="pointer-events-none animate-draw-line"
        />
      ) : null}
    </svg>
  );
}

/** A mark lying on its layer, drawn in the layer's own plane coordinates. */
function PlaneMark({
  player,
  x,
  y,
  enter,
  glow,
}: {
  player: Player;
  x: number;
  y: number;
  enter: boolean;
  glow: boolean;
}) {
  const colour = player === X ? 'var(--color-mark-x)' : 'var(--color-mark-o)';
  const style: CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };
  return (
    <g
      aria-hidden="true"
      className={cx(enter && 'animate-pop', glow && 'animate-pulse-soft')}
      style={style}
      stroke={colour}
      strokeWidth={0.13}
      strokeLinecap="round"
      fill="none"
    >
      {player === X ? (
        <>
          <line x1={x - 0.26} y1={y - 0.26} x2={x + 0.26} y2={y + 0.26} />
          <line x1={x + 0.26} y1={y - 0.26} x2={x - 0.26} y2={y + 0.26} />
        </>
      ) : (
        <circle cx={x} cy={y} r={0.28} />
      )}
    </g>
  );
}

/**
 * The cube laid flat: four 4x4 layers, two by two, in the order they are
 * stacked. The winning cells light up rather than being joined by a line,
 * which would cut across the gaps between layers and mean nothing.
 */
function FlatCube({
  game,
  cells,
  focus,
  playable,
  interactive,
  winning,
  hintFor,
  animate,
  onFocus,
  onPress,
}: CubeViewProps & { animate: boolean }) {
  const t = useT(gameBoardMessages);
  return (
    <div className="grid grid-cols-2 gap-3">
      {LAYERS.map((layer) => (
        <div
          key={layer}
          role="rowgroup"
          aria-label={t('layer', { n: layer + 1 })}
          className="flex flex-col gap-1"
        >
          <span aria-hidden="true" className="text-center text-xs text-ink-muted">
            {t('layer', { n: layer + 1 })}
          </span>
          <div className="overflow-hidden rounded-xl border border-stroke bg-surface">
            {LINES.map((row) => (
              <div
                key={row}
                role="row"
                aria-rowindex={layer * QUBIC_EDGE + row + 1}
                className="grid grid-cols-4"
              >
                {LINES.map((col) => {
                  const index = qubicIndex(layer, row, col);
                  const { cell, label } = cells[index]!;
                  const canPlay = interactive && playable.has(index);
                  const hint = hintFor.get(index);
                  const won = winning.has(index);
                  return (
                    <button
                      key={col}
                      type="button"
                      role="gridcell"
                      data-cell={index}
                      tabIndex={index === focus ? 0 : -1}
                      aria-label={label}
                      aria-disabled={!canPlay}
                      aria-colindex={col + 1}
                      onFocus={() => onFocus(index)}
                      onClick={() => onPress(index)}
                      className={cx(
                        'relative flex aspect-square items-center justify-center',
                        'border-t border-r border-dashed border-grid/85',
                        row === 0 && 'border-t-0',
                        col === QUBIC_EDGE - 1 && 'border-r-0',
                        canPlay
                          ? 'cursor-pointer transition-colors duration-150 hover:bg-b8/12 active:bg-b8/25'
                          : 'cursor-default',
                        won && 'bg-b8/25',
                      )}
                    >
                      {isMark(cell) ? (
                        <span className={cx('flex w-[66%]', animate && won && 'animate-win-throb')}>
                          <Mark
                            player={cell}
                            hole="var(--color-surface)"
                            className={cx(
                              'w-full',
                              animate &&
                                game.lastMove === index &&
                                (cell === X ? 'animate-mark-x' : 'animate-mark-o'),
                            )}
                          />
                        </span>
                      ) : null}
                      {game.lastMove === index ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[8%] rounded-full ring-2 ring-ink/70"
                        />
                      ) : null}
                      {hint && cell === Empty ? (
                        <span
                          aria-hidden="true"
                          className={cx(
                            'pointer-events-none absolute inset-[22%] border-2 animate-pulse-soft',
                            hint === 'win' && 'rounded-full border-ok',
                            hint === 'threat' && 'rounded-sm border-warn',
                            hint === 'best' && 'rounded-full border-dashed border-ink',
                          )}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Turn, tilt, reset and lay flat. The cube eases between angles when a
 * button turns it, the same way a drag would have.
 */
function ViewControls({
  flat,
  onFlat,
  view,
  onView,
}: {
  flat: boolean;
  onFlat: (flat: boolean) => void;
  view: View;
  onView: (view: View) => void;
}) {
  const t = useT(gameBoardMessages);
  const tween = useRef<number | null>(null);
  useEffect(() => () => cancelTween(tween), []);

  function turnTo(target: View) {
    cancelTween(tween);
    if (typeof requestAnimationFrame === 'undefined') {
      onView(target);
      return;
    }
    const from = view;
    const started = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - started) / 260);
      const eased = 1 - (1 - progress) ** 3;
      onView({
        spin: from.spin + (target.spin - from.spin) * eased,
        tilt: from.tilt + (target.tilt - from.tilt) * eased,
      });
      tween.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    tween.current = requestAnimationFrame(step);
  }

  const button =
    'min-h-8 min-w-8 shrink-0 rounded-lg border border-stroke px-2 text-xs text-ink hover:bg-stroke-soft disabled:opacity-40';
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1.5"
      role="group"
      aria-label={t('cubeView')}
    >
      {!flat ? (
        <>
          <button
            type="button"
            className={button}
            aria-label={t('turnLeft')}
            onClick={() => turnTo({ ...view, spin: view.spin - SPIN_STEP })}
          >
            ↺
          </button>
          <button
            type="button"
            className={button}
            aria-label={t('turnRight')}
            onClick={() => turnTo({ ...view, spin: view.spin + SPIN_STEP })}
          >
            ↻
          </button>
          <button
            type="button"
            className={button}
            aria-label={t('tiltUp')}
            disabled={view.tilt >= TILT_RANGE[1]}
            onClick={() =>
              turnTo({ ...view, tilt: Math.min(TILT_RANGE[1], view.tilt + TILT_STEP) })
            }
          >
            ⤒
          </button>
          <button
            type="button"
            className={button}
            aria-label={t('tiltDown')}
            disabled={view.tilt <= TILT_RANGE[0]}
            onClick={() =>
              turnTo({ ...view, tilt: Math.max(TILT_RANGE[0], view.tilt - TILT_STEP) })
            }
          >
            ⤓
          </button>
          <button type="button" className={button} onClick={() => turnTo(DEFAULT_VIEW)}>
            {t('resetView')}
          </button>
        </>
      ) : null}
      <button type="button" className={button} aria-pressed={flat} onClick={() => onFlat(!flat)}>
        {t(flat ? 'view3d' : 'flatLayers')}
      </button>
    </div>
  );
}

function cancelTween(tween: { current: number | null }) {
  if (tween.current !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(tween.current);
  }
  tween.current = null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function describeCell(
  game: GameState,
  index: number,
  hint: BoardHint['kind'] | undefined,
  t: Translator<(typeof gameBoardMessages)['en']>,
): string {
  const { layer, row, col } = qubicCoords(index);
  const cell = game.board[index];
  const parts = [
    t('layer', { n: layer + 1 }),
    t('position', { row: row + 1, col: col + 1 }),
    cell === X ? 'X' : isMark(cell) ? 'O' : t('empty'),
  ];
  if (game.winLine?.includes(index)) parts.push(t('partOfWin'));
  if (hint === 'win') parts.push(t('hintWin'));
  else if (hint === 'threat') parts.push(t('hintThreat'));
  else if (hint === 'best') parts.push(t('hintBest'));
  return parts.join(t('sep'));
}
