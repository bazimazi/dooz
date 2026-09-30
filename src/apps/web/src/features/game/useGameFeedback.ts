import { Empty, type GameState, type Player, vanishedBy } from '@dooz/engine';
import { useEffect, useRef } from 'react';
import { haptics, sfx } from '@/lib/sound';

interface FeedbackOptions {
  /**
   * The mark played by the person at this device, which decides whether a
   * finished game sounds like a win or a loss. `null` for pass-and-play and for
   * spectators, where any finish is somebody's win and is played as one.
   */
  you?: Player | null;
  /** Threats the hints are currently pointing at. A new one gets a chime. */
  threats?: number;
  /** Replays step through positions: marks sound, results do not repeat. */
  replay?: boolean;
}

/** How long after the final mark the result sounds, so the two do not collide. */
const RESULT_DELAY_MS = 380;

/**
 * Sound and vibration for a game, derived from how its state changes.
 *
 * It compares each position with the one before rather than being called from
 * every place a move can come from - a tap, the bot, the server, a replay
 * step - so every screen gets the same feedback from one line, and none of
 * them can forget a case.
 */
export function useGameFeedback(game: GameState, options: FeedbackOptions = {}): void {
  const { you = null, threats = 0, replay = false } = options;
  const previous = useRef<GameState | null>(null);
  const previousThreats = useRef(threats);

  useEffect(() => {
    const before = previous.current;
    previous.current = game;
    if (!before) {
      if (game.moves.length === 0 && !replay) sfx.start();
      return;
    }
    if (before === game) return;

    const played = game.moves.length - before.moves.length;
    const sameConfig =
      before.config.variant === game.config.variant && before.config.size === game.config.size;

    // Fewer moves is a take-back only if the moves that remain are the ones
    // that were there, and more is a continuation only if it keeps them all;
    // anything else is a different position altogether - a new game, or the
    // tutorial moving to its next board.
    const rewound = played < 0 && game.moves.every((move, ply) => before.moves[ply] === move);
    const continued = played > 0 && before.moves.every((move, ply) => game.moves[ply] === move);
    const unrelated = played !== 0 && !rewound && !continued;

    if (!sameConfig || unrelated || (rewound && game.moves.length === 0 && !replay)) {
      sfx.start();
      return;
    }

    if (played < 0) {
      sfx.undo();
      haptics.buzz(6);
      return;
    }

    if (played !== 1 || game.lastMove === null) return;

    const index = game.lastMove;
    const mover = game.board[index];
    if (mover === undefined || mover === Empty) return;
    const { size } = game.config;

    if (game.config.variant === 'gravity') {
      sfx.drop(mover, index, size, Math.floor(index / size) + 1);
    } else {
      sfx.place(mover, index, size);
    }
    haptics.buzz(8);

    if (vanishedBy(game) !== null) sfx.vanish();

    // An Ultimate small board changing hands is an event of its own.
    const claimed = game.ultimate?.boards.findIndex(
      (owner, board) => owner !== Empty && before.ultimate?.boards[board] === Empty,
    );
    if (claimed !== undefined && claimed >= 0) {
      const owner = game.ultimate!.boards[claimed]!;
      setTimeout(() => sfx.claim(owner === 1 ? 1 : 2), 140);
    }

    if (before.status === 'playing' && game.status !== 'playing' && !replay) {
      const outcome =
        game.status === 'draw' ? 'draw' : you === null || game.winner === you ? 'win' : 'loss';
      const delay = game.config.variant === 'gravity' ? RESULT_DELAY_MS + 250 : RESULT_DELAY_MS;
      setTimeout(() => {
        if (outcome === 'win') {
          sfx.win();
          haptics.buzz([30, 50, 30, 50, 90]);
        } else if (outcome === 'loss') {
          sfx.lose();
          haptics.buzz(140);
        } else {
          sfx.draw();
          haptics.buzz([20, 40, 20]);
        }
      }, delay);
    }
  }, [game, you, replay]);

  useEffect(() => {
    if (threats > 0 && previousThreats.current === 0) {
      // Late enough that it lands after the opponent's mark, not on top of it.
      const timer = setTimeout(() => sfx.threat(), 260);
      previousThreats.current = threats;
      return () => clearTimeout(timer);
    }
    previousThreats.current = threats;
    return undefined;
  }, [threats]);
}
