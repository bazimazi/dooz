import {
  type BotDifficulty,
  type GameConfig,
  modeForConfig,
  O,
  type Player,
  startingPlayerOf,
  X,
} from '@/game/engine';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UndoIcon } from '@/components/art/ui-icons';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { Board, type BoardHint } from '@/game/components/Board';
import { GameHeader } from '@/game/components/GameHeader';
import { HintLegend } from '@/game/components/HintLegend';
import { ModeChip } from '@/game/components/ModePicker';
import { OpenerBanner } from '@/game/components/OpenerBanner';
import { outcomeFor, ResultModal, revealDelayFor } from '@/game/components/ResultModal';
import { VariantStatus } from '@/game/components/VariantStatus';
import { useDifficultyLabels } from '@/game/bot/labels';
import { useBotOpponent } from '@/game/bot/useBotOpponent';
import { hintsFor } from '@/game/hints';
import { forgetGame, useGame } from '@/game/useGame';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useTurnTint } from '@/game/useTurnTint';
import type { Outcome } from '@/features/progress/store';
import { useT } from '@/i18n';
import { arcadeMessages } from '@/i18n/messages/arcade';
import type { Avatar } from '@/protocol';
import type { Setup } from './handicap';
import { type ClockSpec, forgetClock, useHumanClock } from './useHumanClock';

/**
 * Everything that makes one arcade match differ from a plain bot game. The
 * daily challenge, the gauntlet, a run's battles and blitz all describe their
 * match with one of these, and the board, the clock and the result panel are
 * shared.
 */
export interface MatchSpec {
  readonly config: GameConfig;
  readonly difficulty: BotDifficulty;
  /** Who opens. Absent for a coin toss; ignored when there is a setup. */
  readonly opener?: Player;
  /** Marks already on the board: a handicap or a challenge's twist. */
  readonly setup?: Setup;
  /** Times the player. The bot is paced by `botTimeBudgetMs` instead. */
  readonly clock?: ClockSpec;
  readonly botTimeBudgetMs?: number;
  /** Your own moves to win within, shown under the board. Scoring is the caller's. */
  readonly par?: number;
  /** Free take-backs this match. */
  readonly undos?: number;
  /** Show the squares that win or lose this move. */
  readonly hints?: boolean;
  /** Where the position is saved, so a reload resumes it. */
  readonly storageKey: string;
  readonly rival?: { readonly name: string; readonly avatar?: Avatar };
  /** The word under the mode name: "Daily", "Gauntlet". */
  readonly badge: string;
}

export interface MatchResult {
  readonly outcome: Outcome;
  /** Moves you made, setup marks excluded. */
  readonly moves: number;
  /** The game ended on your clock rather than on the board. */
  readonly flagged: boolean;
  /** Clock left at the end, when timed. */
  readonly timeLeftMs: number | null;
  readonly undosUsed: number;
}

export interface ResultView {
  readonly title: string;
  readonly art: ReactNode;
  readonly note?: ReactNode;
  readonly detail?: ReactNode;
  readonly rewards?: ReactNode;
  readonly actions: ReactNode;
}

interface ArcadeMatchProps {
  spec: MatchSpec;
  /** Called once per finished game, before the result panel appears. */
  onFinish: (result: MatchResult) => void;
  /** The result panel's content. `restart` plays the same match again. */
  result: (result: MatchResult, restart: () => void) => ResultView;
  /** Above the board, under the header: a run's hearts, a gauntlet's lives. */
  status?: ReactNode;
  /** Below the board: the challenge's rules, the relics in play. */
  footer?: ReactNode;
  /** Shows a restart button. Off where a restart would dodge a loss. */
  restartable?: boolean;
  /** Leave the match, shown as the last footer control. */
  leave?: ReactNode;
}

/**
 * One arcade match against the bot: board, header, optional clock, optional
 * take-backs, and a result panel the caller fills in.
 *
 * You are X and the bot is O, as everywhere else. The result is reported once
 * per game - on the board's verdict, or on your flag falling - and never again
 * if a take-back reopens the board.
 */
