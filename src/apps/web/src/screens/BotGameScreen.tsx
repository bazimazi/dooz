import {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  type GameState,
  modeById,
  type ModeId,
  O,
  startingPlayerOf,
  X,
} from '@dooz/engine';
import { Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BulbIcon, SparkIcon, TargetIcon } from '@/components/art/ui-icons';
import { Board, type BoardHint } from '@/components/game/Board';
import { GameControls } from '@/components/game/GameControls';
import { GameHeader } from '@/components/game/GameHeader';
import { ModeChip } from '@/components/game/ModePicker';
import { OpenerBanner } from '@/components/game/OpenerBanner';
import {
  outcomeFace,
  outcomeFor,
  ResultModal,
  revealDelayFor,
} from '@/components/game/ResultModal';
import { RivalBubble } from '@/components/game/RivalBubble';
import { Stars } from '@/components/game/Stars';
import { VariantStatus } from '@/components/game/VariantStatus';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { DIFFICULTY_LABELS } from '@/features/bot/labels';
import { useBotOpponent } from '@/features/bot/useBotOpponent';
import { useSuggestion } from '@/features/bot/useSuggestion';
import { useGame } from '@/features/game/useGame';
import { useGameFeedback } from '@/features/game/useGameFeedback';
import { useTurnTint } from '@/features/game/useTurnTint';
import { type Stage, stageAfter, stageById, starsFor } from '@/features/journey/stages';
import { type BotRecord, useProgressStore } from '@/features/progress/store';
import { cx } from '@/lib/cx';
import { hintsFor } from '@/lib/hints';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { sfx } from '@/lib/sound';

interface BotGameScreenProps {
  mode: ModeId;
  difficulty: BotDifficulty;
  /** Practice mode: hints on, take-backs allowed, and the bot's thinking shown. */
  practice?: boolean;
  /** A journey stage, which fixes the mode, the rival and the opener. */
  stage?: string;
}

/** What the finished game earned, worked out once when it ends. */
type Earned =
  | { kind: 'stage'; stars: number; improved: boolean }
  | { kind: 'record'; record: BotRecord }
  | { kind: 'none' };

/**
 * You are X; the bot is O. Who opens is decided by the toss in `useGame` -
 * except on a journey stage, where you always do, so that the stars measure
 * the player rather than the coin.
 */
export function BotGameScreen({
  mode,
  difficulty,
  practice = false,
  stage: stageId,
}: BotGameScreenProps) {
  const stage = stageId ? stageById(stageId) : undefined;
  if (stageId && !stage) return <BotGame mode={mode} difficulty={difficulty} practice={practice} />;
  return (
    <BotGame
      // A new stage is a new game with new rules for stars, so it starts clean.
      key={stage?.id ?? 'free'}
      mode={stage?.mode ?? mode}
      difficulty={stage?.rival.difficulty ?? difficulty}
      practice={practice && !stage}
      stage={stage}
    />
  );
}

