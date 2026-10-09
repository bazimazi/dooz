/**
 * Join class names, dropping anything falsy.
 *
 * Small enough not to warrant a dependency, and the conditional-object form of
 * `clsx` is not needed anywhere in this app.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
