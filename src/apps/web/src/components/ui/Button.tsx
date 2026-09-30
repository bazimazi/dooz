import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from 'react';
import { cx } from '@/lib/cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'normal' | 'small';

/**
 * Fill and label colour per variant.
 *
 * Both travel together because the relationship between them inverts across
 * the themes: on the dark canvas the lead action is the deepest block on the
 * page, on the light one it is the only saturated one, and a single shared
 * text colour cannot be legible on both.
 */
const VARIANT: Record<Variant, { fill: string; ink: string }> = {
  primary: { fill: 'var(--color-btn-primary)', ink: 'var(--color-on-btn-primary)' },
  secondary: { fill: 'var(--color-btn-secondary)', ink: 'var(--color-on-btn-secondary)' },
  ghost: { fill: 'transparent', ink: 'var(--color-ink)' },
  danger: {
    fill: 'color-mix(in srgb, var(--color-danger) 70%, var(--color-btn-primary))',
    ink: 'var(--color-g10)',
  },
};

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Merged with the variant fill rather than replacing it. */
  style?: CSSProperties;
  /** Stretch to the container instead of the design's fixed pill width. */
  block?: boolean;
}

type ButtonProps<T extends ElementType> = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps | 'as'> & {
    /** Render as something else - a router `Link`, usually. */
    as?: T;
  };

/**
 * The button's classes on their own.
 *
 * `as={Link}` covers most navigation, but a polymorphic component cannot carry
 * the router's own inference for `search` and `params` - passing them through
 * `ComponentPropsWithoutRef` loses the route-specific types that make those
 * safe. Where a link needs them it is written as a real `<Link>` with these
 * classes on it, which keeps the type checking and costs one import.
 */
export function buttonClasses(
  options: { variant?: Variant; size?: Size; block?: boolean; className?: string } = {},
): string {
  const { variant = 'secondary', size = 'normal', block = false, className } = options;
  const ghost = variant === 'ghost';

  return cx(
    'group flex items-center justify-center rounded-3xl no-underline',
    !ghost && 'sheen tile-edge shadow-[0_4px_14px_-8px_var(--color-shadow)]',
    ghost && 'border border-stroke-soft',
    size === 'small' ? 'h-11 px-5 text-base font-semibold' : 'h-14 px-6 text-2xl font-semibold',
    // A caller that sizes the button itself gets exactly that. Two width
    // utilities on one element are decided by stylesheet order, not by which
    // was written last, so a `w-auto` passed in used to lose to this `w-full`
    // - stretching a "Join" button across the field beside it.
    setsWidth(className) ? null : block ? 'w-full' : 'w-full max-w-68',
    'transition-[transform,box-shadow,filter] duration-200 ease-soft',
    'hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_12px_26px_-10px_var(--color-shadow)]',
    'active:translate-y-0 active:scale-[0.965] active:duration-75',
    'disabled:pointer-events-none disabled:opacity-50',
    className,
  );
}

/** Whether `className` carries its own width - `w-auto`, `w-24`, `sm:w-auto` - not a `max-w-`. */
function setsWidth(className: string | undefined): boolean {
  return className !== undefined && /(?:^|\s)(?:[\w-]+:)*!?w-\S+/.test(className);
}

/** The fill and label colour for a link using {@link buttonClasses}. */
export function buttonStyle(variant: Variant = 'secondary'): CSSProperties {
  return { '--tile-fill': VARIANT[variant].fill, color: VARIANT[variant].ink } as CSSProperties;
}

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
  size = 'normal',
  icon,
  children,
  className,
  style,
  block = false,
  ...rest
}: ButtonProps<T>) {
  const Component: ElementType = as ?? 'button';

  return (
    <Component
      className={buttonClasses({ variant, size, block, className })}
      style={
        {
          '--tile-fill': VARIANT[variant].fill,
          color: VARIANT[variant].ink,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      <span className="relative z-2 flex items-center gap-2.5">
        {icon ? (
          <span
            className={cx(
              'leading-none transition-transform duration-200 ease-spring group-hover:scale-115',
              size === 'small' ? 'text-[1.1rem]' : 'text-[1.4rem]',
            )}
          >
            {icon}
          </span>
        ) : null}
        {children}
      </span>
    </Component>
  );
}
