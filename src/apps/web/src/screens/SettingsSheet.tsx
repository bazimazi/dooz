import { O, X } from '@dooz/engine';
import { useState } from 'react';
import { Mark } from '@/components/art/marks';
import { LockIcon, MoonIcon, SunIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Segmented, Slider, Toggle } from '@/components/ui/Field';
import { useProgressStore } from '@/features/progress/store';
import { isSkinUnlocked, SKIN_UNLOCKS } from '@/features/progress/unlocks';
import { cx } from '@/lib/cx';
import { loadPreferences, savePreferences, type Skin, type ThemeChoice } from '@/lib/preferences';
import { sfx } from '@/lib/sound';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

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
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  function update(changes: Parameters<typeof savePreferences>[0]) {
    savePreferences(changes);
    setPreferences(loadPreferences());
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
        aria-label="Settings"
        tabIndex={-1}
        className={cx(
          'w-full max-w-88 rounded-t-[2rem] border border-stroke p-2 outline-none sm:rounded-[2rem]',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex max-h-[85vh] flex-col gap-5 overflow-y-auto rounded-t-[1.5rem] bg-surface px-5 py-6 sm:rounded-[1.5rem]">
          <h2 className="text-center font-display text-xl">Settings</h2>

          <Group title="Appearance">
            <Segmented<ThemeChoice>
              label="Theme"
              value={preferences.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'system', label: 'Auto', title: 'Follow the system setting' },
                { value: 'light', label: <SunIcon />, title: 'Light' },
                { value: 'dark', label: <MoonIcon />, title: 'Dark' },
              ]}
            />
            <SkinPicker value={preferences.skin} onChange={(skin) => update({ skin })} />
          </Group>

          <Group title="Sound">
            <Toggle
              label="Sound effects"
              description="Every mark plays a note — a game is a little tune."
              checked={preferences.sound}
              onChange={(sound) => update({ sound })}
            />
            <Toggle
              label="Music"
              description="A slow ambient score. Never the same twice."
              checked={preferences.music}
              onChange={(music) => update({ music })}
            />
            <Slider
              label="Volume"
              value={preferences.volume}
              disabled={!preferences.sound && !preferences.music}
              describe={(value) => `${Math.round(value * 100)} percent`}
              onChange={(volume) => {
                update({ volume });
                sfx.tap();
              }}
            />
            {canVibrate ? (
              <Toggle
                label="Vibration"
                description="A light buzz on moves and results."
                checked={preferences.haptics}
                onChange={(haptics) => update({ haptics })}
              />
            ) : null}
          </Group>

          <Group title="Help">
            <Toggle
              label="Practice hints"
              description="Ring the winning and losing squares in local games."
              checked={preferences.hints}
              onChange={(hints) => update({ hints })}
            />
            <p className="px-1 text-xs text-ink-faint">
              Motion follows your system setting. With “reduce motion” on, animations are skipped
              and the board settles instantly.
            </p>
          </Group>

          <Button variant="ghost" size="small" onClick={close} className="self-center">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-xs tracking-wide text-ink-faint uppercase">{title}</h3>
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
  const progress = useProgressStore();
  const [explained, setExplained] = useState<Skin | null>(null);
  const shown = SKIN_UNLOCKS.find((unlock) => unlock.skin === (explained ?? value));

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Pieces" className="grid grid-cols-4 gap-2">
        {SKIN_UNLOCKS.map((unlock) => {
          const open = isSkinUnlocked(unlock.skin, progress);
          const selected = unlock.skin === value;
          return (
            <button
              key={unlock.skin}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={open ? unlock.name : `${unlock.name}, locked. ${unlock.requirement}`}
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
              <span className="text-[0.6875rem] text-ink-muted">{unlock.name}</span>
              {!open ? (
                <span className="absolute top-1 right-1 text-xs text-ink-faint">
                  <LockIcon />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {shown && !isSkinUnlocked(shown.skin, progress) ? (
        <p key={shown.skin} className="animate-toast-in px-1 text-xs text-ink-muted" role="status">
          <strong className="text-ink">{shown.name}:</strong> {shown.requirement}{' '}
          <span className="tnum text-ink-faint">
            ({Math.min(shown.have(progress), shown.need)}/{shown.need})
          </span>
        </p>
      ) : null}
    </div>
  );
}
