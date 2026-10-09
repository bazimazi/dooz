import { ReturnLink } from '@/components/ui/ReturnLink';
import { describeConfig, type GameState, X } from '@/game/engine';
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
import { describeReason } from '@/game/components/ResultModal';

export function ReplayScreen({ matchId }: { matchId: string }) {
  const credentials = useAccountStore((state) => state.credentials);
  const [record, setRecord] = useState<MatchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  // Clearing during render rather than in the effect, so following a link from
  // one replay to another never shows the previous game's board first.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== matchId) {
    setLoadedFor(matchId);
    setRecord(null);
    setError(null);
    setReported(false);
  }

  useEffect(() => {
    const controller = new AbortController();

    void api
      .match(matchId, credentials, controller.signal)
      .then(setRecord)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Could not load this match');
      });

    return () => controller.abort();
  }, [matchId, credentials]);

  const replay = useReplay(record);

  // Left and right step through the game, space plays and pauses. A replay is
  // a player, and a player that cannot be driven from the keyboard is a toy.
  useEffect(() => {
    if (!replay) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
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
            title="Match not found"
            body={error}
            action={
              <Button as={ReturnLink} to="/profile" size="small" className="w-auto px-4">
                Your matches
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
          <p className="text-center text-sm text-ink-faint">Loading the match…</p>
        </Card>
      </Screen>
    );
  }

  const total = replay.frames.length - 1;

  return (
    <Screen scroll>
      <Header />

      <div className="flex w-full flex-col items-center gap-3 pb-6">
        {/* Who played, and what it did to their ratings. */}
        <Card className="w-full" padding="tight">
          <div className="flex items-center gap-2 px-1 py-1">
            <PlayerSide profile={record.players.x} mark="X" winner={record.winner === X} />
            <span className="shrink-0 text-xs text-ink-faint">vs</span>
            <PlayerSide
              profile={record.players.o}
              mark="O"
              winner={record.winner === 2}
              align="end"
            />
          </div>
          <p className="px-1 pb-1 text-center text-xs text-ink-faint">
            {describeConfig(record.config)} · {record.kind} ·{' '}
            <span title={fullDate(record.playedAt)}>{timeAgo(record.playedAt)}</span>
          </p>
        </Card>

        <ReplayFeedback game={replay.current} />
        <Board game={replay.current} onPlay={() => undefined} readOnly />

        {/* Transport. The scrubber is a real range input, so it is draggable,
            keyboard-operable and announced as a slider without any extra work. */}
        <div className="flex w-full max-w-board flex-col gap-2">
          <input
            type="range"
            min={0}
            max={total}
            value={replay.at}
            onChange={(event) => replay.seek(Number(event.target.value))}
            aria-label="Move"
            aria-valuetext={`Move ${replay.at} of ${total}`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-sunken accent-[var(--color-stroke)]"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="tnum w-20 text-xs text-ink-faint">
              Move {replay.at}/{total}
            </span>

            <div className="flex items-center gap-1.5">
              <IconButton
                size="small"
                tone="bare"
                label="Previous move"
                disabled={replay.atStart}
                onClick={replay.previous}
              >
                <StepBackIcon />
              </IconButton>

              <IconButton label={replay.playing ? 'Pause' : 'Play'} onClick={replay.toggle}>
                {replay.playing ? <PauseIcon /> : <PlayIcon />}
              </IconButton>

              <IconButton
                size="small"
                tone="bare"
                label="Next move"
                disabled={replay.atEnd}
                onClick={replay.next}
              >
                <StepForwardIcon />
              </IconButton>
            </div>

            <span className="tnum w-20 text-right text-xs text-ink-faint">
              {replay.moveTimeMs !== null ? duration(replay.moveTimeMs) : ''}
            </span>
          </div>
        </div>

        <div className="grid w-full max-w-board grid-cols-3 gap-2">
          <StatTile
            label="Result"
            value={record.outcome === 'win' ? 'Win' : record.outcome === 'loss' ? 'Loss' : 'Draw'}
            tone={record.outcome === 'win' ? 'good' : record.outcome === 'loss' ? 'bad' : 'plain'}
            hint={describeReason(record.reason, record.outcome)}
          />
          <StatTile label="Moves" value={record.moves.length} />
          <StatTile
            label="Length"
            value={duration(record.durationMs)}
            hint={record.ratingDelta !== null ? `${signed(record.ratingDelta)} rating` : undefined}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="ghost"
            className="w-auto px-4"
            icon={<ShareIcon />}
            onClick={() => void shareOrCopy(window.location.href, 'A game of dooz')}
          >
            Share
          </Button>

          {credentials && !reported ? (
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-4"
              icon={<FlagReportIcon />}
              onClick={async () => {
                try {
                  await api.report(credentials, matchId, 'other');
                  setReported(true);
                } catch {
                  setReported(false);
                }
              }}
            >
              Report
            </Button>
          ) : reported ? (
            <span className="text-xs text-ink-faint" role="status">
              Reported — thank you
            </span>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}

function Header() {
  return (
    <header className="flex w-full items-center gap-3 pt-2 pb-3">
      <IconButton
        as={ReturnLink}
        to="/profile"
        tone="bare"
        size="small"
        label="Back to your matches"
      >
        <BackIcon />
      </IconButton>
      <h1 className="font-display text-xl">Replay</h1>
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
  return (
    <div
      className={cx(
        'flex min-w-0 flex-1 items-center gap-2',
        align === 'end' && 'flex-row-reverse text-right',
      )}
    >
      <AvatarBadge avatar={profile.avatar} className="size-9 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className={cx('flex items-center gap-1', align === 'end' && 'flex-row-reverse')}>
          {/* The crown sits outside the truncating name, or a long name eats
              the one thing on this row that says who won. */}
          {winner ? (
            <TrophyIcon className="size-3.5 shrink-0 text-mark-o" aria-label="Winner" />
          ) : null}
          <span className="truncate text-sm">{profile.displayName}</span>
        </span>
        <span className="text-xs text-ink-muted">
          {mark}
          {profile.rating !== null ? ` · ${profile.rating}` : ''}
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
