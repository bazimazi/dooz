import { modeById } from '@/game/engine';
import { useCallback, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { Button } from '@/components/ui/Button';
import { Card, StatTile } from '@/components/ui/Card';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { Screen } from '@/components/ui/Screen';
import { outcomeFace } from '@/game/components/ResultModal';
import { useDifficultyLabels } from '@/game/bot/labels';
import { ArcadeMatch, type MatchResult, type MatchSpec } from '@/features/arcade/ArcadeMatch';
import {
  GAUNTLET_LIVES,
  type GauntletOpponent,
  gauntletOpponent,
  useGauntletStore,
} from '@/features/arcade/gauntlet';
import { Hearts, PageHeader } from '@/features/arcade/ui';
import { RewardsPanel } from '@/features/progress/RewardsPanel';
import { type Award, useProgressStore } from '@/features/progress/store';
import { botGameXp } from '@/features/progress/xp';
import { formatNumber, translate, useLocale, useT } from '@/i18n';
import { arcadeMessages } from '@/i18n/messages/arcade';
import { useModeTexts } from '@/i18n/messages/modes';

interface Match {
  spec: MatchSpec;
  opponent: GauntletOpponent;
}

/** The match for the gauntlet as it stands, frozen so a report cannot swap it mid-panel. */
function matchFor(seed: number, beaten: number, played: number): Match {
  const opponent = gauntletOpponent(seed, beaten, played);
  return {
    opponent,
    spec: {
      config: modeById(opponent.mode).config,
      difficulty: opponent.difficulty,
      storageKey: `gauntlet:${seed}:${played}`,
      rival: { name: opponent.rival.name, avatar: opponent.rival.avatar },
      badge: translate(arcadeMessages, 'gauntletBadge', { number: opponent.number }),
    },
  };
}

/**
 * The gauntlet: how far you got, who is next, and the fight itself.
 */
export function GauntletScreen() {
  const gauntlet = useGauntletStore();
  const best = useProgressStore((state) => state.gauntlet.best);
  const runs = useProgressStore((state) => state.gauntlet.runs);
  const recordArcadeGame = useProgressStore((state) => state.recordArcadeGame);
  const recordGauntletEnd = useProgressStore((state) => state.recordGauntletEnd);
  const [match, setMatch] = useState<Match | null>(null);
  const [last, setLast] = useState<{
    award: Award;
    over: boolean;
    beaten: number;
    end: Award | null;
  } | null>(null);
  const [summary, setSummary] = useState<{ beaten: number; award: Award } | null>(null);
  const t = useT(arcadeMessages);
  const labels = useDifficultyLabels();
  const modeText = useModeTexts();
  const locale = useLocale();

  const finish = useCallback(
    (result: MatchResult) => {
      if (!match) return;
      const award = recordArcadeGame({
        mode: match.opponent.mode,
        outcome: result.outcome,
        lines: botGameXp(match.opponent.difficulty, result.outcome),
      });
      const beaten = useGauntletStore.getState().beaten + (result.outcome === 'win' ? 1 : 0);
      const over = useGauntletStore.getState().report(result.outcome);
      const end = over ? recordGauntletEnd(beaten) : null;
      setLast({ award, over, beaten, end });
    },
    [match, recordArcadeGame, recordGauntletEnd],
  );

  if (match) {
    return (
      <ArcadeMatch
        key={match.spec.storageKey}
        spec={match.spec}
        onFinish={finish}
        status={
          <span className="flex items-center gap-3 text-xs text-ink-muted">
            <Hearts
              count={gauntlet.seed === null ? 0 : gauntlet.lives}
              max={GAUNTLET_LIVES}
              label={t('lives')}
            />
            <span className="tnum">{t('beaten', { count: gauntlet.beaten })}</span>
          </span>
        }
        leave={
          <Button
            size="small"
            variant="ghost"
            className="w-auto px-4"
            onClick={() => setMatch(null)}
          >
            {t('pause')}
          </Button>
        }
        result={(result) => ({
          title:
            result.outcome === 'win'
              ? t('rivalBeaten', { name: match.opponent.rival.name })
              : result.outcome === 'draw'
                ? t('aDraw')
                : last?.over
                  ? t('gauntletOver')
                  : t('lifeLost'),
          art: outcomeFace(result.outcome),
          note: last?.over
            ? t('noteOver', { count: last.beaten })
            : result.outcome === 'win'
              ? t('noteWin')
              : result.outcome === 'draw'
                ? t('noteDraw')
                : t('noteLoss'),
          rewards: last ? (
            <div className="flex flex-col gap-2">
              <RewardsPanel award={last.award} won={result.outcome === 'win'} />
              {last.end && last.end.xp > 0 ? <RewardsPanel award={last.end} /> : null}
            </div>
          ) : null,
          actions: last?.over ? (
            <Button
              variant="primary"
              size="small"
              block
              onClick={() => {
                setSummary({ beaten: last.beaten, award: last.end ?? last.award });
                setLast(null);
                setMatch(null);
              }}
            >
              {t('seeSummary')}
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                size="small"
                block
                onClick={() => {
                  const { seed, beaten, played } = useGauntletStore.getState();
                  setLast(null);
                  setMatch(seed === null ? null : matchFor(seed, beaten, played));
                }}
              >
                {t('nextOpponent')}
              </Button>
              <Button
                variant="ghost"
                size="small"
                block
                onClick={() => {
                  setLast(null);
                  setMatch(null);
                }}
              >
                {t('takeBreak')}
              </Button>
            </>
          ),
        })}
      />
    );
  }

  const next =
    gauntlet.seed === null
      ? null
      : gauntletOpponent(gauntlet.seed, gauntlet.beaten, gauntlet.played);

  return (
    <Screen scroll>
      <PageHeader title={t('gauntlet')} back="/arcade" />
      <div className="flex w-full flex-col gap-4 pb-6">
        {summary ? (
          <Card className="w-full">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs tracking-wide text-ink-faint uppercase">{t('gauntletOver')}</p>
              <p className="tnum font-display text-4xl">{formatNumber(summary.beaten, locale)}</p>
              <p className="text-sm text-ink-muted">
                {t('summaryBeaten', { count: summary.beaten })}
                {summary.beaten >= best && summary.beaten > 0 ? ` · ${t('newBest')}` : ''}
              </p>
            </div>
          </Card>
        ) : null}

        {next ? (
          <Card className="w-full">
            <div className="flex items-center justify-between gap-3">
              <Hearts count={gauntlet.lives} max={GAUNTLET_LIVES} label={t('lives')} />
              <span className="tnum text-sm text-ink-muted">
                {t('beaten', { count: gauntlet.beaten })}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <AvatarBadge
                avatar={next.rival.avatar}
                ring="var(--color-sunken)"
                className="size-14 shrink-0"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-xs text-ink-faint">
                  {t('opponentNumber', { number: next.number })}
                </span>
                <span className="truncate font-display text-xl">{next.rival.name}</span>
                <span className="text-sm text-ink-muted">
                  {labels.label(next.difficulty)} · {modeText(next.mode).name}
                </span>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                variant="primary"
                block
                onClick={() => {
                  setSummary(null);
                  setMatch(matchFor(gauntlet.seed!, gauntlet.beaten, gauntlet.played));
                }}
              >
                {t('fight')}
              </Button>
              <Button
                variant="ghost"
                size="small"
                block
                onClick={() => {
                  recordGauntletEnd(gauntlet.beaten);
                  gauntlet.abandon();
                }}
              >
                {t('endGauntlet')}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="w-full">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">
                {t('gauntletIntro', { count: GAUNTLET_LIVES })}
              </p>
              <Button
                variant="primary"
                block
                onClick={() => {
                  setSummary(null);
                  useGauntletStore.getState().start();
                  const { seed } = useGauntletStore.getState();
                  setMatch(matchFor(seed!, 0, 0));
                }}
              >
                {summary ? t('tryAgain') : t('startGauntlet')}
              </Button>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label={t('bestStat')} value={formatNumber(best, locale)} hint={t('bestHint')} />
          <StatTile label={t('gauntlets')} value={formatNumber(runs, locale)} hint={t('played')} />
        </div>
        <Button as={ReturnLink} to="/arcade" variant="ghost" size="small" block>
          {t('arcade')}
        </Button>
      </div>
    </Screen>
  );
}
