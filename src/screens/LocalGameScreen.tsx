import {
  modeById,
  type ModeId,
  O,
  opponentOf,
  type Player,
  startingPlayerOf,
  X,
} from '@/game/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mark } from '@/components/art/marks';
import { BulbIcon, UsersIcon } from '@/components/art/ui-icons';
import { Board } from '@/game/components/Board';
import { GameControls } from '@/game/components/GameControls';
import { GameHeader } from '@/game/components/GameHeader';
import { GameResetDialog } from '@/game/components/GameResetDialog';
import { HintLegend } from '@/game/components/HintLegend';
import { ModeChip } from '@/game/components/ModePicker';
import { OpenerBanner } from '@/game/components/OpenerBanner';
import { outcomeMark, ResultModal, revealDelayFor } from '@/game/components/ResultModal';
import { VariantStatus } from '@/game/components/VariantStatus';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useAccountStore } from '@/features/account/store';
import { useGame } from '@/game/useGame';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useTurnTint } from '@/game/useTurnTint';
import { useProgressStore } from '@/features/progress/store';
import { cx } from '@/lib/cx';
import { hintsFor } from '@/game/hints';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';

interface LocalGameScreenProps {
  mode: ModeId;
}

interface Score {
  x: number;
  o: number;
  draws: number;
}

const NO_SCORE: Score = { x: 0, o: 0, draws: 0 };
function loadScore(mode: ModeId): Score {
  try {
    const score = JSON.parse(localStorage.getItem(`dooz.local-series:${mode}`) ?? 'null');
    return score &&
      ['x', 'o', 'draws'].every((key) => Number.isInteger(score[key]) && score[key] >= 0)
      ? score
      : NO_SCORE;
  } catch {
    return NO_SCORE;
  }
}

/**
 * Two people, one device - and a running score between them.
 *
 * A single game of tic-tac-toe between two people is over in twenty seconds;
 * what they actually play is a series. So the screen keeps the tally, lets
 * them put their names on the seats, and hands the first move of the next game
 * to whoever lost the last one, which is both the house rule most people
 * already use and the one that keeps a series close. Draws alternate.
 */