function BotGame({
  mode,
  difficulty,
  practice,
  stage,
}: {
  mode: ModeId;
  difficulty: BotDifficulty;
  practice: boolean;
  stage?: Stage;
}) {
  const navigate = useNavigate();
  const config = useMemo(() => modeById(mode).config, [mode]);
  const { game, play, restart, undo, canUndo, round } = useGame(config, stage ? { opener: X } : {});
  const [hintsOn, setHintsOn] = useState(() => !stage && (practice || loadPreferences().hints));
  const recordBotGame = useProgressStore((state) => state.recordBotGame);
  const recordStage = useProgressStore((state) => state.recordStage);

  const onMove = useCallback((index: number) => play(index), [play]);
  const { thinking, lastSearch } = useBotOpponent({
    game,
    botPlayer: O,
    difficulty,
    onMove,
  });
  const { suggestion, thinking: suggesting, suggest } = useSuggestion(game);

  const hints = useMemo<BoardHint[]>(() => {
    const forced = hintsOn && game.currentPlayer === X ? hintsFor(game) : [];
    if (practice && suggestion !== null && !forced.some((hint) => hint.index === suggestion)) {
      return [...forced, { index: suggestion, kind: 'best' }];
    }
    return forced;
  }, [hintsOn, game, practice, suggestion]);

  useGameFeedback(game, {
    you: X,
    threats: hints.filter((hint) => hint.kind === 'threat').length,
  });
  useTurnTint(game);
  const remark = useRivalRemarks(game, stage);

  const rivalName = stage ? stage.rival.name : `${DIFFICULTY_LABELS[difficulty]} bot`;
  const finished = game.status !== 'playing';
  const outcome = outcomeFor(game, X);
  const yourMoves = countMovesBy(game.moves.length, startingPlayerOf(game), X);

  // Record each finished game exactly once, when it finishes - not on every
  // render of the finished board, and not again if a take-back reopens it.
  const [earned, setEarned] = useState<{ round: number; value: Earned } | null>(null);
  const recordedRound = useRef(-1);
  useEffect(() => {
    if (!finished || recordedRound.current === round) return;
    recordedRound.current = round;

    let value: Earned = { kind: 'none' };
    if (stage) {
      const stars = starsFor(stage, outcome === 'win', yourMoves);
      value = { kind: 'stage', stars, improved: recordStage(stage.id, stars) };
    } else if (!practice) {
      value = { kind: 'record', record: recordBotGame(mode, difficulty, outcome) };
    }
    setEarned({ round, value });
  }, [
    finished,
    round,
    stage,
    outcome,
    yourMoves,
    practice,
    mode,
    difficulty,
    recordStage,
    recordBotGame,
  ]);

  /**
   * Board and difficulty live in the URL, so the screen can be linked to or
   * reloaded - but changing one is a setting change, not a move between
   * screens. `viewTransition: false` keeps the document from cross-fading, and
   * `replace` keeps Back pointing at the home screen rather than walking back
   * through every setting the player tried.
   */
  function goTo(next: { mode?: ModeId; difficulty?: BotDifficulty }) {
    const search = {
      mode: next.mode ?? mode,
      difficulty: next.difficulty ?? difficulty,
      ...(practice ? { practice: true as const } : {}),
    };
    savePreferences({ mode: search.mode, difficulty: search.difficulty });
    void navigate({ to: '/play/bot', search, replace: true, viewTransition: false });
  }

  function toggleHints() {
    const next = !hintsOn;
    setHintsOn(next);
    if (!practice) savePreferences({ hints: next });
  }

  /**
   * Take back to your own turn.
   *
   * Usually that is two moves - the bot's reply and yours - but a game you
   * ended yourself has no reply to take back, and taking two there would undo
   * the bot's previous move as well and hand it the turn.
   */
  function takeBack() {
    const lastMover = game.lastMove === null ? null : game.board[game.lastMove];
    undo();
    if (!(finished && lastMover === X)) undo();
  }

  const title = stage
    ? outcome === 'win'
      ? 'Stage cleared!'
      : outcome === 'loss'
        ? `${stage.rival.name} wins`
        : 'A draw'
    : outcome === 'win'
      ? 'You win!'
      : outcome === 'loss'
        ? 'You lose'
        : 'Draw';

  const following = stage ? stageAfter(stage) : undefined;
  const thisRound = earned?.round === round ? earned.value : null;

  return (
    <Screen>
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{ name: 'You', kind: 'local', isYou: true }}
          right={{
            name: stage ? stage.rival.name : DIFFICULTY_LABELS[difficulty],
            kind: 'bot',
            busy: thinking,
            ...(stage ? { avatar: stage.rival.avatar } : {}),
          }}
          centre={
            stage ? (
              <ModeChip mode={mode} />
            ) : (
              <ModeChip mode={mode} onClick={() => void navigate({ to: '/' })} />
            )
          }
          badge={stage ? 'Journey' : practice ? 'Practice' : 'vs Bot'}
        />
        {remark ? <RivalBubble key={remark.id} text={remark.text} /> : null}
      </div>

      <main
        className="relative flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-3 py-5"
        style={{ animationDelay: '0.12s' }}
      >
        <div className="relative w-full max-w-board">
          <Board
            game={game}
            onPlay={play}
            disabled={thinking || game.currentPlayer === O}
            finishTone={finished ? outcome : null}
            hints={hints}
          />
          <OpenerBanner
            round={round}
            player={game.currentPlayer}
            label={game.currentPlayer === X ? 'You go first' : `${rivalName} goes first`}
          />
        </div>

        <VariantStatus game={game} />

        {stage ? (
          <StageGoal stage={stage} moves={yourMoves} finished={finished} />
        ) : (
          <ThinkingIndicator thinking={thinking} />
        )}

        {practice && lastSearch ? (
          <p className="tnum text-center text-xs text-ink-faint">
            Last search: depth {lastSearch.depth}, {lastSearch.nodes.toLocaleString()} positions
            {lastSearch.reason === 'search' ? '' : ` · ${lastSearch.reason}`}
          </p>
        ) : null}
      </main>

      <footer
        className="flex animate-rise flex-col items-center gap-3 pb-4"
        style={{ animationDelay: '0.22s' }}
      >
        {stage ? null : (
          <Segmented<BotDifficulty>
            label="Bot difficulty"
            value={difficulty}
            onChange={(next) => goTo({ difficulty: next })}
            size="small"
            className="w-full max-w-board"
            options={BOT_DIFFICULTIES.map((value) => ({
              value,
              label: DIFFICULTY_LABELS[value].slice(0, 3),
              title: DIFFICULTY_LABELS[value],
            }))}
          />
        )}

        <GameControls
          onRestart={() => restart()}
          restartLabel={stage ? 'Restart stage' : 'New game'}
          onUndo={practice ? takeBack : undefined}
          canUndo={canUndo && !thinking}
          extra={
            stage ? null : (
              <>
                {practice ? (
                  <IconButton
                    label="Suggest a move"
                    onClick={suggest}
                    disabled={finished || thinking || suggesting || game.currentPlayer !== X}
                    className={suggestion !== null ? 'text-ink' : undefined}
                  >
                    <span className={cx('block', suggesting && 'animate-pulse-soft')}>
                      <TargetIcon />
                    </span>
                  </IconButton>
                ) : null}
                <IconButton
                  label={hintsOn ? 'Turn hints off' : 'Turn hints on'}
                  aria-pressed={hintsOn}
                  onClick={toggleHints}
                  className={hintsOn ? 'text-ok' : undefined}
                >
                  <BulbIcon />
                </IconButton>
              </>
            )
          }
        />
      </footer>

      {finished ? (
        <ResultModal
          title={title}
          art={
            stage ? (
              <span className="relative block">
                <AvatarBadge
                  avatar={stage.rival.avatar}
                  ring="var(--color-sunken)"
                  className="size-[1em]"
                />
              </span>
            ) : (
              outcomeFace(outcome)
            )
          }
          note={
            stage
              ? `“${outcome === 'win' ? stage.rival.concede : stage.rival.gloat}”`
              : `${DIFFICULTY_LABELS[difficulty]} bot · ${modeById(mode).name}`
          }
          detail={
            thisRound ? (
              <EarnedDetail
                earned={thisRound}
                difficulty={difficulty}
                stage={stage}
                moves={yourMoves}
              />
            ) : null
          }
          celebrate={outcome === 'win'}
          revealDelay={revealDelayFor(game)}
          actions={
            stage ? (
              <>
                {outcome === 'win' && following ? (
                  <Button
                    variant="primary"
                    size="small"
                    block
                    onClick={() =>
                      void navigate({
                        to: '/play/bot',
                        search: {
                          mode: following.mode,
                          difficulty: following.rival.difficulty,
                          stage: following.id,
                        },
                        replace: true,
                      })
                    }
                  >
                    Next: {following.rival.name}
                  </Button>
                ) : null}
                <Button
                  variant={outcome === 'win' && following ? 'ghost' : 'primary'}
                  size="small"
                  block
                  onClick={() => restart()}
                >
                  {outcome === 'win' ? 'Play again' : 'Try again'}
                </Button>
                <Button as={Link} to="/journey" variant="ghost" size="small" block>
                  Journey map
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" size="small" block onClick={() => restart()}>
                  Play again
                </Button>
                {outcome !== 'win' ? (
                  <Button
                    size="small"
                    variant="ghost"
                    block
                    onClick={() => goTo({ difficulty: easier(difficulty) })}
                  >
                    Try an easier bot
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="ghost"
                    block
                    onClick={() => goTo({ difficulty: harder(difficulty) })}
                  >
                    Try a harder bot
                  </Button>
                )}
                <Button as={Link} to="/" variant="ghost" size="small" block>
                  Back to home
                </Button>
              </>
            )
          }
        />
      ) : null}
    </Screen>
  );
}

