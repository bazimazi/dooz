import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from 'react';
import { cx } from '@/lib/cx';

type Variant = 'primary' | 'secondary';

const VARIANT_FILL: Record<Variant, string> = {
  // The lead action sits darker than the surface it is on, as in the design.
  primary: 'var(--color-b2)',
  secondary: 'var(--color-b7)',
};

interface ButtonOwnProps {
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Merged with the variant fill rather than replacing it. */
  style?: CSSProperties;
}

type ButtonProps<T extends ElementType> = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps | 'as'> & {
    /** Render as something else - a router `Link`, usually. */
    as?: T;
  };

/**
 * The gradient-edged pill used for every primary action.
 *
 * Polymorphic because half of these navigate (and must be real links, for
 * middle-click and for screen readers) while the rest run a callback.
 *
 * Pointer feedback runs in three stages so the button feels like an object:
 * it lifts and catches a highlight on hover, and presses in - down, not just
 * smaller - on click, with a shorter curve going down than coming back up.
 * The label sits above the `sheen` highlight rather than under it.
 */
export function Button<T extends ElementType = 'button'>({
  as,
  variant = 'secondary',
  icon,
  children,
  className,
  style,
  ...rest
}: ButtonProps<T>) {
  const Component: ElementType = as ?? 'button';

  return (
    <Component
      className={cx(
        'sheen group tile-edge flex h-14 w-full max-w-68 items-center justify-center rounded-3xl',
        'text-2xl font-semibold text-g10 no-underline',
        'shadow-[0_4px_14px_-8px_rgb(0_0_0/0.6)]',
        'transition-[transform,box-shadow,filter] duration-200 ease-soft',
        'hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_12px_26px_-10px_rgb(0_0_0/0.65)]',
        'active:translate-y-0 active:scale-[0.965] active:duration-75',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      style={{ '--tile-fill': VARIANT_FILL[variant], ...style } as CSSProperties}
      {...rest}
    >
      <span className="relative z-2 flex items-center gap-2.5">
        {icon ? (
          <span className="text-[1.4rem] leading-none transition-transform duration-200 ease-spring group-hover:scale-115">
            {icon}
          </span>
        ) : null}
        {children}
      </span>
    </Component>
  );
}
