import { type ReactNode, useEffect, useRef } from 'react';
import { cx } from '@/lib/cx';

export interface TabOption<T extends string> {
  value: T;
  label: ReactNode;
}

/**
 * A horizontally scrolling tab strip.
 *
 * A scroller rather than a wrapping row, because a row that rewraps as the
 * labels change moves everything below it - and on these screens what is below
 * is the list the tabs control.
 *
 * The selected tab is scrolled into view on mount and whenever it changes,
 * which is what stops a deep link to the seventh mode landing on a strip that
 * appears to have nothing selected.
 */
export function Tabs<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly TabOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Queried by value rather than by `aria-selected`, so the effect actually
    // reads the thing it depends on - and so it cannot pick up a stale
    // selection from the render before this one.
    const selected = stripRef.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    selected?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [value]);

  /**
   * Arrow keys move between tabs, as the tablist pattern requires. Only the
   * selected tab is a tab stop, so the strip is one stop in the page rather
   * than one per mode.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;

    const index = options.findIndex((option) => option.value === value);
    const next = options[Math.min(options.length - 1, Math.max(0, index + delta))];
    if (!next || next.value === value) return;

    event.preventDefault();
    onChange(next.value);
  }

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cx(
        // Pulled out to the screen's gutters so the strip can scroll edge to
        // edge, then padded back in so the first tab still lines up.
        '-mx-5 flex w-[calc(100%+2.5rem)] gap-2 overflow-x-auto px-5 pb-1',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-tab={option.value}
          role="tab"
          aria-selected={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          className={cx(
            'shrink-0 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap',
            'transition-[border-color,background-color,color] duration-200',
            option.value === value
              ? 'border-stroke bg-surface text-ink'
              : 'border-stroke-soft text-ink-muted hover:border-stroke hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
