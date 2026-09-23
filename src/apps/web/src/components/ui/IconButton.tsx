import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface IconButtonOwnProps {
  children: ReactNode;
  /** Required: the icon carries no text, so this is the only accessible name. */
  label: string;
  /** `solid` drops the translucency for use on the lighter modal surface. */
  tone?: 'glass' | 'solid' | 'bare';
  size?: 'normal' | 'small';
  className?: string;
}

type IconButtonProps<T extends ElementType> = IconButtonOwnProps &
  Omit<ComponentPropsWithoutRef<T>, keyof IconButtonOwnProps | 'as'> & { as?: T };

/** The icon button's classes on their own. See {@link buttonClasses}. */
export function iconButtonClasses(
  options: {
    tone?: 'glass' | 'solid' | 'bare';
    size?: 'normal' | 'small';
    className?: string;
  } = {},
): string {
  const { tone = 'glass', size = 'normal', className } = options;
  return cx(
    'group flex shrink-0 items-center justify-center rounded-tile text-ink',
    size === 'small' ? 'size-9 text-lg' : 'size-12 text-2xl',
    'transition-[transform,box-shadow,filter,opacity,background-color] duration-200 ease-soft',
    'hover:-translate-y-0.5 hover:brightness-115',
    'active:translate-y-0 active:scale-90 active:duration-75',
    tone === 'glass' && 'glass-edge hover:shadow-[0_10px_20px_-10px_var(--color-shadow)]',
    tone === 'solid' && 'border border-stroke bg-sunken',
    tone === 'bare' && 'hover:bg-stroke-soft',
    className,
  );
}

/**
 * The square rounded button used for refresh, home, back and share.
 *
 * Never smaller than 44px at the `normal` size, which is the smallest target a
 * thumb can reliably hit - the `small` variant is for rows where the control is
 * one of several and the whole row is the real target.
 */
export function IconButton<T extends ElementType = 'button'>({
  as,
  children,
  label,
  tone = 'glass',
  size = 'normal',
  className,
  ...rest
}: IconButtonProps<T>) {
  const Component: ElementType = as ?? 'button';

  return (
    <Component
      aria-label={label}
      title={label}
      className={cx(
        'group flex shrink-0 items-center justify-center rounded-tile text-ink',
        size === 'small' ? 'size-9 text-lg' : 'size-12 text-2xl',
        // Same three-stage feel as the pill buttons, at the smaller scale: lift
        // and brighten on hover, press in on click, shorter curve going down.
        'transition-[transform,box-shadow,filter,opacity,background-color] duration-200 ease-soft',
        'hover:-translate-y-0.5 hover:brightness-115',
        'active:translate-y-0 active:scale-90 active:duration-75',
        'disabled:pointer-events-none disabled:opacity-40',
        tone === 'glass' && 'glass-edge hover:shadow-[0_10px_20px_-10px_var(--color-shadow)]',
        tone === 'solid' && 'border border-stroke bg-sunken',
        tone === 'bare' && 'hover:bg-stroke-soft',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
