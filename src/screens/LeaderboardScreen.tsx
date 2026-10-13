import { ReturnLink } from '@/components/ui/ReturnLink';
import { Link, useNavigate } from '@tanstack/react-router';
import { RANKED_MODES, type ModeId } from '@/game/engine';
import type { LadderEntry, LadderResponse, Season } from '@/protocol/competitive';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { MedalIcon, TrophyIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Tabs } from '@/components/ui/Tabs';
import { useAccountStore } from '@/features/account/store';
import { competitiveApi } from '@/features/competitive/api';
import { TierBadge } from '@/features/competitive/TierBadge';
import { countdown, useNow } from '@/features/competitive/TournamentView';
import { useLocale, useT } from '@/i18n';
import { modeName } from '@/i18n/messages/modes';
import { apiErrorText } from '@/i18n/messages/onlineApiErrors';
import { formatRating } from '@/i18n/messages/onlineCompetitive';
import { leaderboardMessages } from '@/i18n/messages/onlineLeaderboard';
import { useTierLabels } from '@/i18n/messages/onlineTiers';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/cx';
import { longDate, winRate } from '@/lib/format';

type SeasonChoice = number | 'current';

/**
 * A season's ladder for one mode.
 *
 * The current season is live; earlier ones are shown as they closed. Players
 * appear once they have finished their placement matches, and the ladder
 * leaves out ratings that have not been tested for a long time, so a spot near
 * the top has to be held rather than banked. The viewer's own place is pinned
 * underneath when it is not already on the page.
 */
