import { type GameState, isMark, X } from '@/game/engine';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { EffectsEngine } from '@/game/effects/engine';
import { landingDelay } from '@/game/effects/timing';
import { type Callout, calloutFor } from '@/game/tactics';
import { cx } from '@/lib/cx';
import { EFFECTS_BUDGET } from '@/lib/graphics';
import type { ArtStyle, GraphicsQuality } from '@/lib/preferences';
import { usePageVisible } from '@/lib/usePageVisible';

interface BoardEffectsProps {
  game: GameState;
  quality: Exclude<GraphicsQuality, 'low'>;
  style: ArtStyle;
  /** Whether callouts may name a threat still on the board. Off for online play. */
  assist: boolean;
  /** The board's frame, which takes the screen shake. */
  frameRef: RefObject<HTMLElement | null>;
  /** Rows cropped off the top of the drawn board (Connect Four's blocked row). */
  hiddenRows?: number;
}

/**
 * The layer over the board where the game's feel lives: impact particles as
 * a mark lands, the win's trace, burst, slow motion and shake, and the
 * tactical callouts.
 *
 * Never mounted on Low. On Balanced the particles are halved and the slow
 * motion, the bloom and the trace are left out; High has everything. A hidden
 * page drops whatever is in flight rather than playing it back on return.
 *
 * Everything here is decoration over a board that is complete without it, so
 * the whole layer is hidden from assistive technology and takes no input.
 */
export function BoardEffects({
  game,
  quality,
  style,
  assist,
  frameRef,
  hiddenRows = 0,
}: BoardEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<EffectsEngine | null>(null);
  const previous = useRef<GameState | null>(null);
  const visible = usePageVisible();
  const callout = useCallout(game, assist);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const created = new EffectsEngine(canvas, () => frameRef.current);
    engine.current = created;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => created.resize());
    observer?.observe(canvas);
    return () => {
      observer?.disconnect();
      created.destroy();
      engine.current = null;
    };
  }, [frameRef]);

  useEffect(() => {
    engine.current?.configure(EFFECTS_BUDGET[quality], style);
  }, [quality, style]);

  useEffect(() => {
    if (engine.current) engine.current.hiddenRows = hiddenRows;
  }, [hiddenRows]);

  useEffect(() => {
    if (!visible) engine.current?.clear();
  }, [visible]);

  useEffect(() => {
    const before = previous.current;
    previous.current = game;
    const fx = engine.current;
    if (!fx || !before || before === game) return;

    const played = game.moves.length - before.moves.length;
    const continued = played === 1 && before.moves.every((move, ply) => game.moves[ply] === move);
    if (!continued) {
      // A take-back, a new round or a jump: whatever was flying belongs to a
      // position that is gone.
      if (played !== 0) fx.clear();
      return;
    }

    const index = game.lastMove;
    if (index === null || !isMark(game.board[index])) return;
    const { size, variant } = game.config;
    const player = game.board[index] === X ? 'x' : 'o';
    const landing = landingDelay(variant, index, size);
    fx.land(index, size, player, landing);

    if (game.status === 'won' && game.winLine && game.winLine.length > 0) {
      fx.win(game.winLine, size, game.winner === X ? 'x' : 'o', landing);
    }
  }, [game]);

  useEffect(() => {
    if (callout) engine.current?.bump();
  }, [callout]);

  return (
    <div dir="ltr" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {callout ? (
        <span
          key={callout.id}
          data-kind={callout.callout.kind}
          data-player={callout.callout.player === X ? 'x' : 'o'}
          className={cx('fx-callout', quality === 'high' && 'fx-callout-rich')}
        >
          {callout.callout.text}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The callout for the latest move, worked out during render when the position
 * changes - so the banner and the mark that earned it arrive in one paint.
 * Keyed by ply, so the same words twice in a row still play twice.
 */
function useCallout(game: GameState, assist: boolean): { id: number; callout: Callout } | null {
  const [said, setSaid] = useState<{
    game: GameState;
    shown: { id: number; callout: Callout } | null;
  }>({ game, shown: null });

  if (said.game !== game) {
    const next = calloutFor(said.game, game, { revealThreats: assist });
    const continued = game.moves.length === said.game.moves.length + 1;
    setSaid({
      game,
      shown: next ? { id: game.moves.length, callout: next } : continued ? said.shown : null,
    });
  }

  return said.shown;
}
