import { type BotDifficulty, modeById, type ModeId, O, profileFor, X } from '@/game/engine';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { ClockIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { outcomeFace } from '@/game/components/ResultModal';
import { useDifficultyLabels } from '@/game/bot/labels';
import { forgetGame } from '@/game/useGame';
import { RewardsPanel } from '@/features/progress/RewardsPanel';
import { type Award, type BotRecord, useProgressStore } from '@/features/progress/store';
import { useT } from '@/i18n';
import { arcadeMessages } from '@/i18n/messages/arcade';
import { useModeText } from '@/i18n/messages/modes';
import { consumeDialogHistory } from '@/lib/useDialog';
import { ArcadeMatch, type MatchResult, type MatchSpec } from './ArcadeMatch';
import { blitzClockFor } from './daily';
import { handicapSetup, maxHandicapFor } from './handicap';
import { seededRandom } from './random';
import { forgetClock } from './useHumanClock';

/** The share of its usual thinking time a bot gets in blitz. */
const BLITZ_THINKING = 0.4;

/**
 * A bot game with the clock on, a head start, or both.
 *
 * It is still a bot game - it goes on the same record, the same streak, the
 * same XP - with the clock and the pre-placed marks layered on. The clock is
 * the player's alone; the bot is kept to pace by a shorter thinking budget, so
 * a blitz game feels quick on both sides without the bot ever losing on time.
 */
export function BlitzGame({
  mode,
  difficulty,
  blitz,
  handicap = 0,
}: {
  mode: ModeId;
  difficulty: BotDifficulty;
  blitz: boolean;
  handicap?: number;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const t = useT(arcadeMessages);
  const labels = useDifficultyLabels();
  const modeText = useModeText(mode);
  const recordBotGame = useProgressStore((state) => state.recordBotGame);
  const game = modeById(mode);
  const marks = Math.max(
    -maxHandicapFor(game.config),
    Math.min(maxHandicapFor(game.config), handicap),
  );
  const storageKey = `blitz:${mode}:${difficulty}:${blitz}:${marks}`;
  const [earned, setEarned] = useState<{ record: BotRecord; award: Award | null } | null>(null);

  const spec = useMemo<MatchSpec>(() => {
    const setup =
      marks === 0
        ? undefined
        : handicapSetup(game.config, Math.abs(marks), marks > 0 ? X : O, seededRandom(Date.now()));
    return {
      config: game.config,
      difficulty,
      ...(setup && setup.moves.length > 0 ? { setup } : {}),
      ...(blitz
        ? {
            clock: blitzClockFor(game),
            botTimeBudgetMs: Math.max(
              40,
              Math.round(profileFor(difficulty).timeMs * BLITZ_THINKING),
            ),
          }
        : {}),
      storageKey,
      badge: blitz
        ? t('badgeBlitz')
        : marks > 0
          ? t('badgeHeadStart', { count: marks })
          : t('badgeBotStart', { count: -marks }),
    };
  }, [game, difficulty, blitz, marks, storageKey, t]);

  const finish = useCallback(
    (result: MatchResult) => {
      const record = recordBotGame(mode, difficulty, result.outcome, {
        blitz,
        handicap: marks,
      });
      setEarned({ record, award: useProgressStore.getState().lastAward });
    },
    [recordBotGame, mode, difficulty, blitz, marks],
  );

  async function go(next: { blitz: boolean }) {
    forgetGame(storageKey);
    forgetClock(storageKey);
    await consumeDialogHistory(router.history);
    void navigate({
      to: '/play/bot',
      search: {
        mode,
        difficulty,
        ...(next.blitz ? { blitz: true as const } : {}),
        ...(marks !== 0 ? { handicap: marks } : {}),
      },
      replace: true,
      viewTransition: false,
    });
  }

  return (
    <ArcadeMatch
      key={storageKey}
      spec={spec}
      onFinish={finish}
      restartable
      leave={
        <IconButton
          label={blitz ? t('clockOff') : t('clockOn')}
          aria-pressed={blitz}
          onClick={() => void go({ blitz: !blitz })}
          className={blitz ? 'text-warn' : undefined}
        >
          <ClockIcon />
        </IconButton>
      }
      result={(result, restart) => ({
        title:
          result.outcome === 'win'
            ? t('youWin')
            : result.outcome === 'draw'
              ? t('draw')
              : result.flagged
                ? t('outOfTime')
                : t('botWins', { bot: labels.bot(difficulty) }),
        art: outcomeFace(result.outcome),
        note: t(blitz ? 'blitzNote' : 'headStartNote', {
          bot: labels.bot(difficulty),
          mode: modeText.name,
        }),
        detail: earned ? (
          <p className="tnum text-center text-xs text-ink-faint">
            {t('record', {
              level: labels.label(difficulty),
              won: earned.record.won,
              drawn: earned.record.drawn,
              lost: earned.record.lost,
            })}
          </p>
        ) : null,
        rewards: earned?.award ? (
          <RewardsPanel award={earned.award} won={result.outcome === 'win'} />
        ) : null,
        actions: (
          <>
            <Button
              variant="primary"
              size="small"
              block
              onClick={() => {
                setEarned(null);
                restart();
              }}
            >
              {t('playAgain')}
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
