import { useEffect, useState } from 'react';
import { MedalIcon, SparkIcon } from '@/components/art/ui-icons';
import { LevelBadge } from '@/features/collection/art';
import { useGraphics } from '@/lib/graphics';
import { formatNumber, useLocale, useT } from '@/i18n';
import { rewardMessages } from '@/i18n/messages/rewards';
import { cx } from '@/lib/cx';
import { loadPreferences } from '@/lib/preferences';
import { offlineAchievement } from './achievements';
import { equippedCosmetic } from './cosmetics';
import { type Award, useProgressStore } from './store';
import { allAnnouncements } from './unlocks';
import { levelProgress } from './xp';

/** When the bar starts to fill, after the panel's own entrance. */
const FILL_DELAY_MS = 650;

/**
 * What a finished game earned, for the result panel's rewards slot.
 *
 * The XP bar starts where it stood before the game and fills to where it
 * stands now, so the gain is something seen rather than a number read. A level
 * gained fills the bar, then shows the new level. Achievements and unlocks are
 * listed by name - the toast that celebrates each one arrives after the panel.
 */
export function RewardsPanel({ award, won = false }: { award: Award; won?: boolean }) {
  const graphics = useGraphics();
  const progress = useProgressStore();
  const t = useT(rewardMessages);
  const locale = useLocale();
  const before = levelProgress(award.before);
  const after = levelProgress(award.after);
  const levelled = after.level > before.level;
  const [filled, setFilled] = useState(graphics === 'low');

  useEffect(() => {
    if (filled) return;
    const timer = setTimeout(() => setFilled(true), FILL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [filled]);

  const shown = filled ? after : before;
  // A level gained fills the bar to the end rather than running it backwards
  // to the new level's start.
  const width = filled ? (levelled ? 1 : after.fraction) : before.fraction;
  const unlockNames = allAnnouncements(progress)
    .filter((entry) => award.unlocked.includes(entry.id))
    .map((entry) =>
      entry.kind === 'cosmetic' ? entry.cosmetic.name : entry.kind === 'skin' ? entry.name : '',
    )
    .filter(Boolean);
  const emote = won ? equippedCosmetic('emote', loadPreferences().cosmetics, progress).line : null;

  return (
    <div className="flex w-full flex-col gap-2 rounded-tile border border-stroke-soft bg-surface/70 px-3 py-2.5">
      {emote ? (
        <p className="self-center rounded-2xl rounded-es-sm bg-sunken px-3 py-1 text-sm font-semibold">
          {t('quoted', { text: emote })}
        </p>
      ) : null}
      <div className="flex items-center gap-2.5">
        <LevelBadge
          level={shown.level}
          className={cx('size-9 text-sm', filled && levelled && 'animate-pop')}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold">
              {filled && levelled
                ? t('levelReached', { level: after.level })
                : t('level', { level: shown.level })}
            </span>
            <span className="tnum font-semibold text-ok">{t('xpGained', { xp: award.xp })}</span>
          </div>
          <div
            role="progressbar"
            aria-label={t('xpBar')}
            aria-valuemin={0}
            aria-valuemax={after.span || 1}
            aria-valuenow={after.span ? after.into : 1}
            className="h-2 overflow-hidden rounded-full bg-sunken"
          >
            <div
              className="h-full rounded-full bg-ok transition-[width] duration-700 ease-out"
              style={{ width: `${Math.round(Math.max(0.04, width) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {award.lines.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[0.75rem] text-ink-muted">
          {award.lines.map((line, at) => (
            <li key={`${line.label}-${at}`} className="flex justify-between gap-2">
              <span className="truncate">{line.label}</span>
              <span className={cx('tnum shrink-0', line.xp < 0 && 'text-danger')}>
                {line.xp >= 0 ? '+' : '−'}
                {formatNumber(Math.abs(line.xp), locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {award.achievements.length > 0 || unlockNames.length > 0 ? (
        <ul className="flex flex-col gap-1 border-t border-stroke-soft pt-2 text-xs">
          {award.achievements.map((id) => (
            <li key={id} className="flex items-center gap-1.5 font-semibold text-ok">
              <MedalIcon className="size-4 shrink-0" />
              <span className="truncate">{offlineAchievement(id)?.name ?? id}</span>
            </li>
          ))}
          {unlockNames.map((name) => (
            <li key={name} className="flex items-center gap-1.5 font-semibold text-warn">
              <SparkIcon className="size-4 shrink-0" />
              <span className="truncate">{t('unlocked', { name })}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
