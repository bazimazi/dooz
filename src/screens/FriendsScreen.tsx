import { GAME_MODES, type ModeId, modeById } from '@/game/engine';
import type { PublicProfile } from '@/protocol';
import {
  type Friend,
  formatFriendCode,
  friendCodeSchema,
  type PendingFriend,
  type Presence,
} from '@/protocol/social';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { UsersIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { Field, Segmented } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { ReturnLink } from '@/components/ui/ReturnLink';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { useSocialStore } from '@/features/social/store';
import { formatNumber, useT } from '@/i18n';
import { useModeTexts } from '@/i18n/messages/modes';
import { apiErrorMessage } from '@/i18n/messages/onlineApiErrors';
import { friendsMessages } from '@/i18n/messages/onlineFriends';
import { cx } from '@/lib/cx';
import { shareOrCopy } from '@/lib/invite';
import { socialApi } from '@/lib/social-api';

/**
 * Friends: a code to share, requests both ways, the list with who is around,
 * and from each friend a live challenge or a game by correspondence.
 *
 * The list refreshes every half minute while the screen is open, which is as
 * fresh as presence needs to be - nobody needs to know to the second that a
 * friend has started a game.
 */

const REFRESH_MS = 30_000;

const PRESENCE = {
  online: { label: 'presenceOnline', dot: 'bg-ok' },
  playing: { label: 'presencePlaying', dot: 'bg-mark-o' },
  queue: { label: 'presenceQueue', dot: 'bg-mark-x' },
  offline: { label: 'presenceOffline', dot: 'bg-ink-faint/50' },
} as const satisfies Record<Presence, { label: keyof typeof friendsMessages.en; dot: string }>;

export function FriendsScreen() {
  const t = useT(friendsMessages);
  const { friends, error, loadFriends, correspondenceTurns } = useSocialStore();

  useEffect(() => {
    void loadFriends();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void loadFriends();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadFriends]);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={ReturnLink} to="/" tone="bare" size="small" label={t('backHome')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <h1 className="font-display text-xl">{t('title')}</h1>
        <Link
          to="/correspondence"
          className="ms-auto rounded-full border border-stroke-soft px-3 py-1.5 text-xs text-ink-muted no-underline hover:text-ink"
        >
          {t('gamesByMail')}
          {correspondenceTurns > 0 ? (
            <span className="ms-1.5 rounded-full bg-mark-o px-1.5 text-on-raised">
              {formatNumber(correspondenceTurns)}
            </span>
          ) : null}
        </Link>
      </header>

      <div className="flex w-full flex-col gap-4 pb-6">
        {error && !friends ? (
          <Card className="w-full">
            <EmptyState
              title={t('loadFailed')}
              body={error}
              action={
                <Button size="small" className="w-auto px-4" onClick={() => void loadFriends()}>
                  {t('tryAgain')}
                </Button>
              }
            />
          </Card>
        ) : null}

        {friends ? (
          <>
            <CodeCard code={friends.code} />
            <AddFriend />
            {friends.incoming.length > 0 || friends.outgoing.length > 0 ? (
              <Requests incoming={friends.incoming} outgoing={friends.outgoing} />
            ) : null}
            <FriendList friends={friends.friends} />
            {friends.blocked.length > 0 ? <Blocked blocked={friends.blocked} /> : null}
          </>
        ) : !error ? (
          <p className="py-10 text-center text-sm text-ink-faint">{t('loading')}</p>
        ) : null}
      </div>
    </Screen>
  );
}

function CodeCard({ code }: { code: string }) {
  const t = useT(friendsMessages);
  const [copied, setCopied] = useState<string | null>(null);
  const shown = formatFriendCode(code);
  return (
    <Card className="w-full" padding="tight">
      <div className="flex items-center gap-3 px-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs tracking-wide text-ink-faint uppercase">{t('yourCode')}</span>
          <span
            className="tnum font-display text-2xl tracking-widest"
            aria-label={shown.split('').join(' ')}
          >
            {shown}
          </span>
        </span>
        <Button
          size="small"
          className="w-auto px-4"
          onClick={async () => {
            const result = await shareOrCopy(t('shareText', { code: shown }), t('shareTitle'));
            setCopied(
              result === 'failed' ? t('readOut') : result === 'shared' ? t('shared') : t('copied'),
            );
          }}
        >
          {t('share')}
        </Button>
      </div>
      {copied ? (
        <p role="status" className="px-2 pt-1 text-xs text-ink-faint">
          {copied}
        </p>
      ) : null}
    </Card>
  );
}

function AddFriend() {
  const t = useT(friendsMessages);
  const act = useSocialStore((state) => state.act);
  const credentials = useAccountStore((state) => state.credentials);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [found, setFound] = useState<{
    query: string;
    results: { profile: PublicProfile; relation: string }[];
  }>({ query: '', results: [] });
  const asCode = friendCodeSchema.safeParse(query);
  const trimmed = query.trim();
  // Results belong to the query they were found for; a stale answer is not shown.
  const results = !asCode.success && found.query === trimmed ? found.results : [];

  // Names are looked up as they are typed, a moment after the last key.
  useEffect(() => {
    if (!credentials || asCode.success || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void socialApi
        .search(credentials, trimmed, controller.signal)
        .then((response) => setFound({ query: trimmed, results: response.results }))
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [credentials, trimmed, asCode.success]);

  async function send(target: { code: string } | { accountId: string }) {
    const error = await act((auth) => socialApi.sendRequest(auth, target));
    setMessage(error ?? t('requestSent'));
    if (!error) setQuery('');
  }

  return (
    <Card className="w-full" padding="tight">
      <form
        className="flex flex-col gap-2 px-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (asCode.success) void send({ code: asCode.data });
        }}
      >
        <Field
          label={t('addFriend')}
          hint={message ?? t('addHint')}
          value={query}
          maxLength={20}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage(null);
          }}
          trailing={
            asCode.success ? (
              <Button type="submit" size="small" variant="primary" className="w-auto px-4">
                {t('add')}
              </Button>
            ) : null
          }
        />
      </form>
      {results.length > 0 ? (
        <ul className="mt-2 flex flex-col">
          {results.map((result) => (
            <li
              key={result.profile.accountId}
              className="flex items-center gap-3 border-t border-stroke-soft px-2 py-2"
            >
              <AvatarBadge avatar={result.profile.avatar} className="size-8 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{result.profile.displayName}</span>
              {result.relation === 'none' ? (
                <Button
                  size="small"
                  className="w-auto px-3"
                  onClick={() => void send({ accountId: result.profile.accountId })}
                >
                  {t('add')}
                </Button>
              ) : (
                <span className="text-xs text-ink-faint">
                  {result.relation === 'friend'
                    ? t('relationFriends')
                    : result.relation === 'outgoing'
                      ? t('relationRequested')
                      : t('relationAskedYou')}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function Requests({
  incoming,
  outgoing,
}: {
  incoming: PendingFriend[];
  outgoing: PendingFriend[];
}) {
  const t = useT(friendsMessages);
  const act = useSocialStore((state) => state.act);
  return (
    <Card className="w-full" padding="tight">
      <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">{t('requests')}</h2>
      <ul className="flex flex-col">
        {incoming.map((entry) => (
          <PersonRow key={entry.profile.accountId} profile={entry.profile} note={t('wantsFriends')}>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => void act((auth) => socialApi.dismiss(auth, entry.profile.accountId))}
            >
              {t('decline')}
            </Button>
            <Button
              size="small"
              variant="primary"
              className="w-auto px-3"
              onClick={() => void act((auth) => socialApi.accept(auth, entry.profile.accountId))}
            >
              {t('accept')}
            </Button>
          </PersonRow>
        ))}
        {outgoing.map((entry) => (
          <PersonRow key={entry.profile.accountId} profile={entry.profile} note={t('requestSent')}>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => void act((auth) => socialApi.dismiss(auth, entry.profile.accountId))}
            >
              {t('cancel')}
            </Button>
          </PersonRow>
        ))}
      </ul>
    </Card>
  );
}

function FriendList({ friends }: { friends: Friend[] }) {
  const t = useT(friendsMessages);
  const [open, setOpen] = useState<string | null>(null);
  // Who is around first, then everyone else by how long they have been friends.
  const order: Record<Presence, number> = { online: 0, queue: 1, playing: 2, offline: 3 };
  const sorted = friends.toSorted((a, b) => order[a.presence] - order[b.presence]);

  return (
    <Card className="w-full" padding="tight">
      <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">
        {t('friendsCount', { count: friends.length })}
      </h2>
      {friends.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title={t('noFriends')} body={t('noFriendsBody')} />
      ) : (
        <ul className="flex flex-col">
          {sorted.map((friend) => (
            <li
              key={friend.profile.accountId}
              className="border-t border-stroke-soft first:border-t-0"
            >
              <button
                type="button"
                aria-expanded={open === friend.profile.accountId}
                className="flex w-full items-center gap-3 rounded-tile px-2 py-2.5 text-start"
                onClick={() =>
                  setOpen((current) =>
                    current === friend.profile.accountId ? null : friend.profile.accountId,
                  )
                }
              >
                <span className="relative shrink-0">
                  <AvatarBadge avatar={friend.profile.avatar} className="size-9" />
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute -end-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface',
                      PRESENCE[friend.presence].dot,
                    )}
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{friend.profile.displayName}</span>
                  <span className="text-xs text-ink-faint">
                    {t(PRESENCE[friend.presence].label)}
                  </span>
                </span>
                <span aria-hidden="true" className="text-xs text-ink-faint">
                  {open === friend.profile.accountId ? '▴' : '▾'}
                </span>
              </button>
              {open === friend.profile.accountId ? <FriendActions friend={friend} /> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FriendActions({ friend }: { friend: Friend }) {
  const t = useT(friendsMessages);
  const modeText = useModeTexts();
  const navigate = useNavigate();
  const act = useSocialStore((state) => state.act);
  const [mode, setMode] = useState<ModeId>(GAME_MODES[0]?.id ?? 'classic');
  const [days, setDays] = useState<'1' | '2' | '3'>('1');
  const [confirming, setConfirming] = useState<'remove' | 'block' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = friend.profile.accountId;

  async function byMail() {
    const credentials = useAccountStore.getState().credentials;
    if (!credentials) return;
    try {
      const { game } = await socialApi.inviteCorrespondence(
        credentials,
        id,
        modeById(mode).config,
        Number(days) as 1 | 2 | 3,
      );
      void navigate({ to: '/correspondence/$id', params: { id: game.id } });
    } catch (cause) {
      setError(cause instanceof Error ? apiErrorMessage(cause) : t('inviteFailed'));
    }
  }

  return (
    <div className="flex flex-col gap-3 px-2 pb-3">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t('mode')}
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as ModeId)}
          className="h-10 rounded-tile border border-stroke bg-surface/60 px-3 text-sm text-ink"
        >
          {GAME_MODES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {modeText(entry.id).name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="small"
          variant="primary"
          onClick={() => void navigate({ to: '/play/online', search: { mode, challenge: id } })}
        >
          {t('challengeNow')}
        </Button>
        <Button size="small" onClick={() => void byMail()}>
          {t('playByMail')}
        </Button>
      </div>
      <Segmented<'1' | '2' | '3'>
        label={t('daysPerMove')}
        size="small"
        value={days}
        onChange={setDays}
        options={[
          { value: '1', label: t('days', { count: 1 }) },
          { value: '2', label: t('days', { count: 2 }) },
          { value: '3', label: t('days', { count: 3 }) },
        ]}
      />
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {confirming ? (
          <>
            <span className="me-auto self-center text-xs text-ink-muted">
              {confirming === 'block' ? t('confirmBlock') : t('confirmRemove')}
            </span>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => setConfirming(null)}
            >
              {t('keep')}
            </Button>
            <Button
              size="small"
              variant="danger"
              className="w-auto px-3"
              onClick={() =>
                void act((auth) =>
                  confirming === 'block' ? socialApi.block(auth, id) : socialApi.remove(auth, id),
                )
              }
            >
              {confirming === 'block' ? t('block') : t('remove')}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => setConfirming('remove')}
            >
              {t('remove')}
            </Button>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => setConfirming('block')}
            >
              {t('block')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Blocked({ blocked }: { blocked: PendingFriend[] }) {
  const t = useT(friendsMessages);
  const act = useSocialStore((state) => state.act);
  return (
    <Card className="w-full" padding="tight">
      <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">{t('blocked')}</h2>
      <ul className="flex flex-col">
        {blocked.map((entry) => (
          <PersonRow key={entry.profile.accountId} profile={entry.profile}>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => void act((auth) => socialApi.unblock(auth, entry.profile.accountId))}
            >
              {t('unblock')}
            </Button>
          </PersonRow>
        ))}
      </ul>
    </Card>
  );
}

function PersonRow({
  profile,
  note,
  children,
}: {
  profile: PublicProfile;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-t border-stroke-soft px-2 py-2 first:border-t-0">
      <AvatarBadge avatar={profile.avatar} className="size-8 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm">{profile.displayName}</span>
        {note ? <span className="text-xs text-ink-faint">{note}</span> : null}
      </span>
      <span className="flex shrink-0 gap-1.5">{children}</span>
    </li>
  );
}
