import { Link, useRouter } from '@tanstack/react-router';
import type { ComponentProps, MouseEvent } from 'react';
import { returnEntry } from '@/lib/navigation';
import { consumeDialogHistory } from '@/lib/useDialog';

type ReturnDestination = '/' | '/profile' | '/puzzles' | '/journey';

/** Return actions reuse a visited page; deep links fall back to a replacement. */
export function useReturnTo() {
  const router = useRouter();
  return async (to: ReturnDestination) => {
    await consumeDialogHistory(router.history);
    const entry = returnEntry(router.history, to);
    if (entry) router.history.go(entry.index - router.history.location.state['__TSR_index']);
    else await router.navigate({ to, replace: true });
  };
}

export function ReturnLink({
  to,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'to'> & {
  to: ReturnDestination;
}) {
  const returnTo = useReturnTo();
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target && props.target !== '_self')
    )
      return;
    event.preventDefault();
    void returnTo(to);
  }
  return <Link {...props} to={to} replace onClick={click} />;
}
