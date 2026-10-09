import { O, X } from '@/game/engine';
import { useEffect, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { useProgressStore } from '@/features/progress/store';
import { freshUnlocks, type SkinUnlock } from '@/features/progress/unlocks';
import { sfx } from '@/lib/sound';

/** How long a toast stays before it leaves on its own. */
const SHOW_MS = 4200;
/** Held back so it lands after the result panel rather than on top of it. */
const WAIT_MS = 2400;

/**
 * "New pieces unlocked", shown once per unlock, wherever the player is.
 *
 * It watches the progress store rather than being fired by the screen that
 * earned it, so an unlock from the journey, a puzzle or a bot game all arrive
 * the same way - and it waits until the result panel has had its moment, since
 * the unlock is the second piece of good news, not the first.
 */
export function UnlockToast() {
  const progress = useProgressStore();
  const markAnnounced = useProgressStore((state) => state.markAnnounced);
  const [showing, setShowing] = useState<SkinUnlock | null>(null);
  const pending = freshUnlocks(progress);
  const next = pending[0];

  useEffect(() => {
    if (!next || showing) return;
    const timer = setTimeout(() => {
      setShowing(next);
      markAnnounced([`skin:${next.skin}`]);
      sfx.sparkle(6);
    }, WAIT_MS);
    return () => clearTimeout(timer);
  }, [next, showing, markAnnounced]);

  useEffect(() => {
    if (!showing) return;
    const timer = setTimeout(() => setShowing(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [showing]);

  if (!showing) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div
        key={showing.skin}
        className="flex animate-banner items-center gap-3 rounded-full border border-stroke bg-surface py-2 pr-5 pl-3 shadow-[0_18px_40px_-16px_var(--color-shadow)]"
        style={{ animationDuration: `${SHOW_MS}ms` }}
      >
        <span className="flex items-center gap-0.5">
          <Mark player={X} skin={showing.skin} className="size-7" />
          <Mark player={O} skin={showing.skin} className="size-7" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-xs tracking-wide text-ink-faint uppercase">
            New pieces unlocked
          </span>
          <span className="font-display text-lg">{showing.name}</span>
          <span className="text-[0.6875rem] text-ink-faint">Choose them in Settings</span>
        </span>
      </div>
    </div>
  );
}
