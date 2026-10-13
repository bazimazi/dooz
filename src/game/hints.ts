import {
  candidateMoves,
  CHAOS,
  choosesMark,
  Empty,
  decodeQuantumMove,
  type GameState,
  legalMoves,
  O,
  opponentOf,
  penteWinningMoves,
  qubicWinningMoves,
  vanishWinningMoves,
  winningMoves,
  X,
} from '@/game/engine';

export interface Hint {
  index: number;
  kind: 'win' | 'threat';
}

/**
 * The squares worth pointing at, for the practice screen.
 *
 * Two things and no more: where the game is won this move, and where it is lost
 * if it is not answered. That is the pair a beginner keeps missing, and it is
 * also the pair that can be computed exactly rather than guessed at - a hint
 * that says "this is probably good" teaches nothing, because the player cannot
 * tell whether it was right.
 *
 * Deliberately not offered in ranked or casual online play. A hint system in a
 * rated game is an engine at the elbow, and the ladder would mean nothing.
 */
export function hintsFor(game: GameState): Hint[] {
  if (game.status !== 'playing') return [];
  const { variant } = game.config;

  // Vanish threats are only real if the marks they lean on stay put, which
  // the engine works out for each side from the marks they are about to lose.
  if (variant === 'vanish') {
    const wins = vanishWinningMoves(game, game.currentPlayer);
    if (wins.length > 0) return wins.map((index) => ({ index, kind: 'win' as const }));
    return vanishWinningMoves(game, opponentOf(game.currentPlayer)).map((index) => ({
      index,
      kind: 'threat' as const,
    }));
  }

  // Pente's wins include the fifth capture, and its threats can be answered by
  // capturing out of the line as well as by blocking it; Qubic's lines run
  // through the cube rather than across the flat board. Each has its own exact
  // test. Quantum has no squares to point at: a move there is a pair of squares
  // and, often, a collapse - and whether it wins depends on all of them.
  if (variant === 'pente' || variant === 'qubic') {
    const find = variant === 'pente' ? penteWinningMoves : qubicWinningMoves;
    const wins = find(game, game.currentPlayer);
    if (wins.length > 0) return wins.map((index) => ({ index, kind: 'win' as const }));
    return find(game, opponentOf(game.currentPlayer)).map((index) => ({
      index,
      kind: 'threat' as const,
    }));
  }

  // Wild and Order and Chaos: a square one mark short of a line, of either
  // mark, is the whole tactical story. In Wild it wins for whoever moves; in
  // Order and Chaos it wins for Order and has to be spoiled by Chaos.
  if (variant === 'wild' || variant === 'order-chaos') {
    const squares = completionSquares(game);
    const kind = variant === 'order-chaos' && game.currentPlayer === CHAOS ? 'threat' : 'win';
    return squares.map((index) => ({ index, kind }));
  }

  // Misere inverts what a completed line is worth, and Ultimate's threats are
  // at the sub-board level rather than the board's. Neither is served by this,
  // and a wrong hint is worse than none. Gravity is: its legal squares are the
  // landing squares, and a line completed on one is a line like any other - as
  // are Connect Four's, the squares around obstacles, and Powers' placements.
  const lineLike =
    variant === 'classic' ||
    variant === 'gomoku' ||
    variant === 'gravity' ||
    variant === 'connect4' ||
    variant === 'obstacles' ||
    variant === 'powers';
  if (!lineLike) return [];

  const { board, config, currentPlayer } = game;
  const legal = new Set(legalMoves(game));
  const near = candidateMoves(board, config.size, 1).filter((move: number) => legal.has(move));
  // Under the exact rule an overline is not a win, so it is neither pointed at
  // nor warned about.
  const exact = config.exact === true;

  const wins = winningMoves(
    board,
    config.size,
    currentPlayer,
    config.winLength,
    near,
    Number.POSITIVE_INFINITY,
    exact,
  );
  if (wins.length > 0) return wins.map((index: number) => ({ index, kind: 'win' as const }));

  const threats = winningMoves(
    board,
    config.size,
    opponentOf(currentPlayer),
    config.winLength,
    near,
    Number.POSITIVE_INFINITY,
    exact,
  );
  return threats.map((index: number) => ({ index, kind: 'threat' as const }));
}

/** Empty squares where either mark would complete a line, ascending. */
function completionSquares(game: GameState): number[] {
  const { board, config } = game;
  const empty = board.flatMap((cell, index) => (cell === Empty ? [index] : []));
  const found = new Set([
    ...winningMoves(board, config.size, X, config.winLength, empty),
    ...winningMoves(board, config.size, O, config.winLength, empty),
  ]);
  return [...found].toSorted((a, b) => a - b);
}

/**
 * The squares an engine suggestion should light up.
 *
 * On most rule sets a move is a square. A quantum move is a pair of squares and
 * perhaps a collapse, so its suggestion is every square it touches: where the
 * pending mark lands, and the two squares of the new spooky mark.
 */
export function suggestionCells(game: GameState, move: number): number[] {
  if (game.config.variant !== 'quantum') {
    // A mark choice or a power is coded above the cell range; the square is
    // the code's remainder.
    const cells = game.board.length;
    const coded = choosesMark(game.config.variant) || game.config.variant === 'powers';
    if (coded) return move < cells * 3 ? [move % cells] : [];
    return move < cells ? [move] : [];
  }
  const decoded = decodeQuantumMove(move);
  if (!decoded) return [];
  const cells: number[] = [];
  const quantum = game.extra?.kind === 'quantum' ? game.extra : null;
  if (decoded.collapse !== null && quantum !== null && quantum.pending !== null) {
    cells.push(quantum.marks[quantum.pending]!.cells[decoded.collapse]);
  }
  if (decoded.follow.kind === 'spooky') cells.push(...decoded.follow.cells);
  if (decoded.follow.kind === 'classical') cells.push(decoded.follow.cell);
  return [...new Set(cells)];
}
