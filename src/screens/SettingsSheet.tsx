import { O, X } from '@/game/engine';
import { useState } from 'react';
import { Mark } from '@/components/art/marks';
import { LockIcon, MoonIcon, SunIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Segmented, Slider, Toggle } from '@/components/ui/Field';
import { StylePicker } from '@/components/ui/StylePicker';
import { useProgressStore } from '@/features/progress/store';
import { NotificationSettings, TelemetrySettings } from '@/features/social/SettingsExtras';
import { isSkinUnlocked, SKIN_UNLOCKS } from '@/features/progress/unlocks';
import { cx } from '@/lib/cx';
import { formatNumber, type LanguageChoice, LOCALE_INFO, LOCALES, useLocale, useT } from '@/i18n';
import { settingsMessages } from '@/i18n/messages/settings';
import {
  loadPreferences,
  savePreferences,
  type GraphicsQuality,
  type Skin,
  type ThemeChoice,
} from '@/lib/preferences';
import { sfx } from '@/lib/sound';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';
import { hapticsSupported } from '@/platform/haptics';

/**
 * The settings sheet.
 *
 * Grouped by what the player is adjusting - how it looks, how it sounds, how
 * it helps - with every group short enough to take in at a glance. Each change
 * applies the moment it is made, including to the board behind the sheet:
 * there is no "save", because a setting you have to confirm is one you cannot
 * try.
 */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);
  const [preferences, setPreferences] = useState(loadPreferences);
  // iOS has no web vibration API but the native app drives the Taptic Engine,
  // so ask the platform layer rather than the browser.
  const canVibrate = hapticsSupported();
  const t = useT(settingsMessages);

  function update(changes: Parameters<typeof savePreferences>[0]) {
    setPreferences(savePreferences(changes));
  }

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-[2px] sm:items-center sm:p-5',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        tabIndex={-1}
        className={cx(
          'w-full max-w-88 panel-shell rounded-t-[2rem] border border-stroke p-2 outline-none sm:rounded-[2rem]',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing
            ? 'animate-sheet-out sm:animate-panel-out'
            : 'animate-sheet-in sm:animate-panel-in',
        )}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto panel-face rounded-t-[1.5rem] bg-surface px-5 py-6 sm:rounded-[1.5rem]">
          <span aria-hidden="true" className="mx-auto h-1 w-10 shrink-0 rounded-full bg-ink/25" />
          <h2 className="text-center font-display text-2xl">{t('title')}</h2>

          <Group title={t('appearance')}>
            <Segmented<ThemeChoice>
              label={t('theme')}
              value={preferences.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'system', label: t('themeAuto'), title: t('themeAutoTitle') },
                { value: 'light', label: <SunIcon />, title: t('themeLight') },
                { value: 'dark', label: <MoonIcon />, title: t('themeDark') },
              ]}
            />
            <StylePicker value={preferences.style} onChange={(style) => update({ style })} />
            <SkinPicker value={preferences.skin} onChange={(skin) => update({ skin })} />
            <LanguagePicker
              value={preferences.language}
              onChange={(language) => update({ language })}
            />
          </Group>

          <Group title={t('graphics')}>
            <Segmented<GraphicsQuality>
              label={t('graphicsQuality')}
              value={preferences.graphics}
              onChange={(graphics) => update({ graphics })}
              options={[
                { value: 'low', label: t('graphicsLow') },
                { value: 'balanced', label: t('graphicsBalanced') },
                { value: 'high', label: t('graphicsHigh') },
              ]}
            />
            <p role="status" className="px-1 text-xs text-ink-muted">
              {t(`graphicsDescription.${preferences.graphics}`)}
            </p>
          </Group>

          <Group title={t('sound')}>
            <Toggle
              label={t('soundEffects')}
              description={t('soundEffectsDescription')}
              checked={preferences.sound}
              onChange={(sound) => update({ sound })}
            />
            <Toggle
              label={t('music')}
              description={t('musicDescription')}
              checked={preferences.music}
              onChange={(music) => update({ music })}
            />
            <Slider
              label={t('volume')}
              value={preferences.volume}
              disabled={!preferences.sound && !preferences.music}
              describe={(value) => t('volumePercent', { count: Math.round(value * 100) })}
              onChange={(volume) => {
                update({ volume });
                sfx.tap();
              }}
            />
            {canVibrate ? (
              <Toggle
                label={t('vibration')}
                description={t('vibrationDescription')}
                checked={preferences.haptics}
                onChange={(haptics) => update({ haptics })}
              />
            ) : null}
          </Group>

          <Group title={t('notificationsPrivacy')}>
            <NotificationSettings />
            <TelemetrySettings />
          </Group>

          <Group title={t('help')}>
            <Toggle
              label={t('hints')}
              description={t('hintsDescription')}
              checked={preferences.hints}
              onChange={(hints) => update({ hints })}
            />
          </Group>

          <Button variant="ghost" size="small" onClick={close} className="self-center">
            {t('done')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-stroke-soft bg-sunken/35 p-3">
      <h3 className="mb-1 border-b border-stroke-soft px-1 pb-2 text-xs font-semibold tracking-widest text-ink-muted uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The piece sets, each previewed with its own X and O.
 *
 * Locked sets are shown rather than hidden - a reward nobody knows exists is
 * not a goal - with a lock over the preview and what unlocks them underneath,
 * including how far along the player already is.
 */
function SkinPicker({ value, onChange }: { value: Skin; onChange: (skin: Skin) => void }) {
  const t = useT(settingsMessages);
  const locale = useLocale();
  const progress = useProgressStore();
  const [explained, setExplained] = useState<Skin | null>(null);
  const shown = SKIN_UNLOCKS.find((unlock) => unlock.skin === (explained ?? value));

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={t('pieces')} className="grid grid-cols-4 gap-2">
        {SKIN_UNLOCKS.map((unlock) => {
          const open = isSkinUnlocked(unlock.skin, progress);
          const selected = unlock.skin === value;
          const name = t(`skin.${unlock.skin}.name`);
          return (
            <button
              key={unlock.skin}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={
                open
                  ? name
                  : t('pieceLocked', {
                      name,
                      requirement: t(`skin.${unlock.skin}.requirement`, { count: unlock.need }),
                    })
              }
              onClick={() => {
                if (open) {
                  onChange(unlock.skin);
                  setExplained(null);
                } else {
                  setExplained(unlock.skin);
                  sfx.invalid();
                }
              }}
              className={cx(
                'relative flex flex-col items-center gap-1 rounded-tile border px-1 pt-2 pb-1.5',
                'transition-[transform,border-color,background-color] duration-200 ease-spring',
                'hover:-translate-y-0.5 active:scale-95',
                selected ? 'border-stroke bg-sunken' : 'border-stroke-soft',
              )}
            >
              <span className={cx('flex items-center gap-0.5', !open && 'opacity-35 grayscale')}>
                <Mark key={`x-${selected}`} player={X} skin={unlock.skin} className="size-6" />
                <Mark
                  key={`o-${selected}`}
                  player={O}
                  skin={unlock.skin}
                  hole={selected ? 'var(--color-sunken)' : 'var(--color-surface)'}
                  className="size-6"
                />
              </span>
              <span className="text-[0.6875rem] text-ink-muted">{name}</span>
              {!open ? (
                <span className="absolute end-1 top-1 text-xs text-ink-faint">
                  <LockIcon />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {shown && !isSkinUnlocked(shown.skin, progress) ? (
        <p key={shown.skin} className="animate-toast-in px-1 text-xs text-ink-muted" role="status">
          <strong className="text-ink">{t(`skin.${shown.skin}.name`)}:</strong>{' '}
          {t(`skin.${shown.skin}.requirement`, { count: shown.need })}{' '}
          <span className="tnum text-ink-faint">
            ({formatNumber(Math.min(shown.have(progress), shown.need), locale)}/
            {formatNumber(shown.need, locale)})
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The interface language: the device's own, or one of the translations, each
 * written in its own language so a player lost in the wrong one can still find
 * theirs. A native select, because six options would crowd a segmented row.
 */
function LanguagePicker({
  value,
  onChange,
}: {
  value: LanguageChoice;
  onChange: (language: LanguageChoice) => void;
}) {
  const t = useT(settingsMessages);
  return (
    <label className="flex items-center gap-3 px-1 text-sm">
      <span className="shrink-0 text-ink-muted">{t('language')}</span>
      <select
        className="h-10 min-w-0 flex-1 rounded-tile border border-stroke bg-surface px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value as LanguageChoice)}
      >
        <option value="system">{t('languageSystem')}</option>
        {LOCALES.map((locale) => (
          <option key={locale} value={locale} lang={locale} dir={LOCALE_INFO[locale].dir}>
            {LOCALE_INFO[locale].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
