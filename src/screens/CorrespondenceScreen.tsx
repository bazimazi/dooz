import { isModeId } from '@/game/engine';
import type { CorrespondenceGame } from '@/protocol/social';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BackIcon } from '@/components/art/icons';
import { ClockIcon } from '@/components/art/ui-icons';
import { Button, buttonClasses, buttonStyle } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Board, type FinishTone } from '@/game/components/Board';
import { useAccountStore } from '@/features/account/store';
import { toGame } from '@/features/online/store';
import { useSocialStore } from '@/features/social/store';
import { type Translator, useT } from '@/i18n';
import { useModeTexts } from '@/i18n/messages/modes';
import { apiErrorMessage, apiErrorText } from '@/i18n/messages/onlineApiErrors';
import { correspondenceMessages } from '@/i18n/messages/onlineCorrespondence';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/cx';
import { socialApi } from '@/lib/social-api';

/**
 * Games by correspondence: one move a day (or every two or three), against a
 * friend, kept on the server so they carry on across devices and restarts.
 *
 * Nothing is decided here. A move is a cell index sent with the number of
 * moves this screen saw, and the board shown is always the one the server
 * sent back, so a move made twice or against an old position is refused
 * rather than played somewhere unintended.
 */

const REFRESH_MS = 30_000;

type T = Translator<(typeof correspondenceMessages)['en']>;

/** A game's mode name, or "Custom game" for a config off the mode list. */
function useModeName(): (mode: string) => string {
  const t = useT(correspondenceMessages);
  const modeText = useModeTexts();
  return (mode) => (isModeId(mode) ? modeText(mode).name : t('customGame'));
}

/** "in 21 h", "in 2 days", "in 35 min" - or "overdue". */
export function dueIn(t: T, deadline: number, now = Date.now()): string {
  const left = deadline - now;
  if (left <= 0) return t('overdue');
  const minutes = Math.round(left / 60_000);
  if (minutes < 60) return t('inMinutes', { count: Math.max(1, minutes) });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t('inHours', { count: hours });
  return t('inDays', { count: Math.round(hours / 24) });
}

function statusLine(t: T, game: CorrespondenceGame): string {
  switch (game.status) {
    case 'invited':
      return game.invitedByYou
        ? t('invitationSent', { due: dueIn(t, game.deadlineAt) })
        : t('invitesYou');
    case 'active':
      return game.yourTurn
        ? t('yourMoveDue', { due: dueIn(t, game.deadlineAt) })
        : t('theirMoveDue', { due: dueIn(t, game.deadlineAt) });
    case 'finished': {
      const result = game.result;
      if (!result || result.winner === null) return t('drawn');
      const won = result.winner === game.you;
      if (result.reason === 'timeout') return won ? t('wonOnTime') : t('lostOnTime');
      if (result.reason === 'resign') return won ? t('wonByResignation') : t('lostByResignation');
      return won ? t('won') : t('lost');
    }
    case 'declined':
      return t('declined');
    case 'expired':
      return t('expired');
  }
}

/** A failure to show: the server's refusal in the interface language, else `fallback`. */
function failure(cause: unknown, fallback: string): string {
  return cause instanceof Error ? apiErrorMessage(cause) : fallback;
}

function useCredentials() {
  return useAccountStore((state) => state.credentials);
}

/**
 * A number that goes up every half minute while the screen is visible, for
 * effects to depend on when they should fetch again.
 */
