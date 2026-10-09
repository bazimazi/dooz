import { GAME_MODES, modeById, type ModeId } from '@/game/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BackIcon, BotIcon } from '@/components/art/icons';
import { BulbIcon, TargetIcon, TrophyIcon } from '@/components/art/ui-icons';
import { MiniBoard } from '@/game/components/MiniBoard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Tabs } from '@/components/ui/Tabs';
import { OnboardingSheet } from './OnboardingSheet';

/**
 * How to play, per mode.
 *
 * The rules come from the mode definitions rather than being written out here,
 * so a new variant arrives with its own explanation and there is no second
 * place for the rules to be wrong. The interactive tutorial sits at the top
 * because the fastest way to learn this game is to play three moves of it.
 */
export function LearnScreen({ mode }: { mode: ModeId }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ModeId>(mode);
  const [tutorial, setTutorial] = useState(false);
  const detail = modeById(selected);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={Link} to="/" tone="bare" size="small" label="Back to home">
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-xl">How to play</h1>
      </header>

      <div className="flex w-full flex-col gap-4 pb-6">
        <Card className="w-full">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-2xl text-ok">
              <BulbIcon />
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <h2 className="text-base font-semibold">Three moves, thirty seconds</h2>
              <p className="text-sm text-ink-muted">
                Place a mark, win a game and block an opponent — on a real board, not a diagram.
              </p>
              <Button
                size="small"
                variant="primary"
                className="mt-1 w-auto self-start px-5"
                onClick={() => setTutorial(true)}
              >
                Start the walkthrough
              </Button>
            </div>
          </div>
        </Card>

        <Tabs
          label="Mode"
          value={selected}
          onChange={setSelected}
          options={GAME_MODES.map((entry) => ({ value: entry.id, label: entry.name }))}
        />

        <Card className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="mx-auto w-40 shrink-0 sm:mx-0">
              <MiniBoard config={detail.config} active />
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <div>
                <h2 className="font-display text-xl">{detail.name}</h2>
                <p className="text-sm text-ink-muted">{detail.tagline}</p>
              </div>

              <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm text-ink-muted">
                {detail.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-ink-faint">Board</dt>
                <dd>
                  {detail.config.size} × {detail.config.size}
                </dd>
                <dt className="text-ink-faint">In a row</dt>
                <dd>{detail.config.winLength}</dd>
                <dt className="text-ink-faint">Clock</dt>
                <dd>
                  {Math.round(detail.clock.initialSeconds / 60)} min +{' '}
                  {detail.clock.incrementSeconds}s
                </dd>
                <dt className="text-ink-faint">Ranked</dt>
                <dd>{detail.ranked ? 'Yes' : 'Casual only'}</dd>
              </dl>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-stroke-soft pt-4">
            <Button
              size="small"
              className="w-auto px-4"
              icon={<TargetIcon />}
              onClick={() =>
                void navigate({
                  to: '/play/bot',
                  search: { mode: selected, difficulty: 'beginner', practice: true },
                })
              }
            >
              Practice with hints
            </Button>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-4"
              icon={<BotIcon />}
              onClick={() =>
                void navigate({
                  to: '/play/bot',
                  search: { mode: selected, difficulty: 'medium' },
                })
              }
            >
              Play the bot
            </Button>
            {detail.ranked ? (
              <Button
                size="small"
                variant="ghost"
                className="w-auto px-4"
                icon={<TrophyIcon />}
                onClick={() =>
                  void navigate({ to: '/play/online', search: { mode: selected, ranked: true } })
                }
              >
                Play ranked
              </Button>
            ) : null}
          </div>
        </Card>

        <Card className="w-full" padding="tight">
          <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">Good to know</h2>
          <ul className="flex flex-col gap-2 px-2 pt-1 pb-2 text-sm text-ink-muted">
            <li>
              <strong className="text-ink">Ranked vs casual.</strong> Only ranked games move your
              rating. Leaving one early counts as a resignation.
            </li>
            <li>
              <strong className="text-ink">Clocks.</strong> Every online game is timed, with a few
              seconds added after each move. Running out loses the game.
            </li>
            <li>
              <strong className="text-ink">Disconnections.</strong> Your seat is held for 45 seconds
              and your clock keeps running. Come back and you carry on where you were.
            </li>
            <li>
              <strong className="text-ink">Practice mode.</strong> Hints ring the square that wins
              and the one you must block, you can take moves back, and the target button asks the
              engine what it would play.
            </li>
            <li>
              <strong className="text-ink">Journey.</strong> Six rivals, eighteen stages, every
              mode. You always move first; win in fewer moves for more stars.
            </li>
            <li>
              <strong className="text-ink">Puzzles.</strong> Every one is a proven forced win. A new
              daily puzzle arrives each day — solve them on consecutive days to build a streak.
            </li>
            <li>
              <strong className="text-ink">Pieces.</strong> Win against the bot, solve puzzles and
              earn journey stars to unlock new piece sets in Settings.
            </li>
          </ul>
        </Card>
      </div>

      {tutorial ? <OnboardingSheet mode={selected} onClose={() => setTutorial(false)} /> : null}
    </Screen>
  );
}
