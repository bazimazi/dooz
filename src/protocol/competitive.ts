import { z } from 'zod';
import {
  gameConfigSchema,
  leaderboardEntrySchema,
  matchKindSchema,
  publicProfileSchema,
  roomCodeSchema,
  tournamentSchema,
} from './index.js';

/**
 * HTTP shapes for the competitive layer: seasons, ladders, live games and
 * tournaments. The socket messages for tournaments live with the rest of the
 * wire protocol; these are only ever fetched.
 */

export const seasonSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().max(40),
  startsAt: z.number().int(),
  endsAt: z.number().int(),
  /** Set once the season is over and its standings are final. */
  closedAt: z.number().int().nullable(),
});

export type Season = z.infer<typeof seasonSchema>;

export const ladderEntrySchema = leaderboardEntrySchema.extend({
  /** Tier id and "Gold II"-style label for the rating shown. */
  tier: z.string().max(20),
  label: z.string().max(30),
  /** Highest rating reached in the season. */
  peak: z.number().int(),
});

export type LadderEntry = z.infer<typeof ladderEntrySchema>;

export const ladderResponseSchema = z.object({
  mode: z.string(),
  placementGames: z.number().int(),
  season: seasonSchema,
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  entries: z.array(ladderEntrySchema).max(100),
  /** The account asking, when signed in and on this ladder. */
  me: z.object({ rank: z.number().int().positive(), entry: ladderEntrySchema }).nullable(),
});

export type LadderResponse = z.infer<typeof ladderResponseSchema>;

export const seasonsResponseSchema = z.object({
  current: seasonSchema,
  seasons: z.array(seasonSchema).max(50),
});

export const seasonStandingSchema = z.object({
  mode: z.string(),
  rating: z.number().int(),
  rd: z.number().int().nonnegative(),
  provisional: z.boolean(),
  label: z.string(),
  tier: z.string(),
  progress: z.number().min(0).max(1).nullable(),
  seasonPlayed: z.number().int().nonnegative(),
  placementGames: z.number().int().nonnegative(),
  rank: z.number().int().positive().nullable(),
});

export const seasonResultSchema = z.object({
  seasonId: z.number().int(),
  seasonName: z.string(),
  mode: z.string(),
  rating: z.number().int(),
  peak: z.number().int(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  rank: z.number().int().positive().nullable(),
  label: z.string(),
  tier: z.string(),
});

export const awardSchema = z.object({
  source: z.string(),
  sourceId: z.string(),
  mode: z.string(),
  badge: z.string().max(40),
  title: z.string().max(120),
  awardedAt: z.number().int(),
});

/** A player's competitive record: where they stand now, how past seasons went, what they won. */
export const competitiveProfileSchema = z.object({
  season: seasonSchema,
  standings: z.array(seasonStandingSchema).max(50),
  history: z.array(seasonResultSchema).max(50),
  awards: z.array(awardSchema).max(50),
});

export type SeasonStanding = z.infer<typeof seasonStandingSchema>;
export type SeasonResult = z.infer<typeof seasonResultSchema>;
export type Award = z.infer<typeof awardSchema>;
export type CompetitiveProfile = z.infer<typeof competitiveProfileSchema>;

export const liveGameSchema = z.object({
  code: roomCodeSchema,
  mode: z.string(),
  kind: matchKindSchema,
  config: gameConfigSchema,
  x: publicProfileSchema,
  o: publicProfileSchema,
  moves: z.number().int().nonnegative(),
  spectators: z.number().int().nonnegative(),
  startedAt: z.number().int(),
  tournament: z.string().nullable(),
});

export type LiveGame = z.infer<typeof liveGameSchema>;

export const liveGamesResponseSchema = z.object({ games: z.array(liveGameSchema).max(50) });

export const tournamentsResponseSchema = z.object({
  tournaments: z.array(tournamentSchema).max(40),
});

export const tournamentResponseSchema = z.object({ tournament: tournamentSchema });
