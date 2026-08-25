import { BOARD_SIZES, type BoardSize } from '@dooz/engine';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/art/icons';
import { cx } from '@/lib/cx';
import { MiniBoard } from './MiniBoard';

interface BoardSizeCarouselProps {
  value: BoardSize;
  onChange: (size: BoardSize) => void;
}

/** Width of one preview slot, as a percentage of the carousel's width. */
const SLOT_WIDTH = 64;

/**
 * The board-size chooser on the home screen: one preview centred, its
 * neighbours peeking in from the sides.
 *
 * The track is a flex row shifted by whole slots, which keeps the previews
 * evenly spaced without measuring anything at runtime.
 */
export function BoardSizeCarousel({ value, onChange }: BoardSizeCarouselProps) {
  const index = BOARD_SIZES.indexOf(value);

  const step = (delta: number) => {
    const next = BOARD_SIZES[index + delta];
    if (next) onChange(next);
  };

  return (
    <div className="relative w-full">
      <div className="overflow-hidden">
        <div
          className="flex items-center transition-transform duration-500 ease-spring"
          style={{
            // Centring slot `index` means shifting the track left by that many
            // slots, then right by half the space a slot leaves over.
            transform: `translateX(${(100 - SLOT_WIDTH) / 2 - index * SLOT_WIDTH}%)`,
          }}
        >
          {BOARD_SIZES.map((size) => {
            const current = size === value;
            return (
              <button
                key={size}
                type="button"
                onClick={() => onChange(size)}
                aria-label={`${size} by ${size} board`}
                aria-current={current}
                className="group flex shrink-0 flex-col items-center gap-2 px-3 py-4"
                style={{ width: `${SLOT_WIDTH}%` }}
                tabIndex={current ? 0 : -1}
              >
                <span
                  className={cx(
                    'text-sm transition-[opacity,transform] duration-300 ease-spring',
                    current ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                  )}
                >
                  {size} × {size}
                </span>
                <MiniBoard
                  size={size}
                  active={current}
                  className={cx(
                    'w-full transition-all duration-500 ease-spring',
                    current
                      ? 'scale-100 opacity-100 blur-0'
                      : 'scale-[0.82] opacity-40 blur-[2px] group-hover:scale-[0.88] group-hover:opacity-60 group-hover:blur-[1px]',
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <CarouselArrow
        side="left"
        disabled={index === 0}
        onClick={() => step(-1)}
        label="Smaller board"
      />
      <CarouselArrow
        side="right"
        disabled={index === BOARD_SIZES.length - 1}
        onClick={() => step(1)}
        label="Bigger board"
      />
    </div>
  );
}

function CarouselArrow({
  side,
  disabled,
  onClick,
  label,
}: {
  side: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const Chevron = side === 'left' ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cx(
        'group absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center',
        'rounded-full text-2xl text-g8',
        'transition-[transform,opacity,background-color] duration-200 ease-spring',
        'hover:scale-115 hover:bg-b8/20 active:scale-90 active:duration-75',
        'disabled:pointer-events-none disabled:opacity-25',
        side === 'left' ? 'left-0' : 'right-0',
      )}
    >
      {/* The chevron leans the way it will take you as the pointer arrives. */}
      <Chevron
        className={cx(
          'transition-transform duration-200 ease-spring',
          side === 'left' ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5',
        )}
      />
    </button>
  );
}
