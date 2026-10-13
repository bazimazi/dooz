import {
  encodeQuantumMove,
  type GameState,
  isMark,
  type Player,
  type QuantumMark,
  quantumOf,
  quantumOptions,
  X,
} from '@/game/engine';
import { type CSSProperties, type KeyboardEvent, memo, useMemo, useRef, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { useGraphics } from '@/lib/graphics';
import { haptics, sfx } from '@/lib/sound';
import { type Translator, useT } from '@/i18n';
import { gameBoardMessages } from '@/i18n/messages/gameBoard';
import { useModeText } from '@/i18n/messages/modes';
import type { BoardHint, BoardProps } from './Board';

/**
 * Quantum tic-tac-toe's board.
 *
 * A square shows either one classical mark, with the subscript of the move
 * that placed it, or the small spooky marks spread across it - each one also
 * sitting in exactly one other square, which a line joins it to. When a move
 * closes a loop of those lines, the loop and the mark that closed it light up,
 * and the player to move is asked where that mark really is.
 *
 * A move here is up to three taps, sent as one move code: where the pending
 * mark collapses (only when a loop is waiting), then the two squares of the new
 * spooky mark. The board walks the player through them and shows the collapsed
 * board as soon as they have chosen, so the spooky mark is placed on the board
 * it will actually land on. When the collapse decides the game, or leaves one
 * square, there is nothing left to choose and the move goes at once.
 */

type BoardText = Translator<(typeof gameBoardMessages)['en']>;

type Stage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'collapse'; readonly mark: QuantumMark }
  | { readonly kind: 'classical'; readonly cell: number }
  | { readonly kind: 'spooky'; readonly first: number | null };

