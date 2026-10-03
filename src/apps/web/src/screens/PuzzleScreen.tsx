import { applyMove, type GameState, modeById, X } from '@dooz/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, RefreshIcon, ShareIcon } from '@/components/art/icons';
import { Mark } from '@/components/art/marks';
import { BulbIcon } from '@/components/art/ui-icons';
import { Board, type BoardHint } from '@/components/game/Board';
import { ResultModal, revealDelayFor } from '@/components/game/ResultModal';
import { HintLegend } from '@/components/game/HintLegend';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useGameFeedback } from '@/features/game/useGameFeedback';
import { useTurnTint } from '@/features/game/useTurnTint';
import { liveDailyStreak, useProgressStore } from '@/features/progress/store';
import {
  type Puzzle,
  puzzleById,
  PUZZLES,
  puzzleStart,
  TIER_NAMES,
  themeName,
} from '@/features/puzzles/puzzles';
import { cx } from '@/lib/cx';
import { appUrl, shareOrCopy } from '@/lib/invite';
import { haptics, sfx } from '@/lib/sound';
import { TierDots } from './PuzzlesScreen';

/** How long a wrong answer stays on the board before it is taken back. */
const WRONG_MS = 900;
/** The defence arrives after a beat, as if it were being thought about. */
const REPLY_MS = 520;

export function PuzzleScreen({ id, daily = false }: { id: string; daily?: boolean }) {
  const puzzle = puzzleById(id);
  if (!puzzle) {
    return (
      <Screen scroll>
        <Card className="w-full">
          <EmptyState
            title="Puzzle not found"
            body="It may have been replaced in an update."
            action={
              <Button as={Link} to="/puzzles" size="small" className="w-auto px-4">
                All puzzles
              </Button>
            }
          />
        </Card>
      </Screen>
    );
  }
  // Keyed so moving to the next puzzle starts it clean.
  return <PuzzleBoard key={puzzle.id} puzzle={puzzle} daily={daily} />;
}

type Phase = 'solving' | 'replying' | 'wrong' | 'solved';

/**
 * Solving one puzzle.
 *
 * The player plays the side to move; the defence is the one the generator
 * proved was the most stubborn, played back from the pack. A wrong answer is
 * shown - the mark lands, the board says no, and it is lifted again - rather
 * than silently refused, because seeing why a move fails is most of what a
 * puzzle teaches. There is no limit on tries and no penalty beyond the tally.
 */
