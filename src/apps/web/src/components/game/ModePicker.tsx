import { GAME_MODES, type GameMode, type ModeGroup, type ModeId, modeById } from '@dooz/engine';
import { useRef } from 'react';
import { TrophyIcon } from '@/components/art/ui-icons';
import { cx } from '@/lib/cx';
import { MiniBoard } from './MiniBoard';

const GROUP_LABELS: Record<ModeGroup, string> = {
  classic: 'The classics',
  large: 'Bigger boards',
  variant: 'Twists',
};

const GROUP_ORDER: readonly ModeGroup[] = ['classic', 'large', 'variant'];

/**
 * Choosing what to play.
 *
 * A grid of real board previews rather than a list of names, because "Gomoku
 * 15" tells a new player nothing and a picture of a 15x15 board with five
 * stones on it tells them most of what they need. The modes are grouped so the
 * three-by-three board a first-time player is looking for is the first thing
 * on the screen and the variants are somewhere they have to choose to go.
 *
 * It is a radio group: the arrow keys move between modes and a screen reader
 * announces the position in the set, which a grid of buttons would not.
 */
export function ModePicker({
  value,
  onChange,
  className,
}: {
  value: ModeId;
  onChange: (mode: ModeId) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Arrow keys move the selection, as a radio group requires.
   *
   * The visual order is the array order, so left and right are neighbours in
   * the list and up and down move by a row - which is two on the widest layout
   * this ever renders at.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const deltas: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 2,
      ArrowUp: -2,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;

    const index = GAME_MODES.findIndex((mode) => mode.id === value);
    const next = GAME_MODES[Math.min(GAME_MODES.length - 1, Math.max(0, index + delta))];
    if (!next || next.id === value) return;

    event.preventDefault();
    onChange(next.id);
    containerRef.current?.querySelector<HTMLButtonElement>(`[data-mode="${next.id}"]`)?.focus();
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Game mode"
      onKeyDown={handleKeyDown}
      className={cx('flex w-full flex-col gap-5', className)}
    >
      {GROUP_ORDER.map((group) => {
        const modes = GAME_MODES.filter((mode) => mode.group === group);
        if (modes.length === 0) return null;

        return (
          <section key={group} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs tracking-wide text-ink-faint uppercase">
              {GROUP_LABELS[group]}
            </h2>
            {/* One column on the narrowest phones: at 320px two columns leave
                61px for the label, which is less than "Gomoku 13" needs and
                pushed the page into a horizontal scroll. */}
            <div className="grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
              {modes.map((mode) => (
                <ModeTile
                  key={mode.id}
                  mode={mode}
                  selected={mode.id === value}
                  onSelect={() => onChange(mode.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ModeTile({
  mode,
  selected,
  onSelect,
}: {
  mode: GameMode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      data-mode={mode.id}
      aria-checked={selected}
      // Only the selected tile is a tab stop; the arrows move within the group.
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cx(
        // A row rather than a stacked card: seven stacked tiles pushed the
        // "Play" button two screens down, and the preview was carrying far more
        // height than it was worth once the name said the same thing.
        'group flex items-center gap-2.5 rounded-2xl border p-2 text-left',
        'transition-[transform,border-color,background-color] duration-200 ease-spring',
        'hover:-translate-y-0.5 active:scale-[0.98]',
        selected
          ? 'border-stroke bg-surface shadow-[0_12px_28px_-18px_var(--color-shadow)]'
          : 'border-stroke-soft bg-surface/70 hover:border-stroke',
      )}
    >
      <MiniBoard config={mode.config} active={selected} className="w-12 shrink-0" />

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{mode.name}</span>
          {mode.ranked ? (
            <TrophyIcon
              className="size-3 shrink-0 text-ink-faint"
              aria-label="Has a ranked ladder"
            />
          ) : null}
        </span>
        <span className="line-clamp-2 text-xs leading-snug text-ink-faint">{mode.tagline}</span>
      </span>
    </button>
  );
}

/** The compact form for a game screen's header: mode name, tap to change. */
export function ModeChip({ mode, onClick }: { mode: ModeId; onClick?: () => void }) {
  const detail = modeById(mode);

  if (!onClick) {
    return <span className="text-center text-sm text-ink-muted">{detail.name}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-full border border-stroke-soft px-2.5 py-1 text-sm text-ink-muted',
        'transition-colors duration-200 hover:border-stroke hover:text-ink',
      )}
    >
      {detail.name}
    </button>
  );
}
