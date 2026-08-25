import { type BoardSize, X } from '@dooz/engine';
import { useNavigate } from '@tanstack/react-router';
import { Board } from '@/components/game/Board';
import { GameControls } from '@/components/game/GameControls';
import { GameHeader } from '@/components/game/GameHeader';
import { outcomeMark, ResultModal } from '@/components/game/ResultModal';
import { Screen } from '@/components/ui/Screen';
import { useGame } from '@/features/game/useGame';
import { savePreferences } from '@/lib/preferences';

interface LocalGameScreenProps {
  size: BoardSize;
}

/** Two people, one device. */
export function LocalGameScreen({ size }: LocalGameScreenProps) {
  const navigate = useNavigate();
  const { game, play, restart } = useGame(size);

  function changeSize(next: BoardSize) {
    savePreferences({ boardSize: next });
    void navigate({ to: '/play/local', search: { size: next } });
  }

  const finished = game.status !== 'playing';
  const title = game.status === 'draw' ? 'Draw' : `Player ${game.winner === X ? 1 : 2} Won!`;
  // Somebody at this device won either way, so a win is always worth marking.
  const finishTone = finished ? (game.winner ? 'win' : 'draw') : null;

  return (
    <Screen>
      <div className="w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{ name: 'Player 1' }}
          right={{ name: 'Player 2' }}
          onBoardSizeChange={changeSize}
        />
      </div>

      <main
        className="flex w-full flex-1 animate-board-in items-center justify-center py-6"
        style={{ animationDelay: '0.12s' }}
      >
        <Board game={game} onPlay={play} finishTone={finishTone} />
      </main>

      <footer className="animate-rise pb-4" style={{ animationDelay: '0.22s' }}>
        <GameControls onRestart={restart} restartLabel="New game" />
      </footer>

      {finished ? (
        <ResultModal
          title={title}
          art={outcomeMark(game.winner)}
          onRestart={restart}
          celebrate={game.winner !== null}
        />
      ) : null}
    </Screen>
  );
}
