import { type BoardSize, type BotDifficulty, O, X } from '@dooz/engine';
import { useNavigate } from '@tanstack/react-router';
import { Board } from '@/components/game/Board';
import { GameControls } from '@/components/game/GameControls';
import { GameHeader } from '@/components/game/GameHeader';
import { outcomeFace, outcomeFor, ResultModal } from '@/components/game/ResultModal';
import { Screen } from '@/components/ui/Screen';
import { useBotOpponent } from '@/features/bot/useBotOpponent';
import { useGame } from '@/features/game/useGame';
import { cx } from '@/lib/cx';
import { savePreferences } from '@/lib/preferences';

interface BotGameScreenProps {
  size: BoardSize;
  difficulty: BotDifficulty;
}

const DIFFICULTIES: { value: BotDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

/** You are X; the bot is O. Who opens is decided by the toss in `useGame`. */
export function BotGameScreen({ size, difficulty }: BotGameScreenProps) {
  const navigate = useNavigate();
  const { game, play, restart } = useGame(size);

  const { thinking } = useBotOpponent({
    game,
    botPlayer: O,
    difficulty,
    onMove: play,
  });

  function goTo(next: { size?: BoardSize; difficulty?: BotDifficulty }) {
    const search = { size: next.size ?? size, difficulty: next.difficulty ?? difficulty };
    savePreferences(search);
    void navigate({ to: '/play/bot', search });
  }

  const finished = game.status !== 'playing';
  const outcome = outcomeFor(game, X);
  const title = outcome === 'win' ? 'you Won!' : outcome === 'loss' ? 'you lose!' : 'Draw';

  return (
    <Screen>
      <GameHeader
        game={game}
        left={{ name: 'You' }}
        right={{ name: 'Bot', kind: 'bot' }}
        onBoardSizeChange={(next) => goTo({ size: next })}
      />

      <main className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-6">
        <Board game={game} onPlay={play} disabled={thinking || game.currentPlayer === O} />

        <p
          className={cx(
            'h-5 text-sm text-g8/80 transition-opacity duration-200',
            thinking ? 'animate-pulse-soft opacity-100' : 'opacity-0',
          )}
          aria-live="polite"
        >
          Bot is thinking…
        </p>
      </main>

      <footer className="flex flex-col items-center gap-4 pb-4">
        <div
          role="radiogroup"
          aria-label="Bot difficulty"
          className="flex rounded-tile border border-b8 bg-b8/15 p-0.5"
        >
          {DIFFICULTIES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === difficulty}
              onClick={() => goTo({ difficulty: option.value })}
              className={cx(
                'rounded-[0.75rem] px-3.5 py-1.5 text-sm transition-colors duration-200',
                option.value === difficulty ? 'bg-b8 text-g10' : 'text-g8/70 hover:text-g10',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <GameControls onRestart={restart} restartLabel="New game" />
      </footer>

      {finished ? (
        <ResultModal title={title} art={outcomeFace(outcome)} onRestart={restart} />
      ) : null}
    </Screen>
  );
}
