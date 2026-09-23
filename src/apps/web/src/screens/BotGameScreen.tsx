import { BOT_DIFFICULTIES, type BotDifficulty, modeById, type ModeId, O, X } from '@dooz/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { BulbIcon } from '@/components/art/ui-icons';
import { Board } from '@/components/game/Board';
import { GameControls } from '@/components/game/GameControls';
import { GameHeader } from '@/components/game/GameHeader';
import { ModeChip } from '@/components/game/ModePicker';
import {
  outcomeFace,
  outcomeFor,
  ResultModal,
  revealDelayFor,
} from '@/components/game/ResultModal';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useBotOpponent } from '@/features/bot/useBotOpponent';
import { useGame } from '@/features/game/useGame';
import { cx } from '@/lib/cx';
import { hintsFor } from '@/lib/hints';
import { loadPreferences, savePreferences } from '@/lib/preferences';

interface BotGameScreenProps {
  mode: ModeId;
  difficulty: BotDifficulty;
  /** Practice mode: hints on, take-backs allowed, and the bot's thinking shown. */
  practice?: boolean;
}

const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  master: 'Master',
};

/** You are X; the bot is O. Who opens is decided by the toss in `useGame`. */
export function BotGameScreen({ mode, difficulty, practice = false }: BotGameScreenProps) {
  const navigate = useNavigate();
  const config = useMemo(() => modeById(mode).config, [mode]);
  const { game, play, restart, undo, canUndo } = useGame(config);
  const [hintsOn, setHintsOn] = useState(() => practice || loadPreferences().hints);

  const onMove = useCallback((index: number) => play(index), [play]);
  const { thinking, lastSearch } = useBotOpponent({
    game,
    botPlayer: O,
    difficulty,
    onMove,
  });

  const hints = useMemo(
    () => (hintsOn && game.currentPlayer === X ? hintsFor(game) : []),
    [hintsOn, game],
  );

  /**
   * Board and difficulty live in the URL, so the screen can be linked to or
   * reloaded - but changing one is a setting change, not a move between
   * screens. `viewTransition: false` keeps the document from cross-fading, and
   * `replace` keeps Back pointing at the home screen rather than walking back
   * through every setting the player tried.
   */
  function goTo(next: { mode?: ModeId; difficulty?: BotDifficulty }) {
    const search = {
      mode: next.mode ?? mode,
      difficulty: next.difficulty ?? difficulty,
      ...(practice ? { practice: true as const } : {}),
    };
    savePreferences({ mode: search.mode, difficulty: search.difficulty });
    void navigate({ to: '/play/bot', search, replace: true, viewTransition: false });
  }

  function toggleHints() {
    const next = !hintsOn;
    setHintsOn(next);
    if (!practice) savePreferences({ hints: next });
  }

  /** Take back the bot's reply and your own move, so it is your turn again. */
  function takeBack() {
    undo();
    undo();
  }

  const finished = game.status !== 'playing';
  const outcome = outcomeFor(game, X);
  const title = outcome === 'win' ? 'You win!' : outcome === 'loss' ? 'You lose' : 'Draw';

  return (
    <Screen>
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{ name: 'You', kind: 'local', isYou: true }}
          right={{ name: DIFFICULTY_LABELS[difficulty], kind: 'bot', busy: thinking }}
          centre={<ModeChip mode={mode} onClick={() => void navigate({ to: '/' })} />}
          badge={practice ? 'Practice' : 'vs Bot'}
        />
      </div>

      <main
        className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-3 py-5"
        style={{ animationDelay: '0.12s' }}
      >
        <Board
          game={game}
          onPlay={play}
          disabled={thinking || game.currentPlayer === O}
          finishTone={finished ? outcome : null}
          hints={hints}
        />

        <ThinkingIndicator thinking={thinking} />

        {practice && lastSearch ? (
          <p className="tnum text-center text-xs text-ink-faint">
            Last search: depth {lastSearch.depth}, {lastSearch.nodes.toLocaleString()} positions
            {lastSearch.reason === 'search' ? '' : ` · ${lastSearch.reason}`}
          </p>
        ) : null}
      </main>

      <footer
        className="flex animate-rise flex-col items-center gap-3 pb-4"
        style={{ animationDelay: '0.22s' }}
      >
        <Segmented<BotDifficulty>
          label="Bot difficulty"
          value={difficulty}
          onChange={(next) => goTo({ difficulty: next })}
          size="small"
          className="w-full max-w-board"
          options={BOT_DIFFICULTIES.map((value) => ({
            value,
            label: DIFFICULTY_LABELS[value].slice(0, 3),
            title: DIFFICULTY_LABELS[value],
          }))}
        />

        <GameControls
          onRestart={restart}
          restartLabel="New game"
          onUndo={practice ? takeBack : undefined}
          canUndo={canUndo && !thinking}
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
          art={outcomeFace(outcome)}
          note={`${DIFFICULTY_LABELS[difficulty]} bot · ${modeById(mode).name}`}
          celebrate={outcome === 'win'}
          revealDelay={revealDelayFor(game)}
          actions={
            <>
              <Button variant="primary" size="small" block onClick={restart}>
                Play again
              </Button>
              {outcome !== 'win' ? (
                <Button
                  size="small"
                  variant="ghost"
                  block
                  onClick={() => goTo({ difficulty: easier(difficulty) })}
                >
                  Try an easier bot
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="ghost"
                  block
                  onClick={() => goTo({ difficulty: harder(difficulty) })}
                >
                  Try a harder bot
                </Button>
              )}
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

function easier(difficulty: BotDifficulty): BotDifficulty {
  const index = BOT_DIFFICULTIES.indexOf(difficulty);
  return BOT_DIFFICULTIES[Math.max(0, index - 1)] ?? difficulty;
}

function harder(difficulty: BotDifficulty): BotDifficulty {
  const index = BOT_DIFFICULTIES.indexOf(difficulty);
  return BOT_DIFFICULTIES[Math.min(BOT_DIFFICULTIES.length - 1, index + 1)] ?? difficulty;
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
        'flex h-5 items-center gap-1.5 text-sm text-ink-muted',
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
            className={cx('size-1 rounded-full bg-ink-muted', thinking && 'animate-dot')}
            style={{ animationDelay: `${dot * 0.16}s` }}
          />
        ))}
      </span>
    </p>
  );
}
