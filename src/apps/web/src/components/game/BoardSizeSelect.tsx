import { BOARD_SIZES, type BoardSize } from '@dooz/engine';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDownIcon } from '@/components/art/icons';
import { cx } from '@/lib/cx';

interface BoardSizeSelectProps {
  value: BoardSize;
  onChange: (size: BoardSize) => void;
  /** Locked during an online game, where both players share one board. */
  disabled?: boolean;
}

/**
 * The `3 x 3` / `6 x 6` / `9 x 9` dropdown between the two player cards.
 *
 * Built by hand rather than from a native `<select>` because the design puts
 * the options in a panel that unrolls under the trigger — but it keeps the
 * keyboard and dismissal behaviour a native select has.
 */
export function BoardSizeSelect({ value, onChange, disabled = false }: BoardSizeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function pick(size: BoardSize) {
    setOpen(false);
    if (size !== value) onChange(size);
  }

  return (
    <div ref={containerRef} className="relative z-20 w-[4.5rem] self-start pt-5">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((previous) => !previous)}
        className={cx(
          'flex h-10 w-full items-center justify-between gap-1 rounded-tile border border-b8 px-1.5',
          'bg-b8/20 text-base whitespace-nowrap',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {value} x {value}
        <ChevronDownIcon
          className={cx('size-4 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <ul
        id={listId}
        role="listbox"
        aria-label="Board size"
        className={cx(
          'absolute inset-x-0 top-[3.25rem] overflow-hidden rounded-tile border border-b8',
          'bg-b3/95 backdrop-blur-sm transition-all duration-300',
          open
            ? 'max-h-40 opacity-100'
            : 'pointer-events-none max-h-0 border-transparent opacity-0',
        )}
      >
        {BOARD_SIZES.map((size) => (
          <li key={size}>
            <button
              type="button"
              role="option"
              aria-selected={size === value}
              onClick={() => pick(size)}
              className={cx(
                'flex h-10 w-full items-center border-t border-b8 px-1.5 text-base first:border-t-0',
                'hover:bg-b8/25',
                size === value && 'bg-b8/20',
              )}
            >
              {size} x {size}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
