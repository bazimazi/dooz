import { ReturnLink, useReturnTo } from '@/components/ui/ReturnLink';
import {
  modeById,
  type ModeId,
  O,
  opponentOf,
  type Player,
  startingPlayerOf,
  X,
} from '@/game/engine';
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
import { useGameDuration } from '@/game/useGameDuration';
import { useMusicTension } from '@/game/useMusicTension';
import { useTurnTint } from '@/game/useTurnTint';
import { useProgressStore } from '@/features/progress/store';
import { cx } from '@/lib/cx';
import { hintsFor } from '@/game/hints';
import { lastSeatName, nextSeatName, type Teams, teamName } from '@/game/teams';
import { loadPreferences, savePreferences } from '@/lib/preferences';
import { useClosing } from '@/lib/useClosing';
import { useDialog } from '@/lib/useDialog';
import { useLocale, useT } from '@/i18n';
import { gameScreenMessages } from '@/i18n/messages/gameScreens';

interface LocalGameScreenProps {
  mode: ModeId;
}

interface Score {
  x: number;
  o: number;
  draws: number;
}

const NO_SCORE: Score = { x: 0, o: 0, draws: 0 };
/** One series per mode, and another for the same mode played two against two. */
function seriesKey(mode: ModeId, teams: boolean): string {
  return teams ? `${mode}:teams` : mode;
}

