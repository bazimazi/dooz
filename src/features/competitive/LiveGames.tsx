import { isModeId, DEFAULT_MODE_ID } from '@/game/engine';
import type { LiveGame } from '@/protocol/competitive';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { EyeIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Card';
import { useLocale, useT } from '@/i18n';
import { describeConfigText } from '@/i18n/messages/modes';
import { apiErrorText } from '@/i18n/messages/onlineApiErrors';
import { competitiveMessages, formatRating } from '@/i18n/messages/onlineCompetitive';
import { ApiError } from '@/lib/api';
import { usePageVisible } from '@/lib/usePageVisible';
import { cx } from '@/lib/cx';
import { competitiveApi } from './api';

const REFRESH_MS = 10_000;

/**
 * Public games in progress, strongest first, each one a tap away from being
 * watched. Refreshed every few seconds while the page is visible; a hidden tab
 * does not poll.
 */
export function LiveGames() {
  const [games, setGames] = useState<LiveGame[] | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const visible = usePageVisible();
  const t = useT(competitiveMessages);
  const locale = useLocale();

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const load = () =>
      void competitiveApi
        .live(30, controller.signal)
        .then((found) => {
          setGames(found);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          // Kept in English and translated on render, so a language change
          // relabels an error already showing.
          setError(
            cause instanceof ApiError
              ? { message: cause.message, status: cause.status }
              : { message: cause instanceof Error ? cause.message : '' },
          );
        });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [visible, attempt]);

  if (error !== null && games === null) {
    return (
      <EmptyState
        title={t('liveError')}
        body={error.message ? apiErrorText(error.message, error.status, locale) : t('liveError')}
        action={
          <Button size="small" className="w-auto px-4" onClick={() => setAttempt((n) => n + 1)}>
            {t('tryAgain')}
          </Button>
        }
      />
    );
  }
  if (games === null) {
    return <p className="px-2 py-10 text-center text-sm text-ink-faint">{t('loading')}</p>;
  }
  if (games.length === 0) {
    return <EmptyState icon={<EyeIcon />} title={t('liveEmptyTitle')} body={t('liveEmptyBody')} />;
  }

  return (
    <ol className="flex flex-col" aria-label={t('gamesInProgress')}>
      {games.map((game) => (
        <li
          key={game.code}
          className="flex items-center gap-3 border-t border-stroke-soft px-2 py-2.5 first:border-t-0"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <PlayerLine profile={game.x} />
            <PlayerLine profile={game.o} />
            <span className="text-xs text-ink-faint">
              {describeConfigText(game.config, locale)} ·{' '}
              {game.kind === 'ranked' ? t('ranked') : t('casual')}
              {game.tournament ? ` · ${game.tournament}` : ''} ·{' '}
              {t('moveNumber', { count: game.moves + 1 })}
              {game.spectators > 0 ? ` · ${t('watching', { count: game.spectators })}` : ''}
            </span>
          </span>
          <Link
            to="/play/online"
            search={{ mode: isModeId(game.mode) ? game.mode : DEFAULT_MODE_ID, watch: game.code }}
            className={cx(
              'flex h-10 shrink-0 items-center gap-1.5 rounded-tile border border-stroke px-3 text-sm',
              'no-underline transition-[transform,border-color] duration-200 hover:-translate-y-0.5',
            )}
            aria-label={t('watchLabel', { x: game.x.displayName, o: game.o.displayName })}
          >
            <EyeIcon className="size-4" /> {t('watch')}
          </Link>
        </li>
      ))}
    </ol>
  );
}

function PlayerLine({ profile }: { profile: LiveGame['x'] }) {
  const t = useT(competitiveMessages);
  const locale = useLocale();
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <AvatarBadge avatar={profile.avatar} className="size-6 shrink-0" />
      <span className="truncate">{profile.displayName}</span>
      {profile.bot ? (
        <span className="rounded-full border border-stroke-soft px-1.5 text-[0.65rem] text-ink-faint uppercase">
          {t('bot')}
        </span>
      ) : null}
      {profile.rating !== null ? (
        <span className="tnum shrink-0 text-xs text-ink-faint">
          {formatRating(profile.rating, locale)}
        </span>
      ) : null}
    </span>
  );
}
