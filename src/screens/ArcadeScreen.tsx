import {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  GAME_MODES,
  isModeId,
  modeById,
  type ModeId,
} from '@/game/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useId, useMemo, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { CheckIcon } from '@/components/art/icons';
import { ClockIcon, SparkIcon, TargetIcon, TrophyIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented, Toggle } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { useDifficultyLabels } from '@/game/bot/labels';
import { dailyChallenge } from '@/features/arcade/daily';
import { GAUNTLET_LIVES, gauntletOpponent, useGauntletStore } from '@/features/arcade/gauntlet';
import { maxHandicapFor } from '@/features/arcade/handicap';
import { Hearts, LevelStrip, PageHeader } from '@/features/arcade/ui';
import { dayNumber, liveChallengeStreak, useProgressStore } from '@/features/progress/store';
import { floorReached, useRunStore } from '@/features/run/store';
import { formatNumber, useLocale, useT } from '@/i18n';
import { arcadeMessages } from '@/i18n/messages/arcade';
import { useModeTexts } from '@/i18n/messages/modes';
import { cx } from '@/lib/cx';
import { loadPreferences, savePreferences } from '@/lib/preferences';

const cardLink = cx(
  'group flex w-full items-center gap-3 rounded-2xl border border-stroke-soft bg-surface/80 px-3 py-3 text-start no-underline',
  'transition-[transform,border-color,box-shadow] duration-200 ease-spring',
  'hover:-translate-y-0.5 hover:border-stroke hover:shadow-[0_12px_26px_-16px_var(--color-shadow)]',
  'active:scale-[0.98]',
);

/**
 * The arcade: the solo modes that are more than a single game.
 *
 * Each card says where you stand in it at a glance - today's challenge played
 * or not, a gauntlet or a run under way - so the hub doubles as a dashboard.
 * Everything here works offline.
 */
export function ArcadeScreen() {
  const t = useT(arcadeMessages);
  return (
    <Screen scroll>
      <PageHeader title={t('arcade')} />
      <div className="flex w-full flex-col gap-3 pb-6">
        <LevelStrip />
        <DailyCard />
        <GauntletCard />
        <RunCard />
        <BlitzCard />
      </div>
    </Screen>
  );
}

function CardIcon({ children, tone }: { children: ReactNode; tone?: 'ok' | 'warn' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex size-11 shrink-0 items-center justify-center rounded-full text-2xl max-[359px]:size-9',
        tone === 'ok' ? 'bg-ok/15 text-ok' : tone === 'warn' ? 'bg-warn/15 text-warn' : 'bg-sunken',
      )}
    >
      {children}
    </span>
  );
}

function DailyCard() {
  const [day] = useState(() => dayNumber());
  const challenge = useMemo(() => dailyChallenge(day), [day]);
  const record = useProgressStore((state) => state.challenge);
  const played = record.last?.day === day ? record.last : null;
  const streak = liveChallengeStreak(record);
  const t = useT(arcadeMessages);
  const labels = useDifficultyLabels();
  const modeText = useModeTexts();

  return (
    <Link to="/arcade/daily" className={cardLink}>
      <CardIcon tone={played ? 'ok' : 'warn'}>
        {played ? <CheckIcon className="size-5" /> : <TargetIcon />}
      </CardIcon>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">
          {t('dailyTitle', { number: challenge.number })}
        </span>
        <span className="truncate text-xs text-ink-muted">
          {modeText(challenge.mode).name} · {labels.label(challenge.difficulty)} ·{' '}
          {challenge.modifiers.map((entry) => entry.name).join(', ')}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
          <SparkIcon className={cx('size-3.5', streak > 0 ? 'text-warn' : '')} />
          {played
            ? t('dailyPlayed', { score: played.score })
            : streak > 0
              ? t('streakDays', { count: streak })
              : t('startStreak')}
        </span>
      </span>
    </Link>
  );
}

