import type { Notice } from '@/protocol';
import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { UsersIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { useAccountStore } from '@/features/account/store';
import { useT } from '@/i18n';
import { socialMessages, useNoticeText } from '@/i18n/messages/onlineSocial';
import { socialApi } from '@/lib/social-api';
import { sfx } from '@/lib/sound';
import { PULSE_INTERVAL_MS, useSocialStore } from './store';

/** A challenge waits for an answer longer than news does. */
const CHALLENGE_MS = 45_000;
const NEWS_MS = 9_000;

/**
 * Notices from friends and the server, wherever the player is in the app:
 * a challenge to accept or decline, a friend request, a correspondence move.
 *
 * Also the app's check-in: while the app is on screen and has an account, it
 * polls the pulse, which both delivers notices that arrived without a socket
 * and tells friends this player is around.
 */
export function NoticeCenter() {
  const notices = useSocialStore((state) => state.notices);
  const hasAccount = useAccountStore((state) => state.credentials !== null);

  useEffect(() => {
    if (!hasAccount) return;
    const pulse = () => {
      if (document.visibilityState === 'visible') void useSocialStore.getState().pulse();
    };
    pulse();
    const timer = setInterval(pulse, PULSE_INTERVAL_MS);
    document.addEventListener('visibilitychange', pulse);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', pulse);
    };
  }, [hasAccount]);

  if (notices.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {notices.map((notice) => (
        <NoticeToast key={notice.id} notice={notice} />
      ))}
    </div>
  );
}

function NoticeToast({ notice }: { notice: Notice }) {
  const router = useRouter();
  const t = useT(socialMessages);
  const { title, body } = useNoticeText()(notice);
  const dismiss = useSocialStore((state) => state.dismissNotice);
  const challenge = notice.kind === 'challenge' && notice.code !== undefined;

  useEffect(() => {
    if (challenge) sfx.matched();
    const timer = setTimeout(() => dismiss(notice.id), challenge ? CHALLENGE_MS : NEWS_MS);
    return () => clearTimeout(timer);
  }, [challenge, dismiss, notice.id]);

  function open() {
    dismiss(notice.id);
    // Notice paths are validated as same-app relative paths by the schema.
    if (notice.url) router.history.push(notice.url);
  }

  function decline() {
    dismiss(notice.id);
    const credentials = useAccountStore.getState().credentials;
    if (credentials && notice.from) {
      void socialApi.declineChallenge(credentials, notice.from.accountId).catch(() => undefined);
    }
  }

  return (
    <div
      role={challenge ? 'alertdialog' : 'status'}
      aria-label={title}
      className="pointer-events-auto flex w-full max-w-88 animate-toast-in items-center gap-3 rounded-[1.5rem] border border-stroke bg-surface py-2.5 ps-3 pe-2.5 shadow-[0_18px_40px_-16px_var(--color-shadow)]"
    >
      {notice.from ? (
        <AvatarBadge avatar={notice.from.avatar} className="size-9 shrink-0" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stroke-soft text-lg">
          <UsersIcon />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="line-clamp-2 text-xs text-ink-muted">{body}</span>
      </span>
      {challenge ? (
        <span className="flex shrink-0 gap-1.5">
          <Button size="small" variant="ghost" className="w-auto px-3" onClick={decline}>
            {t('notNow')}
          </Button>
          <Button size="small" variant="primary" className="w-auto px-3" onClick={open}>
            {t('join')}
          </Button>
        </span>
      ) : (
        <span className="flex shrink-0 gap-1.5">
          {notice.url ? (
            <Button size="small" className="w-auto px-3" onClick={open}>
              {t('open')}
            </Button>
          ) : null}
          <Button
            size="small"
            variant="ghost"
            className="w-auto px-2.5"
            aria-label={t('dismiss')}
            onClick={() => dismiss(notice.id)}
          >
            ×
          </Button>
        </span>
      )}
    </div>
  );
}
