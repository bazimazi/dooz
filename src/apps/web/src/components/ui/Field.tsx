import { type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { cx } from '@/lib/cx';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown under the field. Announced with it, so it must be brief. */
  hint?: string;
  /** Replaces the hint and marks the field invalid. */
  error?: string | null;
  trailing?: ReactNode;
}

/**
 * A labelled text input.
 *
 * The label is a real `<label>` wired by id rather than a placeholder, because
 * a placeholder disappears the moment somebody starts typing - which is exactly
 * when they most want to know what the box is for. The hint and the error share
 * one element wired through `aria-describedby`, so a screen reader hears
 * whichever is current without the field carrying two descriptions.
 */
export function Field({ label, hint, error, trailing, className, ...props }: FieldProps) {
  const id = useId();
  const describedBy = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={id} className="px-1 text-sm text-ink-muted">
        {label}
      </label>

      <div className="flex items-center gap-2">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? describedBy : undefined}
          className={cx(
            'h-12 w-full min-w-0 rounded-tile border bg-surface/60 px-4 text-base text-ink',
            'transition-[background-color,border-color,box-shadow] duration-200',
            'placeholder:text-ink-faint',
            'hover:bg-surface/80 focus:bg-surface/80 focus:outline-none',
            error
              ? 'border-danger focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-danger)_30%,transparent)]'
              : 'border-stroke focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-stroke)_35%,transparent)]',
            className,
          )}
          {...props}
        />
        {trailing}
      </div>

      {note ? (
        <p
          id={describedBy}
          className={cx('px-1 text-xs', error ? 'text-danger' : 'text-ink-faint')}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A segmented control.
 *
 * A real radio group rather than a row of buttons, so the arrow keys move
 * between the options and a screen reader announces "2 of 3" without being
 * told to. The selected state is one pill that slides between the options
 * rather than a background that blinks from one to the next, so it is obvious
 * which way the setting moved.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'normal',
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: 'normal' | 'small';
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('relative grid rounded-tile border border-stroke bg-surface/40 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 rounded-xl bg-stroke transition-transform duration-300 ease-spring"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />

      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title ?? undefined}
          onClick={() => onChange(option.value)}
          className={cx(
            'relative z-1 flex items-center justify-center gap-1.5 rounded-xl',
            'transition-[color,transform] duration-200 ease-spring active:scale-95',
            size === 'small' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
            option.value === value ? 'text-on-raised' : 'text-ink-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled on/off switch, for the settings sheet. */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-tile px-1 py-2 text-left"
    >
      <span className="flex flex-col">
        <span className="text-base">{label}</span>
        {description ? <span className="text-xs text-ink-faint">{description}</span> : null}
      </span>

      <span
        aria-hidden="true"
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-stroke bg-stroke' : 'border-stroke-soft bg-surface/60',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-ink transition-transform duration-200 ease-spring',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  );
}