/** Moves `player` has made in a game of `plies` opened by `opener`. */
function countMovesBy(plies: number, opener: 1 | 2, player: 1 | 2): number {
  return opener === player ? Math.ceil(plies / 2) : Math.floor(plies / 2);
}

function easier(difficulty: BotDifficulty): BotDifficulty {
  const index = BOT_DIFFICULTIES.indexOf(difficulty);
  return BOT_DIFFICULTIES[Math.max(0, index - 1)] ?? difficulty;
}

function harder(difficulty: BotDifficulty): BotDifficulty {
  const index = BOT_DIFFICULTIES.indexOf(difficulty);
  return BOT_DIFFICULTIES[Math.min(BOT_DIFFICULTIES.length - 1, index + 1)] ?? difficulty;
}

/**
 * The line under the board on a journey stage: moves so far, against the par
 * for each star. It counts up as you play, so the target is never a surprise
 * on the result screen.
 */
function StageGoal({ stage, moves, finished }: { stage: Stage; moves: number; finished: boolean }) {
  const [two, three] = stage.par;
  const onPace = moves <= three ? 3 : moves <= two ? 2 : 1;
  return (
    <div className="flex h-5 items-center gap-2 text-sm text-ink-muted">
      <span className="tnum">Your moves: {moves}</span>
      <span aria-hidden="true">·</span>
      <Stars earned={finished ? 0 : onPace} className="text-sm" />
      <span className="tnum text-xs text-ink-faint">
        ≤{three} for three · ≤{two} for two
      </span>
    </div>
  );
}

