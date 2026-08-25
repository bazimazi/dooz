import { type BoardSize, O, X } from '@dooz/engine';
import { ROOM_CODE_LENGTH } from '@dooz/protocol';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  BackIcon,
  CheckIcon,
  CopyIcon,
  HomeIcon,
  SearchPlayerIcon,
  ShareIcon,
  WifiOffIcon,
} from '@/components/art/icons';
import { Board } from '@/components/game/Board';
import { GameHeader } from '@/components/game/GameHeader';
import { outcomeFor, outcomeMark, ResultModal } from '@/components/game/ResultModal';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useOnlineStore } from '@/features/online/store';
import { cx } from '@/lib/cx';
import { inviteUrl, shareOrCopy } from '@/lib/invite';

export interface OnlineSearch {
  size: BoardSize;
  /** Open a private room instead of joining the public queue. */
  host?: boolean;
  /** Set by an invite link. */
  code?: string;
}

export function OnlineScreen({ size, host, code }: OnlineSearch) {
  const store = useOnlineStore();
  const { connect, disconnect } = store;
  // The intent behind this visit is acted on once, as soon as the socket is
  // ready; re-running it on every render would spam the server.
  const intentSent = useRef(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (intentSent.current || store.phase !== 'idle') return;
    intentSent.current = true;

    if (code) store.joinRoom(code);
    else if (host) store.createRoom(size);
    else store.quickMatch(size);
  }, [store, code, host, size]);

  if (store.phase === 'playing' || store.phase === 'opponentLeft') return <OnlineGame />;
  return <OnlineLobby size={size} />;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function OnlineLobby({ size }: { size: BoardSize }) {
  const { phase, reconnecting, error, roomCode, quickMatch, leave } = useOnlineStore();
  const navigate = useNavigate();

  return (
    <Screen>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
        <div className="w-full max-w-78 animate-panel-in rounded-[3rem] border border-b8 p-2 shadow-[0_30px_70px_-34px_rgb(0_0_0/0.9)]">
          <div className="flex flex-col items-center gap-5 rounded-[2.75rem] bg-raised px-6 py-10 text-center">
            {phase === 'hosting' && roomCode ? (
              <InvitePanel code={roomCode} />
            ) : (
              <>
                {/* The magnifier sweeps rather than blinks: a search that is
                    still going should look like it is doing something. */}
                <SearchPlayerIcon
                  className={cx(
                    'size-14 origin-bottom',
                    phase === 'searching' && 'animate-sweep',
                    (phase === 'connecting' || phase === 'offline') && 'animate-pulse-soft',
                  )}
                />
                <p className="animate-rise text-xl" style={{ animationDelay: '0.12s' }}>
                  {phase === 'connecting' || phase === 'offline'
                    ? 'connecting…'
                    : phase === 'searching'
                      ? 'searching for an opponent'
                      : 'getting ready…'}
                </p>
                <ProgressBar />
              </>
            )}

            {reconnecting ? (
              <p className="flex animate-rise items-center gap-2 text-sm text-g8/80">
                <WifiOffIcon className="size-4 animate-pulse-soft" /> reconnecting…
              </p>
            ) : null}

            {error ? <p className="animate-toast-in text-sm text-p3">{error}</p> : null}

            <div className="flex items-center gap-4 pt-2">
              <IconButton
                tone="solid"
                label="Back"
                onClick={() => {
                  leave();
                  void navigate({ to: '/' });
                }}
              >
                <BackIcon />
              </IconButton>
              <IconButton as={Link} to="/" tone="solid" label="Back to home">
                <HomeIcon />
              </IconButton>
            </div>
          </div>
        </div>

        {phase === 'hosting' ? (
          <button
            type="button"
            onClick={() => quickMatch(size)}
            className={cx(
              'animate-rise text-sm text-g8/80 underline underline-offset-4',
              'transition-[color,text-underline-offset] duration-200 hover:text-g10 hover:underline-offset-[6px]',
            )}
            style={{ animationDelay: '0.2s' }}
          >
            or find any opponent instead
          </button>
        ) : null}

        <div
          className="flex w-full animate-rise justify-center"
          style={{ animationDelay: '0.26s' }}
        >
          <JoinByCode />
        </div>
        <div
          className="flex w-full animate-rise justify-center"
          style={{ animationDelay: '0.32s' }}
        >
          <NameField />
        </div>
      </div>
    </Screen>
  );
}

/** Lets the player set the name their opponent sees. */
function NameField() {
  const { name, setName } = useOnlineStore();
  const [draft, setDraft] = useState(name);

  return (
    <label className="flex w-full max-w-78 items-center gap-3 text-sm text-g8/70">
      <span className="shrink-0">you are</span>
      <input
        value={draft}
        maxLength={24}
        onChange={(event) => setDraft(event.target.value)}
        // Committed on blur rather than on every keystroke, so a rename is one
        // message to the server instead of one per letter.
        onBlur={() => setName(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        aria-label="Your display name"
        className={cx(
          'h-10 min-w-0 flex-1 rounded-tile border border-b8 bg-b8/15 px-3 text-g10',
          'transition-[background-color,border-color,box-shadow] duration-200',
          'hover:bg-b8/25 focus:bg-b8/25 focus:shadow-[0_0_0_3px_rgb(85_112_253/0.3)] focus:outline-none',
        )}
      />
    </label>
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
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-g10/90">
      <div
        className="h-full w-1/3 animate-slide-track rounded-full"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--color-b2) 25%, var(--color-b4) 50%, var(--color-b2) 75%, transparent)',
        }}
      />
    </div>
  );
}

