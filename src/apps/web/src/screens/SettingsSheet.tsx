import { useState } from 'react';
import { MoonIcon, SunIcon } from '@/components/art/ui-icons';
import { Segmented, Toggle } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';
import { loadPreferences, savePreferences, type ThemeChoice } from '@/lib/preferences';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

/**
 * The settings sheet.
 *
 * Four things, because there are only four worth having: how the app looks,
 * whether the practice hints are on, and the two links out to the account. A
 * settings screen that needs scrolling is a sign the defaults are wrong.
 */
export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);
  const [preferences, setPreferences] = useState(loadPreferences);

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
          'w-full max-w-80 rounded-t-[2rem] border border-stroke p-2 outline-none sm:rounded-[2rem]',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col gap-5 rounded-t-[1.5rem] bg-surface px-5 py-6 sm:rounded-[1.5rem]">
          <h2 className="text-center font-display text-xl">Settings</h2>

          <div className="flex flex-col gap-2">
            <span className="px-1 text-sm text-ink-muted">Appearance</span>
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
          </div>

          <Toggle
            label="Practice hints"
            description="Ring the winning and losing squares in local games."
            checked={preferences.hints}
            onChange={(hints) => update({ hints })}
          />

          <p className="px-1 text-xs text-ink-faint">
            Motion follows your system setting. With “reduce motion” on, animations are skipped and
            the board settles instantly.
          </p>

          <Button variant="ghost" size="small" onClick={close} className="self-center">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
