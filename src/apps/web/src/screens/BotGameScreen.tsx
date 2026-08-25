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
      <div className="w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{ name: 'You' }}
          right={{ name: 'Bot', kind: 'bot', busy: thinking }}
          onBoardSizeChange={(next) => goTo({ size: next })}
        />
      </div>

      <main
        className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-4 py-6"
        style={{ animationDelay: '0.12s' }}
      >
        <Board
          game={game}
          onPlay={play}
          disabled={thinking || game.currentPlayer === O}
          finishTone={finished ? outcome : null}
        />

        <ThinkingIndicator thinking={thinking} />
      </main>

      <footer
        className="flex animate-rise flex-col items-center gap-4 pb-4"
        style={{ animationDelay: '0.22s' }}
      >
        <DifficultyPicker value={difficulty} onChange={(next) => goTo({ difficulty: next })} />
        <GameControls onRestart={restart} restartLabel="New game" />
      </footer>

      {finished ? (
        <ResultModal
          title={title}
          art={outcomeFace(outcome)}
          onRestart={restart}
          celebrate={outcome === 'win'}
        />
      ) : null}
    </Screen>
  );
}

/**
 * "Bot is thinking…", with the three dots doing the waiting.
 *
 * The row keeps its height whether or not it is showing anything, so the board
 * above it does not jump every time the bot takes or finishes a turn.
 */
function ThinkingIndicator({ thinking }: { thinking: boolean }) {
  return (
    <p
      className={cx(
        'flex h-5 items-center gap-1.5 text-sm text-g8/80',
        'transition-[opacity,transform] duration-300 ease-spring',
        thinking ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
      aria-live="polite"
    >
      {thinking ? 'Bot is thinking' : ''}
      <span aria-hidden="true" className="flex items-end gap-1 pb-0.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className={cx('size-1 rounded-full bg-g8', thinking && 'animate-dot')}
            style={{ animationDelay: `${dot * 0.16}s` }}
          />
        ))}
      </span>
    </p>
  );
}

/**
 * The three-way difficulty switch.
 *
 * The selected state is one pill that slides between the options rather than a
 * background that blinks from one to the next, so it is obvious which way the
 * setting moved - and the labels sit in equal grid columns so the pill's third
 * always lines up with them.
 */
function DifficultyPicker({
  value,
  onChange,
}: {
  value: BotDifficulty;
  onChange: (next: BotDifficulty) => void;
}) {
  const index = DIFFICULTIES.findIndex((option) => option.value === value);

  return (
    <div
      role="radiogroup"
      aria-label="Bot difficulty"
      className="relative grid grid-cols-3 rounded-tile border border-b8 bg-b8/15 p-0.5"
    >
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-y-0.5 left-0.5 rounded-xl bg-b8',
          'w-[calc((100%-0.25rem)/3)] transition-transform duration-300 ease-spring',
        )}
        style={{ transform: `translateX(${index * 100}%)` }}
      />

      {DIFFICULTIES.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cx(
            'relative z-1 rounded-xl px-3.5 py-1.5 text-sm',
            'transition-[color,transform] duration-200 ease-spring active:scale-95',
            option.value === value ? 'text-g10' : 'text-g8/70 hover:text-g10',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
