import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * The raised panel the whole app is built from.
 *
 * One component rather than a class string copied into every screen, because
 * the two rounded surfaces nested inside each other - an outer ring carrying
 * the border and an inner block carrying the fill - are what give the design
 * its depth, and getting the two radii to nest correctly is fiddly enough that
 * it should only be done once.
 */
interface CardProps {
  children: ReactNode;
  /** `flat` drops the outer ring, for a card inside a list. */
  tone?: 'raised' | 'flat';
  padding?: 'none' | 'tight' | 'normal' | 'roomy';
  className?: string;
  innerClassName?: string;
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  tight: 'px-3 py-3',
  normal: 'px-5 py-5',
  roomy: 'px-6 py-9',
};

export function Card({
  children,
  tone = 'raised',
  padding = 'normal',
  className,
  innerClassName,
}: CardProps) {
  if (tone === 'flat') {
    return (
      <div
        className={cx(
          'rounded-panel border border-stroke-soft bg-surface/85',
          PADDING[padding],
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cx(
        'rounded-[2rem] border border-stroke p-2',
        'shadow-[0_30px_70px_-34px_var(--color-shadow)]',
        className,
      )}
    >
      <div className={cx('rounded-[1.5rem] bg-surface', PADDING[padding], innerClassName)}>
        {children}
      </div>
    </div>
  );
}

/** A labelled block of statistics, used on the profile and the result panel. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'plain' | 'good' | 'bad';
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-tile border border-stroke-soft bg-surface/85 px-3 py-2.5">
      <span className="text-xs tracking-wide text-ink-faint uppercase">{label}</span>
      <span
        className={cx(
          'tnum text-xl leading-tight font-semibold',
          tone === 'good' && 'text-ok',
          tone === 'bad' && 'text-danger',
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
    </div>
  );
}

/**
 * What a screen shows when there is nothing to show.
 *
 * An empty list with no explanation reads as a broken one, so every list in the
 * app routes its empty case through here and says what would fill it.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon ? <span className="text-3xl text-ink-faint">{icon}</span> : null}
      <p className="text-lg font-semibold">{title}</p>
      {body ? <p className="max-w-64 text-sm text-ink-muted">{body}</p> : null}
      {action}
    </div>
  );
}