export function ArcadeMatch({
  spec,
  onFinish,
  result: describe,
  status,
  footer,
  restartable = false,
  leave,
}: ArcadeMatchProps) {
  const t = useT(arcadeMessages);
  const labels = useDifficultyLabels();
  const { game, play, restart, undo, round } = useGame(spec.config, {
    ...(spec.setup ? { setup: spec.setup } : spec.opener ? { opener: spec.opener } : {}),
    storageKey: spec.storageKey,
  });
  const setupLength = spec.setup?.moves.length ?? 0;
  const [undosUsed, setUndosUsed] = useState(0);
  const [undoRound, setUndoRound] = useState(round);
  if (undoRound !== round) {
    setUndoRound(round);
    setUndosUsed(0);
  }

  const clock = useHumanClock({
    game,
    you: X,
    clock: spec.clock,
    round,
    setupPlies: setupLength,
    storageKey: spec.storageKey,
  });
  const finished = game.status !== 'playing' || clock.flagged;
  const onMove = useCallback((index: number) => play(index), [play]);
  const { thinking } = useBotOpponent({
    game,
    botPlayer: O,
    difficulty: spec.difficulty,
    onMove,
    paused: clock.flagged,
    ...(spec.botTimeBudgetMs !== undefined ? { timeBudgetMs: spec.botTimeBudgetMs } : {}),
  });

  const hints = useMemo<BoardHint[]>(
    () => (spec.hints && !finished && game.currentPlayer === X ? hintsFor(game) : []),
    [spec.hints, finished, game],
  );
  useGameFeedback(game, { you: X, threats: hints.filter((hint) => hint.kind === 'threat').length });
  useTurnTint(game);

  const yourMoves = countOwnMoves(game.moves.length, startingPlayerOf(game), setupLength);
  const outcome: Outcome = clock.flagged ? 'loss' : outcomeFor(game, X);

  const [reported, setReported] = useState<{ round: number; result: MatchResult } | null>(null);
  const reportedRound = useRef(-1);
  useEffect(() => {
    if (!finished || reportedRound.current === round) return;
    reportedRound.current = round;
    const result: MatchResult = {
      outcome,
      moves: yourMoves,
      flagged: clock.flagged,
      timeLeftMs: spec.clock ? clock.remainingMs : null,
      undosUsed,
    };
    // A flag ends the game with the board still in play, which the saved
    // position would otherwise bring back on the next visit.
    if (clock.flagged) {
      forgetGame(spec.storageKey);
      forgetClock(spec.storageKey);
    }
    onFinish(result);
    setReported({ round, result });
  }, [
    finished,
    round,
    outcome,
    yourMoves,
    clock,
    spec.clock,
    spec.storageKey,
    undosUsed,
    onFinish,
  ]);

  const [reviewedRound, setReviewedRound] = useState(-1);
  const [reopenedRound, setReopenedRound] = useState(-1);
  const undosLeft = (spec.undos ?? 0) - undosUsed;

  /** Back to your own turn, as in practice: your move and the bot's reply. */
  function takeBack() {
    if (undosLeft <= 0) return;
    const lastMover = game.lastMove === null ? null : game.board[game.lastMove];
    undo();
    if (lastMover !== X && game.moves.length - 1 > setupLength) undo();
    setUndosUsed((used) => used + 1);
  }

  const rivalName = spec.rival?.name ?? labels.bot(spec.difficulty);
  const opener = startingPlayerOf(game);
  // With a setup the side to move first is the one the setup leaves to move.
  const firstToMove = setupLength % 2 === 0 ? opener : opener === X ? O : X;
  const thisResult = reported?.round === round ? reported.result : null;
  const view = thisResult ? describe(thisResult, () => restart()) : null;
  const mode = modeForConfig(spec.config);

  return (
    <Screen>
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{
            name: t('you'),
            kind: 'local',
            isYou: true,
            ...(spec.clock ? { timeMs: clock.remainingMs, ticking: clock.ticking } : {}),
          }}
          right={{
            name: rivalName,
            kind: 'bot',
            busy: thinking,
            ...(spec.rival?.avatar ? { avatar: spec.rival.avatar } : {}),
          }}
          centre={mode ? <ModeChip mode={mode.id} /> : undefined}
          badge={spec.badge}
        />
        {status ? <div className="mt-2 flex justify-center">{status}</div> : null}
      </div>

      <main
        className="relative flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-3 py-5"
        style={{ animationDelay: '0.12s' }}
      >
        <div className="relative w-full max-w-board">
          <Board
            game={game}
            onPlay={play}
            disabled={finished || thinking || game.currentPlayer === O}
            finishTone={finished ? outcome : null}
            hints={hints}
          />
          <OpenerBanner
            round={round}
            player={firstToMove}
            label={firstToMove === X ? t('youFirst') : t('theyFirst', { name: rivalName })}
            fresh={game.moves.length === setupLength}
          />
        </div>
        <VariantStatus game={game} />
        {spec.hints ? <HintLegend hints={hints} /> : null}
        {spec.par !== undefined ? (
          <p className="tnum text-sm text-ink-muted">
            {t('yourMoves', { moves: yourMoves, par: spec.par })}
          </p>
        ) : null}
        {footer}
      </main>

      <footer
        className="flex animate-rise flex-wrap items-center justify-center gap-3 pb-4"
        style={{ animationDelay: '0.22s' }}
      >
        {finished && reviewedRound === round ? (
          <Button
            size="small"
            variant="ghost"
            className="w-auto px-4"
            onClick={() => {
              setReopenedRound(round);
              setReviewedRound(-1);
            }}
          >
            {t('showResult')}
          </Button>
        ) : null}
        {spec.undos ? (
          <IconButton
            label={t('takeBack', { count: Math.max(0, undosLeft) })}
            onClick={takeBack}
            disabled={finished || thinking || undosLeft <= 0 || game.moves.length <= setupLength}
          >
            <UndoIcon />
          </IconButton>
        ) : null}
        {restartable ? (
          <Button size="small" variant="ghost" className="w-auto px-4" onClick={() => restart()}>
            {t('restart')}
          </Button>
        ) : null}
        {leave}
      </footer>

      {finished && view && reviewedRound !== round ? (
        <ResultModal
          onDismiss={() => setReviewedRound(round)}
          title={view.title}
          art={view.art}
          note={view.note}
          detail={view.detail}
          rewards={view.rewards}
          celebrate={outcome === 'win'}
          revealDelay={reopenedRound === round || clock.flagged ? 0 : revealDelayFor(game)}
          actions={view.actions}
        />
      ) : null}
    </Screen>
  );
}

/** Your moves in the game, leaving out the ones the setup placed. */
function countOwnMoves(plies: number, opener: Player, setupLength: number): number {
  let count = 0;
  for (let ply = setupLength; ply < plies; ply++) {
    const mover = ply % 2 === 0 ? opener : opener === X ? O : X;
    if (mover === X) count++;
  }
  return count;
}