function GauntletCard() {
  const gauntlet = useGauntletStore();
  const best = useProgressStore((state) => state.gauntlet.best);
  const next =
    gauntlet.seed === null
      ? null
      : gauntletOpponent(gauntlet.seed, gauntlet.beaten, gauntlet.played);
  const t = useT(arcadeMessages);
  const modeText = useModeTexts();
  return (
    <Link to="/arcade/gauntlet" className={cardLink}>
      {next ? (
        <AvatarBadge
          avatar={next.rival.avatar}
          ring="var(--color-sunken)"
          className="size-11 shrink-0 max-[359px]:size-9"
        />
      ) : (
        <CardIcon>
          <TrophyIcon />
        </CardIcon>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{t('gauntlet')}</span>
        <span className="truncate text-xs text-ink-muted">
          {next
            ? t('gauntletNext', { name: next.rival.name, mode: modeText(next.mode).name })
            : t('gauntletBlurb')}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
          {next ? (
            <>
              <Hearts count={gauntlet.lives} max={GAUNTLET_LIVES} label={t('lives')} />
              <span className="tnum">{t('beaten', { count: gauntlet.beaten })}</span>
            </>
          ) : (
            <span className="tnum">{t('best', { count: best })}</span>
          )}
        </span>
      </span>
    </Link>
  );
}

function RunCard() {
  const run = useRunStore((state) => state.run);
  const records = useProgressStore((state) => state.run);
  const active = run && run.phase !== 'won' && run.phase !== 'lost' ? run : null;
  const t = useT(arcadeMessages);
  return (
    <Link to="/arcade/run" className={cardLink}>
      <CardIcon>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6">
          <path
            d="M5 20c2-4 4-5 7-5s5-3 5-6M17 9l-3-1M17 9l1-3M5 20h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="17" cy="5" r="2" fill="currentColor" />
        </svg>
      </CardIcon>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{t('run')}</span>
        <span className="truncate text-xs text-ink-muted">
          {active
            ? t('runInProgress', { floor: Math.max(1, floorReached(active)) })
            : t('runBlurb')}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
          {active ? (
            <Hearts count={active.hearts} max={active.maxHearts} />
          ) : (
            <span className="tnum">
              {t('runRecord', { won: records.won, floor: records.bestFloor })}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

/**
 * Blitz and handicap: a single bot game with the clock on, a head start
 * either way, or both. It starts the ordinary bot screen with those set, so
 * everything about a bot game - records, streaks, XP - carries over.
 */
function BlitzCard() {
  const navigate = useNavigate();
  const selectId = useId();
  const [mode, setMode] = useState<ModeId>(() => loadPreferences().mode);
  const [difficulty, setDifficulty] = useState<BotDifficulty>(() => loadPreferences().difficulty);
  const [blitz, setBlitz] = useState(true);
  const [handicap, setHandicap] = useState(0);
  const limit = maxHandicapFor(modeById(mode).config);
  const shown = Math.max(-limit, Math.min(limit, handicap));
  const handicaps = Array.from({ length: limit * 2 + 1 }, (_, at) => at - limit);
  const t = useT(arcadeMessages);
  const labels = useDifficultyLabels();
  const modeText = useModeTexts();
  const locale = useLocale();

  return (
    <Card className="w-full" padding="tight">
      <div className="flex items-center gap-3 px-1 pt-1">
        <CardIcon>
          <ClockIcon />
        </CardIcon>
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{t('blitzTitle')}</span>
          <span className="text-xs text-ink-muted">{t('blitzBlurb')}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-3 px-1 pb-1">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="px-1 text-sm text-ink-muted">
            {t('mode')}
          </label>
          <select
            id={selectId}
            value={mode}
            onChange={(event) => {
              if (isModeId(event.target.value)) setMode(event.target.value);
            }}
            className="h-11 w-full rounded-tile border border-stroke bg-surface/60 px-3 text-base text-ink"
          >
            {GAME_MODES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {modeText(entry.id).name}
              </option>
            ))}
          </select>
        </div>
        <Segmented<BotDifficulty>
          label={t('botDifficulty')}
          value={difficulty}
          onChange={setDifficulty}
          size="small"
          options={BOT_DIFFICULTIES.map((value) => ({
            value,
            label: labels.short(value),
            title: labels.label(value),
          }))}
        />
        <Toggle
          label={t('clock')}
          description={t('clockDescription')}
          checked={blitz}
          onChange={setBlitz}
        />
        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm text-ink-muted" id={`${selectId}-handicap`}>
            {t('headStart')}{' '}
            <span className="text-xs text-ink-faint">
              {shown > 0
                ? t('handicapYou', { count: shown })
                : shown < 0
                  ? t('handicapBot', { count: -shown })
                  : t('handicapNone')}
            </span>
          </span>
          <Segmented<string>
            label={t('handicapLabel')}
            value={String(shown)}
            onChange={(value) => setHandicap(Number(value))}
            size="small"
            options={handicaps.map((value) => ({
              value: String(value),
              label:
                value > 0
                  ? `+${formatNumber(value, locale)}`
                  : value < 0
                    ? `−${formatNumber(-value, locale)}`
                    : formatNumber(0, locale),
              title:
                value > 0
                  ? t('handicapYouTitle', { count: value })
                  : value < 0
                    ? t('handicapBotTitle', { count: -value })
                    : t('noHeadStart'),
            }))}
          />
        </div>
        <Button
          variant="primary"
          block
          onClick={() => {
            savePreferences({ mode, difficulty });
            void navigate({
              to: '/play/bot',
              search: {
                mode,
                difficulty,
                ...(blitz ? { blitz: true as const } : {}),
                ...(shown !== 0 ? { handicap: shown } : {}),
              },
            });
          }}
        >
          {blitz ? t('startBlitz') : t('startGame')}
        </Button>
      </div>
    </Card>
  );
}
