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
        <div className="w-full max-w-78 rounded-[3rem] border border-b8 p-2">
          <div className="flex flex-col items-center gap-5 rounded-[2.75rem] bg-raised px-6 py-10 text-center">
            {phase === 'hosting' && roomCode ? (
              <InvitePanel code={roomCode} />
            ) : (
              <>
                <SearchPlayerIcon
                  className={`size-14 ${phase === 'searching' ? 'animate-pulse-soft' : ''}`}
                />
                <p className="text-xl">
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
              <p className="flex items-center gap-2 text-sm text-g8/80">
                <WifiOffIcon className="size-4" /> reconnecting…
              </p>
            ) : null}

            {error ? <p className="text-sm text-p3">{error}</p> : null}

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
            className="text-sm text-g8/80 underline underline-offset-4"
          >
            or find any opponent instead
          </button>
        ) : null}

        <JoinByCode />
        <NameField />
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
        className="h-10 min-w-0 flex-1 rounded-tile border border-b8 bg-b8/15 px-3 text-g10"
      />
    </label>
  );
}

function ProgressBar() {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-g10">
      <div
        className="h-full w-1/3 rounded-full bg-b2"
        style={{ animation: 'dooz-slide 1.6s ease-in-out infinite' }}
      />
      <style>{`@keyframes dooz-slide { 0% { transform: translateX(-100%) } 100% { transform: translateX(300%) } }`}</style>
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

  return (
    <>
      <p className="text-xl">waiting for your friend</p>

      <div className="w-full rounded-tile border border-b8 bg-b2 px-4 py-3">
        <span className="font-mono text-3xl tracking-[0.3em]">{code}</span>
      </div>

      <Button variant="primary" className="h-12 text-lg" onClick={share} icon={<ShareIcon />}>
        {feedback === 'copied' ? 'link copied' : feedback === 'shared' ? 'shared' : 'share link'}
      </Button>

      {feedback === 'failed' ? (
        <p className="text-sm text-p3">could not copy — read the code out instead</p>
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
        className="h-12 min-w-0 flex-1 rounded-tile border border-b8 bg-b8/15 px-4 text-center font-mono tracking-[0.25em] placeholder:font-sans placeholder:tracking-normal placeholder:text-g8/50"
      />
      <IconButton type="submit" label="Join game" disabled={!ready}>
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

  return (
    <Screen>
      <GameHeader
        game={game}
        left={you === X ? yourSeat : theirSeat}
        right={you === O ? yourSeat : theirSeat}
      />

      <main className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-6">
        <Board game={game} onPlay={play} disabled={!yourTurn} />

        <p className="h-5 text-sm text-g8/80" aria-live="polite">
          {reconnecting
            ? 'reconnecting…'
            : game.status !== 'playing'
              ? ''
              : yourTurn
                ? 'your turn'
                : `waiting for ${theirSeat.name}`}
        </p>
      </main>

      <footer className="flex items-center gap-4 pb-4">
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
      className="glass-edge flex h-12 items-center gap-2 rounded-tile px-3 font-mono text-sm tracking-[0.2em]"
      aria-label={`Room ${code}. Copy the invite link.`}
    >
      {code}
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
    </button>
  );
}
