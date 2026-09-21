import { type BoardSize, X } from '@dooz/engine';
import { useNavigate } from '@tanstack/react-router';
import { Board } from '@/components/game/Board';
import { GameControls } from '@/components/game/GameControls';
import { GameHeader } from '@/components/game/GameHeader';
import { outcomeMark, ResultModal, revealDelayFor } from '@/components/game/ResultModal';
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

  /**
   * The size lives in the URL so the screen can be linked to or reloaded, but
   * changing it is a setting change, not a move between screens:
   * `viewTransition: false` keeps the document from cross-fading, and `replace`
   * keeps Back pointing at the home screen rather than at the previous size.
   */
  function changeSize(next: BoardSize) {
    savePreferences({ boardSize: next });
    void navigate({
      to: '/play/local',
      search: { size: next },
      replace: true,
      viewTransition: false,
    });
  }

  const finished = game.status !== 'playing';
  const title = game.status === 'draw' ? 'Draw' : `Player ${game.winner === X ? 1 : 2} Won!`;
  // Somebody at this device won either way, so a win is always worth marking.
  const finishTone = finished ? (game.winner ? 'win' : 'draw') : null;

  return (
    <Screen>
      {/* `relative z-10` is load-bearing, not decoration: `animate-rise` here
          and `animate-board-in` on <main> both leave a persistent `transform`,
          so each is its own stacking context at `z-index: auto` - and <main>,
          coming second, would otherwise paint over the size picker's open
          panel and swallow the clicks on its lower options. */}
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
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
          revealDelay={revealDelayFor(game)}
        />
      ) : null}
    </Screen>
  );
}
