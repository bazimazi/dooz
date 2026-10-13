import { isModeId } from '@/game/engine';
import type { CompetitiveProfile } from '@/protocol/competitive';
import { useEffect, useState } from 'react';
import { MedalIcon } from '@/components/art/ui-icons';
import { Card } from '@/components/ui/Card';
import { useAccountStore } from '@/features/account/store';
import { type Locale, useLocale, useT } from '@/i18n';
import { competitiveMessages, formatRating } from '@/i18n/messages/onlineCompetitive';
import { modeName as localModeName } from '@/i18n/messages/modes';
import { useTierLabels } from '@/i18n/messages/onlineTiers';
import { longDate } from '@/lib/format';
import { competitiveApi } from './api';
import { TierBadge } from './TierBadge';

function modeName(mode: string, locale: Locale): string {
  return isModeId(mode) ? localModeName(mode, locale) : mode;
}

/**
 * The competitive half of a profile: tier and division per ranked mode this
 * season, how earlier seasons ended, and the titles won along the way.
 *
 * Renders nothing until there is something to show - a player who has never
 * played ranked does not need an empty section telling them so.
 */
export function CompetitiveSection() {
  const credentials = useAccountStore((state) => state.credentials);
  const [data, setData] = useState<CompetitiveProfile | null>(null);
  const t = useT(competitiveMessages);
  const locale = useLocale();
  const tiers = useTierLabels();

  useEffect(() => {
    if (!credentials) return;
    const controller = new AbortController();
    void competitiveApi
      .profile(credentials, controller.signal)
      .then(setData)
      .catch(() => {
        /* Offline or not yet synced: the rest of the profile still stands. */
      });
    return () => controller.abort();
  }, [credentials]);

  if (
    !data ||
    (data.standings.length === 0 && data.history.length === 0 && data.awards.length === 0)
  ) {
    return null;
  }

  return (
    <Card className="w-full" padding="tight">
      <section aria-labelledby="season-heading" className="flex flex-col gap-3 px-2 py-1">
        <h2 id="season-heading" className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg">{data.season.name}</span>
          <span className="text-xs text-ink-faint">
            {t('seasonEnds', { date: longDate(data.season.endsAt) })}
          </span>
        </h2>

        {data.standings.length > 0 ? (
          <ul className="flex flex-col">
            {data.standings.map((standing) => {
              const placing = standing.seasonPlayed < standing.placementGames;
              return (
                <li
                  key={standing.mode}
                  className="flex items-center gap-3 border-t border-stroke-soft py-2 first:border-t-0"
                >
                  <TierBadge rating={standing.rating} compact />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">
                      {modeName(standing.mode, locale)} ·{' '}
                      {placing ? t('placements') : tiers.wire(standing.tier, standing.label)}
                    </span>
                    <span className="text-xs text-ink-faint">
                      {placing
                        ? t('placementProgress', {
                            played: standing.seasonPlayed,
                            total: standing.placementGames,
                          })
                        : standing.rank !== null
                          ? t('seasonRank', { rank: standing.rank })
                          : t('seasonGames', { count: standing.seasonPlayed })}
                      {standing.provisional ? ` · ${t('stillSettling')}` : ''}
                    </span>
                  </span>
                  <span className="tnum text-base font-semibold">
                    {formatRating(standing.rating, locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {data.history.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-stroke-soft pt-2">
            <h3 className="text-xs tracking-wide text-ink-faint uppercase">{t('pastSeasons')}</h3>
            <ul className="flex flex-col">
              {data.history.map((result) => (
                <li
                  key={`${result.seasonId}:${result.mode}`}
                  className="flex items-center gap-3 py-1.5"
                >
                  <TierBadge rating={result.rating} compact />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {result.seasonName} · {modeName(result.mode, locale)}
                  </span>
                  <span className="text-xs text-ink-faint">
                    {result.rank !== null ? `${t('rank', { rank: result.rank })} · ` : ''}
                    {tiers.wire(result.tier, result.label)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.awards.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-stroke-soft pt-2">
            <h3 className="text-xs tracking-wide text-ink-faint uppercase">{t('titles')}</h3>
            <ul className="flex flex-col">
              {data.awards.map((award) => (
                <li
                  key={`${award.source}:${award.sourceId}:${award.mode}`}
                  className="flex items-center gap-2 py-1 text-sm"
                >
                  <MedalIcon className="size-4 shrink-0 text-mark-o" />
                  <span className="min-w-0 flex-1 truncate">{award.title}</span>
                  <span className="text-xs text-ink-faint">{longDate(award.awardedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </Card>
  );
}
