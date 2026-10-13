import { type KeyboardEvent, useRef } from 'react';
import { cx } from '@/lib/cx';
import { useT } from '@/i18n';
import { settingsMessages } from '@/i18n/messages/settings';
import { ART_STYLE_INFO } from '@/lib/graphics';
import { ART_STYLES, type ArtStyle } from '@/lib/preferences';

/**
 * The visual style picker: one card per style, each a tiny board drawn in
 * that style's own colours.
 *
 * A real radio group with a roving tab stop, so the arrow keys walk the cards
 * and a screen reader hears "Tabletop, 2 of 6". The description of the chosen
 * style is a status line underneath, announced as the choice changes.
 */
export function StylePicker({
  value,
  onChange,
}: {
  value: ArtStyle;
  onChange: (style: ArtStyle) => void;
}) {
  const t = useT(settingsMessages);
  const groupRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // The grid mirrors in a right-to-left language, so left and right swap
    // with it; up and down keep their meaning.
    const rtl = groupRef.current ? getComputedStyle(groupRef.current).direction === 'rtl' : false;
    const across = rtl ? -1 : 1;
    const step = { ArrowRight: across, ArrowDown: 1, ArrowLeft: -across, ArrowUp: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const at = ART_STYLES.indexOf(value);
    const next = ART_STYLES[(at + step + ART_STYLES.length) % ART_STYLES.length]!;
    onChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-style-option="${next}"]`)?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <span id="style-picker-label" className="px-1 text-sm text-ink-muted">
        {t('visualStyle')}
      </span>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="style-picker-label"
        className="grid grid-cols-3 gap-2"
        onKeyDown={handleKeyDown}
      >
        {ART_STYLES.map((style) => {
          const selected = style === value;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              data-style-option={style}
              onClick={() => onChange(style)}
              className={cx(
                'flex flex-col items-center gap-1 rounded-tile border px-1 pt-1.5 pb-1',
                'transition-[transform,border-color,background-color] duration-200 ease-spring',
                'hover:-translate-y-0.5 active:scale-95',
                selected ? 'border-stroke bg-sunken' : 'border-stroke-soft',
              )}
            >
              <StyleSwatch style={style} />
              <span className="text-[0.6875rem] leading-tight text-ink-muted">
                {t(`style.${style}.name`)}
              </span>
            </button>
          );
        })}
      </div>
      <p role="status" className="px-1 text-xs text-ink-muted">
        {t(`style.${value}.description`)}
      </p>
    </div>
  );
}

/** A thumbnail board: the style's canvas, its board, its rules and both marks. */
export function StyleSwatch({ style, className }: { style: ArtStyle; className?: string }) {
  const { swatch } = ART_STYLE_INFO[style];
  const goban = style === 'tabletop';
  return (
    <svg viewBox="0 0 48 32" aria-hidden="true" className={cx('h-8 w-12 rounded-md', className)}>
      <rect width="48" height="32" rx="5" fill={swatch.canvas} />
      <rect
        x="12"
        y="4"
        width="24"
        height="24"
        rx={style === 'neon' ? 2 : 3}
        fill={swatch.board}
        stroke={style === 'neon' ? swatch.grid : 'none'}
        strokeWidth="0.8"
      />
      <path
        d={
          goban
            ? 'M16 8H32M16 16H32M16 24H32M16 8V24M24 8V24M32 8V24'
            : 'M20 4V28M28 4V28M12 12H36M12 20H36'
        }
        stroke={swatch.grid}
        strokeOpacity={goban ? 0.7 : 0.6}
        strokeWidth="0.7"
        strokeDasharray={style === 'pastel' || style === 'chalkboard' ? '1.2 1' : undefined}
      />
      <path
        d="M13.8 5.8l4.4 4.4M18.2 5.8l-4.4 4.4"
        stroke={swatch.x}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="24" cy="16" r="2.6" fill="none" stroke={swatch.o} strokeWidth="1.6" />
      <path
        d="M29.8 21.8l4.4 4.4M34.2 21.8l-4.4 4.4"
        stroke={swatch.x}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