export const QuantumBoard = memo(function QuantumBoard({
  game,
  onPlay,
  disabled = false,
  finishTone = null,
  hints,
  readOnly = false,
}: BoardProps) {
  const graphics = useGraphics();
  const t = useT(gameBoardMessages);
  const rules = useModeText('quantum').rules;
  const animate = graphics !== 'low';
  const effects = graphics === 'high';
  const interactive = !readOnly && !disabled && game.status === 'playing';
  const quantum = quantumOf(game);

  // The half-made move belongs to the position it was started in: a move from
  // elsewhere (the opponent, an undo) discards it.
  const [draft, setDraft] = useState<{ ply: number; choice: 0 | 1 | null; first: number | null }>({
    ply: -1,
    choice: null,
    first: null,
  });
  const current = draft.ply === game.moves.length ? draft : { choice: null, first: null };
  const choice = quantum.pending === null ? null : current.choice;

  const options = useMemo(
    () =>
      interactive && (quantum.pending === null || choice !== null)
        ? quantumOptions(game, choice)
        : null,
    [game, interactive, quantum.pending, choice],
  );
  // The board as the player will play into it: collapsed, once they have said how.
  const shown = options?.preview ?? game;
  const shownQuantum = quantumOf(shown);

  const stage: Stage = !interactive
    ? { kind: 'idle' }
    : quantum.pending !== null && choice === null
      ? { kind: 'collapse', mark: quantum.marks[quantum.pending]! }
      : options && options.free.length === 1
        ? { kind: 'classical', cell: options.free[0]! }
        : { kind: 'spooky', first: current.first };

  const [focusIndex, setFocusIndex] = useState(4);
  const gridRef = useRef<HTMLDivElement>(null);
  const hintFor = useMemo(() => {
    const map = new Map<number, BoardHint['kind']>();
    for (const hint of hints ?? []) map.set(hint.index, hint.kind);
    return map;
  }, [hints]);

  const ply = game.moves.length + 1;
  const mover = game.currentPlayer;

  function press(cell: number) {
    if (stage.kind === 'idle') return;

    if (stage.kind === 'collapse') {
      const side = stage.mark.cells.indexOf(cell);
      if (side !== 0 && side !== 1) return refuse();
      const picked: 0 | 1 = side;
      const after = quantumOptions(game, picked);
      if (after.ends) {
        onPlay(encodeQuantumMove({ collapse: picked, follow: { kind: 'nothing' } }));
      } else if (after.free.length === 1) {
        onPlay(
          encodeQuantumMove({
            collapse: picked,
            follow: { kind: 'classical', cell: after.free[0]! },
          }),
        );
      } else {
        sfx.place(game.currentPlayer, cell, 3);
        setDraft({ ply: game.moves.length, choice: picked, first: null });
      }
      return;
    }

    if (stage.kind === 'classical') {
      if (cell !== stage.cell) return refuse();
      onPlay(encodeQuantumMove({ collapse: choice, follow: { kind: 'classical', cell } }));
      return;
    }

    if (isMark(shown.board[cell])) return refuse();
    if (stage.first === null) {
      setDraft({ ply: game.moves.length, choice, first: cell });
      return;
    }
    if (stage.first === cell) {
      setDraft({ ply: game.moves.length, choice, first: null });
      return;
    }
    onPlay(
      encodeQuantumMove({
        collapse: choice,
        follow: { kind: 'spooky', cells: [stage.first, cell] },
      }),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 3,
      ArrowUp: -3,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    const next = focusIndex + delta;
    if (next < 0 || next > 8) return;
    if (Math.abs(delta) === 1 && Math.floor(next / 3) !== Math.floor(focusIndex / 3)) return;
    event.preventDefault();
    setFocusIndex(next);
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
  }

  const spookyIn = useMemo(() => {
    const map = new Map<number, QuantumMark[]>();
    for (const mark of shownQuantum.marks) {
      if (mark.at !== null) continue;
      for (const cell of mark.cells) map.set(cell, [...(map.get(cell) ?? []), mark]);
    }
    return map;
  }, [shownQuantum]);

  const pendingMark = stage.kind === 'collapse' ? stage.mark : null;
  const cycle = new Set(quantum.pending !== null && choice === null ? (quantum.cycle ?? []) : []);
  const justCollapsed = new Set(choice === null ? quantum.collapsed : []);
  const winning = new Set(game.winLine ?? []);
  const winner = game.winner ?? X;

  return (
    <div className="flex w-full max-w-board flex-col items-center gap-2">
      <div
        className={cx(
          'glass-edge relative w-full p-3 backdrop-blur-[3px]',
          'transition-[box-shadow,opacity] duration-500 ease-soft',
          disabled && game.status === 'playing' && 'opacity-90',
          finishTone === 'win' &&
            'animate-board-settle shadow-[0_0_36px_-6px_var(--color-glow-win)]',
          finishTone === 'draw' && 'animate-board-draw',
          finishTone === 'loss' && 'animate-shake',
        )}
        style={{ borderRadius: '2rem' }}
        // The board is a coordinate grid: it never mirrors with the language.
        dir="ltr"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] bg-surface">
          <div
            ref={gridRef}
            role="grid"
            aria-label={t('labelQuantum')}
            aria-busy={disabled && game.status === 'playing'}
            aria-readonly={readOnly || undefined}
            onKeyDown={handleKeyDown}
            className="grid h-full w-full grid-rows-3"
          >
            {[0, 1, 2].map((row) => (
              <div key={row} role="row" className="grid grid-cols-3">
                {[0, 1, 2].map((col) => {
                  const cell = row * 3 + col;
                  const classical = shown.board[cell];
                  const subscript = shownQuantum.classical[cell];
                  const isChoice = pendingMark?.cells.includes(cell) ?? false;
                  const selected = stage.kind === 'spooky' && stage.first === cell;
                  const open =
                    stage.kind === 'collapse'
                      ? isChoice
                      : stage.kind === 'classical'
                        ? stage.cell === cell
                        : stage.kind === 'spooky' && !isMark(classical);
                  return (
                    <button
                      key={col}
                      type="button"
                      role="gridcell"
                      data-cell={cell}
                      tabIndex={cell === focusIndex ? 0 : -1}
                      aria-disabled={!open}
                      aria-pressed={stage.kind === 'spooky' ? selected : undefined}
                      aria-label={describeSquare(
                        shown,
                        cell,
                        spookyIn.get(cell) ?? [],
                        {
                          choice: isChoice,
                          hint: hintFor.get(cell),
                          won: winning.has(cell),
                        },
                        t,
                      )}
                      onFocus={() => setFocusIndex(cell)}
                      onClick={() => press(cell)}
                      className={cx(
                        'group relative flex items-center justify-center',
                        'border-t border-r border-dashed border-grid/85',
                        row === 0 && 'border-t-0',
                        col === 2 && 'border-r-0',
                        open
                          ? 'cursor-pointer transition-colors duration-150 hover:bg-b8/12 active:bg-b8/25'
                          : 'cursor-default',
                        cycle.has(cell) && 'bg-b8/10',
                        selected && 'bg-b8/25',
                        winning.has(cell) && 'bg-b8/20',
                      )}
                    >
                      {isMark(classical) ? (
                        <span
                          className={cx(
                            'relative flex w-[62%]',
                            animate && justCollapsed.has(cell) && 'animate-pop',
                            animate && winning.has(cell) && 'animate-win-throb',
                          )}
                          style={
                            animate && justCollapsed.has(cell)
                              ? { animationDelay: `${quantum.collapsed.indexOf(cell) * 0.09}s` }
                              : undefined
                          }
                        >
                          <Mark player={classical} hole="var(--color-surface)" className="w-full" />
                          <span className="tnum absolute -right-[18%] -bottom-[6%] text-sm font-semibold text-ink-muted">
                            {subscript}
                          </span>
                        </span>
                      ) : (
                        <SpookyMarks
                          marks={spookyIn.get(cell) ?? []}
                          pending={pendingMark}
                          newest={quantum.marks.at(-1) ?? null}
                          animate={animate}
                        />
                      )}

                      {selected ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[8%] rounded-2xl border-2 border-dashed border-ink/70"
                        />
                      ) : null}
                      {stage.kind === 'spooky' && !isMark(classical) && !selected ? (
                        <GhostSpooky player={mover} ply={ply} />
                      ) : null}
                      {isChoice ? (
                        <span
                          aria-hidden="true"
                          className={cx(
                            'pointer-events-none absolute inset-[6%] rounded-2xl border-2 border-ok',
                            animate && 'animate-pulse-soft',
                          )}
                        />
                      ) : null}
                      {hintFor.get(cell) === 'best' ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[14%] animate-pulse-soft rounded-full border-2 border-dashed border-ink"
                        />
                      ) : null}
                      {stage.kind === 'classical' && stage.cell === cell ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-[8%] rounded-2xl border-2 border-ok"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <Entanglements
            quantum={shownQuantum}
            cycle={quantum.pending !== null && choice === null ? quantum.pending : null}
            animate={animate}
            effects={effects}
          />
          {game.winLine ? <QuantumWinLine line={game.winLine} winner={winner} /> : null}
        </div>
      </div>

      <StagePrompt
        stage={stage}
        mover={mover}
        ply={ply}
        choice={choice}
        onBack={() => setDraft({ ply: game.moves.length, choice: null, first: null })}
      />
      <details className="w-full max-w-board rounded-tile border border-stroke-soft px-3 py-2 text-xs text-ink-muted">
        <summary className="cursor-pointer text-ink">{t('howQuantum')}</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 ps-4">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>
    </div>
  );
});

/** A tap the rules refuse, heard rather than silently ignored. */
function refuse() {
  sfx.invalid();
  haptics.buzz([10, 30, 10], 'warning');
}

/** The spooky marks in one square, small, each with its subscript. */
function SpookyMarks({
  marks,
  pending,
  newest,
  animate,
}: {
  marks: readonly QuantumMark[];
  pending: QuantumMark | null;
  newest: QuantumMark | null;
  animate: boolean;
}) {
  if (marks.length === 0) return null;
  return (
    <span aria-hidden="true" className="grid w-[92%] grid-cols-3 gap-[3%]">
      {marks.map((mark) => (
        <span
          key={mark.move}
          className={cx(
            'flex items-end justify-center',
            mark === pending && 'rounded-md ring-2 ring-ok',
            animate && mark === pending && 'animate-pulse-soft',
            animate && mark.move === newest?.move && 'animate-fade-in',
          )}
        >
          <Mark player={mark.player} hole="var(--color-surface)" className="w-[72%] opacity-85" />
          <span className="tnum text-[0.6rem] leading-none font-semibold text-ink-muted">
            {mark.move}
          </span>
        </span>
      ))}
    </span>
  );
}

/** The faint mark a tap would place, while choosing squares. */
function GhostSpooky({ player, ply }: { player: Player; ply: number }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'pointer-events-none absolute top-[6%] right-[6%] flex w-[22%] items-end opacity-0 transition-opacity duration-200',
        'group-hover:opacity-50 group-focus-visible:opacity-50',
      )}
    >
      <Mark player={player} hole="var(--color-surface)" className="w-full" />
      <span className="tnum text-[0.55rem] font-semibold">{ply}</span>
    </span>
  );
}

/**
 * The entanglement lines between the two squares of every spooky mark.
 *
 * Marks that join the same two squares bow apart so each stays visible. The
 * loop waiting to be measured is drawn heavier, and breathes on High.
 */
function Entanglements({
  quantum,
  cycle,
  animate,
  effects,
}: {
  quantum: ReturnType<typeof quantumOf>;
  cycle: number | null;
  animate: boolean;
  effects: boolean;
}) {
  const loop = new Set(quantum.cycle ?? []);
  const seen = new Map<string, number>();
  return (
    <svg
      viewBox="0 0 3 3"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      fill="none"
    >
      {quantum.marks.map((mark, index) => {
        if (mark.at !== null) return null;
        const [a, b] = mark.cells;
        const key = `${a}-${b}`;
        const nth = seen.get(key) ?? 0;
        seen.set(key, nth + 1);
        const from = { x: (a % 3) + 0.5, y: Math.floor(a / 3) + 0.5 };
        const to = { x: (b % 3) + 0.5, y: Math.floor(b / 3) + 0.5 };
        // A line whose midpoint is a square's centre would run straight
        // through that square's own marks, so it always bows. Further marks on
        // the same pair alternate sides, each further out: 0, +, -, ++, --...
        const through = ((from.x + to.x) / 2) % 1 === 0.5 && ((from.y + to.y) / 2) % 1 === 0.5;
        const bow = through
          ? (nth % 2 === 0 ? 1 : -1) * (0.32 + Math.floor(nth / 2) * 0.2)
          : (nth === 0 ? 0 : Math.ceil(nth / 2) * (nth % 2 ? 1 : -1)) * 0.22;
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const control = {
          x: (from.x + to.x) / 2 - ((to.y - from.y) / length) * bow,
          y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * bow,
        };
        const onLoop = cycle !== null && (index === cycle || (loop.has(a) && loop.has(b)));
        const colour = mark.player === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)';
        return (
          <path
            key={mark.move}
            d={`M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`}
            stroke={colour}
            strokeOpacity={onLoop ? 0.95 : 0.5}
            strokeWidth={onLoop ? 0.05 : 0.025}
            strokeDasharray={onLoop ? undefined : '0.06 0.05'}
            strokeLinecap="round"
            className={cx(
              animate && index === quantum.marks.length - 1 && 'animate-fade-in',
              effects && onLoop && 'animate-pulse-soft',
            )}
          />
        );
      })}
    </svg>
  );
}

function QuantumWinLine({ line, winner }: { line: readonly number[]; winner: Player }) {
  const first = line[0]!;
  const last = line.at(-1)!;
  const colour = winner === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)';
  const style: CSSProperties = { strokeDasharray: 1, strokeDashoffset: 1 };
  return (
    <svg
      viewBox="0 0 3 3"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <line
        x1={(first % 3) + 0.5}
        y1={Math.floor(first / 3) + 0.5}
        x2={(last % 3) + 0.5}
        y2={Math.floor(last / 3) + 0.5}
        stroke={colour}
        strokeWidth={0.09}
        strokeLinecap="round"
        pathLength={1}
        style={style}
        className="animate-draw-line"
      />
    </svg>
  );
}

/** What the player has to do next, said in words, and the way back from a collapse choice. */
function StagePrompt({
  stage,
  mover,
  ply,
  choice,
  onBack,
}: {
  stage: Stage;
  mover: Player;
  ply: number;
  choice: 0 | 1 | null;
  onBack: () => void;
}) {
  const t = useT(gameBoardMessages);
  const mark = `${mover === X ? 'X' : 'O'}${ply}`;
  const text =
    stage.kind === 'collapse'
      ? t('promptCollapse', { mark: markName(stage.mark) })
      : stage.kind === 'classical'
        ? t('promptClassical', { mark })
        : stage.kind === 'spooky'
          ? stage.first === null
            ? t('promptSpooky', { mark })
            : t('promptSecond', { mark })
          : '';
  if (!text) return null;
  return (
    <div className="flex w-full max-w-board flex-wrap items-center justify-center gap-2">
      <p className="text-center text-xs text-ink" aria-live="polite">
        {text}
      </p>
      {choice !== null ? (
        <button
          type="button"
          onClick={onBack}
          className="min-h-8 shrink-0 rounded-lg border border-stroke px-2 text-xs text-ink hover:bg-stroke-soft"
        >
          {t('changeCollapse')}
        </button>
      ) : null}
    </div>
  );
}

function describeSquare(
  game: GameState,
  cell: number,
  spooky: readonly QuantumMark[],
  flags: { choice: boolean; hint: BoardHint['kind'] | undefined; won: boolean },
  t: BoardText,
): string {
  const position = t('position', { row: Math.floor(cell / 3) + 1, col: (cell % 3) + 1 });
  const owner = game.board[cell];
  const subscript = quantumOf(game).classical[cell];
  const contents = isMark(owner)
    ? t('collapsed', { mark: `${owner === X ? 'X' : 'O'}${subscript ?? ''}` })
    : spooky.length > 0
      ? t('spooky', { marks: spooky.map(markName).join(t('sep')) })
      : t('empty');
  const extra = [
    flags.choice ? t('collapseChoice') : '',
    flags.won ? t('partOfWin') : '',
    flags.hint === 'best' ? t('suggested') : '',
  ].filter(Boolean);
  return [position, contents, ...extra].join(t('sep'));
}

/** A quantum mark by its letter and the move that placed it: "X3". */
function markName(mark: QuantumMark): string {
  return `${mark.player === X ? 'X' : 'O'}${mark.move}`;
}