function loadScore(series: string): Score {
  try {
    const score = JSON.parse(localStorage.getItem(`dooz.local-series:${series}`) ?? 'null');
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
 *
 * Four people can play it too, as two teams of two: each team is one mark,
 * and its players take its moves in turn (see `game/teams.ts`). The cards show
 * whose seat is up, and the series is kept between the teams.
 */
export function LocalGameScreen({ mode }: LocalGameScreenProps) {
  const returnTo = useReturnTo();
  const t = useT(gameScreenMessages);
  const locale = useLocale();
  const avatar = useAccountStore((state) => state.profile?.avatar);
  const config = useMemo(() => modeById(mode).config, [mode]);
  const { game, play, restart, undo, canUndo, round } = useGame(config, {
    storageKey: `local:${mode}`,
  });
  const [hintsOn, setHintsOn] = useState(() => loadPreferences().hints);
  const [names, setNames] = useState(() => loadPreferences().localNames);
  const [partners, setPartners] = useState(() => loadPreferences().localPartners);
  const [teamPlay, setTeamPlay] = useState(() => loadPreferences().localTeams);
  const series = seriesKey(mode, teamPlay);
  const [renaming, setRenaming] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [reviewedRound, setReviewedRound] = useState(-1);
  // A result reopened with "Show result" appears at once, not after the reveal.
  const [reopenedRound, setReopenedRound] = useState(-1);
  const [score, setScore] = useState<Score>(() => loadScore(series));
  // The round whose result is in `score`, mirrored from the ref below so the
  // seat rotation can read it during render.
  const [countedRound, setCountedRound] = useState(-1);
  const recordLocalGame = useProgressStore((state) => state.recordLocalGame);

  const hints = useMemo(() => (hintsOn ? hintsFor(game) : []), [hintsOn, game]);
  useGameFeedback(game, { threats: hints.filter((hint) => hint.kind === 'threat').length });
  useTurnTint(game);
  useMusicTension(game);
  const duration = useGameDuration(game);

  const finished = game.status !== 'playing';
  const teams: Teams | null = teamPlay
    ? { x: [names[0], partners[0]], o: [names[1], partners[1]] }
    : null;
  // Games of this series already decided, not counting this one: what decides
  // which partner leads each team this game.
  const gamesDone = score.x + score.o + score.draws - (countedRound === round ? 1 : 0);
  /** Who plays `player`'s next move: the seat's name, or the team member who is up. */
  const nameOf = (player: Player) =>
    teams ? nextSeatName(game, player, teams, gamesDone) : player === X ? names[0] : names[1];
  const title =
    game.status === 'draw'
      ? t('draw')
      : teams
        ? t('teamWin', { team: teamName(game.winner ?? X, teams, locale) })
        : t('playerWins', { name: nameOf(game.winner ?? X) });
  // Somebody at this device won either way, so a win is always worth marking.
  const finishTone = finished ? (game.winner ? 'win' : 'draw') : null;

  // Count each finished game once. A take-back that reopens it and finishes it
  // differently replaces its result rather than adding a second one.
  const counted = useRef<{ round: number; result: 'x' | 'o' | 'draws' } | null>(null);
  // The profile's game count is per round: re-finishing after a take-back is
  // the same game.
  const recordedRound = useRef(-1);
  useEffect(() => {
    if (!finished) {
      if (counted.current?.round === round) {
        const { result } = counted.current;
        setScore((current) => ({ ...current, [result]: current[result] - 1 }));
        counted.current = null;
        setCountedRound(-1);
      }
      return;
    }
    if (counted.current?.round === round) return;
    const result = game.winner === X ? 'x' : game.winner === O ? 'o' : 'draws';
    counted.current = { round, result };
    setCountedRound(round);
    setScore((current) => ({ ...current, [result]: current[result] + 1 }));
    if (recordedRound.current !== round) {
      recordedRound.current = round;
      recordLocalGame(mode);
    }
  }, [finished, round, game.winner, recordLocalGame, mode]);

  // A new mode is a new series, and so is switching between one-a-side and
  // teams: the same people are not playing the same match any more.
  const [scoredSeries, setScoredSeries] = useState(series);
  if (scoredSeries !== series) {
    setScoredSeries(series);
    setScore(loadScore(series));
    setCountedRound(-1);
  }
  // The result counted against the old series is not the new one's to undo.
  const countedSeries = useRef(scoredSeries);
  useEffect(() => {
    if (countedSeries.current === scoredSeries) return;
    countedSeries.current = scoredSeries;
    counted.current = null;
  }, [scoredSeries]);

  useEffect(() => {
    try {
      localStorage.setItem(`dooz.local-series:${scoredSeries}`, JSON.stringify(score));
    } catch {
      /* The current series still works without storage. */
    }
  }, [scoredSeries, score]);

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
          left={{
            name: nameOf(X),
            kind: 'local',
            ...(avatar && !teams ? { avatar } : {}),
            ...(teams
              ? { detail: t('withPartner', { name: partnerOf(X, nameOf(X), teams) }) }
              : {}),
          }}
          right={{
            name: nameOf(O),
            kind: 'local',
            ...(teams
              ? { detail: t('withPartner', { name: partnerOf(O, nameOf(O), teams) }) }
              : {}),
          }}
          centre={
            <div className="flex flex-col items-center gap-1">
              <ModeChip mode={mode} onClick={() => void returnTo('/')} />
              <ScoreLine score={score} />
            </div>
          }
          badge={
            played > 0
              ? t('gameNumber', { count: played + (finished ? 0 : 1) })
              : t(teams ? 'badgeTeams' : 'badgeLocal')
          }
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
            player={startingPlayerOf(game)}
            label={t('starts', { name: nameOf(startingPlayerOf(game)) })}
            fresh={game.moves.length === 0}
          />
        </div>
        {teams && !finished ? (
          <p className="text-center text-sm text-ink" aria-live="polite">
            {/* The name is set in bold wherever the language puts it. */}
            {t('teamTurn', { mark: game.currentPlayer === X ? 'X' : 'O' })
              .split(/(\{name\})/)
              .map((part, at) =>
                part === '{name}' ? (
                  <span key={at} className="font-semibold">
                    {nameOf(game.currentPlayer)}
                  </span>
                ) : (
                  part
                ),
              )}
          </p>
        ) : null}
        <VariantStatus game={game} />
        {hintsOn ? <HintLegend hints={hints} /> : null}
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
        <GameControls
          onRestart={() => {
            if (!finished && game.moves.length > 0) setConfirmRestart(true);
            else restart();
          }}
          restartLabel={t('newGame')}
          onUndo={() => {
            setReviewedRound(-1);
            undo();
          }}
          canUndo={canUndo}
          extra={
            <>
              <IconButton label={t('namePlayers')} onClick={() => setRenaming(true)}>
                <UsersIcon />
              </IconButton>
              <IconButton
                label={t(hintsOn ? 'hintsOff' : 'hintsOn')}
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
          detail={
            <SeriesDetail
              score={score}
              names={teams ? [teamName(X, teams, locale), teamName(O, teams, locale)] : names}
              winner={game.winner}
              {...(teams && game.winner
                ? { finisher: lastSeatName(game, game.winner, teams, gamesDone) }
                : {})}
            />
          }
          celebrate={game.winner !== null}
          tone={game.winner !== null ? 'win' : 'draw'}
          game={game}
          durationMs={duration}
          revealDelay={reopenedRound === round ? 0 : revealDelayFor(game)}
          actions={
            <>
              <Button variant="primary" size="small" block onClick={nextGame}>
                {t('nextGame')}
              </Button>
              <Button
                variant="ghost"
                size="small"
                block
                onClick={() => {
                  setScore(NO_SCORE);
                  counted.current = null;
                  setCountedRound(-1);
                  restart();
                }}
              >
                {t('newSeries')}
              </Button>
              <Button as={ReturnLink} to="/" variant="ghost" size="small" block>
                {t('backHome')}
              </Button>
            </>
          }
        />
      ) : null}

      {renaming ? (
        <NamesSheet
          names={names}
          partners={partners}
          teams={teamPlay}
          onSave={(next) => {
            setNames(next.names);
            setPartners(next.partners);
            setTeamPlay(next.teams);
            savePreferences({
              localNames: next.names,
              localPartners: next.partners,
              localTeams: next.teams,
            });
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
  const t = useT(gameScreenMessages);
  return (
    <span
      className="tnum flex items-center gap-1.5 text-base font-semibold"
      aria-label={t('score', { x: score.x, o: score.o })}
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
  finisher,
}: {
  score: Score;
  names: readonly [string, string];
  winner: Player | null;
  /** In team play, the teammate whose move won it. */
  finisher?: string;
}) {
  const t = useT(gameScreenMessages);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center justify-center gap-3 rounded-tile border border-stroke-soft px-3 py-2">
        <SeriesSide name={names[0]} player={X} points={score.x} lit={winner === X} />
        <span className="text-xs text-ink-faint">
          {score.draws > 0 ? t('drawnCount', { count: score.draws }) : t('vs')}
        </span>
        <SeriesSide name={names[1]} player={O} points={score.o} lit={winner === O} />
      </div>
      {finisher ? (
        <p className="text-xs text-ink-muted">{t('winningMoveBy', { name: finisher })}</p>
      ) : null}
    </div>
  );
}

/** The other member of `player`'s team from `name`. */
function partnerOf(player: Player, name: string, teams: Teams): string {
  const [first, second] = player === X ? teams.x : teams.o;
  return name === first ? second : first;
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
  partners,
  teams,
  onSave,
  onClose,
}: {
  names: readonly [string, string];
  partners: readonly [string, string];
  teams: boolean;
  onSave: (next: { names: [string, string]; partners: [string, string]; teams: boolean }) => void;
  onClose: () => void;
}) {
  const t = useT(gameScreenMessages);
  const { closing, close } = useClosing(onClose);
  const panelRef = useDialog<HTMLDivElement>(close);
  const seat = (name: string, n: number) => name.trim() || t('playerN', { n });
  const [first, setFirst] = useState(names[0]);
  const [second, setSecond] = useState(names[1]);
  const [third, setThird] = useState(partners[0]);
  const [fourth, setFourth] = useState(partners[1]);
  const [teamPlay, setTeamPlay] = useState(teams);

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
        aria-label={t('namePlayers')}
        tabIndex={-1}
        className={cx(
          'max-h-[calc(100dvh-2.5rem)] w-full max-w-80 overflow-y-auto panel-shell rounded-[2rem] border border-stroke p-2 outline-none',
          'shadow-[0_30px_70px_-30px_var(--color-shadow)]',
          closing ? 'animate-panel-out' : 'animate-panel-in',
        )}
      >
        <form
          className="flex flex-col gap-4 panel-face rounded-[1.5rem] bg-surface px-5 py-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              names: [seat(first, 1), seat(second, 2)],
              partners: [seat(third, 3), seat(fourth, 4)],
              teams: teamPlay,
            });
            close();
          }}
        >
          <h2 className="text-center font-display text-xl">{t('whosPlaying')}</h2>
          <label className="flex items-center justify-between gap-3 rounded-tile border border-stroke-soft px-3 py-2 text-sm">
            <span className="flex flex-col">
              <span>{t('twoTeams')}</span>
              <span className="text-xs text-ink-muted">{t('teammatesTakeTurns')}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={teamPlay}
              onChange={(event) => setTeamPlay(event.target.checked)}
              className="size-5 shrink-0 accent-[var(--color-ok)]"
            />
          </label>
          <Field
            label={t(teamPlay ? 'teamXFirst' : 'playsX')}
            value={first}
            maxLength={14}
            autoComplete="off"
            onChange={(event) => setFirst(event.target.value)}
            trailing={<Mark player={X} className="size-7 shrink-0" />}
          />
          {teamPlay ? (
            <Field
              label={t('teamXSecond')}
              value={third}
              maxLength={14}
              autoComplete="off"
              onChange={(event) => setThird(event.target.value)}
              trailing={<Mark player={X} className="size-7 shrink-0" />}
            />
          ) : null}
          <Field
            label={t(teamPlay ? 'teamOFirst' : 'playsO')}
            value={second}
            maxLength={14}
            autoComplete="off"
            onChange={(event) => setSecond(event.target.value)}
            trailing={<Mark player={O} hole="var(--color-surface)" className="size-7 shrink-0" />}
          />
          {teamPlay ? (
            <Field
              label={t('teamOSecond')}
              value={fourth}
              maxLength={14}
              autoComplete="off"
              onChange={(event) => setFourth(event.target.value)}
              trailing={<Mark player={O} hole="var(--color-surface)" className="size-7 shrink-0" />}
            />
          ) : null}
          {teamPlay ? (
            <p className="text-center text-xs text-ink-muted">
              {t('turnsGo', {
                a: seat(first, 1),
                b: seat(second, 2),
                c: seat(third, 3),
                d: seat(fourth, 4),
              })}
            </p>
          ) : null}
          <Button type="submit" variant="primary" size="small" block>
            {t('save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={close}
            className="self-center"
          >
            {t('cancel')}
          </Button>
        </form>
      </div>
    </div>
  );
}
