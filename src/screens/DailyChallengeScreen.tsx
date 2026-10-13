import { useCallback, useMemo, useState } from 'react';
import { CheckIcon, ShareIcon } from '@/components/art/icons';
import { SparkIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Card, StatTile } from '@/components/ui/Card';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { Screen } from '@/components/ui/Screen';
import { MiniBoard } from '@/game/components/MiniBoard';
import { outcomeFace } from '@/game/components/ResultModal';
import { useDifficultyLabels } from '@/game/bot/labels';
import { ArcadeMatch, type MatchResult, type MatchSpec } from '@/features/arcade/ArcadeMatch';
import {
  type ChallengeScore,
  challengeXp,
  type DailyChallenge,
  dailyChallenge,
  scoreChallenge,
  shareText,
} from '@/features/arcade/daily';
import { Chip, PageHeader } from '@/features/arcade/ui';
import { RewardsPanel } from '@/features/progress/RewardsPanel';
import {
  type Award,
  dayNumber,
  liveChallengeStreak,
  useProgressStore,
} from '@/features/progress/store';
import { formatClock } from '@/game/components/MatchClock';
import { formatNumber, useLocale, useT } from '@/i18n';
import { dailyChallengeMessages } from '@/i18n/messages/dailyChallenge';
import { useModeText, useModeTexts } from '@/i18n/messages/modes';
import { shareOrCopy } from '@/lib/invite';

/**
 * Today's challenge: what it is, how it scores, and - once played - how it
 * went, with a line to share.
 *
 * The first game finished today is the official one. Playing again afterwards
 * is allowed and scored for interest, but marked as practice and never
 * recorded, so a score cannot be farmed by retrying until the bot slips.
 */
