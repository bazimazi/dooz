import { ReturnLink, useReturnTo } from '@/components/ui/ReturnLink';
import {
  BOT_DIFFICULTIES,
  type BotDifficulty,
  type GameState,
  modeById,
  type ModeId,
  O,
  startingPlayerOf,
  X,
} from '@/game/engine';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AvatarBadge } from '@/components/art/avatars';
import { BulbIcon, ClockIcon, SparkIcon, TargetIcon } from '@/components/art/ui-icons';
import { Board, type BoardHint } from '@/game/components/Board';
import { GameControls } from '@/game/components/GameControls';
import { GameHeader } from '@/game/components/GameHeader';
import { GameResetDialog } from '@/game/components/GameResetDialog';
import { HintLegend } from '@/game/components/HintLegend';
import { ModeChip } from '@/game/components/ModePicker';
import { OpenerBanner } from '@/game/components/OpenerBanner';
import {
  outcomeFace,
  outcomeFor,
  ResultModal,
  revealDelayFor,
} from '@/game/components/ResultModal';
import { RivalBubble } from '@/game/components/RivalBubble';
import { Stars } from '@/game/components/Stars';
import { VariantStatus } from '@/game/components/VariantStatus';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { useDifficultyLabels } from '@/game/bot/labels';
import { useBotOpponent } from '@/game/bot/useBotOpponent';
import { useSuggestion } from '@/game/bot/useSuggestion';
import { forgetGame, useGame } from '@/game/useGame';
import { useGameFeedback } from '@/game/useGameFeedback';
import { useGameDuration } from '@/game/useGameDuration';
import { useMusicTension } from '@/game/useMusicTension';
import { useTurnTint } from '@/game/useTurnTint';
import { rivalWorld, useRivalWorld } from '@/features/journey/worlds';
import { rivalText, stageText } from '@/i18n/messages/journey';
import {
  FRESH_MEMORY,
  nextRemark,
  type Remark,
  type RemarkMemory,
  resultLine,
} from '@/features/journey/remarks';
import {
  analyseWin,
  isUnlocked,
  playerMoves,
  type Stage,
  stageAfter,
  stageById,
  stageDifficulty,
  type StageResult,
  stageStyle,
  starsFor,
} from '@/features/journey/stages';
import { type BotRecord, useProgressStore } from '@/features/progress/store';
import { RewardsPanel } from '@/features/progress/RewardsPanel';
import { BlitzGame } from '@/features/arcade/BlitzGame';
import { cx } from '@/lib/cx';
import { hintsFor, suggestionCells } from '@/game/hints';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { sfx } from '@/lib/sound';
import { consumeDialogHistory } from '@/lib/useDialog';
import { type Translator, useT } from '@/i18n';
import { gameScreenMessages } from '@/i18n/messages/gameScreens';
import { useModeText } from '@/i18n/messages/modes';

interface BotGameScreenProps {
  mode: ModeId;
  difficulty: BotDifficulty;
  /** Practice mode: hints on, take-backs allowed, and the bot's thinking shown. */
  practice?: boolean;
  /** A journey stage, which fixes the mode, the rival and the opener. */
  stage?: string;
  /** Play against the clock. Not on a journey stage, which has its own rules. */
  blitz?: boolean;
  /** Pre-placed marks: positive for you, negative for the bot. */
  handicap?: number;
}

