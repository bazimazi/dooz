import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { BackIcon } from '@/components/art/icons';
import { IconButton } from '@/components/ui/IconButton';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { LevelBadge } from '@/features/collection/art';
import { useProgressStore } from '@/features/progress/store';
import { levelProgress } from '@/features/progress/xp';
import { useT } from '@/i18n';
import { arcadeMessages } from '@/i18n/messages/arcade';
import { rewardMessages } from '@/i18n/messages/rewards';
import { cx } from '@/lib/cx';

/** The title row of an arcade screen, with the way back. */
export function PageHeader({
  title,
  back = '/',
  trailing,
}: {
  title: string;
  back?: '/' | '/arcade' | '/profile';
  trailing?: ReactNode;
}) {
  const t = useT(arcadeMessages);
  return (
    <header className="flex w-full items-center gap-3 pt-2 pb-4">
      <IconButton
        as={ReturnLink}
        to={back}
        tone="bare"
        size="small"
        label={back === '/' ? t('backHome') : t('back')}
      >
        <BackIcon />
      </IconButton>
      <h1 className="min-w-0 flex-1 truncate font-display text-xl">{title}</h1>
      {trailing}
    </header>
  );
}

/** Lives or hearts, as a row of filled and empty hearts with a spoken count. */
export function Hearts({ count, max, label }: { count: number; max: number; label?: string }) {
  const t = useT(arcadeMessages);
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={t('heartsCount', { label: label ?? t('hearts'), count, max })}
    >
      {Array.from({ length: max }, (_, at) => (
        <svg
          key={at}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cx('size-5', at < count ? 'text-danger' : 'text-ink-faint/50')}
        >
          <path
            d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21Z"
            fill={at < count ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      ))}
    </span>
  );
}

/** The player's level and XP bar, linking to the collection it unlocks. */
export function LevelStrip({ className }: { className?: string }) {
  const xp = useProgressStore((state) => state.xp);
  const { level, into, span, fraction } = levelProgress(xp);
  const t = useT(rewardMessages);
  return (
    <Link
      to="/collection"
      aria-label={span ? t('stripLabel', { level, into, span }) : t('stripLabelTop', { level })}
      className={cx(
        'flex w-full items-center gap-3 rounded-tile border border-stroke-soft bg-surface/80 px-3 py-2.5 no-underline transition-colors duration-200 hover:border-stroke',
        className,
      )}
    >
      <LevelBadge level={level} className="size-10 text-base" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-ink">{t('level', { level })}</span>
          <span className="tnum text-ink-faint">
            {span ? t('stripXp', { into, span }) : t('maxLevel')}
          </span>
        </span>
        <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-sunken">
          <span
            className="block h-full rounded-full bg-ok"
            style={{ width: `${Math.round(Math.max(0.03, fraction) * 100)}%` }}
          />
        </span>
      </span>
      <span className="shrink-0 text-xs text-ink-muted">{t('collection')}</span>
    </Link>
  );
}

/** A labelled pill, for a challenge's modifiers and a run's relics. */
export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-stroke-soft bg-surface/70 px-2.5 py-1 text-xs text-ink-muted"
    >
      {children}
    </span>
  );
}
