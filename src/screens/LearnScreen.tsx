import { ReturnLink } from '@/components/ui/ReturnLink';
import { GAME_MODES, modeById, type ModeId } from '@/game/engine';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BackIcon, BotIcon } from '@/components/art/icons';
import { BulbIcon, TargetIcon, TrophyIcon } from '@/components/art/ui-icons';
import { MiniBoard } from '@/game/components/MiniBoard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Tabs } from '@/components/ui/Tabs';
import { RIVALS, STAGES } from '@/features/journey/stages';
import { LessonsCard } from '@/features/lessons/LessonsCard';
import { formatNumber, type Locale, useLocale, useT } from '@/i18n';
import { learnMessages } from '@/i18n/messages/learn';
import { useModeTexts } from '@/i18n/messages/modes';
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
  const selected = mode;
  const [tutorial, setTutorial] = useState(false);
  const detail = modeById(selected);
  const t = useT(learnMessages);
  const locale = useLocale();
  const modeText = useModeTexts();
  const text = modeText(selected);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={ReturnLink} to="/" tone="bare" size="small" label={t('backHome')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <h1 className="font-display text-xl">{t('howToPlay')}</h1>
      </header>

      <div className="flex w-full flex-col gap-4 pb-6">
        <Card className="w-full">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-2xl text-ok">
              <BulbIcon />
            </span>
            <div className="flex flex-1 flex-col gap-2">
              <h2 className="text-base font-semibold">{t('walkthroughTitle')}</h2>
              <p className="text-sm text-ink-muted">{t('walkthroughBody')}</p>
              <Button
                size="small"
                variant="primary"
                className="mt-1 w-auto self-start px-5 whitespace-nowrap"
                onClick={() => setTutorial(true)}
              >
                {t('startWalkthrough')}
              </Button>
            </div>
          </div>
        </Card>

        <Tabs
          label={t('mode')}
          value={selected}
          onChange={(next) =>
            void navigate({
              to: '/learn',
              search: { mode: next },
              replace: true,
              viewTransition: false,
              resetScroll: false,
            })
          }
          options={GAME_MODES.map((entry) => ({ value: entry.id, label: modeText(entry.id).name }))}
        />

        <Card className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div dir="ltr" className="mx-auto w-40 shrink-0 sm:mx-0">
              <MiniBoard config={detail.config} active />
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <div>
                <h2 className="font-display text-xl">{text.name}</h2>
                <p className="text-sm text-ink-muted">{text.tagline}</p>
              </div>

              <ol className="flex list-decimal flex-col gap-1.5 ps-4 text-sm text-ink-muted">
                {text.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-ink-faint">{t('board')}</dt>
                <dd>
                  {/* Qubic's cube is stored as an 8x8 board, but it is played
                      as four layers of four. */}
                  {detail.config.variant === 'qubic'
                    ? t('cubeSize', { size: 4 })
                    : t('boardSize', { size: detail.config.size })}
                </dd>
                <dt className="text-ink-faint">{t('inARow')}</dt>
                <dd>{formatNumber(detail.config.winLength, locale)}</dd>
                <dt className="text-ink-faint">{t('clock')}</dt>
                <dd>
                  {t('clockValue', {
                    time: clockLength(detail.clock.initialSeconds, locale, t),
                    count: detail.clock.incrementSeconds,
                  })}
                </dd>
                <dt className="text-ink-faint">{t('ranked')}</dt>
                <dd>{detail.ranked ? t('rankedYes') : t('rankedNo')}</dd>
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
              {t('practiceHints')}
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
              {t('playBot')}
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
                {t('playRanked')}
              </Button>
            ) : null}
          </div>
        </Card>

        <LessonsCard mode={selected} />

        <Card className="w-full" padding="tight">
          <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">
            {t('goodToKnow')}
          </h2>
          <ul className="flex flex-col gap-2 px-2 pt-1 pb-2 text-sm text-ink-muted">
            {TIPS.map((tip) => (
              <li key={tip}>
                <strong className="text-ink">{t(`tip.${tip}.title`)}</strong>{' '}
                {t(`tip.${tip}.body`, {
                  count: SEAT_HELD_SECONDS,
                  rivals: RIVALS.length,
                  stages: STAGES.length,
                })}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {tutorial ? <OnboardingSheet mode={selected} onClose={() => setTutorial(false)} /> : null}
    </Screen>
  );
}

/** The good-to-know notes, in the order they are listed. */
const TIPS = [
  'ranked',
  'clocks',
  'disconnect',
  'practice',
  'journey',
  'puzzles',
  'pieces',
] as const;

/** How long the server holds a dropped player's seat, as the notes describe it. */
const SEAT_HELD_SECONDS = 45;

/** "3 min", or "2:30" for a clock that is not a whole number of minutes. */
function clockLength(
  seconds: number,
  locale: Locale,
  t: (key: 'clockMinutes', values: { count: number }) => string,
): string {
  const rest = seconds % 60;
  if (rest === 0) return t('clockMinutes', { count: seconds / 60 });
  const padded = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 }).format(rest);
  return `${formatNumber(Math.floor(seconds / 60), locale)}:${padded}`;
}
