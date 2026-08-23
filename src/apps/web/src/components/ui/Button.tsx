import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
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
}

type ButtonProps<T extends ElementType> = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps | 'as'> & {
    /** Render as something else — a router `Link`, usually. */
    as?: T;
  };

/**
 * The gradient-edged pill used for every primary action.
 *
 * Polymorphic because half of these navigate (and must be real links, for
 * middle-click and for screen readers) while the rest run a callback.
 */
export function Button<T extends ElementType = 'button'>({
  as,
  variant = 'secondary',
  icon,
  children,
  className,
  ...rest
}: ButtonProps<T>) {
  const Component: ElementType = as ?? 'button';

  return (
    <Component
      className={cx(
        'tile-edge flex h-14 w-full max-w-68 items-center justify-center gap-2.5 rounded-3xl',
        'text-2xl font-semibold text-g10 no-underline',
        'transition-transform duration-150 active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      style={{ '--tile-fill': VARIANT_FILL[variant] } as React.CSSProperties}
      {...rest}
    >
      {icon ? <span className="text-[1.4rem] leading-none">{icon}</span> : null}
      {children}
    </Component>
  );
}
