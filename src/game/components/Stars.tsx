import { cx } from '@/lib/cx';

const STAR_PATH = 'M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

/** A single star: gold when lit, an outline when not. */
export function StarIcon({ lit = false, className }: { lit?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d={STAR_PATH}
        fill={lit ? 'var(--color-mark-o)' : 'none'}
        stroke={lit ? 'var(--color-mark-o-edge)' : 'var(--color-stroke)'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface StarsProps {
  /** How many are earned, 0-3. */
  earned: number;
  /** Pop each earned star in on mount, one after another. */
  animate?: boolean;
  /** Seconds before the first star arrives. */
  delay?: number;
  className?: string;
}

/**
 * A row of three stars.
 *
 * Earned stars are gold and filled; the rest are outlines, so "one of three"
 * reads without counting. When they animate, each earned star spins in on its
 * own beat - the result screen's moment of reward, spread out enough to feel.
 */
export function Stars({ earned, animate = false, delay = 0, className }: StarsProps) {
  return (
    <span
      className={cx('inline-flex items-center gap-1', className)}
      role="img"
      aria-label={`${earned} of 3 stars`}
    >
      {[0, 1, 2].map((star) => {
        const lit = star < earned;
        return (
          // The middle star sits a little higher, as on a podium. The lift is
          // on a wrapper so it never fights the entrance over `transform`.
          <span key={star} className={cx('flex', star === 1 && 'translate-y-[-0.12em] scale-110')}>
            <span
              className={cx('flex', lit && animate && 'animate-star-in')}
              style={lit && animate ? { animationDelay: `${delay + star * 0.22}s` } : undefined}
            >
              <StarIcon lit={lit} className="size-[1em]" />
            </span>
          </span>
        );
      })}
    </span>
  );
}
