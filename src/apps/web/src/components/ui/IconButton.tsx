import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface IconButtonOwnProps {
  children: ReactNode;
  /** Required: the icon carries no text, so this is the only accessible name. */
  label: string;
  /** `solid` drops the translucency for use on the lighter modal surface. */
  tone?: 'glass' | 'solid';
  className?: string;
}

type IconButtonProps<T extends ElementType> = IconButtonOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof IconButtonOwnProps | 'as'> & { as?: T };

/** The square rounded button used for refresh, home, back and share. */
export function IconButton<T extends ElementType = 'button'>({
  as,
  children,
  label,
  tone = 'glass',
  className,
  ...rest
}: IconButtonProps<T>) {
  const Component: ElementType = as ?? 'button';

  return (
    <Component
      aria-label={label}
      title={label}
      className={cx(
        'group flex size-12 shrink-0 items-center justify-center rounded-tile text-2xl text-g10',
        // Same three-stage feel as the pill buttons, at the smaller scale: lift
        // and brighten on hover, press in on click, shorter curve going down.
        'transition-[transform,box-shadow,filter,opacity] duration-200 ease-soft',
        'hover:-translate-y-0.5 hover:brightness-115 hover:shadow-[0_10px_20px_-10px_rgb(0_0_0/0.7)]',
        'active:translate-y-0 active:scale-90 active:duration-75',
        'disabled:pointer-events-none disabled:opacity-40',
        tone === 'glass' ? 'glass-edge' : 'border border-b8 bg-b2',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
