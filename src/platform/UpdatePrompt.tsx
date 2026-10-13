import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n';
import { platformMessages } from '@/i18n/messages/onlinePlatform';
import { checkForUpdate, type AvailableUpdate } from './updater';

/** Long enough that checking never competes with the first screen loading. */
const CHECK_AFTER_MS = 8000;

/**
 * "A new version is ready", as a small card the player can ignore.
 *
 * Never a modal: an update is the app's news, not the player's, and nothing
 * about it is urgent enough to interrupt a game. It stays until answered and
 * only installs on an explicit tap, since installing restarts the app.
 */
export function UpdatePrompt() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [state, setState] = useState<'idle' | 'installing' | 'failed'>('idle');
  const t = useT(platformMessages);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const found = await checkForUpdate();
      if (cancelled) found?.dismiss();
      else setUpdate(found);
    }
    const timer = setTimeout(() => void check(), CHECK_AFTER_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (!update) return null;

  function later() {
    update?.dismiss();
    setUpdate(null);
  }

  function install() {
    if (!update) return;
    setState('installing');
    update.install().catch(() => setState('failed'));
  }

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto flex w-full max-w-sm animate-fade-in flex-col gap-3 rounded-3xl border border-stroke bg-surface p-4 shadow-[0_18px_40px_-16px_var(--color-shadow)]">
        <div className="flex flex-col leading-tight">
          <span className="text-xs tracking-wide text-ink-faint uppercase">
            {t('updateAvailable')}
          </span>
          <span className="font-display text-lg">{t('version', { version: update.version })}</span>
          {state === 'failed' ? (
            <span className="text-sm text-ink-faint">{t('installFailed')}</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            size="small"
            variant="ghost"
            className="w-auto flex-1"
            onClick={later}
            disabled={state === 'installing'}
          >
            {t('later')}
          </Button>
          <Button
            size="small"
            variant="primary"
            className="w-auto flex-1"
            onClick={install}
            disabled={state === 'installing'}
          >
            {state === 'installing' ? t('installing') : t('restart')}
          </Button>
        </div>
      </div>
    </div>
  );
}
