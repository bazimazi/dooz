import {
  choosesMark,
  type GameState,
  markMove,
  O,
  type Player,
  type PowerKind,
  powerCharges,
  powerMove,
  swapMove,
  X,
} from '@/game/engine';
import type { KeyboardEvent, ReactNode } from 'react';
import { SwapIcon } from '@/components/art/ui-icons';
import { Mark } from '@/components/art/marks';
import { cx } from '@/lib/cx';
import { useT } from '@/i18n';
import { gameVariantMessages } from '@/i18n/messages/gameVariants';

/**
 * The choices some rule sets ask for before a square is tapped.
 *
 * Most games are "tap a square". Wild and Order and Chaos also ask which mark
 * to place, Powers which action to take, and a pie-rule game offers the swap
 * as a move with no square at all. These live above the board rather than in
 * a menu so the choice is always visible next to the squares it changes, and
 * each is a real control - a radio group or a button - so it works from the
 * keyboard and is announced as what it is.
 */

/** What a tap on `cell` plays, given the choices made above the board. */
export function moveFor(game: GameState, cell: number, mark: Player, power: PowerKind): number {
  const { variant } = game.config;
  if (choosesMark(variant)) return markMove(game.config, cell, mark);
  if (variant === 'powers') return powerMove(game.config, cell, power);
  return cell;
}

/** Whether the board needs a controls bar for `game` at all. */
export function hasVariantControls(game: GameState): boolean {
  return (
    choosesMark(game.config.variant) ||
    game.config.variant === 'powers' ||
    game.config.opening === 'swap'
  );
}

interface VariantControlsProps {
  game: GameState;
  /** The board is taking input from this device right now. */
  interactive: boolean;
  /** The legal move codes, as the board already holds them. */
  playable: ReadonlySet<number>;
  mark: Player;
  onMark: (mark: Player) => void;
  power: PowerKind;
  onPower: (power: PowerKind) => void;
  onPlay: (move: number) => void;
}

export function VariantControls({
  game,
  interactive,
  playable,
  mark,
  onMark,
  power,
  onPower,
  onPlay,
}: VariantControlsProps) {
  const t = useT(gameVariantMessages);
  const { variant } = game.config;
  const swap = swapMove(game.config);
  const canSwap = interactive && swap !== null && playable.has(swap);
  // The picker and the powers sit in a bar above the squares for the whole
  // game. The swap is on offer for one move only, so it hangs on the frame's
  // top edge instead: the board never shifts to make room for it.
  const bar = choosesMark(variant) || variant === 'powers';

  return (
    <>
      {bar ? (
        <div className="mb-2 flex min-h-9 flex-wrap items-center justify-center gap-2 text-xs">
          {choosesMark(variant) ? (
            <Choice
              label={t(variant === 'order-chaos' ? 'markToPlaceEither' : 'markToPlace')}
              options={[
                { value: X, content: <MarkGlyph player={X} />, name: 'X' },
                { value: O, content: <MarkGlyph player={O} />, name: 'O' },
              ]}
              value={mark}
              onChange={onMark}
              enabled={interactive}
            />
          ) : null}

          {variant === 'powers' ? (
            <PowerChoice game={game} interactive={interactive} power={power} onPower={onPower} />
          ) : null}
        </div>
      ) : null}

      {canSwap ? (
        <button
          type="button"
          onClick={() => onPlay(swap)}
          className={cx(
            'absolute -top-4 left-1/2 z-10 flex min-h-9 -translate-x-1/2 animate-fade-in items-center gap-1.5',
            'rounded-full border border-accent bg-surface px-3 text-xs font-semibold whitespace-nowrap text-ink',
            'shadow-[0_6px_16px_-8px_var(--color-shadow)] transition-colors duration-150 hover:bg-b8/12 active:bg-b8/25',
          )}
        >
          <SwapIcon className="size-4" />
          {t('swapOpening')}
        </button>
      ) : null}
    </>
  );
}

function PowerChoice({
  game,
  interactive,
  power,
  onPower,
}: {
  game: GameState;
  interactive: boolean;
  power: PowerKind;
  onPower: (power: PowerKind) => void;
}) {
  const t = useT(gameVariantMessages);
  const charges = powerCharges(game, game.currentPlayer);
  const hasTarget = game.board.some((cell) => cell === (game.currentPlayer === X ? O : X));
  return (
    <Choice
      label={t('action')}
      options={[
        { value: 'place', content: t('place'), name: t('placeMark') },
        {
          value: 'bomb',
          content: (
            <>
              <BombIcon className="size-4" /> {t('bomb', { count: charges.bomb })}
            </>
          ),
          name: t('bombName', { count: charges.bomb }),
          disabled: charges.bomb <= 0 || !hasTarget,
        },
        {
          value: 'wall',
          content: (
            <>
              <WallIcon className="size-4" /> {t('wall', { count: charges.wall })}
            </>
          ),
          name: t('wallName', { count: charges.wall }),
          disabled: charges.wall <= 0,
        },
      ]}
      value={power}
      onChange={onPower}
      enabled={interactive}
    />
  );
}

interface ChoiceOption<T> {
  value: T;
  content: ReactNode;
  /** The accessible name, when the visible content is a glyph or a count. */
  name: string;
  disabled?: boolean;
}

/**
 * A small segmented radio group. Arrow keys move the choice, as a radio group
 * requires; a disabled option stays focusable so it is still read out.
 */
function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  enabled,
}: {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  enabled: boolean;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0 || !enabled) return;
    event.preventDefault();
    const usable = options.filter((option) => !option.disabled);
    const at = usable.findIndex((option) => option.value === value);
    const next = usable[(at + step + usable.length) % usable.length];
    if (!next) return;
    onChange(next.value);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-choice="${String(next.value)}"]`)
      ?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="flex items-center gap-0.5 rounded-full border border-stroke p-0.5"
    >
      {options.map((option) => {
        const checked = option.value === value;
        const disabled = !enabled || option.disabled === true;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            data-choice={String(option.value)}
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            aria-label={option.name}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              if (!disabled) onChange(option.value);
            }}
            className={cx(
              'flex min-h-8 min-w-9 items-center justify-center gap-1 rounded-full px-2.5 transition-colors duration-150',
              checked ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-stroke-soft',
              disabled && !checked && 'opacity-45',
              disabled ? 'cursor-default' : 'cursor-pointer',
            )}
          >
            {option.content}
          </button>
        );
      })}
    </div>
  );
}

function MarkGlyph({ player }: { player: Player }) {
  return <Mark player={player} hole="var(--color-surface)" className="size-4" />;
}

function BombIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="10" cy="14.5" r="6.5" />
      <path d="M14.6 9.9l1.8-1.8M16.4 8.1c.6-1.9 2.1-2.7 3.6-2.1" />
      <path d="M21 3.2v1.4M22.6 4.8h-1.4M19.6 4.8h-1.2" />
      <path d="M7.2 12.2a3 3 0 0 1 2.4-1.4" />
    </svg>
  );
}

function WallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 12h18M9 5v7M15 12v7" />
    </svg>
  );
}
