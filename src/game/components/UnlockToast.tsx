import { O, X } from '@/game/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { MedalIcon } from '@/components/art/ui-icons';
import { CosmeticArt, LevelBadge } from '@/features/collection/art';
import { useProgressStore } from '@/features/progress/store';
import {
  type Announcement,
  announcementHeading,
  freshAnnouncements,
} from '@/features/progress/unlocks';
import { sfx } from '@/lib/sound';
import { type Translator, useT } from '@/i18n';
import { gameUiMessages } from '@/i18n/messages/gameUi';

type UiText = Translator<(typeof gameUiMessages)['en']>;

/** How long a toast stays before it leaves on its own. */
const SHOW_MS = 4200;
/** Held back so it lands after the result panel rather than on top of it. */
const WAIT_MS = 2400;
/** The gap between one toast leaving and the next arriving. */
const BETWEEN_MS = 350;

/**
 * "Level up", "Achievement unlocked", "New pieces unlocked" - shown once per
 * thing earned, wherever the player is.
 *
 * It watches the progress store rather than being fired by the screen that
 * earned it, so a reward from the journey, a puzzle, the arcade or a bot game
 * all arrive the same way - and it waits until the result panel has had its
 * moment, since a reward is the second piece of good news, not the first.
 * Several earned at once queue up, most important first.
 */
export function UnlockToast() {
  const t = useT(gameUiMessages);
  const progress = useProgressStore();
  const markAnnounced = useProgressStore((state) => state.markAnnounced);
  const [showing, setShowing] = useState<Announcement | null>(null);
  // When the last toast left, so a queue drains back to back while a fresh
  // batch still waits for the result panel.
  const lastHidden = useRef(0);
  const pending = useMemo(() => freshAnnouncements(progress), [progress]);
  const next = pending[0];

  useEffect(() => {
    if (!next || showing) return;
    const queued = Date.now() - lastHidden.current < BETWEEN_MS * 3;
    const timer = setTimeout(
      () => {
        setShowing(next);
        markAnnounced([next.id]);
        sfx.sparkle(next.kind === 'level' ? 8 : 6);
      },
      queued ? BETWEEN_MS : WAIT_MS,
    );
    return () => clearTimeout(timer);
  }, [next, showing, markAnnounced]);

  useEffect(() => {
    if (!showing) return;
    const timer = setTimeout(() => {
      lastHidden.current = Date.now();
      setShowing(null);
    }, SHOW_MS);
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
        key={showing.id}
        className="flex max-w-full animate-banner items-center gap-3 rounded-full border border-stroke bg-surface py-2 ps-3 pe-5 shadow-[0_18px_40px_-16px_var(--color-shadow)]"
        style={{ animationDuration: `${SHOW_MS}ms` }}
      >
        <ToastArt entry={showing} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-xs tracking-wide text-ink-faint uppercase">
            {announcementHeading(showing)}
          </span>
          <span className="truncate font-display text-lg">{toastTitle(showing, t)}</span>
          {toastHint(showing, t) ? (
            <span className="text-[0.6875rem] text-ink-faint">{toastHint(showing, t)}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function ToastArt({ entry }: { entry: Announcement }) {
  switch (entry.kind) {
    case 'level':
      return <LevelBadge level={entry.level} className="size-9 text-sm" />;
    case 'achievement':
      return (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok/15 text-lg text-ok">
          <MedalIcon />
        </span>
      );
    case 'skin':
      return (
        <span className="flex shrink-0 items-center gap-0.5">
          <Mark player={X} skin={entry.skin} className="size-7" />
          <Mark player={O} skin={entry.skin} className="size-7" />
        </span>
      );
    case 'cosmetic':
      return <CosmeticArt cosmetic={entry.cosmetic} className="size-9" />;
  }
}

function toastTitle(entry: Announcement, t: UiText): string {
  switch (entry.kind) {
    case 'level':
      return t('level', { level: entry.level });
    case 'achievement':
    case 'skin':
      return entry.name;
    case 'cosmetic':
      return entry.cosmetic.name;
  }
}

function toastHint(entry: Announcement, t: UiText): string | null {
  if (entry.kind === 'skin') return t('skinHint');
  if (entry.kind === 'cosmetic') return t('cosmeticHint');
  return null;
}