function useRefreshTick(): [number, () => void] {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((value) => value + 1);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  const reload = useCallback(() => setTick((value) => value + 1), []);
  return [tick, reload];
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function CorrespondenceListScreen() {
  const t = useT(correspondenceMessages);
  const modeName = useModeName();
  const credentials = useCredentials();
  const ensureOnline = useAccountStore((state) => state.ensureOnline);
  const [games, setGames] = useState<CorrespondenceGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, reload] = useRefreshTick();

  // Games by mail live on the server, so a device without an account gets one.
  useEffect(() => {
    if (credentials) return;
    void ensureOnline().then((ok) => {
      if (!ok) setError(t('connectToSee'));
      return ok;
    });
  }, [credentials, ensureOnline, t]);

  useEffect(() => {
    if (!credentials) return;
    const controller = new AbortController();
    socialApi
      .correspondence(credentials, controller.signal)
      .then((response) => {
        setGames(response.games);
        setError(null);
        return response;
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure(cause, t('loadFailed')));
        }
      });
    return () => controller.abort();
  }, [credentials, tick, t]);

  const groups = useMemo(() => {
    const list = games ?? [];
    return [
      {
        key: 'yourMove',
        title: t('groupYourMove'),
        games: list.filter((game) => game.status === 'active' && game.yourTurn),
      },
      {
        key: 'invitations',
        title: t('groupInvitations'),
        games: list.filter((game) => game.status === 'invited'),
      },
      {
        key: 'theirMove',
        title: t('groupTheirMove'),
        games: list.filter((game) => game.status === 'active' && !game.yourTurn),
      },
      {
        key: 'finished',
        title: t('groupFinished'),
        games: list.filter((game) => game.status !== 'active' && game.status !== 'invited'),
      },
    ].filter((group) => group.games.length > 0);
  }, [games, t]);

  return (
    <Screen width="wide" scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-4">
        <IconButton as={Link} to="/friends" tone="bare" size="small" label={t('backToFriends')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <h1 className="font-display text-xl">{t('title')}</h1>
      </header>

      <div className="flex w-full flex-col gap-4 pb-6">
        {error ? (
          <Card className="w-full">
            <EmptyState
              title={t('loadFailed')}
              body={error}
              action={
                <Button size="small" className="w-auto px-4" onClick={reload}>
                  {t('tryAgain')}
                </Button>
              }
            />
          </Card>
        ) : games === null ? (
          <p className="py-10 text-center text-sm text-ink-faint">{t('loading')}</p>
        ) : groups.length === 0 ? (
          <Card className="w-full">
            <EmptyState
              icon={<ClockIcon />}
              title={t('empty')}
              body={t('emptyBody')}
              action={
                <Button as={Link} to="/friends" size="small" className="w-auto px-4">
                  {t('friends')}
                </Button>
              }
            />
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.key} className="w-full" padding="tight">
              <h2 className="px-2 py-1 text-xs tracking-wide text-ink-faint uppercase">
                {group.title}
              </h2>
              <ul className="flex flex-col">
                {group.games.map((game) => (
                  <li key={game.id} className="border-t border-stroke-soft first:border-t-0">
                    <Link
                      to="/correspondence/$id"
                      params={{ id: game.id }}
                      className="flex items-center gap-3 rounded-tile px-2 py-2.5 text-ink no-underline"
                    >
                      <AvatarBadge avatar={game.opponent.avatar} className="size-9 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm">
                          {game.opponent.displayName}
                          <span className="text-ink-faint"> · {modeName(game.mode)}</span>
                        </span>
                        <span
                          className={cx(
                            'text-xs',
                            game.yourTurn ? 'font-semibold text-mark-o' : 'text-ink-faint',
                          )}
                        >
                          {statusLine(t, game)}
                        </span>
                      </span>
                      <span className="tnum text-xs text-ink-faint">
                        {t('moves', { count: game.snapshot.moves.length })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// One game
// ---------------------------------------------------------------------------

export function CorrespondenceGameScreen({ id }: { id: string }) {
  const t = useT(correspondenceMessages);
  const modeName = useModeName();
  const credentials = useCredentials();
  const [game, setGame] = useState<CorrespondenceGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [tick, reload] = useRefreshTick();

  // A notice about this game (their move, the result) means the board changed.
  useEffect(
    () =>
      useSocialStore.subscribe((state, previous) => {
        const path = `/correspondence/${id}`;
        if (
          state.notices.some((notice) => notice.url === path && !previous.notices.includes(notice))
        ) {
          reload();
        }
      }),
    [id, reload],
  );

  useEffect(() => {
    if (!credentials) return;
    const controller = new AbortController();
    socialApi
      .correspondenceGame(credentials, id, controller.signal)
      .then((response) => {
        setGame(response.game);
        setError(null);
        return response;
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure(cause, t('loadGameFailed')));
        }
      });
    return () => controller.abort();
  }, [credentials, id, tick, t]);

  async function run(action: () => Promise<{ game?: CorrespondenceGame | undefined }>) {
    setSending(true);
    try {
      const result = await action();
      if (result.game) setGame(result.game);
      else reload();
      setError(null);
    } catch (cause) {
      setError(failure(cause, apiErrorText('Something went wrong')));
      // The position moved on under us; show the real one.
      if (cause instanceof ApiError && cause.status === 409) reload();
    } finally {
      setSending(false);
    }
  }

  const state = useMemo(() => (game ? toGame(game.snapshot) : null), [game]);
  const finishTone: FinishTone | null =
    game?.status === 'finished' && game.result
      ? game.result.winner === null
        ? 'draw'
        : game.result.winner === game.you
          ? 'win'
          : 'loss'
      : null;

  return (
    <Screen scroll>
      <header className="flex w-full items-center gap-3 pt-2 pb-3">
        <IconButton as={Link} to="/correspondence" tone="bare" size="small" label={t('backToList')}>
          <BackIcon className="rtl:-scale-x-100" />
        </IconButton>
        <h1 className="truncate font-display text-xl">
          {game ? t('versus', { name: game.opponent.displayName }) : t('gameByMail')}
        </h1>
      </header>

      {error ? (
        <p
          role="alert"
          className="mb-3 w-full rounded-tile border border-danger/40 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {game && state ? (
        <div className="flex w-full flex-col items-center gap-4 pb-6">
          <Card className="w-full" padding="tight">
            <div className="flex items-center gap-3 px-2">
              <AvatarBadge avatar={game.opponent.avatar} className="size-10 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">
                  {t('youPlay', { mode: modeName(game.mode), mark: game.you === 1 ? 'X' : 'O' })}
                </span>
                <span
                  role="status"
                  className={cx(
                    'text-xs',
                    game.yourTurn ? 'font-semibold text-mark-o' : 'text-ink-faint',
                  )}
                >
                  {statusLine(t, game)}
                </span>
              </span>
            </div>
          </Card>

          <div dir="ltr" className="contents">
            <Board
              game={state}
              onPlay={(index) =>
                void run(() =>
                  socialApi.correspondenceMove(credentials!, id, index, game.snapshot.moves.length),
                )
              }
              disabled={!game.yourTurn || sending || !credentials}
              readOnly={game.status !== 'active'}
              finishTone={finishTone}
            />
          </div>

          {game.status === 'invited' && !game.invitedByYou ? (
            <div className="grid w-full grid-cols-2 gap-2">
              <Button
                variant="ghost"
                disabled={sending}
                onClick={() =>
                  void run(() => socialApi.correspondenceAction(credentials!, id, 'decline'))
                }
              >
                {t('decline')}
              </Button>
              <Button
                variant="primary"
                disabled={sending}
                onClick={() =>
                  void run(() => socialApi.correspondenceAction(credentials!, id, 'accept'))
                }
              >
                {t('accept')}
              </Button>
            </div>
          ) : null}

          {game.status === 'invited' && game.invitedByYou ? (
            <Button
              variant="ghost"
              disabled={sending}
              onClick={() =>
                void run(() => socialApi.correspondenceAction(credentials!, id, 'decline'))
              }
            >
              {t('withdraw')}
            </Button>
          ) : null}

          {game.status === 'active' ? (
            confirmResign ? (
              <div className="flex w-full items-center gap-2">
                <span className="flex-1 text-sm text-ink-muted">{t('confirmResign')}</span>
                <Button
                  size="small"
                  variant="ghost"
                  className="w-auto px-3"
                  onClick={() => setConfirmResign(false)}
                >
                  {t('keepPlaying')}
                </Button>
                <Button
                  size="small"
                  variant="danger"
                  className="w-auto px-3"
                  disabled={sending}
                  onClick={() => {
                    setConfirmResign(false);
                    void run(() => socialApi.correspondenceAction(credentials!, id, 'resign'));
                  }}
                >
                  {t('resign')}
                </Button>
              </div>
            ) : (
              <Button
                size="small"
                variant="ghost"
                className="w-auto px-4"
                onClick={() => setConfirmResign(true)}
              >
                {t('resign')}
              </Button>
            )
          ) : null}

          {game.result?.matchId ? (
            <Link
              to="/replay/$matchId"
              params={{ matchId: game.result.matchId }}
              className={buttonClasses({ size: 'small', className: 'w-auto px-4' })}
              style={buttonStyle()}
            >
              {t('replay')}
            </Link>
          ) : null}
        </div>
      ) : !error ? (
        <p className="py-10 text-center text-sm text-ink-faint">{t('loading')}</p>
      ) : null}
    </Screen>
  );
}
