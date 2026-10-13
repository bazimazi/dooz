import { ReturnLink } from '@/components/ui/ReturnLink';
import { type GameState, O, X } from '@/game/engine';
import type { Avatar, MatchRecord } from '@/protocol';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon, ShareIcon } from '@/components/art/icons';
import {
  FlagReportIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
  TrophyIcon,
} from '@/components/art/ui-icons';
import { Board } from '@/game/components/Board';
import { VariantStatus } from '@/game/components/VariantStatus';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, StatTile } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useReplay } from '@/features/replay/useReplay';
import { api } from '@/lib/api';
import { cx } from '@/lib/cx';
import { duration, fullDate, signed, timeAgo } from '@/lib/format';
import { shareOrCopy } from '@/lib/invite';
import { describeReason, describeReasonFor } from '@/game/components/ResultModal';
import { formatNumber, useLocale, useT } from '@/i18n';
import { describeConfigText } from '@/i18n/messages/modes';
import { replayMessages } from '@/i18n/messages/replay';

export function ReplayScreen({ matchId }: { matchId: string }) {
  const t = useT(replayMessages);
  const locale = useLocale();
  const credentials = useAccountStore((state) => state.credentials);
  const [record, setRecord] = useState<MatchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState<'idle' | 'sending' | 'failed'>('idle');

  // Clearing during render rather than in the effect, so following a link from
  // one replay to another never shows the previous game's board first.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== matchId) {
    setLoadedFor(matchId);
    setRecord(null);
    setError(null);
    setReported(false);
    setReporting('idle');
  }

  useEffect(() => {
    const controller = new AbortController();

    void api
      .match(matchId, credentials, controller.signal)
      .then(setRecord)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : t('loadFailed'));
      });

    return () => controller.abort();
  }, [matchId, credentials, t]);

  const replay = useReplay(record);

  // Left and right step through the game, space plays and pauses. A replay is
  // a player, and a player that cannot be driven from the keyboard is a toy.
  // Playback runs left to right in every language, as media controls do, so
  // the arrows keep their meaning in a right-to-left one.
  useEffect(() => {
    if (!replay) return;
    const onKey = (event: KeyboardEvent) => {
      // Leave keys that already mean something alone: browser shortcuts, text
      // fields, a focused control's own Space, and the board grid's arrows.
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select')) return;
      if (event.key === ' ' && target?.closest('button, a')) return;
      if (event.key.startsWith('Arrow') && target?.closest('[role="grid"]')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        replay.next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        replay.previous();
      } else if (event.key === ' ') {
        event.preventDefault();
        replay.toggle();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [replay]);

  if (error) {
    return (
      <Screen scroll>
        <Header />
        <Card className="w-full">
          <EmptyState
            title={t('notFound')}
            body={error}
            action={
              <Button as={ReturnLink} to="/profile" size="small" className="w-auto px-4">
                {t('yourMatches')}
              </Button>
            }
          />
        </Card>
      </Screen>
    );
  }

  if (!record || !replay) {
    return (
      <Screen scroll>
        <Header />
        <Card className="w-full" padding="roomy">
          <p className="text-center text-sm text-ink-faint">{t('loading')}</p>
        </Card>
      </Screen>
    );
  }

  const total = replay.frames.length - 1;
  // The server tells a replay from the viewer's side, or X's for anyone who
  // did not play; only a participant gets the first-person result.
  const seat =
    credentials?.accountId === record.players.x.accountId
      ? X
      : credentials?.accountId === record.players.o.accountId
        ? O
        : null;
  const misere = record.config.variant === 'misere';
  const winnerName = (record.winner === O ? record.players.o : record.players.x).displayName;
  const loserName = (record.winner === O ? record.players.x : record.players.o).displayName;

  return (
    <Screen scroll>
      <Header />

      <div className="flex w-full flex-col items-center gap-3 pb-6">
        {/* Who played, and what it did to their ratings. */}
        <Card className="w-full" padding="tight">
          <div className="flex items-center gap-2 px-1 py-1">
            <PlayerSide profile={record.players.x} mark="X" winner={record.winner === X} />
            <span className="shrink-0 text-xs text-ink-faint">{t('versus')}</span>
            <PlayerSide
              profile={record.players.o}
              mark="O"
              winner={record.winner === 2}
              align="end"
            />
          </div>
          <p className="px-1 pb-1 text-center text-xs text-ink-faint">
            {describeConfigText(record.config, locale)} · {t(`kind.${record.kind}`)} ·{' '}
            <span title={fullDate(record.playedAt)}>{timeAgo(record.playedAt)}</span>
          </p>
        </Card>

        <ReplayFeedback game={replay.current} />
        <Board game={replay.current} onPlay={() => undefined} readOnly />
        {/* Pente's captures are half the story of a game; step through them too. */}
        {replay.current.config.variant === 'pente' ? <VariantStatus game={replay.current} /> : null}

        {/* Transport. The scrubber is a real range input, so it is draggable,
            keyboard-operable and announced as a slider without any extra work.
            Like any media player it does not mirror in a right-to-left
            language: a timeline runs left to right everywhere. */}
        <div dir="ltr" className="flex w-full max-w-board flex-col gap-2">
          <input
            type="range"
            min={0}
            max={total}
            value={replay.at}
            onChange={(event) => replay.seek(Number(event.target.value))}
            aria-label={t('move')}
            aria-valuetext={t('moveOf', { move: replay.at, total })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sunken accent-[var(--color-stroke)]"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="tnum w-20 text-xs text-ink-faint">
              {t('moveShort', { move: replay.at, total })}
            </span>

            <div className="flex items-center gap-1.5">
              <IconButton
                size="small"
                tone="bare"
                label={t('previousMove')}
                disabled={replay.atStart}
                onClick={replay.previous}
              >
                <StepBackIcon />
              </IconButton>

              <IconButton
                label={replay.playing ? t('pause') : t('play')}
                disabled={total === 0}
                onClick={replay.toggle}
              >
                {replay.playing ? <PauseIcon /> : <PlayIcon />}
              </IconButton>

              <IconButton
                size="small"
                tone="bare"
                label={t('nextMove')}
                disabled={replay.atEnd}
                onClick={replay.next}
              >
                <StepForwardIcon />
              </IconButton>
            </div>

            <span className="tnum w-20 text-end text-xs text-ink-faint">
              {replay.moveTimeMs !== null ? duration(replay.moveTimeMs) : ''}
            </span>
          </div>
        </div>

        <div className="grid w-full max-w-board grid-cols-3 gap-2">
          {seat !== null ? (
            <StatTile
              label={t('result')}
              value={t(record.outcome)}
              tone={record.outcome === 'win' ? 'good' : record.outcome === 'loss' ? 'bad' : 'plain'}
              hint={describeReason(record.reason, record.outcome, misere)}
            />
          ) : (
            <StatTile
              label={t('result')}
              value={
                record.winner === null
                  ? t('draw')
                  : t('markWon', { mark: record.winner === X ? 'X' : 'O' })
              }
              hint={describeReasonFor(
                record.reason,
                { winner: winnerName, loser: loserName },
                misere,
              )}
            />
          )}
          <StatTile label={t('moves')} value={formatNumber(record.moves.length, locale)} />
          <StatTile
            label={t('length')}
            value={duration(record.durationMs)}
            hint={
              seat !== null && record.ratingDelta !== null
                ? t('ratingChange', { change: signed(record.ratingDelta) })
                : undefined
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="ghost"
            className="w-auto px-4"
            icon={<ShareIcon />}
            onClick={() => void shareOrCopy(window.location.href, t('shareTitle'))}
          >
            {t('share')}
          </Button>

          {credentials && seat !== null && !reported ? (
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-4"
              icon={<FlagReportIcon />}
              disabled={reporting === 'sending'}
              onClick={async () => {
                setReporting('sending');
                try {
                  await api.report(credentials, matchId, 'other');
                  setReported(true);
                  setReporting('idle');
                } catch {
                  setReporting('failed');
                }
              }}
            >
              {reporting === 'failed' ? t('reportFailed') : t('report')}
            </Button>
          ) : reported ? (
            <span className="text-xs text-ink-faint" role="status">
              {t('reported')}
            </span>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}

function Header() {
  const t = useT(replayMessages);
  return (
    <header className="flex w-full items-center gap-3 pt-2 pb-3">
      <IconButton as={ReturnLink} to="/profile" tone="bare" size="small" label={t('backToMatches')}>
        <BackIcon className="rtl:-scale-x-100" />
      </IconButton>
      <h1 className="font-display text-xl">{t('title')}</h1>
    </header>
  );
}

function PlayerSide({
  profile,
  mark,
  winner,
  align = 'start',
}: {
  profile: { displayName: string; avatar: Avatar; rating: number | null };
  mark: string;
  winner: boolean;
  align?: 'start' | 'end';
}) {
  const t = useT(replayMessages);
  const locale = useLocale();
  return (
    <div
      className={cx(
        'flex min-w-0 flex-1 items-center gap-2',
        align === 'end' && 'flex-row-reverse text-end',
      )}
    >
      <AvatarBadge avatar={profile.avatar} className="size-9 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className={cx('flex items-center gap-1', align === 'end' && 'flex-row-reverse')}>
          {/* The crown sits outside the truncating name, or a long name eats
              the one thing on this row that says who won. */}
          {winner ? (
            <TrophyIcon className="size-3.5 shrink-0 text-mark-o" aria-label={t('winner')} />
          ) : null}
          <span className="truncate text-sm">{profile.displayName}</span>
        </span>
        <span className="text-xs text-ink-muted">
          {mark}
          {profile.rating !== null ? ` · ${formatNumber(profile.rating, locale)}` : ''}
        </span>
      </span>
    </div>
  );
}

/**
 * Each step of a replay plays the mark it places, so watching a game back
 * sounds like playing it did. The result chord is left out - it was heard once.
 */
function ReplayFeedback({ game }: { game: GameState }) {
  useGameFeedback(game, { replay: true });
  return null;
}