export function DailyChallengeScreen() {
  // Fixed for the visit: a challenge left open over midnight stays the one
  // that was started, and records under its own day.
  const [day] = useState(() => dayNumber());
  const challenge = useMemo(() => dailyChallenge(day), [day]);
  const record = useProgressStore((state) => state.challenge);
  const official = record.last?.day === day ? record.last : null;
  const [playing, setPlaying] = useState(false);
  const t = useT(dailyChallengeMessages);
  const labels = useDifficultyLabels();
  const modeText = useModeTexts();
  const locale = useLocale();

  if (playing) {
    return (
      <ChallengeMatch
        challenge={challenge}
        practice={official !== null}
        onLeave={() => setPlaying(false)}
      />
    );
  }

  const mode = modeText(challenge.mode);
  const streak = liveChallengeStreak(record);
  const resumable = hasSavedGame(`challenge:${day}`);

  return (
    <Screen scroll>
      <PageHeader title={t('title', { number: challenge.number })} back="/arcade" />
      <div className="flex w-full flex-col gap-4 pb-6">
        <Card className="w-full">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="w-20 shrink-0 max-[359px]:w-16">
              <MiniBoard config={challenge.config} className="w-full" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-ink-faint">{t('today')}</span>
              <span className="font-display text-xl">{mode.name}</span>
              <span className="text-sm text-ink-muted">
                {t('versus', { bot: labels.bot(challenge.difficulty), par: challenge.par })}
              </span>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-2" aria-label={t('twists')}>
            {challenge.modifiers.map((modifier) => (
              <li key={modifier.id} className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Chip>{modifier.name}</Chip>
                  <span className="tnum text-xs text-ink-faint">
                    ×{formatNumber(modifier.multiplier, locale)}
                  </span>
                </span>
                <span className="px-1 text-xs text-ink-muted">
                  {modifier.description}
                  {modifier.id === 'clock' && challenge.clock
                    ? ` ${t('clockNote', { time: formatClock(challenge.clock.initialMs) })}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-faint">{t('rules')}</p>
        </Card>

        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            label={t('streak')}
            value={formatNumber(streak, locale)}
            hint={t('bestStreak', { count: record.best })}
          />
          <StatTile label={t('bestScore')} value={formatNumber(record.bestScore, locale)} />
        </div>

        {official ? (
          <OfficialResult
            challenge={challenge}
            modeName={mode.name}
            result={official}
            streak={streak}
          />
        ) : null}

        <Button variant="primary" block onClick={() => setPlaying(true)}>
          {official ? t('practiceAgain') : resumable ? t('continue') : t('start')}
        </Button>
        <Button as={ReturnLink} to="/arcade" variant="ghost" size="small" block>
          {t('arcade')}
        </Button>
      </div>
    </Screen>
  );
}

function hasSavedGame(storageKey: string): boolean {
  try {
    return localStorage.getItem(`dooz.game:${storageKey}`) !== null;
  } catch {
    return false;
  }
}

function OfficialResult({
  challenge,
  modeName,
  result,
  streak,
}: {
  challenge: DailyChallenge;
  modeName: string;
  result: { score: number; outcome: 'win' | 'loss' | 'draw'; moves: number };
  streak: number;
}) {
  const stars =
    result.outcome === 'loss'
      ? 0
      : result.outcome === 'draw'
        ? 1
        : result.moves <= challenge.par
          ? 3
          : 2;
  const t = useT(dailyChallengeMessages);
  return (
    <Card className="w-full" padding="tight">
      <div className="flex items-center justify-between gap-3 px-2 py-1">
        <span className="flex flex-col">
          <span className="text-xs tracking-wide text-ink-faint uppercase">
            {t('todaysResult')}
          </span>
          <span className="tnum font-display text-2xl">{t('points', { score: result.score })}</span>
          <span className="text-xs text-ink-muted">
            {t(result.outcome === 'win' ? 'won' : result.outcome === 'draw' ? 'drew' : 'lost')} ·{' '}
            {'★'.repeat(stars)}
            {'☆'.repeat(3 - stars)}
          </span>
        </span>
        <ShareButton text={shareText(challenge, modeName, { ...result, stars }, streak)} />
      </div>
      <p className="px-2 pt-1 text-xs text-ink-faint">{t('nextChallenge')}</p>
    </Card>
  );
}

function ShareButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const done = state === 'shared' || state === 'copied';
  const t = useT(dailyChallengeMessages);
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button
        size="small"
        className="w-auto px-4"
        icon={done ? <CheckIcon /> : <ShareIcon />}
        onClick={async () => setState(await shareOrCopy(text, t('shareTitle')))}
      >
        {state === 'copied' ? t('copied') : state === 'shared' ? t('shared') : t('share')}
      </Button>
      <span role="status" className="text-[0.6875rem] text-ink-faint">
        {state === 'failed' ? t('shareFailed') : ''}
      </span>
    </span>
  );
}

function ChallengeMatch({
  challenge,
  practice,
  onLeave,
}: {
  challenge: DailyChallenge;
  practice: boolean;
  onLeave: () => void;
}) {
  const recordChallenge = useProgressStore((state) => state.recordChallenge);
  const streak = useProgressStore((state) => liveChallengeStreak(state.challenge));
  // Practice reopens the challenge with a fresh position each time.
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<{
    score: ChallengeScore;
    award: Award | null;
    official: boolean;
  } | null>(null);
  const t = useT(dailyChallengeMessages);
  const mode = useModeText(challenge.mode);

  const spec = useMemo<MatchSpec>(
    () => ({
      config: challenge.config,
      difficulty: challenge.difficulty,
      ...(challenge.setup ? { setup: challenge.setup } : { opener: challenge.opener }),
      ...(challenge.clock ? { clock: challenge.clock } : {}),
      par: challenge.par,
      storageKey: practice
        ? `challenge-practice:${challenge.day}:${attempt}`
        : `challenge:${challenge.day}`,
      badge: practice ? t('badgePractice') : t('badgeDaily'),
    }),
    [challenge, practice, attempt, t],
  );

  const finish = useCallback(
    (result: MatchResult) => {
      const score = scoreChallenge(challenge, result);
      // Only the first game finished today is recorded; the store ignores a
      // second result for a day it already has.
      const award = practice
        ? null
        : recordChallenge({
            day: challenge.day,
            mode: challenge.mode,
            outcome: result.outcome,
            score: score.total,
            moves: result.moves,
            lines: challengeXp(score),
          });
      setOutcome({ score, award, official: award !== null });
    },
    [challenge, practice, recordChallenge],
  );

  return (
    <ArcadeMatch
      key={spec.storageKey}
      spec={spec}
      onFinish={finish}
      restartable={practice}
      leave={
        <Button size="small" variant="ghost" className="w-auto px-4" onClick={onLeave}>
          {t('leave')}
        </Button>
      }
      footer={
        <div className="flex flex-wrap justify-center gap-1.5">
          {challenge.modifiers.map((modifier) => (
            <Chip key={modifier.id} title={modifier.description}>
              {modifier.name}
            </Chip>
          ))}
        </div>
      }
      result={(result) => ({
        title:
          result.outcome === 'win'
            ? t('challengeWon')
            : result.outcome === 'draw'
              ? t('aDraw')
              : result.flagged
                ? t('outOfTime')
                : t('challengeLost'),
        art: outcomeFace(result.outcome),
        note: outcome?.official
          ? t('scoreNote', { score: outcome.score.total })
          : t('practiceNote', { score: outcome?.score.total ?? 0 }),
        detail: outcome ? (
          <ScoreLines score={outcome.score} streak={outcome.official ? streak : 0} />
        ) : null,
        rewards: outcome?.award ? (
          <RewardsPanel award={outcome.award} won={result.outcome === 'win'} />
        ) : null,
        actions: (
          <>
            {outcome?.official ? (
              <ShareButton
                text={shareText(
                  challenge,
                  mode.name,
                  {
                    outcome: result.outcome,
                    score: outcome.score.total,
                    stars: outcome.score.stars,
                  },
                  streak,
                )}
              />
            ) : null}
            <Button
              variant="primary"
              size="small"
              block
              onClick={() => {
                setOutcome(null);
                setAttempt((count) => count + 1);
                if (!practice) onLeave();
              }}
            >
              {practice ? t('practiceAgain') : t('done')}
            </Button>
            <Button as={ReturnLink} to="/arcade" variant="ghost" size="small" block>
              {t('arcade')}
            </Button>
          </>
        ),
      })}
    />
  );
}

function ScoreLines({ score, streak }: { score: ChallengeScore; streak: number }) {
  const t = useT(dailyChallengeMessages);
  const locale = useLocale();
  if (score.lines.length === 0) {
    return <p className="text-center text-xs text-ink-faint">{t('noPoints')}</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-0.5 text-xs text-ink-muted">
        {score.lines.map((line) => (
          <li key={line.label} className="flex justify-between gap-2">
            <span>{line.label}</span>
            <span className="tnum">{formatNumber(line.points, locale)}</span>
          </li>
        ))}
      </ul>
      {streak > 1 ? (
        <p className="flex items-center justify-center gap-1 text-sm font-semibold text-warn">
          <SparkIcon className="size-4" /> {t('streakDays', { count: streak })}
        </p>
      ) : null}
    </div>
  );
}