export function LocalGameScreen({ mode }: LocalGameScreenProps) {
  const navigate = useNavigate();
  const avatar = useAccountStore((state) => state.profile?.avatar);
  const config = useMemo(() => modeById(mode).config, [mode]);
  const { game, play, restart, undo, canUndo, round } = useGame(config, {
    storageKey: `local:${mode}`,
  });
  const [hintsOn, setHintsOn] = useState(() => loadPreferences().hints);
  const [names, setNames] = useState(() => loadPreferences().localNames);
  const [renaming, setRenaming] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [reviewedRound, setReviewedRound] = useState(-1);
  const [score, setScore] = useState<Score>(() => loadScore(mode));
  const recordLocalGame = useProgressStore((state) => state.recordLocalGame);

  const hints = useMemo(() => (hintsOn ? hintsFor(game) : []), [hintsOn, game]);
  useGameFeedback(game, { threats: hints.filter((hint) => hint.kind === 'threat').length });
  useTurnTint(game);

  const finished = game.status !== 'playing';
  const nameOf = (player: Player) => (player === X ? names[0] : names[1]);
  const title = game.status === 'draw' ? 'Draw' : `${nameOf(game.winner ?? X)} wins!`;
  // Somebody at this device won either way, so a win is always worth marking.
  const finishTone = finished ? (game.winner ? 'win' : 'draw') : null;

  // Count each finished game once. A take-back that reopens it and finishes it
  // differently replaces its result rather than adding a second one.
  const counted = useRef<{ round: number; result: 'x' | 'o' | 'draws' } | null>(null);
  useEffect(() => {
    if (!finished) {
      if (counted.current?.round === round) {
        const { result } = counted.current;
        setScore((current) => ({ ...current, [result]: current[result] - 1 }));
        counted.current = null;
      }
      return;
    }
    if (counted.current?.round === round) return;
    const result = game.winner === X ? 'x' : game.winner === O ? 'o' : 'draws';
    counted.current = { round, result };
    setScore((current) => ({ ...current, [result]: current[result] + 1 }));
    recordLocalGame();
  }, [finished, round, game.winner, recordLocalGame]);

  // A new mode is a new series.
  const [scoredMode, setScoredMode] = useState(mode);
  if (scoredMode !== mode) {
    setScoredMode(mode);
    setScore(loadScore(mode));
  }

  useEffect(() => {
    try {
      localStorage.setItem(`dooz.local-series:${mode}`, JSON.stringify(score));
    } catch {
      /* The current series still works without storage. */
    }
  }, [mode, score]);

  function nextGame() {
    // Loser opens; after a draw, whoever did not open this one.
    restart(opponentOf(game.winner ?? startingPlayerOf(game)));
  }

  function toggleHints() {
    const next = !hintsOn;
    setHintsOn(next);
    savePreferences({ hints: next });
  }

  const played = score.x + score.o + score.draws;

  return (
    <Screen>
      {/* `relative z-10` is load-bearing, not decoration: `animate-rise` here
          and `animate-board-in` on <main> both leave a persistent `transform`,
          so each is its own stacking context at `z-index: auto` - and <main>,
          coming second, would otherwise paint over anything the header opens
          and swallow the clicks on it. */}
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{ name: names[0], kind: 'local', ...(avatar ? { avatar } : {}) }}
          right={{ name: names[1], kind: 'local' }}
          centre={
            <div className="flex flex-col items-center gap-1">
              <ModeChip mode={mode} onClick={() => void navigate({ to: '/', search: undefined })} />
              <ScoreLine score={score} />
            </div>
          }
          badge={played > 0 ? `Game ${played + (finished ? 0 : 1)}` : 'Local'}
        />
      </div>

      <main
        className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-3 py-6"
        style={{ animationDelay: '0.12s' }}
      >
        <div className="relative w-full max-w-board">
          <Board game={game} onPlay={play} finishTone={finishTone} hints={hints} />
          <OpenerBanner
            round={round}
            player={game.currentPlayer}
            label={`${nameOf(game.currentPlayer)} starts`}
          />
        </div>
        <VariantStatus game={game} />
        {hintsOn ? <HintLegend hints={hints} /> : null}
      </main>

      <footer
        className="flex animate-rise flex-col items-center gap-3 pb-4"
        style={{ animationDelay: '0.22s' }}
      >
        {finished && reviewedRound === round ? (
          <Button size="small" variant="ghost" onClick={() => setReviewedRound(-1)}>
            Show result
          </Button>
        ) : null}
        <GameControls
          onRestart={() => {
            if (!finished && game.moves.length > 0) setConfirmRestart(true);
            else restart();
          }}
          restartLabel="New game"
          onUndo={() => {
            setReviewedRound(-1);
            undo();
          }}
          canUndo={canUndo}
          extra={
            <>
              <IconButton label="Name the players" onClick={() => setRenaming(true)}>
                <UsersIcon />
              </IconButton>
              <IconButton
                label={hintsOn ? 'Turn hints off' : 'Turn hints on'}
                aria-pressed={hintsOn}
                onClick={toggleHints}
                className={hintsOn ? 'text-ok' : undefined}
              >
                <BulbIcon />
              </IconButton>
            </>
          }
        />
      </footer>

      {finished && reviewedRound !== round ? (
        <ResultModal
          onDismiss={() => setReviewedRound(round)}
          title={title}
          art={outcomeMark(game.winner)}
          detail={<SeriesDetail score={score} names={names} winner={game.winner} />}
          celebrate={game.winner !== null}
          revealDelay={revealDelayFor(game)}
          actions={
            <>
              <Button variant="primary" size="small" block onClick={nextGame}>
                Next game
              </Button>
              <Button
                variant="ghost"
                size="small"
                block
                onClick={() => {
                  setScore(NO_SCORE);
                  counted.current = null;
                  restart();
                }}
              >
                New series
              </Button>
              <Button as={Link} to="/" variant="ghost" size="small" block>
                Back to home
              </Button>
            </>
          }
        />
      ) : null}

      {renaming ? (
        <NamesSheet
          names={names}
          onSave={(next) => {
            setNames(next);
            savePreferences({ localNames: next });
          }}
          onClose={() => setRenaming(false)}
        />
      ) : null}
      {confirmRestart ? (
        <GameResetDialog
          onCancel={() => setConfirmRestart(false)}
          onConfirm={() => {
            setConfirmRestart(false);
            restart();
          }}
        />
      ) : null}
    </Screen>
  );
}

