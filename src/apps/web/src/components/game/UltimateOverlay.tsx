import { Empty, type GameState, O, X } from '@dooz/engine';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';

/**
 * Everything an Ultimate board needs that a grid of squares cannot show.
 *
 * Three things, drawn over the cells rather than inside them:
 *
 * 1. **The sub-board borders.** Nine 3x3 games on one 9x9 grid are unreadable
 *    without them - the dashed cell rules alone give no hint where one small
 *    board ends and the next begins.
 * 2. **Which board you must play in.** This is the whole variant, and a player
 *    who cannot see it at a glance is playing by trial and error.
 * 3. **Who won each small board.** A large mark over a finished board, so the
 *    meta-game is readable without counting marks.
 *
 * It is `pointer-events-none` throughout: the cells underneath stay clickable,
 * because an overlay that swallows taps on the board is worse than no overlay.
 */
export function UltimateOverlay({ game }: { game: GameState }) {
  const meta = game.ultimate;
  if (!meta) return null;

  const playing = game.status === 'playing';

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="grid h-full w-full grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }, (_, board) => {
          const owner = meta.boards[board] ?? Empty;
          const drawn = meta.drawn[board] === true;
          const settled = owner !== Empty || drawn;
          const active = playing && (meta.activeBoard === null || meta.activeBoard === board);
          const open = active && !settled;
          const inWin = meta.winBoards?.includes(board) === true;

          return (
            <div
              key={board}
              className={cx(
                'relative flex items-center justify-center',
                // A solid rule between the small boards, on the inner edges
                // only so the outer frame stays clean.
                'border-t-2 border-l-2 border-b8/70',
                board < 3 && 'border-t-0',
                board % 3 === 0 && 'border-l-0',
                'transition-[background-color] duration-300 ease-soft',
                // The board you are sent to is lit. When the move is free every
                // open board is lit, which is itself the message.
                open && 'bg-b8/10',
                settled && 'bg-surface/45',
              )}
            >
              {/* The live board is ringed, inset so the ring sits inside the
                  rule rather than on top of it. */}
              {open ? (
                // Eases in each time the target board changes, so the eye is
                // pulled to where the next move has to go.
                <span className="absolute inset-[3%] animate-subboard-in">
                  <span
                    className={cx(
                      'absolute inset-0 rounded-lg ring-2 ring-b8/80',
                      meta.activeBoard !== null && 'animate-pulse-soft',
                    )}
                  />
                </span>
              ) : null}

              {/* A small board taken: a ring stamps out from under the mark. */}
              {owner !== Empty ? (
                <span
                  className="absolute inset-[20%] animate-stamp rounded-full"
                  style={{
                    boxShadow: `0 0 0 3px ${owner === X ? 'var(--color-mark-x-soft)' : 'var(--color-mark-o-soft)'}`,
                  }}
                />
              ) : null}

              {owner !== Empty ? (
                <span className={cx('flex w-[62%]', inWin && 'animate-win-throb')}>
                  <Mark
                    player={owner === X ? X : O}
                    hole="var(--color-surface)"
                    className={cx(
                      'w-full animate-pop drop-shadow-[0_2px_10px_rgb(0_0_0/0.45)]',
                      // A board that is part of the winning three keeps moving,
                      // so the three that ended the game read as a set.
                      inWin ? 'opacity-95' : 'opacity-70',
                    )}
                  />
                </span>
              ) : null}

              {drawn ? (
                <span className="text-lg font-semibold text-g8/45 animate-fade-in">—</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
