import { placementFor, placementOrder } from '@/protocol/tiers';
import { useT } from '@/i18n';
import { competitiveMessages } from '@/i18n/messages/onlineCompetitive';
import { useTierLabels } from '@/i18n/messages/onlineTiers';
import { cx } from '@/lib/cx';
import { TierShield } from './TierBadge';

export interface RatedChange {
  before: number;
  after: number;
  provisional?: boolean | undefined;
  seasonPlayed?: number | undefined;
  placementGames?: number | undefined;
}

/**
 * Where a ranked result left the player on the ladder: their division, how far
 * through it they are, and whether this game promoted or demoted them. During
 * placements it shows the count instead, since a division that will move a
 * long way in the next few games is not worth reading yet.
 *
 * The bar's fill is a plain width - it is decoration on a number the result
 * panel already counts up, so it needs no animation of its own.
 */
export function DivisionProgress({ change }: { change: RatedChange }) {
  const t = useT(competitiveMessages);
  const tiers = useTierLabels();
  const before = placementFor(change.before);
  const after = placementFor(change.after);
  const afterLabel = tiers.placement(after);
  const placing =
    change.seasonPlayed !== undefined &&
    change.placementGames !== undefined &&
    change.seasonPlayed < change.placementGames;
  const moved = placementOrder(after) - placementOrder(before);

  return (
    <div className="flex flex-col gap-2 rounded-tile border border-stroke-soft bg-surface/85 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <TierShield tier={after.tier} division={after.division} />
        <span className="flex-1 text-sm font-semibold">{afterLabel}</span>
        {moved !== 0 && !placing ? (
          <span className={cx('text-xs font-semibold', moved > 0 ? 'text-ok' : 'text-danger')}>
            {moved > 0 ? t('promoted') : t('demoted')}
          </span>
        ) : null}
      </div>

      {placing ? (
        <p className="text-xs text-ink-muted">
          {t('placementMatch', {
            played: change.seasonPlayed ?? 0,
            total: change.placementGames ?? 0,
          })}
        </p>
      ) : after.progress !== null ? (
        <>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
            role="progressbar"
            aria-label={t('progressThrough', { division: afterLabel })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(after.progress * 100)}
          >
            <div
              className="h-full rounded-full bg-mark-o"
              style={{ width: `${Math.max(4, after.progress * 100)}%` }}
            />
          </div>
          {after.nextAt !== null ? (
            <p className="text-xs text-ink-faint">
              {t('toNextDivision', { count: Math.max(0, after.nextAt - change.after) })}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-ink-faint">{t('topOfLadder')}</p>
      )}

      {change.provisional && !placing ? (
        <p className="text-xs text-ink-faint">{t('provisional')}</p>
      ) : null}
    </div>
  );
}