export function LeaderboardScreen({ mode }: { mode: ModeId }) {
  const navigate = useNavigate();
  const credentials = useAccountStore((state) => state.credentials);
  const [season, setSeason] = useState<SeasonChoice>('current');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [data, setData] = useState<LadderResponse | null>(null);
  // Kept as the API client worded it and translated on render.
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const t = useT(leaderboardMessages);
  const locale = useLocale();

  // Clearing the previous table during render rather than in the effect means
  // a new tab or season never shows the old rows for a frame.
  const key = `${mode}:${season}`;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Bumped by "Try again", so the same ladder is fetched once more.
  const [attempt, setAttempt] = useState(0);
  if (loadedFor !== key) {
    setLoadedFor(key);
    setData(null);
    setError(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    void competitiveApi
      .seasons(controller.signal)
      .then((result) => setSeasons(result.seasons))
      .catch(() => {
        /* The selector simply offers the current season alone. */
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void competitiveApi
      .ladder({ mode, season, limit: 50 }, credentials, controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof ApiError
            ? { message: cause.message, status: cause.status }
            : { message: cause instanceof Error ? cause.message : '' },
        );
      });
    return () => controller.abort();
  }, [mode, season, credentials, attempt]);

  const me = data?.me ?? null;
  const meShown =
    me !== null &&
    data?.entries.some((entry) => entry.profile.accountId === me.entry.profile.accountId);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={ReturnLink} to="/" tone="bare" size="small" label={t('backHome')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <h1 className="flex-1 font-display text-xl">{t('title')}</h1>
        <Link
          to="/tournaments"
          search={{ tab: 'arenas' }}
          className="flex min-h-11 items-center gap-1.5 px-1 text-sm text-ink-muted no-underline hover:text-ink"
        >
          <MedalIcon className="size-4" /> {t('compete')}
        </Link>
      </header>

      <Tabs
        label={t('modeTabs')}
        value={mode}
        onChange={(next) =>
          void navigate({
            to: '/leaderboard',
            search: { mode: next },
            replace: true,
            viewTransition: false,
            resetScroll: false,
          })
        }
        options={RANKED_MODES.map((entry) => ({
          value: entry.id,
          label: modeName(entry.id, locale),
        }))}
        className="mb-3"
      />

      <SeasonBar
        seasons={seasons}
        value={season}
        onChange={setSeason}
        shown={data?.season ?? null}
      />

      <Card className="w-full" padding="tight">
        {error ? (
          <EmptyState
            title={t('loadError')}
            body={
              error.message ? apiErrorText(error.message, error.status, locale) : t('loadError')
            }
            action={
              <Button
                size="small"
                className="w-auto px-4"
                onClick={() => {
                  setLoadedFor(null);
                  setAttempt((count) => count + 1);
                }}
              >
                {t('tryAgain')}
              </Button>
            }
          />
        ) : data === null ? (
          <p className="px-2 py-10 text-center text-sm text-ink-faint">{t('loading')}</p>
        ) : data.entries.length === 0 ? (
          <EmptyState
            icon={<TrophyIcon />}
            title={data.season.closedAt === null ? t('nobodyPlacedYet') : t('nobodyPlacedSeason')}
            body={t('finishPlacements', { count: data.placementGames })}
            action={
              data.season.closedAt === null ? (
                <Button
                  as={ReturnLink}
                  to="/"
                  size="small"
                  className="w-auto px-4 whitespace-nowrap"
                >
                  {t('playRanked')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ol className="flex flex-col">
              {data.entries.map((entry) => (
                <LadderRow
                  key={entry.profile.accountId}
                  entry={entry}
                  isMe={me?.entry.profile.accountId === entry.profile.accountId}
                />
              ))}
            </ol>

            {me && !meShown ? (
              <div className="mt-1 border-t-2 border-stroke pt-1" aria-label={t('yourPlace')}>
                <ol>
                  <LadderRow entry={me.entry} isMe />
                </ol>
              </div>
            ) : null}

            <p className="px-2 py-3 text-center text-xs text-ink-faint">
              {t('footer', { count: data.placementGames })}
              {data.total > data.entries.length
                ? ` ${t('topOf', { shown: data.entries.length, total: data.total })}`
                : ''}
            </p>
          </>
        )}
      </Card>
    </Screen>
  );
}

function SeasonBar({
  seasons,
  value,
  onChange,
  shown,
}: {
  seasons: Season[];
  value: SeasonChoice;
  onChange: (value: SeasonChoice) => void;
  shown: Season | null;
}) {
  const live = shown && shown.closedAt === null;
  const now = useNow(30_000);
  const t = useT(leaderboardMessages);
  const locale = useLocale();
  return (
    <div className="mb-3 flex w-full items-center gap-3">
      <label className="flex flex-1 items-center gap-2 text-sm">
        <span className="sr-only">{t('season')}</span>
        <select
          className="h-10 min-w-0 flex-1 rounded-tile border border-stroke bg-surface px-3 text-sm"
          value={String(value)}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === 'current' ? 'current' : Number(next));
          }}
        >
          <option value="current">{t('currentSeason')}</option>
          {seasons
            .filter((season) => season.closedAt !== null)
            .map((season) => (
              <option key={season.id} value={season.id}>
                {t('seasonEnded', { season: season.name, date: longDate(season.closedAt!) })}
              </option>
            ))}
        </select>
      </label>
      {shown ? (
        <span className="shrink-0 text-xs text-ink-faint">
          {live
            ? t('seasonEndsIn', { season: shown.name, time: countdown(shown.endsAt - now, locale) })
            : shown.name}
        </span>
      ) : null}
    </div>
  );
}

function LadderRow({ entry, isMe }: { entry: LadderEntry; isMe: boolean }) {
  const t = useT(leaderboardMessages);
  const locale = useLocale();
  const tiers = useTierLabels();
  return (
    <li
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
        {formatRating(entry.rank, locale)}
      </span>

      <AvatarBadge avatar={entry.profile.avatar} className="size-9 shrink-0" />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">
          {entry.profile.displayName}
          {isMe ? <span className="text-ink-faint"> · {t('you')}</span> : null}
        </span>
        <span className="text-xs text-ink-faint">
          {tiers.wire(entry.tier, entry.label)} · {t('played', { count: entry.played })} ·{' '}
          {t('wonRate', { rate: winRate(entry.won, entry.played) })}
        </span>
      </span>

      <TierBadge rating={entry.rating} compact />
      <span className="tnum w-12 shrink-0 text-end text-base font-semibold">
        {formatRating(entry.rating, locale)}
      </span>
    </li>
  );
}
