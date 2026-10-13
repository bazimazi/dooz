import { ReturnLink, useReturnTo } from '@/components/ui/ReturnLink';
import {
  type GameState,
  modeById,
  type ModeId,
  O,
  type Player,
  startingPlayerOf,
  X,
} from '@/game/engine';
import type { Avatar, Clock } from '@/protocol';
import { ROOM_CODE_LENGTH } from '@/protocol';
import { Link, useRouter } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackIcon,
  CheckIcon,
  CopyIcon,
  SearchPlayerIcon,
  ShareIcon,
  WifiOffIcon,
} from '@/components/art/icons';
import { EyeIcon, FlagIcon, HandshakeIcon, TrophyIcon } from '@/components/art/ui-icons';
import { Board } from '@/game/components/Board';
import { EmoteBar, EmoteToast } from '@/game/components/EmoteBar';
import { GameHeader } from '@/game/components/GameHeader';
import { VariantStatus } from '@/game/components/VariantStatus';
import { RewardsPanel } from '@/features/progress/RewardsPanel';
import { useOnlineXp } from '@/features/progress/useOnlineXp';
import {
  describeReason,
  describeReasonFor,
  outcomeFace,
  ResultModal,
  revealDelayFor,
} from '@/game/components/ResultModal';
import { Button, buttonClasses, buttonStyle } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { DivisionProgress } from '@/features/competitive/DivisionProgress';
import { TournamentPanel } from '@/features/competitive/TournamentPanel';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useMusicTension } from '@/game/useMusicTension';
import { useTurnTint } from '@/game/useTurnTint';
import { seatsFor, useOnlineStore } from '@/features/online/store';
import { cx } from '@/lib/cx';
import { useT } from '@/i18n';
import { onlineMessages } from '@/i18n/messages/online';
import { useOnlineErrorText } from '@/i18n/messages/onlineErrors';
import { useModeText } from '@/i18n/messages/modes';
import { inviteUrl, shareOrCopy } from '@/lib/invite';
import { sfx } from '@/lib/sound';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

export interface OnlineSearch {
  mode: ModeId;
  /** Open a private room instead of joining a queue. */
  host?: boolean;
  /** Set by an invite link. */
  code?: string;
  /** Watch a game rather than play one. */
  watch?: string;
  ranked?: boolean;
  /** Join (or come back to) a tournament by id. */
  tournament?: string;
  /** Create a private bracket for this many players. */
  bracket?: 4 | 8 | 16;
  /** Open a private room and invite this friend (an account id) into it. */
  challenge?: string;
}

export function OnlineScreen({
  mode,
  host,
  code,
  watch,
  ranked,
  tournament,
  bracket,
  challenge,
}: OnlineSearch) {
  const router = useRouter();
  const store = useOnlineStore();
  const { connect, disconnect } = store;
  const accountStatus = useAccountStore((state) => state.onlineStatus);
  const initialise = useAccountStore((state) => state.ensureOnline);

  // The intent behind this visit is acted on once, as soon as the socket is
  // ready; re-running it on every render would spam the server. A queue place
  // or room lost to a reconnect is asked for again by the store itself.
  const intentSent = useRef(false);

  // An intentional page departure releases the room/queue immediately.
  // Closing the socket alone would leave an opponent waiting for reconnect.
  useEffect(
    () =>
      router.subscribe('onBeforeNavigate', ({ toLocation }) => {
        if (toLocation.pathname !== '/play/online') useOnlineStore.getState().leave(false);
      }),
    [router],
  );

  useEffect(() => {
    void initialise();
  }, [initialise]);

  // The socket cannot introduce itself until there is an account to introduce,
  // so connecting waits on it rather than failing and retrying.
  useEffect(() => {
    if (accountStatus !== 'ready') return;
    connect();
    return () => disconnect();
  }, [accountStatus, connect, disconnect]);

  useEffect(() => {
    if (intentSent.current || store.phase !== 'idle') return;
    intentSent.current = true;

    const config = modeById(mode).config;
    // A tournament pairs its own games, so joining one is the whole intent.
    if (tournament) store.joinTournament(tournament);
    else if (bracket) store.createBracket(config, bracket);
    else if (watch) store.spectate(watch);
    else if (code) store.joinRoom(code);
    else if (challenge) store.challenge(challenge, config);
    else if (host) store.createRoom(config);
    else store.queue(config, ranked === true);
  }, [store, code, host, watch, ranked, mode, tournament, bracket, challenge]);

  // The moment a search or a private room turns into a game gets its own
  // chime - it is often heard from another tab, while waiting.
  const previousPhase = useRef(store.phase);
  useEffect(() => {
    const before = previousPhase.current;
    previousPhase.current = store.phase;
    if ((before === 'searching' || before === 'hosting') && store.phase === 'playing') {
      sfx.matched();
    }
  }, [store.phase]);

  if (store.phase === 'playing' || store.phase === 'watching' || store.phase === 'opponentLeft') {
    return <OnlineGame mode={mode} />;
  }
  return (
    <OnlineLobby
      mode={mode}
      ranked={ranked === true}
      tournament={tournament ?? null}
      competing={tournament !== undefined || bracket !== undefined}
    />
  );
}

