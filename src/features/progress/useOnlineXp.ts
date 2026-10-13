import type { Player } from '@/game/engine';
import type { MatchResult } from '@/protocol';
import { useEffect } from 'react';
import { type Award, useProgressStore } from './store';

const STORAGE_KEY = 'dooz.online-xp';
/** Enough to cover a reconnect that replays a result; older ids cannot return. */
const REMEMBERED = 40;

/** Awards paid this session, by match id, for the result panel to show. */
const awards = new Map<string, Award>();

function recorded(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function remember(matchId: string): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...recorded().filter((id) => id !== matchId), matchId].slice(-REMEMBERED)),
    );
  } catch {
    /* Without storage a replayed result could pay twice; it is only XP. */
  }
}

/**
 * XP for a finished online match, paid once per match id.
 *
 * The server keeps the real record; this is only the level, which lives on the
 * device like the rest of solo progress. A result can arrive more than once -
 * a reconnect replays it - so the ids already paid for are remembered.
 * Spectators earn nothing.
 */
export function useOnlineXp(
  result: MatchResult | null,
  you: Player | null,
  mode: string,
): Award | null {
  const recordOnlineGame = useProgressStore((state) => state.recordOnlineGame);
  // Paying updates the store, which is what renders the award once it exists.
  useProgressStore((state) => state.lastAward);

  useEffect(() => {
    if (!result || you === null) return;
    if (awards.has(result.matchId) || recorded().includes(result.matchId)) return;
    remember(result.matchId);
    const outcome = result.winner === null ? 'draw' : result.winner === you ? 'win' : 'loss';
    awards.set(result.matchId, recordOnlineGame(mode, outcome, result.kind === 'ranked'));
  }, [result, you, mode, recordOnlineGame]);

  return result ? (awards.get(result.matchId) ?? null) : null;
}
