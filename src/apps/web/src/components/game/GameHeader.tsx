import { type BoardSize, type GameState, O, X } from '@dooz/engine';
import { BoardSizeSelect } from './BoardSizeSelect';
import { PlayerCard } from './PlayerCard';

export interface SeatInfo {
  name: string;
  kind?: 'human' | 'bot';
  connected?: boolean;
  isYou?: boolean;
  /** Seat is working on something — the bot searching for its move. */
  busy?: boolean;
}

interface GameHeaderProps {
  game: GameState;
  /** The X seat, always drawn on the left. */
  left: SeatInfo;
  /** The O seat, always drawn on the right. */
  right: SeatInfo;
  /** Omit to hide the size picker — online games are fixed to one board. */
  onBoardSizeChange?: (size: BoardSize) => void;
}

export function GameHeader({ game, left, right, onBoardSizeChange }: GameHeaderProps) {
  const playing = game.status === 'playing';

  return (
    <header className="flex w-full items-start justify-center gap-2.5 pt-4">
      <PlayerCard {...left} player={X} active={playing && game.currentPlayer === X} />

      {onBoardSizeChange ? (
        <BoardSizeSelect value={game.size} onChange={onBoardSizeChange} />
      ) : (
        <div className="animate-fade-in self-start pt-5 text-base whitespace-nowrap opacity-70">
          {game.size} x {game.size}
        </div>
      )}

      <PlayerCard {...right} player={O} active={playing && game.currentPlayer === O} />
    </header>
  );
}
