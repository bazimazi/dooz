import type { GameConfig } from '@/game/engine';
import { useEffect, useState } from 'react';
import { cx } from '@/lib/cx';
import { useGraphics } from '@/lib/graphics';
import { usePageVisible } from '@/lib/usePageVisible';
import { MiniBoard } from './MiniBoard';

/** How often the demo game plays itself again, in milliseconds. */
const LOOP_MS = 5600;

/**
 * The home screen's hero: the chosen mode's board, playing its winning run
 * over and over like an attract screen in an arcade.
 *
 * Each loop remounts the preview, which is the only way to replay its one-shot
 * entrance - the marks land in order and the line draws through them. It sits
 * on a tilted stage with a pool of light under it on High; on Low it is the
 * still, finished position. A hidden page stops the loop.
 */
export function HeroBoard({ config, className }: { config: GameConfig; className?: string }) {
  const graphics = useGraphics();
  const visible = usePageVisible();
  const [loop, setLoop] = useState(0);
  const playing = graphics !== 'low' && visible;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setLoop((count) => count + 1), LOOP_MS);
    return () => clearInterval(timer);
  }, [playing]);

  return (
    <span dir="ltr" className={cx('hero-stage relative block', className)}>
      {graphics === 'high' ? <span aria-hidden="true" className="hero-pool" /> : null}
      <span className="hero-tilt block">
        <MiniBoard key={loop} config={config} active={graphics !== 'low'} className="w-full" />
      </span>
    </span>
  );
}