/** What the finished game earned, worked out once when it ends. */
type Earned =
  | { kind: 'stage'; stars: number; improved: boolean; line: string }
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
  blitz = false,
  handicap = 0,
}: BotGameScreenProps) {
  const stage = stageId ? stageById(stageId) : undefined;
  const journey = useProgressStore((state) => state.journey);
  const t = useT(gameScreenMessages);
  // The clock and head starts live in the arcade's match, which still records
  // the game as a bot game.
  if (!stageId && !practice && (blitz || handicap !== 0)) {
    return <BlitzGame mode={mode} difficulty={difficulty} blitz={blitz} handicap={handicap} />;
  }
  if (stageId && !stage) return <BotGame mode={mode} difficulty={difficulty} practice={practice} />;
  // A link can name any stage; the journey decides which are open.
  if (stage && !isUnlocked(stage, journey)) {
    return (
      <Screen scroll>
        <Card className="w-full">
          <EmptyState
            title={t('stageLocked')}
            body={t('stageLockedBody', { rival: stage.rival.name })}
            action={
              <Button as={ReturnLink} to="/journey" size="small" className="w-auto px-4">
                {t('journeyMap')}
              </Button>
            }
          />
        </Card>
      </Screen>
    );
  }
  return (
    <BotGame
      // Stages and practice have their own saved positions and help settings.
      key={stage?.id ?? (practice ? 'practice' : 'free')}
      mode={stage?.mode ?? mode}
      difficulty={stage ? stageDifficulty(stage) : difficulty}
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
  const router = useRouter();
  const returnTo = useReturnTo();
  const t = useT(gameScreenMessages);
  const levels = useDifficultyLabels();
  const modeName = useModeText(mode).name;
  const config = useMemo(() => modeById(mode).config, [mode]);
  // A stage's opener and head start, built once so a restart rebuilds the same.
  const setup = useMemo(
    () => (stage?.setup ? { opener: stage.opener, moves: stage.setup } : undefined),
    [stage],
  );
  const style = useMemo(() => (stage ? stageStyle(stage) : undefined), [stage]);
  const { game, play, restart, undo, canUndo, round } = useGame(config, {
    ...(stage ? { opener: stage.opener } : {}),
    ...(setup ? { setup } : {}),
    storageKey: stage ? `journey:${stage.id}` : `bot:${mode}:${difficulty}:${practice}`,
  });
  const [hintsOn, setHintsOn] = useState(() => !stage && (practice || loadPreferences().hints));
  // A stage that offers hints gives its third star for not using them: the
  // round they were last switched on in, so a restart starts clean.
  const [hintedRound, setHintedRound] = useState(-1);
  const offersHints = !stage || stage.objective === 'no-hints';
  const [pendingChange, setPendingChange] = useState<'restart' | BotDifficulty | null>(null);
  const [reviewedRound, setReviewedRound] = useState(-1);
  // A result reopened with "Show result" appears at once, not after the reveal.
  const [reopenedRound, setReopenedRound] = useState(-1);
  const recordBotGame = useProgressStore((state) => state.recordBotGame);
  const recordStage = useProgressStore((state) => state.recordStage);

  const onMove = useCallback((index: number) => play(index), [play]);
  const { thinking, lastSearch } = useBotOpponent({
    game,
    botPlayer: O,
    difficulty,
    onMove,
    paused: pendingChange !== null,
    ...(style ? { style } : {}),
  });
  const { suggestion, thinking: suggesting, suggest } = useSuggestion(game);

  const hints = useMemo<BoardHint[]>(() => {
    const forced = hintsOn && game.currentPlayer === X ? hintsFor(game) : [];
    if (practice && suggestion !== null) {
      // A suggestion is a move code; on most rule sets that is one square.
      const best = suggestionCells(game, suggestion).filter(
        (index) => !forced.some((hint) => hint.index === index),
      );
      return [...forced, ...best.map((index) => ({ index, kind: 'best' as const }))];
    }
    return forced;
  }, [hintsOn, game, practice, suggestion]);

  useGameFeedback(game, {
    you: X,
    threats: hints.filter((hint) => hint.kind === 'threat').length,
  });
  useTurnTint(game);
  useMusicTension(game);
  // A journey stage is played in the rival's own world: board tint, backdrop
  // motif and theme tune. Cleared again on the way out.
  useRivalWorld(stage ? rivalWorld(stage.rival.id) : null);
  const duration = useGameDuration(game);
  const remark = useRivalRemarks(game, stage, mode, round, lastSearch);

  const rivalName = stage ? stage.rival.name : levels.bot(difficulty);
  const finished = game.status !== 'playing';
  const outcome = outcomeFor(game, X);
  const perfectClassic = mode === 'classic' && ['hard', 'expert', 'master'].includes(difficulty);
  const yourMoves = playerMoves(game, stage, X);
  const hintsUsed = hintsOn || hintedRound === round;
  // What the finished game did besides win - read once it is over, from the
  // moves, so the stars and the goal line agree.
  const stageResult = useMemo<StageResult | null>(
    () =>
      stage && finished
        ? { won: outcome === 'win', moves: yourMoves, hintsUsed, ...analyseWin(game, stage, X) }
        : null,
    [stage, finished, outcome, yourMoves, hintsUsed, game],
  );

  // Record each finished game exactly once, when it finishes - not on every
  // render of the finished board, and not again if a take-back reopens it.
  const [earned, setEarned] = useState<{ round: number; value: Earned } | null>(null);
  const recordedRound = useRef(-1);
  useEffect(() => {
    if (!finished || recordedRound.current === round) return;
    recordedRound.current = round;

    let value: Earned = { kind: 'none' };
    if (stage && stageResult) {
      const stars = starsFor(stage, stageResult);
      value = {
        kind: 'stage',
        stars,
        improved: recordStage(stage.id, stars),
        // The rival's parting line, chosen once per game rather than per render.
        line: resultLine(stage.rival, outcome),
      };
    } else if (!practice) {
      value = { kind: 'record', record: recordBotGame(mode, difficulty, outcome) };
    }
    setEarned({ round, value });
  }, [
    finished,
    round,
    stage,
    stageResult,
    outcome,
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
  async function goTo(next: { mode?: ModeId; difficulty?: BotDifficulty }) {
    const search = {
      mode: next.mode ?? mode,
      difficulty: next.difficulty ?? difficulty,
      ...(practice ? { practice: true as const } : {}),
    };
    savePreferences({ mode: search.mode, difficulty: search.difficulty });
    // Another level is a new round, not one left there earlier.
    if (search.mode !== mode || search.difficulty !== difficulty)
      forgetGame(`bot:${search.mode}:${search.difficulty}:${practice}`);
    // A confirmation/result overlay must release its temporary entry before
    // replacing game settings, or Back would restore the old difficulty.
    await consumeDialogHistory(router.history);
    return navigate({ to: '/play/bot', search, replace: true, viewTransition: false });
  }

  function toggleHints() {
    const next = !hintsOn;
    setHintsOn(next);
    if (next) setHintedRound(round);
    // A stage's hints are its own, not the player's general preference.
    if (!practice && !stage) savePreferences({ hints: next });
  }

  function requestChange(change: 'restart' | BotDifficulty) {
    if (change === difficulty) return;
    if (!finished && game.moves.length > 0) setPendingChange(change);
    else if (change === 'restart') restart();
    else void goTo({ difficulty: change });
  }

  /**
   * Take back to your own turn.
   *
   * Usually that is two moves - the bot's reply and yours - but a game you
   * ended yourself has no reply to take back, and taking two there would undo
   * the bot's previous move as well and hand it the turn.
   */
  function takeBack() {
    setReviewedRound(-1);
    const lastMover = game.lastMove === null ? null : game.board[game.lastMove];
    undo();
    if (!(finished && lastMover === X)) undo();
  }

  const title = stage
    ? outcome === 'win'
      ? t('stageCleared')
      : outcome === 'loss'
        ? t('rivalWins', { name: stage.rival.name })
        : t('aDraw')
    : outcome === 'win'
      ? t('youWin')
      : outcome === 'loss'
        ? t('rivalWins', { name: levels.bot(difficulty) })
        : t('draw');

  const following = stage ? stageAfter(stage) : undefined;
  const thisRound = earned?.round === round ? earned.value : null;
  // Set by the same record call as `earned`, so it belongs to this round
  // whenever this round recorded anything.
  const award = useProgressStore((state) => state.lastAward);

  return (
    <Screen>
      <div className="relative z-10 w-full animate-rise" style={{ animationDelay: '0.04s' }}>
        <GameHeader
          game={game}
          left={{ name: t('you'), kind: 'local', isYou: true }}
          right={{
            name: stage ? stage.rival.name : levels.label(difficulty),
            kind: 'bot',
            busy: thinking,
            ...(stage ? { avatar: stage.rival.avatar } : {}),
          }}
          centre={
            stage ? (
              <ModeChip mode={mode} />
            ) : (
              <ModeChip mode={mode} onClick={() => void returnTo('/')} />
            )
          }
          badge={t(stage ? 'badgeJourney' : practice ? 'badgePractice' : 'badgeBot')}
        />
        {remark ? (
          <RivalBubble
            key={`${round}:${remark.id}`}
            text={remark.text}
            accent={['fork', 'signature', 'bossIntro', 'nearLoss'].includes(remark.event)}
          />
        ) : null}
      </div>

      <main
        className="relative flex w-full flex-1 animate-board-in flex-col items-center justify-center gap-3 py-5"
        style={{ animationDelay: '0.12s' }}
      >
        <div className="relative w-full max-w-board">
          <Board
            game={game}
            onPlay={play}
            disabled={pendingChange !== null || thinking || game.currentPlayer === O}
            finishTone={finished ? outcome : null}
            hints={hints}
          />
          <OpenerBanner
            round={round}
            player={startingPlayerOf(game)}
            label={
              startingPlayerOf(game) === X ? t('youGoFirst') : t('goesFirst', { name: rivalName })
            }
            fresh={game.moves.length === 0}
          />
        </div>

        <VariantStatus game={game} />
        {hintsOn || practice ? <HintLegend hints={hints} /> : null}

        {!stage && practice ? (
          <p className="text-center text-xs text-ink-muted">{t('practiceNote')}</p>
        ) : !stage && perfectClassic ? (
          <p className="text-center text-xs text-ink-muted">{t('perfectNote')}</p>
        ) : null}

        {stage ? (
          <StageGoal
            stage={stage}
            moves={yourMoves}
            earned={stageResult ? starsFor(stage, stageResult) : null}
          />
        ) : (
          <ThinkingIndicator thinking={thinking} />
        )}
      </main>

      <footer
        className="flex animate-rise flex-col items-center gap-3 pb-4"
        style={{ animationDelay: '0.22s' }}
      >
        {finished && reviewedRound === round ? (
          <Button
            size="small"
            variant="ghost"
            onClick={() => {
              setReopenedRound(round);
              setReviewedRound(-1);
            }}
          >
            {t('showResult')}
          </Button>
        ) : null}
        {stage ? null : (
          <Segmented<BotDifficulty>
            label={t('botDifficulty')}
            value={difficulty}
            onChange={requestChange}
            size="small"
            className="w-full max-w-board"
            options={BOT_DIFFICULTIES.map((value) => ({
              value,
              label: levels.short(value),
              title: levels.label(value),
            }))}
          />
        )}

        <GameControls
          onRestart={() => requestChange('restart')}
          restartLabel={t(stage ? 'restartStage' : 'newGame')}
          onUndo={practice ? takeBack : undefined}
          canUndo={canUndo && !thinking}
          extra={
            !offersHints ? null : (
              <>
                {practice ? (
                  <IconButton
                    label={t('suggestMove')}
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
                  label={t(hintsOn ? 'hintsOff' : 'hintsOn')}
                  aria-pressed={hintsOn}
                  onClick={toggleHints}
                  className={hintsOn ? 'text-ok' : undefined}
                >
                  <BulbIcon />
                </IconButton>
                {!stage && !practice ? (
                  <IconButton
                    label={t('playClock')}
                    aria-pressed={false}
                    onClick={async () => {
                      await consumeDialogHistory(router.history);
                      void navigate({
                        to: '/play/bot',
                        search: { mode, difficulty, blitz: true },
                        replace: true,
                        viewTransition: false,
                      });
                    }}
                  >
                    <ClockIcon />
                  </IconButton>
                ) : null}
              </>
            )
          }
        />
      </footer>

      {finished && reviewedRound !== round ? (
        <ResultModal
          onDismiss={() => setReviewedRound(round)}
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
              ? outcome === 'draw'
                ? t('heldDraw', { name: stage.rival.name })
                : t('quote', {
                    line:
                      thisRound?.kind === 'stage'
                        ? thisRound.line
                        : outcome === 'win'
                          ? rivalText(stage.rival).concede
                          : rivalText(stage.rival).gloat,
                  })
              : outcome === 'draw' && perfectClassic
                ? t('perfectDraw')
                : `${levels.bot(difficulty)} · ${modeName}`
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
          rewards={
            thisRound && thisRound.kind !== 'none' && award ? (
              <RewardsPanel award={award} won={outcome === 'win'} />
            ) : null
          }
          celebrate={outcome === 'win'}
          tone={outcome}
          game={game}
          durationMs={duration}
          revealDelay={reopenedRound === round ? 0 : revealDelayFor(game)}
          actions={
            stage ? (
              <>
                {outcome === 'win' && following ? (
                  <Button
                    variant="primary"
                    size="small"
                    block
                    onClick={async () => {
                      await consumeDialogHistory(router.history);
                      void navigate({
                        to: '/play/bot',
                        search: {
                          mode: following.mode,
                          difficulty: following.rival.difficulty,
                          stage: following.id,
                        },
                        replace: true,
                      });
                    }}
                  >
                    {t('nextStage', { name: following.rival.name })}
                  </Button>
                ) : null}
                <Button
                  variant={outcome === 'win' && following ? 'ghost' : 'primary'}
                  size="small"
                  block
                  onClick={() => restart()}
                >
                  {t(outcome === 'win' ? 'playAgain' : 'tryAgain')}
                </Button>
                <Button as={ReturnLink} to="/journey" variant="ghost" size="small" block>
                  {t('journeyMap')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" size="small" block onClick={() => restart()}>
                  {t('playAgain')}
                </Button>
                {outcome === 'loss' && difficulty !== BOT_DIFFICULTIES[0] ? (
                  <Button
                    size="small"
                    variant="ghost"
                    block
                    onClick={() => goTo({ difficulty: easier(difficulty) })}
                  >
                    {t('easierBot')}
                  </Button>
                ) : outcome === 'win' && difficulty !== BOT_DIFFICULTIES.at(-1) ? (
                  <Button
                    size="small"
                    variant="ghost"
                    block
                    onClick={() => goTo({ difficulty: harder(difficulty) })}
                  >
                    {t('harderBot')}
                  </Button>
                ) : null}
                {!practice ? (
                  <Button
                    onClick={async () => {
                      await consumeDialogHistory(router.history);
                      forgetGame(`bot:${mode}:${difficulty}:true`);
                      void navigate({
                        to: '/play/bot',
                        search: { mode, difficulty, practice: true },
                        replace: true,
                      });
                    }}
                    variant="ghost"
                    size="small"
                    block
                  >
                    {t('practiceHints')}
                  </Button>
                ) : null}
                <Button as={ReturnLink} to="/" variant="ghost" size="small" block>
                  {t('backHome')}
                </Button>
              </>
            )
          }
        />
      ) : null}
      {pendingChange !== null ? (
        <GameResetDialog
          {...(pendingChange === 'restart'
            ? {}
            : {
                title: t('changeDifficultyTitle'),
                description: t('changeDifficultyBody', { level: levels.label(pendingChange) }),
                actionLabel: t('changeDifficulty'),
              })}
          onCancel={() => setPendingChange(null)}
          onConfirm={() => {
            const change = pendingChange;
            if (change === 'restart') {
              setPendingChange(null);
              restart();
            } else {
              // The dialog promised to replace this round, not to shelve it.
              forgetGame(`bot:${mode}:${difficulty}:${practice}`);
              // goTo consumes the dialog entry before updating the URL.
              void goTo({ difficulty: change }).then(() => setPendingChange(null));
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

function easier(difficulty: BotDifficulty): BotDifficulty {
  const index = BOT_DIFFICULTIES.indexOf(difficulty);
  return BOT_DIFFICULTIES[Math.max(0, index - 1)] ?? difficulty;
}

function harder(difficulty: BotDifficulty): BotDifficulty {
  const index = BOT_DIFFICULTIES.indexOf(difficulty);
  return BOT_DIFFICULTIES[Math.min(BOT_DIFFICULTIES.length - 1, index + 1)] ?? difficulty;
}

/** What a stage's third star asks for besides the par: "without a hint". */
function objectiveWords(stage: Stage, t: Translator<(typeof gameScreenMessages)['en']>): string {
  switch (stage.objective) {
    case 'no-hints':
      return t('objectiveNoHints');
    case 'fork':
      return t('objectiveFork');
    case 'flawless':
      return t('objectiveFlawless');
    case 'par':
      return '';
  }
}

/**
 * The line under the board on a journey stage: moves so far, against the par
 * for each star. It counts up as you play, so the target is never a surprise
 * on the result screen.
 */
function StageGoal({
  stage,
  moves,
  earned,
}: {
  stage: Stage;
  moves: number;
  /** The stars the finished game earned; null while it is still being played. */
  earned: number | null;
}) {
  const t = useT(gameScreenMessages);
  const [two, three] = stage.par;
  const onPace =
    stage.objective === 'par' ? (moves <= three ? 3 : moves <= two ? 2 : 1) : moves <= two ? 2 : 1;
  return (
    <div className="flex min-h-5 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm text-ink-muted">
      <span className="tnum whitespace-nowrap">{t('yourMoves', { count: moves })}</span>
      <span aria-hidden="true">·</span>
      <Stars earned={earned ?? onPace} className="text-sm" />
      <span className="tnum text-xs whitespace-nowrap text-ink-faint">
        {stage.objective === 'par'
          ? t('parGoal', { three, two })
          : t('objectiveGoal', { two, objective: objectiveWords(stage, t) })}
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
  const t = useT(gameScreenMessages);
  const levels = useDifficultyLabels();
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
            {t('wonIn', { count: moves })}
            {earned.improved ? t('newBest') : ''}
            {stage && earned.stars < 3 ? t('threeStarsAt', { count: stage.par[1] }) : ''}
          </p>
        ) : (
          <p className="text-xs text-ink-faint">{t('winToEarn')}</p>
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
            <SparkIcon className="size-4" /> {t('streak', { count: record.streak })}
          </p>
        ) : null}
        <p className="tnum">
          {t('record', {
            level: levels.label(difficulty),
            won: record.won,
            drawn: record.drawn,
            lost: record.lost,
          })}
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
  const t = useT(gameScreenMessages);
  return (
    <p
      className={cx(
        'flex h-5 items-center gap-1.5 text-sm text-ink-muted',
        'transition-[opacity,transform] duration-300 ease-spring',
        thinking ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
      aria-live="polite"
    >
      {thinking ? t('botThinking') : ''}
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
 * What a journey rival says as the game goes: an introduction, then lines for
 * the moments that matter - a threat made or blocked, two at once, the end
 * coming - read off the position by `nextRemark`.
 *
 * Worked out during render when the position changes, rather than in an
 * effect, so the line and the move that prompted it arrive in one paint.
 */
function useRivalRemarks(
  game: GameState,
  stage: Stage | undefined,
  mode: ModeId,
  round: number,
  note: { move: number; reason: string; score: number } | null,
): Remark | null {
  const [said, setSaid] = useState<{
    game: GameState | null;
    remark: Remark | null;
    memory: RemarkMemory;
    firstRound: number;
  }>({ game: null, remark: null, memory: FRESH_MEMORY, firstRound: round });

  if (said.game !== game && stage) {
    const next = nextRemark(said, game, {
      rival: stage.rival,
      mode,
      bot: O,
      setupPlies: stage.setup?.length ?? 0,
      note,
      rematch: round !== said.firstRound,
      boss: stage.boss === true,
      ...(stage.intro ? { intro: stageText(stage).intro } : {}),
    });
    setSaid({ ...said, game, ...next });
  }

  return stage ? said.remark : null;
}