/**
 * Sound and the turn tint for an online game. A component of its own because
 * the game screen returns early until a game exists, and hooks cannot follow
 * an early return.
 */
function OnlineFeedback({ game, you }: { game: GameState; you: Player | null }) {
  useGameFeedback(game, { you });
  useTurnTint(game);
  // The score follows how far the game has gone, never where its threats are.
  useMusicTension(game, { assist: false });
  return null;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function OnlineLobby({
  mode,
  ranked,
  tournament,
  competing,
}: {
  mode: ModeId;
  ranked: boolean;
  tournament: string | null;
  competing: boolean;
}) {
  const accountError = useAccountStore((state) => state.syncError);
  const retryAccount = useAccountStore((state) => state.ensureOnline);
  const { phase, reconnecting, error, errorCode, roomCode, queued, queue, botAt } =
    useOnlineStore();
  const returnTo = useReturnTo();
  const detail = modeById(mode);
  const modeName = useModeText(mode).name;
  const t = useT(onlineMessages);
  const errorText = useOnlineErrorText();

  const status =
    phase === 'connecting' || phase === 'offline'
      ? t('connecting')
      : phase === 'searching'
        ? ranked
          ? t('findingRanked')
          : t('finding')
        : t('gettingReady');

  return (
    <Screen>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-5">
        <div className="w-full max-w-80 animate-panel-in rounded-[2rem] border border-stroke p-2 shadow-[0_30px_70px_-34px_var(--color-shadow)]">
          <div className="flex flex-col items-center gap-4 rounded-[1.5rem] bg-surface px-6 py-8 text-center">
            {competing && phase !== 'hosting' && phase !== 'searching' ? (
              <TournamentPanel fallbackId={tournament} />
            ) : phase === 'hosting' && roomCode ? (
              <InvitePanel code={roomCode} modeName={modeName} />
            ) : (
              <>
                {/* The magnifier sweeps rather than blinks: a search that is
                    still going should look like it is doing something. */}
                <SearchPlayerIcon
                  className={cx(
                    'size-12 origin-bottom',
                    phase === 'searching' && 'animate-sweep',
                    (phase === 'connecting' || phase === 'offline') && 'animate-pulse-soft',
                  )}
                />

                <div className="flex flex-col gap-1">
                  <p className="animate-rise text-lg" style={{ animationDelay: '0.12s' }}>
                    {status}
                  </p>
                  <p className="text-sm text-ink-faint">
                    {ranked
                      ? t('modeRanked', { mode: modeName })
                      : phase === 'searching'
                        ? t('modeCasual', { mode: modeName })
                        : modeName}
                  </p>
                  {phase === 'searching' && queued > 1 ? (
                    <p className="text-xs text-ink-faint">
                      {t('playersWaiting', { count: queued })}
                    </p>
                  ) : null}
                </div>

                <ProgressBar />

                {phase === 'searching' ? (
                  <p className="max-w-64 text-xs text-ink-faint">
                    {ranked ? t('searchRanked') : t('searchCasual')}
                    {botAt !== null ? ` ${t('botNote')}` : ''}
                  </p>
                ) : null}
              </>
            )}

            {reconnecting ? (
              <p className="flex animate-rise items-center gap-2 text-sm text-ink-muted">
                <WifiOffIcon className="size-4 animate-pulse-soft" /> {t('reconnecting')}
              </p>
            ) : null}

            {accountError ? (
              <Button size="small" onClick={() => void retryAccount()}>
                {t('retryConnection')}
              </Button>
            ) : null}
            {error || accountError ? (
              <p role="alert" className="animate-toast-in text-sm text-danger">
                {error !== null ? errorText(errorCode, error) : accountError}
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-3 pt-1">
              {phase === 'hosting' ? (
                <Button
                  size="small"
                  variant="ghost"
                  className="w-auto px-3 whitespace-nowrap"
                  onClick={() => queue(detail.config, false)}
                >
                  {t('findAnyone')}
                </Button>
              ) : null}

              <IconButton
                tone="solid"
                label={t('backToHome')}
                onClick={() => {
                  void returnTo('/');
                }}
              >
                <BackIcon className="rtl:-scale-x-100" />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

/**
 * The indeterminate bar under "searching…".
 *
 * The travelling block is a gradient with soft ends rather than a hard pill, so
 * it reads as a sweep of light across the track instead of a brick sliding
 * along it - and it eases at both ends, which is what stops the loop looking
 * like a stutter every time it wraps.
 */
function ProgressBar() {
  const t = useT(onlineMessages);
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-sunken"
      role="progressbar"
      aria-label={t('searching')}
    >
      <div
        className="h-full w-1/3 animate-slide-track rounded-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--color-stroke) 35%, var(--color-stroke) 65%, transparent)',
        }}
      />
    </div>
  );
}

function InvitePanel({ code, modeName }: { code: string; modeName: string }) {
  const [feedback, setFeedback] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const link = inviteUrl(code);
  const t = useT(onlineMessages);

  // The share sheet can sit open longer than the screen lasts, so the timer it
  // schedules has to be cancellable.
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function share() {
    const result = await shareOrCopy(link, t('inviteTitle'));
    setFeedback(result);
    if (result !== 'failed') {
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setFeedback('idle'), 2500);
    }
  }

  const label =
    feedback === 'copied' ? t('linkCopied') : feedback === 'shared' ? t('shared') : t('shareLink');

  return (
    <>
      <p className="animate-rise text-lg">{t('waitingForFriend')}</p>
      <p className="-mt-2 text-sm text-ink-faint">{t('modePrivate', { mode: modeName })}</p>

      {/* The code arrives a character at a time - it is the one thing on this
          screen the player has to read out or type, so it is worth the beat. */}
      <div
        className="w-full animate-rise rounded-tile border border-stroke bg-sunken px-4 py-3"
        style={{ animationDelay: '0.1s' }}
      >
        <span
          className="selectable flex justify-center font-mono text-3xl tracking-[0.3em]"
          aria-label={t('roomCodeSpelled', { code: code.split('').join(' ') })}
        >
          {code.split('').map((character, position) => (
            <span
              key={position}
              aria-hidden="true"
              className="animate-pop"
              style={{ animationDelay: `${0.18 + position * 0.06}s` }}
            >
              {character}
            </span>
          ))}
        </span>
      </div>

      <Button
        variant="primary"
        size="small"
        block
        className="animate-rise"
        style={{ animationDelay: '0.24s' }}
        onClick={share}
        icon={feedback === 'copied' || feedback === 'shared' ? <CheckIcon /> : <ShareIcon />}
      >
        {/* Keyed on the label so the swap to "link copied" pops rather than
            silently replacing the text under the pointer. */}
        <span key={label} className="animate-toast-in">
          {label}
        </span>
      </Button>

      {feedback === 'failed' ? (
        <p className="animate-toast-in text-sm text-danger">{t('copyFailed')}</p>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

function OnlineGame({ mode }: { mode: ModeId }) {
  const store = useOnlineStore();
  const {
    game,
    you,
    seats,
    kind,
    phase,
    reconnecting,
    roomCode,
    clock,
    result,
    spectators,
    rematchOffered,
    rematchRequested,
    drawOffered,
    drawRequested,
    emotes,
    muted,
    tournamentGame,
    berserk,
  } = store;
  const returnTo = useReturnTo();
  const [confirmResign, setConfirmResign] = useState(false);
  const t = useT(onlineMessages);

  const dismissEmote = useCallback((id: number) => useOnlineStore.getState().dismissEmote(id), []);
  // The level is solo progress; an online match feeds it like any other game.
  const award = useOnlineXp(result, you, mode);

  if (!game) return null;

  const watching = you === null;
  const { theirs } = seatsFor(seats, you);
  const yourTurn =
    !watching && game.status === 'playing' && game.currentPlayer === you && !reconnecting;

  const finished = result !== null || game.status !== 'playing' || phase === 'opponentLeft';
  // The server's verdict wins over the board: a resignation, a flag or an
  // abandoned seat ends the match while the board itself is still in play.
  const winner = result ? result.winner : game.status === 'won' ? game.winner : null;
  const outcome = watching || winner === null ? 'draw' : winner === you ? 'win' : 'loss';
  const misere = game.config.variant === 'misere';

  const xSeat = seats.find((seat) => seat.player === X);
  const oSeat = seats.find((seat) => seat.player === O);

  const status = reconnecting
    ? t('reconnecting')
    : finished
      ? ''
      : watching
        ? t('toMove', {
            name: (game.currentPlayer === X ? xSeat : oSeat)?.profile.displayName ?? t('player'),
          })
        : yourTurn
          ? t('yourTurn')
          : theirs
            ? t('waitingFor', { name: theirs.profile.displayName })
            : t('waitingForOpponent');

  const title =
    phase === 'opponentLeft' && !result
      ? t('opponentLeft')
      : watching
        ? winner === null
          ? t('draw')
          : t('wins', {
              name: (winner === X ? xSeat : oSeat)?.profile.displayName ?? t('player'),
            })
        : outcome === 'win'
          ? t('youWin')
          : outcome === 'loss'
            ? t('youLose')
            : t('draw');

  const ratingChange =
    result?.rating && you !== null ? (you === X ? result.rating.x : result.rating.o) : null;
  // Bots are labelled wherever they sit; the badge says so as well as the name.
  const vsBot = seats.some((seat) => seat.profile.bot);
  // Berserk is offered before your own first move, in an arena that allows it.
  const ownMoves =
    you === null
      ? 0
      : Math.floor((game.moves.length + (startingPlayerOf(game) === you ? 1 : 0)) / 2);
  const mayBerserk =
    !watching &&
    !finished &&
    you !== null &&
    tournamentGame?.berserk === true &&
    !berserk.includes(you) &&
    ownMoves === 0;

  return (
    <Screen>
      <OnlineFeedback game={game} you={you} />
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={seatInfo(xSeat, you, X, clock, game, reconnecting, t('opponent'))}
          right={seatInfo(oSeat, you, O, clock, game, reconnecting, t('opponent'))}
          badge={
            watching
              ? t('badgeWatching')
              : tournamentGame
                ? berserk.length > 0
                  ? t('badgeTournamentBerserk')
                  : t('badgeTournament')
                : vsBot
                  ? t('badgeVsBot')
                  : kind === 'ranked'
                    ? t('badgeRanked')
                    : kind === 'private'
                      ? t('badgePrivate')
                      : t('badgeCasual')
          }
        />
      </div>

      <main
        className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-3 py-5"
        style={{ animationDelay: '0.12s' }}
      >
        <Board
          game={game}
          onPlay={store.play}
          disabled={!yourTurn}
          readOnly={watching}
          finishTone={finished && !watching ? outcome : null}
          // No callouts that point at a standing threat in online play.
          assist={false}
        />

        {/* Keyed on the text so each change of turn arrives as its own line
            rather than as characters mutating in place. */}
        <p className="h-5 text-sm text-ink-muted" aria-live="polite">
          <span key={status} className="inline-block animate-toast-in">
            {status}
          </span>
        </p>
        {/* The rule set's own reminder - Order and Chaos's roles, the powers
            each side has left - exactly as the local screens show it. */}
        <VariantStatus game={game} />

        {emotes.length > 0 ? (
          <div className="flex w-full max-w-board flex-col gap-1.5">
            {emotes.map((emote) => (
              <EmoteToast key={emote.id} emote={emote} you={you} onDone={dismissEmote} />
            ))}
          </div>
        ) : null}

        {drawOffered && !finished ? (
          <div
            role="alertdialog"
            aria-label={t('drawOffered')}
            className="flex w-full max-w-board items-center gap-2 rounded-tile border border-stroke bg-surface px-3 py-2"
          >
            <HandshakeIcon className="size-5 shrink-0 text-ink-muted" />
            <span className="flex-1 text-sm">{t('drawOffered')}</span>
            <Button size="small" className="w-auto px-3" onClick={() => store.respondDraw(true)}>
              {t('accept')}
            </Button>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => store.respondDraw(false)}
            >
              {t('decline')}
            </Button>
          </div>
        ) : null}
      </main>

      <footer
        className="flex w-full animate-rise flex-col items-center gap-2 pb-3"
        style={{ animationDelay: '0.22s' }}
      >
        {!watching && !finished ? (
          <EmoteBar
            onSend={store.sendEmote}
            muted={muted}
            onMuteChange={store.setMuted}
            disabled={reconnecting}
          />
        ) : null}

        <div className="flex items-center gap-2.5">
          {roomCode && kind === 'private' ? <RoomCodeChip code={roomCode} /> : null}

          {spectators > 0 ? (
            <span
              className="flex h-10 items-center gap-1.5 rounded-tile border border-stroke-soft px-3 text-xs text-ink-faint"
              title={t('watchingCount', { count: spectators })}
            >
              <EyeIcon className="size-4" /> {spectators}
            </span>
          ) : null}

          {!watching && !finished ? (
            <>
              <IconButton
                label={t('offerDraw')}
                disabled={drawRequested || reconnecting}
                onClick={store.offerDraw}
              >
                <HandshakeIcon />
              </IconButton>
              <IconButton
                label={t('resign')}
                disabled={reconnecting}
                onClick={() => setConfirmResign(true)}
              >
                <FlagIcon />
              </IconButton>
            </>
          ) : null}

          <IconButton
            label={watching ? t('stopWatching') : finished ? t('backToHome') : t('leaveGame')}
            onClick={() => {
              void returnTo('/');
            }}
          >
            <BackIcon className="rtl:-scale-x-100" />
          </IconButton>
        </div>

        {drawRequested && !finished ? (
          <p className="text-xs text-ink-faint" aria-live="polite">
            {t('drawPending')}
          </p>
        ) : null}

        {mayBerserk ? (
          <Button size="small" variant="ghost" className="w-auto px-4" onClick={store.goBerserk}>
            {t('berserk')}
          </Button>
        ) : null}
      </footer>

      {confirmResign ? (
        <ConfirmResign
          onCancel={() => setConfirmResign(false)}
          onConfirm={() => {
            setConfirmResign(false);
            store.resign();
          }}
          ranked={kind === 'ranked'}
        />
      ) : null}

      {finished ? (
        <ResultModal
          title={title}
          art={phase === 'opponentLeft' && !result ? <WifiOffIcon /> : outcomeFace(outcome)}
          note={
            result
              ? watching
                ? describeReasonFor(
                    result.reason,
                    {
                      winner: (winner === O ? oSeat : xSeat)?.profile.displayName ?? t('player'),
                      loser: (winner === O ? xSeat : oSeat)?.profile.displayName ?? t('player'),
                    },
                    misere,
                  )
                : describeReason(result.reason, outcome, misere)
              : phase === 'opponentLeft'
                ? t('theyClosed')
                : undefined
          }
          tone={outcome}
          game={game}
          rating={ratingChange}
          detail={
            kind === 'ranked' && ratingChange ? (
              <DivisionProgress change={ratingChange} />
            ) : undefined
          }
          rewards={award ? <RewardsPanel award={award} won={outcome === 'win'} /> : null}
          celebrate={!watching && outcome === 'win'}
          revealDelay={revealDelayFor(game, result?.reason)}
          actions={
            <>
              {!watching && tournamentGame ? (
                <Button variant="primary" size="small" block onClick={() => store.leave()}>
                  {t('backToTournament')}
                </Button>
              ) : null}

              {!watching && !tournamentGame ? (
                <Button
                  variant="primary"
                  size="small"
                  block
                  disabled={phase === 'opponentLeft' || rematchRequested}
                  onClick={store.rematch}
                >
                  {rematchRequested
                    ? t('waitingForThem')
                    : rematchOffered
                      ? t('acceptRematch')
                      : t('playAgain')}
                </Button>
              ) : null}

              {result ? (
                <Link
                  to="/replay/$matchId"
                  params={{ matchId: result.matchId }}
                  className={buttonClasses({ size: 'small', variant: 'ghost', block: true })}
                  style={buttonStyle('ghost')}
                >
                  {t('watchReplay')}
                </Link>
              ) : null}

              {kind === 'ranked' ? (
                <Button
                  as={Link}
                  to="/leaderboard"
                  size="small"
                  variant="ghost"
                  block
                  icon={<TrophyIcon />}
                >
                  {t('leaderboard')}
                </Button>
              ) : null}

              <Button as={ReturnLink} to="/" size="small" variant="ghost" block>
                {t('backToHome')}
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

function seatInfo(
  seat:
    | {
        profile: { displayName: string; avatar: Avatar; rating: number | null };
        connected: boolean;
      }
    | undefined,
  you: number | null,
  player: number,
  clock: Clock | null,
  game: { currentPlayer: number; status: string },
  reconnecting: boolean,
  fallbackName: string,
) {
  const isYou = you === player;
  return {
    name: seat?.profile.displayName ?? fallbackName,
    avatar: seat?.profile.avatar,
    connected: isYou ? !reconnecting : (seat?.connected ?? true),
    isYou,
    rating: seat?.profile.rating ?? null,
    timeMs: clock ? (player === X ? clock.x : clock.o) : null,
    ticking: clock?.running === player && game.status === 'playing',
  };
}

function ConfirmResign({
  onCancel,
  onConfirm,
  ranked,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  ranked: boolean;
}) {
  const { closing, close } = useClosing(onCancel);
  const panelRef = useDialog<HTMLDivElement>(close);
  const t = useT(onlineMessages);
  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={t('resignTitle')}
        tabIndex={-1}
        className={cx(
          'max-h-[calc(100dvh-2.5rem)] w-full max-w-72 overflow-y-auto rounded-[1.75rem] border border-stroke bg-surface p-5 outline-none',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <h2 className="font-display text-lg">{t('resignTitle')}</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          {ranked ? t('resignRanked') : t('resignCasual')}
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="small" variant="ghost" block onClick={close}>
            {t('keepPlaying')}
          </Button>
          <Button size="small" variant="danger" block onClick={onConfirm}>
            {t('resign')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoomCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t = useT(onlineMessages);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await shareOrCopy(inviteUrl(code), t('inviteTitle'));
        if (result === 'failed') return;
        setCopied(true);
        clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setCopied(false), 2000);
      }}
      className={cx(
        'glass-edge flex h-12 items-center gap-2 rounded-tile px-3 font-mono text-sm tracking-[0.2em]',
        'transition-[transform,filter] duration-200 ease-soft',
        'hover:-translate-y-0.5 hover:brightness-115 active:translate-y-0 active:scale-95 active:duration-75',
      )}
      aria-label={t('roomChip', { code })}
    >
      {code}
      {/* The tick replaces the copy glyph with a pop, which is the whole
          confirmation - there is no room here for a message. */}
      <span key={copied ? 'copied' : 'idle'} className="block animate-pop">
        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      </span>
    </button>
  );
}

export { ROOM_CODE_LENGTH };
