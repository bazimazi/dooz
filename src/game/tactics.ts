import {
  candidateMoves,
  colOf,
  Empty,
  type GameState,
  isMark,
  legalMoves,
  opponentOf,
  type Player,
  rowOf,
  swapMove,
  vanishWinningMoves,
  winningMoves,
} from '@/game/engine';
import { translate } from '@/i18n';
import { gameLabelMessages } from '@/i18n/messages/gameLabels';

/**
 * The tactical callouts the board shouts after a move: "FORK!", "OPEN FOUR",
 * "BLOCKED!", "SWAP!".
 *
 * They are read off the same exact threat check the practice hints use -
 * which squares complete a line next move - so a callout never names a threat
 * that is not on the board. Nothing here searches: a fork is two winning
 * squares at once, an open run is two winning squares on the same line as the
 * move that made them, and a block is a move onto a square the opponent was
 * about to win on.
 */

export type CalloutKind = 'fork' | 'open' | 'blocked' | 'swap' | 'claimed';

export interface Callout {
  kind: CalloutKind;
  /** The words on the banner, already in display case and the interface's language. */
  text: string;
  /** Who earned it. */
  player: Player;
  /** The square it is about, for effects that want to point at it. */
  cell: number | null;
}

export interface CalloutOptions {
  /**
   * Whether a callout may describe a threat still standing on the board.
   *
   * Off in rated and casual online play, where telling a player they are
   * facing a fork is an engine at the elbow - the same reason hints are off
   * there. Callouts about things both players already know (a block, a swap,
   * a small board taken) are still made.
   */
  revealThreats: boolean;
}

/**
 * Line variants whose threats the shared check understands exactly: a square
 * either completes the mover's own run or it does not. Everything else is left
 * out on purpose - misère inverts what a line is worth, Pente wins by capture
 * too, Wild and Order & Chaos let either side play either mark, Powers can
 * move marks - and a wrong callout is worse than none.
 */
const LINE_VARIANTS = new Set(['classic', 'gomoku', 'gravity', 'connect4', 'obstacles']);

/** Rule sets where only the lowest free square of each column can be played. */
const DROP_VARIANTS = new Set(['gravity', 'connect4']);

/** The banner for an open run of `run` marks: "OPEN FOUR". */
function openText(run: number): string {
  if (run === 3) return translate(gameLabelMessages, 'calloutOpen3');
  if (run === 4) return translate(gameLabelMessages, 'calloutOpen4');
  if (run === 5) return translate(gameLabelMessages, 'calloutOpen5');
  return translate(gameLabelMessages, 'calloutOpenN', { count: run });
}

/**
 * The callout for the move that turned `before` into `after`, or `null`.
 *
 * Only a single new move is described: a take-back, a new game or a jump
 * through a replay says nothing. A move that ends the game says nothing
 * either - the win has a show of its own, and a banner on top of it would
 * compete with the line.
 */
export function calloutFor(
  before: GameState,
  after: GameState,
  { revealThreats }: CalloutOptions,
): Callout | null {
  if (after.moves.length !== before.moves.length + 1) return null;
  if (!before.moves.every((move, ply) => after.moves[ply] === move)) return null;
  if (before.status !== 'playing' || after.status !== 'playing') return null;

  const move = after.moves.at(-1)!;
  const mover = before.currentPlayer;

  if (swapMove(after.config) === move) {
    return {
      kind: 'swap',
      text: translate(gameLabelMessages, 'calloutSwap'),
      player: mover,
      cell: after.lastMove,
    };
  }

  // Ultimate: a small board changing hands is the event worth naming.
  if (after.ultimate && before.ultimate) {
    const claimed = after.ultimate.boards.findIndex(
      (owner, board) => owner === mover && before.ultimate!.boards[board] === Empty,
    );
    return claimed >= 0
      ? {
          kind: 'claimed',
          text: translate(gameLabelMessages, 'calloutClaimed'),
          player: mover,
          cell: after.lastMove,
        }
      : null;
  }

  const placed = after.lastMove;
  if (placed === null || !isMark(after.board[placed])) return null;

  const variant = after.config.variant;
  const vanish = variant === 'vanish';
  if (!vanish && !LINE_VARIANTS.has(variant)) return null;

  const rival = opponentOf(mover);
  // The opponent's winning squares before the move, from the position where
  // it was the mover's turn: if the mover took one of them, that was a block.
  const rivalWins = vanish ? vanishWinningMoves(before, rival) : lineWins(before, rival);
  const blocked = rivalWins.includes(placed);

  if (revealThreats) {
    // The mover's winning squares now, with the opponent to move.
    const ownWins = vanish ? vanishWinningMoves(after, mover) : lineWins(after, mover);
    if (ownWins.length >= 2) {
      const winLength = after.config.winLength;
      const open =
        !vanish &&
        winLength >= 4 &&
        ownWins.length === 2 &&
        collinear(after.config.size, [placed, ...ownWins]);
      return open
        ? {
            kind: 'open',
            text: openText(winLength - 1),
            player: mover,
            cell: placed,
          }
        : {
            kind: 'fork',
            text: translate(gameLabelMessages, 'calloutFork'),
            player: mover,
            cell: placed,
          };
    }
  }

  return blocked
    ? {
        kind: 'blocked',
        text: translate(gameLabelMessages, 'calloutBlocked'),
        player: mover,
        cell: placed,
      }
    : null;
}

/**
 * Squares on which `player` would complete a line if it were their move.
 *
 * Gravity and Connect Four only ever offer the landing squares, which are
 * the same for both players, so their legal moves are the candidates. Elsewhere a winning square is
 * always next to a mark, so the neighbourhood is enough and keeps a 15x15
 * check to a few dozen squares.
 */
function lineWins(game: GameState, player: Player): number[] {
  const { board, config } = game;
  const candidates = DROP_VARIANTS.has(config.variant)
    ? legalMoves(game)
    : candidateMoves(board, config.size, 1).filter((cell) => board[cell] === Empty);
  return winningMoves(board, config.size, player, config.winLength, candidates);
}

/** Whether every square lies on one straight line: a row, a column or a diagonal. */
export function collinear(size: number, cells: readonly number[]): boolean {
  if (cells.length < 2) return true;
  const [first, second] = cells as [number, number];
  const r0 = rowOf(size, first);
  const c0 = colOf(size, first);
  const dr = Math.sign(rowOf(size, second) - r0);
  const dc = Math.sign(colOf(size, second) - c0);
  if (dr === 0 && dc === 0) return false;
  return cells.every((cell) => {
    const r = rowOf(size, cell) - r0;
    const c = colOf(size, cell) - c0;
    if (dr === 0) return r === 0;
    if (dc === 0) return c === 0;
    // Diagonal: equal steps along both axes, in the line's own direction.
    return r * dc === c * dr && Math.abs(r) === Math.abs(c);
  });
}
