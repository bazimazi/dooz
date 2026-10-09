import { type GameState, modeById, type ModeId, O, type Player, X } from '@/game/engine';
import type { Avatar, Clock } from '@/protocol';
import { ROOM_CODE_LENGTH } from '@/protocol';
import { Link, useNavigate } from '@tanstack/react-router';
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
import {
  describeReason,
  outcomeFace,
  outcomeFor,
  ResultModal,
  revealDelayFor,
} from '@/game/components/ResultModal';
import { Button, buttonClasses, buttonStyle } from '@/components/ui/Button';
import { StatTile } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useTurnTint } from '@/game/useTurnTint';
import { seatsFor, useOnlineStore } from '@/features/online/store';
import { cx } from '@/lib/cx';
import { signed } from '@/lib/format';
import { inviteUrl, shareOrCopy } from '@/lib/invite';
import { sfx } from '@/lib/sound';

export interface OnlineSearch {
  mode: ModeId;
  /** Open a private room instead of joining a queue. */
  host?: boolean;
  /** Set by an invite link. */
  code?: string;
  /** Watch a game rather than play one. */
  watch?: string;
  ranked?: boolean;
}

export function OnlineScreen({ mode, host, code, watch, ranked }: OnlineSearch) {
  const store = useOnlineStore();
  const { connect, disconnect } = store;
  const accountStatus = useAccountStore((state) => state.onlineStatus);
  const initialise = useAccountStore((state) => state.ensureOnline);

  // The intent behind this visit is acted on once, as soon as the socket is
  // ready; re-running it on every render would spam the server.
  const intentSent = useRef(false);

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
    if (watch) store.spectate(watch);
    else if (code) store.joinRoom(code);
    else if (host) store.createRoom(config);
    else store.queue(config, ranked === true);
  }, [store, code, host, watch, ranked, mode]);

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
  return <OnlineLobby mode={mode} ranked={ranked === true} />;
}

/**
 * Sound and the turn tint for an online game. A component of its own because
 * the game screen returns early until a game exists, and hooks cannot follow
 * an early return.
 */