function PuzzleBoard({ puzzle, daily }: { puzzle: Puzzle; daily: boolean }) {
  const navigate = useNavigate();
  const recordPuzzle = useProgressStore((state) => state.recordPuzzle);
  const solvedIds = useProgressStore((state) => state.puzzles);

  const start = useMemo(() => puzzleStart(puzzle), [puzzle]);
  const solver = start.currentPlayer;
  const [game, setGame] = useState<GameState>(start);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('solving');
  const [misses, setMisses] = useState(0);
  const [hinted, setHinted] = useState(false);
  // Whether a hint was ever shown on this attempt; `hinted` clears per move.
  const [helped, setHelped] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  useGameFeedback(game, { you: solver });
  useTurnTint(game);

  const accepted = puzzle.accept[step] ?? [];
  const hints: BoardHint[] =
    hinted && phase === 'solving' ? accepted.map((index) => ({ index, kind: 'best' })) : [];

  function attempt(index: number) {
    if (phase !== 'solving') return;
    const next = applyMove(game, index);
    if (!next) return;

    if (!accepted.includes(index)) {
      // Show it, say no, take it back.
      const before = game;
      setGame(next);
      setPhase('wrong');
      setMisses((count) => count + 1);
      setTimeout(() => {
        sfx.wrong();
        haptics.buzz([12, 40, 12]);
      }, 180);
      timer.current = setTimeout(() => {
        setGame(before);
        setPhase('solving');
      }, WRONG_MS);
      return;
    }

    setGame(next);
    setHinted(false);
    if (next.status === 'won') {
      setPhase('solved');
      recordPuzzle(puzzle.id, daily);
      return;
    }

    // The stored defence, after a beat.
    const reply = puzzle.line[step * 2 + 1];
    setPhase('replying');
    timer.current = setTimeout(() => {
      setGame((current) =>
        reply === undefined ? current : (applyMove(current, reply) ?? current),
      );
      setStep((current) => current + 1);
      setPhase('solving');
    }, REPLY_MS);
  }

  function retry() {
    clearTimeout(timer.current);
    setGame(start);
    setStep(0);
    setPhase('solving');
    setHinted(false);
    setHelped(false);
    setMisses(0);
  }

  const mode = modeById(puzzle.mode);
  const theme = themeName(puzzle.theme);
  const nextPuzzle =
    PUZZLES.find(
      (candidate) => candidate.number > puzzle.number && !solvedIds.includes(candidate.id),
    ) ?? PUZZLES.find((candidate) => !solvedIds.includes(candidate.id) && candidate !== puzzle);

  const message =
    phase === 'wrong'
      ? 'Not that one — they can escape. Try again.'
      : phase === 'replying'
        ? 'Good. They defend…'
        : phase === 'solved'
          ? 'Solved!'
          : step === 0
            ? `Find the move that wins in ${puzzle.mateIn}.`
            : step === puzzle.mateIn - 1
              ? 'Finish it.'
              : 'Keep the pressure on.';

  return (
    <Screen>
      <header className="flex w-full items-center gap-3 pt-2">
        <IconButton as={Link} to="/puzzles" tone="bare" size="small" label="All puzzles">
          <BackIcon />
        </IconButton>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-xl leading-tight">
            {daily ? 'Daily puzzle' : `Puzzle #${puzzle.number}`}
          </h1>
          <span className="truncate text-xs text-ink-faint">
            {mode.name} · {TIER_NAMES[puzzle.tier]}
            {theme ? ` · ${theme}` : ''}
          </span>
        </div>
        <span className="ml-auto">
          <TierDots tier={puzzle.tier} />
        </span>
      </header>

      <main className="flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-4 py-4">
        <div className="flex items-center gap-3 rounded-full border border-stroke-soft bg-surface/70 py-1.5 pr-4 pl-2">
          <Mark
            player={solver}
            hole="var(--color-surface)"
            className={cx('size-7', solver === X && 'p-0.5')}
          />
          <span className="text-sm">
            You play <strong>{solver === X ? 'X' : 'O'}</strong> · win in {puzzle.mateIn}
          </span>
          {/* One pip per move of the combination, filled as they are found. */}
          <span
            className="flex gap-1"
            aria-label={`Move ${Math.min(step + 1, puzzle.mateIn)} of ${puzzle.mateIn}`}
          >
            {Array.from({ length: puzzle.mateIn }, (_, pip) => (
              <span
                key={pip}
                className={cx(
                  'size-2 rounded-full transition-colors duration-300',
                  pip < step || phase === 'solved'
                    ? 'bg-ok'
                    : pip === step
                      ? 'bg-ink-muted'
                      : 'bg-stroke-soft',
                )}
              />
            ))}
          </span>
        </div>

        <Board
          game={game}
          onPlay={attempt}
          disabled={phase !== 'solving'}
          finishTone={phase === 'solved' ? 'win' : null}
          hints={hints}
        />
        {hinted ? <HintLegend hints={hints} /> : null}

        <p
          key={message}
          aria-live="polite"
          className={cx(
            'h-5 animate-toast-in text-sm',
            phase === 'wrong' ? 'text-danger' : phase === 'solved' ? 'text-ok' : 'text-ink-muted',
          )}
        >
          {message}
        </p>
      </main>

      <footer className="flex items-center justify-center gap-3 pb-4">
        <IconButton label="Start over" onClick={retry} disabled={game === start}>
          <RefreshIcon />
        </IconButton>
        <IconButton
          label={hinted ? 'Hint shown' : 'Show a hint'}
          aria-pressed={hinted}
          disabled={phase !== 'solving'}
          onClick={() => {
            setHinted(true);
            setHelped(true);
          }}
          className={hinted ? 'text-ok' : undefined}
        >
          <BulbIcon />
        </IconButton>
      </footer>

      {phase === 'solved' ? (
        <ResultModal
          title="Solved!"
          art={<Mark player={solver} hole="var(--color-surface)" className="size-20" />}
          note={
            misses === 0
              ? helped
                ? 'With a little help.'
                : 'First try. Sharp.'
              : `Solved after ${misses} ${misses === 1 ? 'miss' : 'misses'}.`
          }
          celebrate
          revealDelay={revealDelayFor(game)}
          actions={
            <>
              {nextPuzzle ? (
                <Button
                  variant="primary"
                  size="small"
                  block
                  onClick={() =>
                    void navigate({
                      to: '/puzzles/$id',
                      params: { id: nextPuzzle.id },
                      replace: true,
                    })
                  }
                >
                  Next puzzle
                </Button>
              ) : null}
              {daily ? <ShareDaily misses={misses} helped={helped} /> : null}
              <Button variant="ghost" size="small" block onClick={retry}>
                Play it again
              </Button>
              <Button as={Link} to="/puzzles" variant="ghost" size="small" block>
                All puzzles
              </Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

/**
 * Share today's result: the date, how it went, the streak - and a link, so
 * the person it is sent to can try the same puzzle. No spoilers: it says how
 * the puzzle was solved, never where.
 */
function ShareDaily({ misses, helped }: { misses: number; helped: boolean }) {
  const daily = useProgressStore((state) => state.daily);
  const [feedback, setFeedback] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  const streak = liveDailyStreak(daily);
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  async function share() {
    const how =
      misses === 0
        ? helped
          ? 'Solved with a hint'
          : 'Solved first try'
        : `Solved in ${misses + 1} tries`;
    const lines = [
      `dooz daily puzzle · ${date}`,
      `✓ ${how}`,
      ...(streak > 1 ? [`🔥 ${streak}-day streak`] : []),
      appUrl('/puzzles') ?? '',
    ].filter(Boolean);
    setFeedback(await shareOrCopy(lines.join('\n'), 'dooz daily puzzle'));
  }

  return (
    <Button size="small" block onClick={() => void share()} icon={<ShareIcon />}>
      {feedback === 'copied' ? 'Copied' : feedback === 'shared' ? 'Shared' : 'Share result'}
    </Button>
  );
}
