import { ReturnLink } from '@/components/ui/ReturnLink';
import { useNavigate } from '@tanstack/react-router';
import { RANKED_MODES, type ModeId } from '@/game/engine';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { TrophyIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Tabs } from '@/components/ui/Tabs';
import { useAccountStore } from '@/features/account/store';
import { api, type LeaderboardResponse } from '@/lib/api';
import { cx } from '@/lib/cx';
import { winRate } from '@/lib/format';

export function LeaderboardScreen({ mode }: { mode: ModeId }) {
  const navigate = useNavigate();
  const selected = mode;
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = useAccountStore((state) => state.profile);

  // Clearing the previous mode's table during render rather than in the effect
  // means the new tab never shows the old mode's rows for a frame.
  const [loadedFor, setLoadedFor] = useState<ModeId | null>(null);
  if (loadedFor !== selected) {
    setLoadedFor(selected);
    setData(null);
    setError(null);
  }

  useEffect(() => {
    const controller = new AbortController();

    void api
      .leaderboard(selected, 50, controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Could not load the leaderboard');
      });

    return () => controller.abort();
  }, [selected]);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={ReturnLink} to="/" tone="bare" size="small" label="Back to home">
          <BackIcon />
        </IconButton>
        <h1 className="font-display text-xl">Leaderboard</h1>
      </header>

      <Tabs
        label="Leaderboard mode"
        value={selected}
        onChange={(next) =>
          void navigate({
            to: '/leaderboard',
            search: { mode: next },
            replace: true,
            viewTransition: false,
            resetScroll: false,
          })
        }
        options={RANKED_MODES.map((entry) => ({ value: entry.id, label: entry.name }))}
        className="mb-3"
      />

      <Card className="w-full" padding="tight">
        {error ? (
          <EmptyState
            title="Could not load the leaderboard"
            body={error}
            action={
              <Button size="small" className="w-auto px-4" onClick={() => setLoadedFor(null)}>
                Try again
              </Button>
            }
          />
        ) : data === null ? (
          <p className="px-2 py-10 text-center text-sm text-ink-faint">Loading…</p>
        ) : data.entries.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon />}
            title="Nobody has qualified yet"
            body={`Play ${data.placementGames} ranked matches in this mode to appear here.`}
            action={
              <Button as={ReturnLink} to="/" size="small" className="w-auto px-4">
                Play a ranked match
              </Button>
            }
          />
        ) : (
          <>
            <ol className="flex flex-col">
              {data.entries.map((entry) => {
                const isMe = me?.accountId === entry.profile.accountId;
                return (
                  <li
                    key={entry.profile.accountId}
                    className={cx(
                      'flex items-center gap-3 border-t border-stroke-soft px-2 py-2.5 first:border-t-0',
                      isMe && 'rounded-tile bg-stroke-soft/40',
                    )}
                  >
                    <span
                      className={cx(
                        'tnum w-8 shrink-0 text-center text-sm font-semibold',
                        entry.rank === 1 && 'text-mark-o',
                        entry.rank === 2 && 'text-ink',
                        entry.rank === 3 && 'text-mark-x-soft',
                        entry.rank > 3 && 'text-ink-faint',
                      )}
                    >
                      {entry.rank}
                    </span>

                    <AvatarBadge avatar={entry.profile.avatar} className="size-9 shrink-0" />

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">
                        {entry.profile.displayName}
                        {isMe ? <span className="text-ink-faint"> · you</span> : null}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {entry.played} played · {winRate(entry.won, entry.played)} won
                      </span>
                    </span>

                    <span className="tnum shrink-0 text-base font-semibold">{entry.rating}</span>
                  </li>
                );
              })}
            </ol>

            <p className="px-2 py-3 text-center text-xs text-ink-faint">
              Saved rankings are available offline. Connect to refresh them. Ranked matches only.{' '}
              {data.placementGames} games are needed to qualify, so a single lucky win cannot put
              anyone at the top.
            </p>
          </>
        )}
      </Card>
    </Screen>
  );
}