function OnlineFeedback({ game, you }: { game: GameState; you: Player | null }) {
  useGameFeedback(game, { you });
  useTurnTint(game);
  return null;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function OnlineLobby({ mode, ranked }: { mode: ModeId; ranked: boolean }) {
  const accountError = useAccountStore((state) => state.syncError);
  const retryAccount = useAccountStore((state) => state.ensureOnline);
  const { phase, reconnecting, error, roomCode, queued, queue, leave } = useOnlineStore();
  const navigate = useNavigate();
  const detail = modeById(mode);

  const status =
    phase === 'connecting' || phase === 'offline'
      ? 'Connecting…'
      : phase === 'searching'
        ? ranked
          ? 'Finding an opponent near your rating'
          : 'Finding an opponent'
        : 'Getting ready…';

  return (
    <Screen>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-5">
        <div className="w-full max-w-80 animate-panel-in rounded-[2rem] border border-stroke p-2 shadow-[0_30px_70px_-34px_var(--color-shadow)]">
          <div className="flex flex-col items-center gap-4 rounded-[1.5rem] bg-surface px-6 py-8 text-center">
            {phase === 'hosting' && roomCode ? (
              <InvitePanel code={roomCode} modeName={detail.name} />
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
                    {detail.name}
                    {ranked ? ' · Ranked' : phase === 'searching' ? ' · Casual' : ''}
                  </p>
                  {phase === 'searching' && queued > 1 ? (
                    <p className="text-xs text-ink-faint">{queued} players waiting</p>
                  ) : null}
                </div>

                <ProgressBar />

                {phase === 'searching' ? (
                  <p className="max-w-64 text-xs text-ink-faint">
                    {ranked
                      ? 'The search widens the longer you wait, so a match always arrives.'
                      : 'Anyone in this queue will do — this should be quick.'}
                  </p>
                ) : null}
              </>
            )}

            {reconnecting ? (
              <p className="flex animate-rise items-center gap-2 text-sm text-ink-muted">
                <WifiOffIcon className="size-4 animate-pulse-soft" /> Reconnecting…
              </p>
            ) : null}

            {accountError ? (
              <Button size="small" onClick={() => void retryAccount()}>
                Retry connection
              </Button>
            ) : null}
            {error || accountError ? (
              <p role="alert" className="animate-toast-in text-sm text-danger">
                {error ?? accountError}
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-3 pt-1">
              {phase === 'hosting' ? (
                <Button
                  size="small"
                  variant="ghost"
                  className="w-auto px-4"
                  onClick={() => queue(detail.config, false)}
                >
                  Find anyone instead
                </Button>
              ) : null}

              <IconButton
                tone="solid"
                label="Back to home"
                onClick={() => {
                  leave();
                  void navigate({ to: '/' });
                }}
              >
                <BackIcon />
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
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-sunken"
      role="progressbar"
      aria-label="Searching"
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

  // The share sheet can sit open longer than the screen lasts, so the timer it
  // schedules has to be cancellable.
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  async function share() {
    const result = await shareOrCopy(link, 'Play dooz with me');
    setFeedback(result);
    if (result !== 'failed') {
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setFeedback('idle'), 2500);
    }
  }

  const label =
    feedback === 'copied' ? 'Link copied' : feedback === 'shared' ? 'Shared' : 'Share link';

  return (
    <>
      <p className="animate-rise text-lg">Waiting for your friend</p>
      <p className="-mt-2 text-sm text-ink-faint">{modeName} · Private</p>

      {/* The code arrives a character at a time - it is the one thing on this
          screen the player has to read out or type, so it is worth the beat. */}
      <div
        className="w-full animate-rise rounded-tile border border-stroke bg-sunken px-4 py-3"
        style={{ animationDelay: '0.1s' }}
      >
        <span
          className="selectable flex justify-center font-mono text-3xl tracking-[0.3em]"
          aria-label={`Room code ${code.split('').join(' ')}`}
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
        <p className="animate-toast-in text-sm text-danger">
          Could not copy — read the code out instead
        </p>
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
  } = store;
  const navigate = useNavigate();
  const [confirmResign, setConfirmResign] = useState(false);

  const dismissEmote = useCallback((id: number) => useOnlineStore.getState().dismissEmote(id), []);

  if (!game) return null;

  const watching = you === null;
  const { theirs } = seatsFor(seats, you);
  const yourTurn =
    !watching && game.status === 'playing' && game.currentPlayer === you && !reconnecting;

  const finished = result !== null || game.status !== 'playing' || phase === 'opponentLeft';
  const outcome = watching ? 'draw' : outcomeFor(game, you);

  const xSeat = seats.find((seat) => seat.player === X);
  const oSeat = seats.find((seat) => seat.player === O);

  const status = reconnecting
    ? 'Reconnecting…'
    : finished
      ? ''
      : watching
        ? `${(game.currentPlayer === X ? xSeat : oSeat)?.profile.displayName ?? 'Player'} to move`
        : yourTurn
          ? 'Your turn'
          : `Waiting for ${theirs?.profile.displayName ?? 'your opponent'}`;

  const title =
    phase === 'opponentLeft' && !result
      ? 'Opponent left'
      : watching
        ? game.winner === null
          ? 'Draw'
          : `${(game.winner === X ? xSeat : oSeat)?.profile.displayName ?? 'Player'} wins`
        : outcome === 'win'
          ? 'You win!'
          : outcome === 'loss'
            ? 'You lose'
            : 'Draw';

  const ratingChange =
    result?.rating && you !== null ? (you === X ? result.rating.x : result.rating.o) : null;

  return (
    <Screen>
      <OnlineFeedback game={game} you={you} />
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={seatInfo(xSeat, you, X, clock, game, reconnecting)}
          right={seatInfo(oSeat, you, O, clock, game, reconnecting)}
          badge={
            watching
              ? 'Watching'
              : kind === 'ranked'
                ? 'Ranked'
                : kind === 'private'
                  ? 'Private'
                  : 'Casual'
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
        />

        {/* Keyed on the text so each change of turn arrives as its own line
            rather than as characters mutating in place. */}
        <p className="h-5 text-sm text-ink-muted" aria-live="polite">
          <span key={status} className="inline-block animate-toast-in">
            {status}
          </span>
        </p>

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
            aria-label="Draw offered"
            className="flex w-full max-w-board items-center gap-2 rounded-tile border border-stroke bg-surface px-3 py-2"
          >
            <HandshakeIcon className="size-5 shrink-0 text-ink-muted" />
            <span className="flex-1 text-sm">Draw offered</span>
            <Button size="small" className="w-auto px-3" onClick={() => store.respondDraw(true)}>
              Accept
            </Button>
            <Button
              size="small"
              variant="ghost"
              className="w-auto px-3"
              onClick={() => store.respondDraw(false)}
            >
              Decline
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
              title={`${spectators} watching`}
            >
              <EyeIcon className="size-4" /> {spectators}
            </span>
          ) : null}

          {!watching && !finished ? (
            <>
              <IconButton
                label="Offer a draw"
                disabled={drawRequested || reconnecting}
                onClick={store.offerDraw}
              >
                <HandshakeIcon />
              </IconButton>
              <IconButton
                label="Resign"
                disabled={reconnecting}
                onClick={() => setConfirmResign(true)}
              >
                <FlagIcon />
              </IconButton>
            </>
          ) : null}

          <IconButton
            label={watching ? 'Stop watching' : finished ? 'Back to home' : 'Leave game'}
            onClick={() => {
              store.leave();
              void navigate({ to: '/' });
            }}
          >
            <BackIcon />
          </IconButton>
        </div>

        {drawRequested && !finished ? (
          <p className="text-xs text-ink-faint" aria-live="polite">
            Draw offered — waiting for a reply
          </p>
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
              ? describeReason(result.reason, outcome)
              : phase === 'opponentLeft'
                ? 'They closed the game'
                : undefined
          }
          detail={
            ratingChange ? (
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Rating" value={ratingChange.after} hint={modeById(mode).name} />
                <StatTile
                  label="Change"
                  value={signed(ratingChange.after - ratingChange.before)}
                  tone={ratingChange.after >= ratingChange.before ? 'good' : 'bad'}
                />
              </div>
            ) : undefined
          }
          celebrate={!watching && outcome === 'win'}
          revealDelay={revealDelayFor(game, result?.reason)}
          actions={
            <>
              {!watching ? (
                <Button
                  variant="primary"
                  size="small"
                  block
                  disabled={phase === 'opponentLeft' || rematchRequested}
                  onClick={store.rematch}
                >
                  {rematchRequested
                    ? 'Waiting for them…'
                    : rematchOffered
                      ? 'Accept rematch'
                      : 'Play again'}
                </Button>
              ) : null}

              {result ? (
                <Link
                  to="/replay/$matchId"
                  params={{ matchId: result.matchId }}
                  className={buttonClasses({ size: 'small', variant: 'ghost', block: true })}
                  style={buttonStyle('ghost')}
                >
                  Watch the replay
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
                  Leaderboard
                </Button>
              ) : null}

              <Button as={Link} to="/" size="small" variant="ghost" block>
                Back to home
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
) {
  const isYou = you === player;
  return {
    name: seat?.profile.displayName ?? 'Opponent',
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
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-scrim p-5">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Resign this game?"
        className="w-full max-w-72 animate-panel-in rounded-[1.75rem] border border-stroke bg-surface p-5"
      >
        <h2 className="font-display text-lg">Resign this game?</h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          {ranked
            ? 'Your opponent wins and your rating will drop.'
            : 'Your opponent wins the game.'}
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="small" variant="ghost" block onClick={onCancel}>
            Keep playing
          </Button>
          <Button size="small" variant="danger" block onClick={onConfirm}>
            Resign
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoomCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await shareOrCopy(inviteUrl(code), 'Play dooz with me');
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
      aria-label={`Room ${code}. Copy the invite link.`}
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
