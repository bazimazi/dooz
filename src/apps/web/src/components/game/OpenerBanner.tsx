import type { Player } from '@dooz/engine';
import { useEffect, useState } from 'react';
import { Mark } from '@/components/art/marks';

interface OpenerBannerProps {
  /** Changes for every new game, which is what replays the toss. */
  round: number;
  player: Player;
  /** "You go first", "Pip goes first". */
  label: string;
}

/** Matches the `banner` animation, which fades itself out at the end. */
const SHOW_MS = 1700;

/**
 * Who opens, said once at the start of a game.
 *
 * The opener is a coin toss, and a coin toss nobody sees is just the bot
 * moving before you have looked at the board. The mark spins like a tossed
 * coin, holds for a beat, and the banner leaves on its own - it never waits
 * for a tap, and it sits over the board without taking one.
 *
 * It keeps its own time rather than showing while the board is empty: a bot
 * that opens would otherwise take the banner away with its first move. The
 * opener and the label are captured when the round starts, so the banner does
 * not change its mind as the turn passes underneath it.
 */
export function OpenerBanner({ round, player, label }: OpenerBannerProps) {
  const [shown, setShown] = useState<{ round: number; player: Player; label: string } | null>(null);

  const [seenRound, setSeenRound] = useState<number | null>(null);
  if (seenRound !== round) {
    setSeenRound(round);
    setShown({ round, player, label });
  }

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      key={shown.round}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
    >
      <div className="flex animate-banner items-center gap-2.5 rounded-full border border-stroke bg-surface/95 py-2 pr-5 pl-2.5 shadow-[0_18px_40px_-18px_var(--color-shadow)] backdrop-blur-sm">
        <span className="flex size-9 animate-flip items-center justify-center">
          <Mark player={shown.player} hole="var(--color-surface)" className="size-8" />
        </span>
        <span className="font-display text-lg">{shown.label}</span>
      </div>
    </div>
  );
}
