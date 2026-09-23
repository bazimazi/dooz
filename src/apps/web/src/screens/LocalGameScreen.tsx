import { modeById, type ModeId, X } from '@dooz/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { BulbIcon } from '@/components/art/ui-icons';
import { Board } from '@/components/game/Board';
import { GameControls } from '@/components/game/GameControls';
import { GameHeader } from '@/components/game/GameHeader';
import { ModeChip } from '@/components/game/ModePicker';
import { outcomeMark, ResultModal, revealDelayFor } from '@/components/game/ResultModal';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useGame } from '@/features/game/useGame';
import { hintsFor } from '@/lib/hints';
import { loadPreferences, savePreferences } from '@/lib/preferences';

interface LocalGameScreenProps {
  mode: ModeId;
}

/** Two people, one device. */
export function LocalGameScreen({ mode }: LocalGameScreenProps) {
  const navigate = useNavigate();
  const config = useMemo(() => modeById(mode).config, [mode]);
  const { game, play, restart, undo, canUndo } = useGame(config);
  const [hintsOn, setHintsOn] = useState(() => loadPreferences().hints);

  const hints = useMemo(() => (hintsOn ? hintsFor(game) : []), [hintsOn, game]);

  const finished = game.status !== 'playing';
  const title = game.status === 'draw' ? 'Draw' : `Player ${game.winner === X ? 1 : 2} wins!`;
  // Somebody at this device won either way, so a win is always worth marking.
  const finishTone = finished ? (game.winner ? 'win' : 'draw') : null;

  function toggleHints() {
    const next = !hintsOn;
    setHintsOn(next);
    savePreferences({ hints: next });
  }

  return (
    <Screen>
      {/* `relative z-10` is load-bearing, not decoration: `animate-rise` here
          and `animate-board-in` on <main> both leave a persistent `transform`,
          so each is its own stacking context at `z-index: auto` - and <main>,
          coming second, would otherwise paint over anything the header opens
          and swallow the clicks on it. */}
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{ name: 'Player 1', kind: 'local' }}
          right={{ name: 'Player 2', kind: 'local' }}
          centre={
            <ModeChip mode={mode} onClick={() => void navigate({ to: '/', search: undefined })} />
          }
          badge="Local"
        />
      </div>

      <main
        className="flex w-full flex-1 animate-board-in items-center justify-center py-6"
        style={{ animationDelay: '0.12s' }}
      >
        <Board game={game} onPlay={play} finishTone={finishTone} hints={hints} />
      </main>

      <footer className="animate-rise pb-4" style={{ animationDelay: '0.22s' }}>
        <GameControls
          onRestart={restart}
          restartLabel="New game"
          onUndo={undo}
          canUndo={canUndo}
          extra={
            <IconButton
              label={hintsOn ? 'Turn hints off' : 'Turn hints on'}
              aria-pressed={hintsOn}
              onClick={toggleHints}
              className={hintsOn ? 'text-ok' : undefined}
            >
              <BulbIcon />
            </IconButton>
          }
        />
      </footer>

      {finished ? (
        <ResultModal
          title={title}
          art={outcomeMark(game.winner)}
          celebrate={game.winner !== null}
          revealDelay={revealDelayFor(game)}
          actions={
            <>
              <Button variant="primary" size="small" block onClick={restart}>
                Play again
              </Button>
              <Button as={Link} to="/" variant="ghost" size="small" block>
                Back to home
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}