function EarnedDetail({
  earned,
  difficulty,
  stage,
  moves,
}: {
  earned: Earned;
  difficulty: BotDifficulty;
  stage: Stage | undefined;
  moves: number;
}): ReactNode {
  useEffect(() => {
    if (earned.kind === 'stage' && earned.stars > 0) {
      const timer = setTimeout(() => sfx.sparkle(earned.stars + 2), 700);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [earned]);

  if (earned.kind === 'stage') {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <Stars earned={earned.stars} animate delay={0.55} className="text-4xl" />
        {earned.stars > 0 ? (
          <p className="tnum text-xs text-ink-faint">
            Won in {moves} moves
            {earned.improved ? ' · new best' : ''}
            {stage && earned.stars < 3 ? ` · three stars at ${stage.par[1]} or fewer` : ''}
          </p>
        ) : (
          <p className="text-xs text-ink-faint">Win the game to earn stars.</p>
        )}
      </div>
    );
  }

  if (earned.kind === 'record') {
    const { record } = earned;
    return (
      <div className="flex flex-col items-center gap-1 text-xs text-ink-faint">
        {record.streak >= 2 ? (
          <p className="flex animate-pop items-center gap-1 text-sm font-semibold text-warn">
            <SparkIcon className="size-4" /> {record.streak} wins in a row
          </p>
        ) : null}
        <p className="tnum">
          vs {DIFFICULTY_LABELS[difficulty]}: {record.won} won · {record.drawn} drawn ·{' '}
          {record.lost} lost
        </p>
      </div>
    );
  }

  return null;
}

/**
 * "Bot is thinking…", with the three dots doing the waiting.
 *
 * The row keeps its height whether or not it is showing anything, so the board
 * above it does not jump every time the bot takes or finishes a turn.
 */
function ThinkingIndicator({ thinking }: { thinking: boolean }) {
  return (
    <p
      className={cx(
        'flex h-5 items-center gap-1.5 text-sm text-ink-muted',
        'transition-[opacity,transform] duration-300 ease-spring',
        thinking ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
      aria-live="polite"
    >
      {thinking ? 'Bot is thinking' : ''}
      <span aria-hidden="true" className="flex items-end gap-1 pb-0.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className={cx('size-1 rounded-full bg-ink-muted', thinking && 'animate-dot')}
            style={{ animationDelay: `${dot * 0.16}s` }}
          />
        ))}
      </span>
    </p>
  );
}

/**
 * What a journey rival says as the game goes: a taunt when they have just made
 * a threat you must answer, a worry when you have just made one they must.
 *
 * Read off the same exact threat check the hints use, so a rival never taunts
 * a threat that is not there. Not every threat gets a line - every other one at
 * most - because a character who comments on every move is one you mute.
 */
function useRivalRemarks(
  game: GameState,
  stage: Stage | undefined,
): { id: number; text: string } | null {
  // Worked out during render when the position changes, rather than in an
  // effect, so the line and the move that prompted it arrive in one paint.
  const [said, setSaid] = useState<{
    game: GameState;
    remark: { id: number; text: string } | null;
    lastSpoke: number;
  }>({ game, remark: null, lastSpoke: -10 });

  if (said.game !== game) {
    setSaid(nextRemark(said, game, stage));
  }

  return said.remark;
}

function nextRemark(
  previous: { remark: { id: number; text: string } | null; lastSpoke: number },
  game: GameState,
  stage: Stage | undefined,
): { game: GameState; remark: { id: number; text: string } | null; lastSpoke: number } {
  const ply = game.moves.length;
  // A new game starts quiet.
  if (ply === 0) return { game, remark: null, lastSpoke: -10 };

  const quiet = { game, remark: previous.remark, lastSpoke: previous.lastSpoke };
  if (!stage || game.status !== 'playing' || ply < 3 || ply - previous.lastSpoke < 3) return quiet;
  if (!hintsFor(game).some((hint) => hint.kind === 'threat')) return quiet;

  // X to move and under threat: the rival just made it. O to move and under
  // threat: you did.
  const lines = game.currentPlayer === X ? stage.rival.taunts : stage.rival.worries;
  const text = lines[ply % lines.length];
  return text ? { game, remark: { id: ply, text }, lastSpoke: ply } : quiet;
}
