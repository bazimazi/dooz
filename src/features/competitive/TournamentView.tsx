import type { Tournament } from '@/protocol';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { currentLocale, type Locale, translate, useLocale, useT } from '@/i18n';
import { competitiveMessages, formatRating } from '@/i18n/messages/onlineCompetitive';
import { cx } from '@/lib/cx';

/** The current time, re-read every second while mounted. For countdowns only. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function countdown(ms: number, locale: Locale = currentLocale()): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const twoDigits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
  if (hours > 0) {
    return translate(
      competitiveMessages,
      'countdownHours',
      { hours, minutes: twoDigits.format(minutes) },
      locale,
    );
  }
  return translate(
    competitiveMessages,
    'countdownMinutes',
    { minutes, seconds: twoDigits.format(seconds) },
    locale,
  );
}

/** One line saying where a tournament is in its life. */
export function tournamentStatus(
  tournament: Tournament,
  now: number,
  locale: Locale = currentLocale(),
): string {
  const t = (
    key: keyof (typeof competitiveMessages)['en'],
    values?: Record<string, string | number>,
  ) => translate(competitiveMessages, key, values, locale);
  if (tournament.status === 'finished') return t('finished');
  if (tournament.status === 'scheduled') {
    return tournament.kind === 'bracket'
      ? t('waitingForPlayers', { players: tournament.players, max: tournament.maxPlayers })
      : t('startsIn', { time: countdown(tournament.startsAt - now, locale) });
  }
  return tournament.kind === 'arena'
    ? now < tournament.endsAt
      ? t('timeLeft', { time: countdown(tournament.endsAt - now, locale) })
      : t('lastGames')
    : t('inProgress');
}

/** Arena standings, with the viewer's own row marked. */
export function Standings({ tournament, me }: { tournament: Tournament; me: string | null }) {
  const t = useT(competitiveMessages);
  const locale = useLocale();
  if (tournament.standings.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-ink-faint">{t('nobodyJoined')}</p>;
  }
  return (
    <ol className="flex flex-col" aria-label={t('standings')}>
      {tournament.standings.map((entry) => {
        const isMe = entry.profile.accountId === me;
        return (
          <li
            key={entry.profile.accountId}
            className={cx(
              'flex items-center gap-2.5 border-t border-stroke-soft px-2 py-2 first:border-t-0',
              isMe && 'rounded-tile bg-stroke-soft/40',
              !entry.active && 'opacity-60',
            )}
          >
            <span className="tnum w-7 shrink-0 text-center text-sm text-ink-faint">
              {formatRating(entry.rank, locale)}
            </span>
            <AvatarBadge avatar={entry.profile.avatar} className="size-7" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">
                {entry.profile.displayName}
                {isMe ? <span className="text-ink-faint"> · {t('you')}</span> : null}
              </span>
              <span className="text-xs text-ink-faint">
                {t('played', { count: entry.played })} · {t('won', { count: entry.won })}
                {entry.active ? '' : ` · ${t('left')}`}
              </span>
            </span>
            {entry.fire ? (
              <span className="text-xs font-semibold text-mark-o" title={t('onFireTitle')}>
                {t('onFire')}
              </span>
            ) : null}
            <span className="tnum w-10 shrink-0 text-end text-base font-semibold">
              {formatRating(tournament.kind === 'arena' ? entry.score : entry.won, locale)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A single-elimination bracket, one column per round. */
export function BracketView({ tournament }: { tournament: Tournament }) {
  const t = useT(competitiveMessages);
  if (!tournament.bracket) return null;
  const rounds = tournament.bracket;
  return (
    <div className="flex gap-3 overflow-x-auto pb-1" role="list" aria-label={t('bracket')}>
      {rounds.map((games, round) => (
        <div key={round} role="listitem" className="flex min-w-36 flex-col justify-around gap-2">
          <p className="text-xs tracking-wide text-ink-faint uppercase">
            {round === rounds.length - 1
              ? t('final')
              : round === rounds.length - 2
                ? t('semiFinals')
                : t('round', { round: round + 1 })}
          </p>
          {games.map((game, index) => (
            <div key={index} className="rounded-tile border border-stroke-soft text-sm">
              {(['a', 'b'] as const).map((side, sideIndex) => {
                const profile = game[side];
                const won = game.winner === sideIndex + 1;
                return (
                  <div
                    key={side}
                    className={cx(
                      'flex items-center gap-1.5 px-2 py-1',
                      sideIndex === 1 && 'border-t border-stroke-soft',
                      won && 'font-semibold',
                      game.winner !== null && !won && 'text-ink-faint',
                    )}
                  >
                    {profile ? <AvatarBadge avatar={profile.avatar} className="size-4" /> : null}
                    <span className="truncate">
                      {profile?.displayName ?? (round === 0 ? t('bye') : '—')}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
