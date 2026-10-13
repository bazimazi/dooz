import { placementFor, type TierId } from '@/protocol/tiers';
import { useTierLabels } from '@/i18n/messages/onlineTiers';
import { cx } from '@/lib/cx';

/**
 * Metal colours for the tiers. They are the same in both themes on purpose:
 * gold is gold whatever the background, and the badge carries its own dark
 * outline so it reads on either.
 */
const TIER_COLOURS: Record<TierId, { fill: string; edge: string }> = {
  bronze: { fill: '#c98a55', edge: '#6e4321' },
  silver: { fill: '#c9d1dc', edge: '#58606c' },
  gold: { fill: '#f2c94c', edge: '#7a5a07' },
  platinum: { fill: '#7fe0d4', edge: '#1f6b62' },
  diamond: { fill: '#8fb8ff', edge: '#27447e' },
  master: { fill: '#d39cff', edge: '#5a2a85' },
};

/** A small shield in the tier's colour, with its division numeral. */
export function TierShield({
  tier,
  division,
  className,
}: {
  tier: TierId;
  division: 1 | 2 | 3 | null;
  className?: string;
}) {
  const colours = TIER_COLOURS[tier];
  return (
    <svg viewBox="0 0 24 28" aria-hidden="true" className={cx('size-6 shrink-0', className)}>
      <path
        d="M12 1.5 22 5v8.5c0 6.4-4.3 10.9-10 13-5.7-2.1-10-6.6-10-13V5z"
        fill={colours.fill}
        stroke={colours.edge}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontSize={division === null ? 10 : 8.5}
        fontWeight="700"
        fill={colours.edge}
        fontFamily="system-ui, sans-serif"
      >
        {division === null ? '★' : ['', 'I', 'II', 'III'][division]}
      </text>
    </svg>
  );
}

/** Shield plus "Gold II", for a rating. */
export function TierBadge({
  rating,
  compact = false,
  className,
}: {
  rating: number;
  compact?: boolean;
  className?: string;
}) {
  const placement = placementFor(rating);
  const label = useTierLabels().placement(placement);
  return (
    <span
      className={cx('inline-flex items-center gap-1.5', className)}
      title={label}
      aria-label={compact ? label : undefined}
    >
      <TierShield
        tier={placement.tier}
        division={placement.division}
        className={compact ? 'size-5' : 'size-6'}
      />
      {compact ? null : <span className="text-sm">{label}</span>}
    </span>
  );
}
