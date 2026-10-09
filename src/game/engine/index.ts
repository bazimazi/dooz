export * from './types.js';
export * from './board.js';
export * from './rules.js';
export * from './game.js';
export * from './modes.js';
export {
  type Variant,
  VANISH_KEEP,
  VANISH_MOVE_LIMIT,
  vanishedBy,
  vanishingNext,
  variantFor,
} from './variants/index.js';
export {
  candidateMoves,
  completesLine,
  findForkMove,
  findImmediateWin,
  solveVanish,
  vanishPliesLeft,
  vanishVerdict,
  vanishWinningMoves,
  winningMoves,
} from './bot/index.js';
export {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  type BotMove,
  type BotOptions,
  chooseMove,
  type DifficultyProfile,
  findBestMove,
  isBotDifficulty,
  profileFor,
} from './bot/index.js';
