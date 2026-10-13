import { type GameState, type Player, startingPlayerOf, X } from '@/game/engine';
import { type Locale, translate } from '@/i18n';
import { gameLabelMessages } from '@/i18n/messages/gameLabels';

/**
 * Two teams of two on one device.
 *
 * The rules never hear about it: a team is just one of the two marks, and its
 * two players take that mark's moves in turn. So the whole of team play is
 * working out which of the two is up, from the moves already played - with the
 * opener's team on the even plies, P1 (X) then P3 (O) then P2 (X) then P4 (O)
 * when X opens. Who leads each team alternates from game to game, so neither
 * partner is always the one to make the team's first move.
 */

/** Each team's two players, the first-named leading the first game of a series. */
export interface Teams {
  readonly x: readonly [string, string];
  readonly o: readonly [string, string];
}

/** How many moves `player` has made in `game`. */
export function movesBy(game: GameState, player: Player): number {
  const plies = game.moves.length;
  return player === startingPlayerOf(game) ? Math.ceil(plies / 2) : Math.floor(plies / 2);
}

/**
 * Which of `player`'s two seats makes their `turn`-th move (0-based) in the
 * `gamesDone`-th game of a series: 0 for the first-named, 1 for the partner.
 */
export function seatFor(turn: number, gamesDone: number): 0 | 1 {
  return ((turn + gamesDone) % 2) as 0 | 1;
}

/** The name of the player whose turn it is next for `player`'s team. */
export function nextSeatName(
  game: GameState,
  player: Player,
  teams: Teams,
  gamesDone: number,
): string {
  const team = player === X ? teams.x : teams.o;
  return team[seatFor(movesBy(game, player), gamesDone)];
}

/** The name of the player who made `player`'s team's most recent move, or the next one if none. */
export function lastSeatName(
  game: GameState,
  player: Player,
  teams: Teams,
  gamesDone: number,
): string {
  const team = player === X ? teams.x : teams.o;
  const made = movesBy(game, player);
  return team[seatFor(Math.max(0, made - 1), gamesDone)];
}

/** "Ana & Ben": how a team is named in a result or a score. */
export function teamName(player: Player, teams: Teams, locale?: Locale): string {
  const [first, second] = player === X ? teams.x : teams.o;
  return translate(gameLabelMessages, 'team', { first, second }, locale);
}
