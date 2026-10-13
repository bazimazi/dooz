import { canPlay, type GameState } from '@/game/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePageVisible } from '@/lib/usePageVisible';
import { BotSearch } from './BotSearch';

/** Suggestions only start a worker when requested, and cancel stale work. */
export function useSuggestion(game: GameState): {
  suggestion: number | null;
  thinking: boolean;
  suggest: () => void;
} {
  const searchRef = useRef<BotSearch | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const visible = usePageVisible();
  const [answer, setAnswer] = useState<{ for: GameState; move: number } | null>(null);
  const [asking, setAsking] = useState<GameState | null>(null);

  useEffect(() => {
    const search = new BotSearch();
    searchRef.current = search;
    return () => search.dispose();
  }, []);

  // A new position or a hidden tab cancels the request in flight.
  useEffect(
    () => () => {
      pending.current?.();
      pending.current = null;
      setAsking(null);
    },
    [game, visible],
  );

  const suggest = useCallback(() => {
    if (game.status !== 'playing' || !visible || pending.current) return;
    const position = game;
    setAsking(position);
    pending.current =
      searchRef.current?.search(position, { difficulty: 'expert', timeBudgetMs: 900 }, (chosen) => {
        pending.current = null;
        setAsking((current) => (current === position ? null : current));
        if (chosen && canPlay(position, chosen.move))
          setAnswer({ for: position, move: chosen.move });
      }) ?? null;
  }, [game, visible]);

  return {
    suggestion: answer && answer.for === game ? answer.move : null,
    thinking: asking === game && visible,
    suggest,
  };
}