function InvitePanel({ code }: { code: string }) {
  const [feedback, setFeedback] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const link = inviteUrl(code);

  async function share() {
    const result = await shareOrCopy(link, 'Play dooz with me');
    setFeedback(result);
    if (result !== 'failed') setTimeout(() => setFeedback('idle'), 2500);
  }

  const label =
    feedback === 'copied' ? 'link copied' : feedback === 'shared' ? 'shared' : 'share link';

  return (
    <>
      <p className="animate-rise text-xl">waiting for your friend</p>

      {/* The code arrives a character at a time - it is the one thing on this
          screen the player has to read out or type, so it is worth the beat. */}
      <div
        className="w-full animate-rise rounded-tile border border-b8 bg-b2 px-4 py-3"
        style={{ animationDelay: '0.1s' }}
      >
        <span className="flex justify-center font-mono text-3xl tracking-[0.3em]" aria-label={code}>
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
        className="h-12 animate-rise text-lg"
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
        <p className="animate-toast-in text-sm text-p3">
          could not copy - read the code out instead
        </p>
      ) : null}
    </>
  );
}

function JoinByCode() {
  const { joinRoom } = useOnlineStore();
  const [code, setCode] = useState('');
  const ready = code.trim().length === ROOM_CODE_LENGTH;

  return (
    <form
      className="flex w-full max-w-78 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) joinRoom(code);
      }}
    >
      <input
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH))}
        placeholder="have a code?"
        aria-label="Room code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className={cx(
          'h-12 min-w-0 flex-1 rounded-tile border border-b8 bg-b8/15 px-4 text-center',
          'font-mono tracking-[0.25em] placeholder:font-sans placeholder:tracking-normal placeholder:text-g8/50',
          'transition-[background-color,border-color,box-shadow] duration-200',
          'hover:bg-b8/25 focus:bg-b8/25 focus:shadow-[0_0_0_3px_rgb(85_112_253/0.3)] focus:outline-none',
          // A complete code lights the field, so the join button is not the
          // only thing telling you it is ready to send.
          ready && 'border-p3/70 bg-b8/30',
        )}
      />
      <IconButton
        type="submit"
        label="Join game"
        disabled={!ready}
        className={ready ? 'animate-glow-ring' : undefined}
        style={{ '--glow': 'rgb(255 153 246 / 0.45)' } as React.CSSProperties}
      >
        <CheckIcon />
      </IconButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

function OnlineGame() {
  const {
    game,
    you,
    opponent,
    phase,
    reconnecting,
    roomCode,
    rematchOffered,
    rematchRequested,
    play,
    rematch,
    leave,
  } = useOnlineStore();
  const navigate = useNavigate();

  if (!game || !you) return null;

  const yourTurn = game.status === 'playing' && game.currentPlayer === you && !reconnecting;
  const yourSeat = { name: 'You', isYou: true, connected: !reconnecting };
  const theirSeat = {
    name: opponent?.name ?? 'Opponent',
    connected: opponent?.connected ?? true,
  };

  const finished = game.status !== 'playing';
  const outcome = outcomeFor(game, you);
  const title =
    phase === 'opponentLeft'
      ? 'opponent left'
      : outcome === 'win'
        ? 'you Won!'
        : outcome === 'loss'
          ? 'you lose!'
          : 'Draw';

  const status = reconnecting
    ? 'reconnecting…'
    : game.status !== 'playing'
      ? ''
      : yourTurn
        ? 'your turn'
        : `waiting for ${theirSeat.name}`;

  return (
    <Screen>
      <div className="w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={you === X ? yourSeat : theirSeat}
          right={you === O ? yourSeat : theirSeat}
        />
      </div>

      <main
        className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-4 py-6"
        style={{ animationDelay: '0.12s' }}
      >
        <Board
          game={game}
          onPlay={play}
          disabled={!yourTurn}
          finishTone={finished ? outcome : null}
        />

        {/* Keyed on the text so each change of turn arrives as its own line
            rather than as characters mutating in place. */}
        <p className="h-5 text-sm text-g8/80" aria-live="polite">
          <span key={status} className="inline-block animate-toast-in">
            {status}
          </span>
        </p>
      </main>

      <footer
        className="flex animate-rise items-center gap-4 pb-4"
        style={{ animationDelay: '0.22s' }}
      >
        {roomCode ? <RoomCodeChip code={roomCode} /> : null}
        <IconButton
          label="Leave game"
          onClick={() => {
            leave();
            void navigate({ to: '/' });
          }}
        >
          <BackIcon />
        </IconButton>
        <IconButton as={Link} to="/" label="Back to home">
          <HomeIcon />
        </IconButton>
      </footer>

      {finished || phase === 'opponentLeft' ? (
        <ResultModal
          title={title}
          art={phase === 'opponentLeft' ? <WifiOffIcon /> : outcomeMark(game.winner)}
          onRestart={rematch}
          restartLabel={rematchRequested ? 'waiting for opponent' : 'play again'}
          restartDisabled={phase === 'opponentLeft' || rematchRequested}
          celebrate={phase !== 'opponentLeft' && outcome === 'win'}
          note={
            phase === 'opponentLeft'
              ? 'they closed the game'
              : rematchOffered
                ? `${theirSeat.name} wants a rematch`
                : rematchRequested
                  ? 'waiting for them to accept…'
                  : undefined
          }
        />
      ) : null}
    </Screen>
  );
}

function RoomCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const result = await shareOrCopy(inviteUrl(code), 'Play dooz with me');
        if (result === 'failed') return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