/** The series so far, as the two marks either side of a score. */
function ScoreLine({ score }: { score: Score }) {
  return (
    <span
      className="tnum flex items-center gap-1.5 text-base font-semibold"
      aria-label={`Score ${score.x} to ${score.o}`}
    >
      <span key={`x${score.x}`} className="animate-pop">
        {score.x}
      </span>
      <span className="text-xs font-normal text-ink-faint">–</span>
      <span key={`o${score.o}`} className="animate-pop">
        {score.o}
      </span>
    </span>
  );
}

function SeriesDetail({
  score,
  names,
  winner,
}: {
  score: Score;
  names: readonly [string, string];
  winner: Player | null;
}) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-tile border border-stroke-soft px-3 py-2">
      <SeriesSide name={names[0]} player={X} points={score.x} lit={winner === X} />
      <span className="text-xs text-ink-faint">
        {score.draws > 0 ? `${score.draws} drawn` : 'vs'}
      </span>
      <SeriesSide name={names[1]} player={O} points={score.o} lit={winner === O} />
    </div>
  );
}

function SeriesSide({
  name,
  player,
  points,
  lit,
}: {
  name: string;
  player: Player;
  points: number;
  lit: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col items-center gap-0.5">
      <span className="flex items-center gap-1.5">
        <Mark player={player} hole="var(--color-surface)" className="size-4" />
        <span
          key={points}
          className={cx('tnum text-2xl font-semibold', lit && 'animate-pop')}
          style={lit ? { animationDelay: '0.6s' } : undefined}
        >
          {points}
        </span>
      </span>
      <span className="max-w-24 truncate text-xs text-ink-muted">{name}</span>
    </span>
  );
}

function NamesSheet({
  names,
  onSave,
  onClose,
}: {
  names: readonly [string, string];
  onSave: (names: [string, string]) => void;
  onClose: () => void;
}) {
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);
  const [first, setFirst] = useState(names[0]);
  const [second, setSecond] = useState(names[1]);

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5 backdrop-blur-[2px]',
        closing ? 'animate-fade-out' : 'animate-fade-in',
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Name the players"
        tabIndex={-1}
        className={cx(
          'w-full max-w-80 panel-shell rounded-[2rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <form
          className="flex flex-col gap-4 panel-face rounded-[1.5rem] bg-surface px-5 py-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSave([first.trim() || 'Player 1', second.trim() || 'Player 2']);
            close();
          }}
        >
          <h2 className="text-center font-display text-xl">Who’s playing?</h2>
          <Field
            label="Plays X"
            value={first}
            maxLength={14}
            autoComplete="off"
            onChange={(event) => setFirst(event.target.value)}
            trailing={<Mark player={X} className="size-7 shrink-0" />}
          />
          <Field
            label="Plays O"
            value={second}
            maxLength={14}
            autoComplete="off"
            onChange={(event) => setSecond(event.target.value)}
            trailing={<Mark player={O} hole="var(--color-surface)" className="size-7 shrink-0" />}
          />
          <Button type="submit" variant="primary" size="small" block>
            Save
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={close}
            className="self-center"
          >
            Cancel
          </Button>
        </form>
      </div>
    </div>
  );
}
