import { type Player, X } from '@dooz/engine';
import { AvatarIcon, BotAvatarIcon, TurnCaret, WifiOffIcon } from '@/components/art/icons';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';

interface PlayerCardProps {
  name: string;
  player: Player;
  /** Draws the caret and the coloured edge when it is this player's turn. */
  active: boolean;
  kind?: 'human' | 'bot';
  /** Online only. `undefined` means presence does not apply. */
  connected?: boolean;
  /** Marks the seat as belonging to the person at this device. */
  isYou?: boolean;
}

/** One of the two cards flanking the board header. */
export function PlayerCard({
  name,
  player,
  active,
  kind = 'human',
  connected,
  isYou = false,
}: PlayerCardProps) {
  const Avatar = kind === 'bot' ? BotAvatarIcon : AvatarIcon;
  const accent = player === X ? 'var(--color-p2)' : 'var(--color-y2)';
  const offline = connected === false;

  return (
    <div
      className={cx(
        'relative w-[6.125rem] rounded-panel border p-1 transition-colors duration-300',
        active ? 'border-transparent' : 'border-b8',
        offline && 'opacity-60',
      )}
      style={active ? { borderColor: accent } : undefined}
    >
      <div className="flex h-[7.5rem] flex-col items-center justify-around rounded-[1.25rem] bg-raised px-1">
        <Avatar className="size-12" ring="var(--color-b2)" />

        <div className="flex items-center gap-1">
          <span className="max-w-[5rem] truncate text-base leading-5" title={name}>
            {name}
          </span>
          {offline ? <WifiOffIcon className="size-3.5 text-g8" /> : null}
        </div>

        <Mark player={player} hole="var(--color-raised)" className="size-8" />
      </div>

      {isYou ? (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-b2 px-2 py-0.5 text-[0.625rem] tracking-wide uppercase">
          you
        </span>
      ) : null}

      {active ? (
        <TurnCaret
          color={accent}
          className="absolute -bottom-[0.9rem] left-1/2 h-2 w-4 -translate-x-1/2"
        />
      ) : null}
    </div>
  );
}
