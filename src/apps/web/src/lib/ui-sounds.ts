import { sfx } from './sound';

/**
 * A soft click for every control, installed once on the document.
 *
 * One delegated listener rather than a sound call in every button component:
 * it covers links, radios, tabs and switches that are not built from `Button`,
 * and a control added later clicks without anyone remembering to wire it.
 * Board squares are skipped - a move has its own, far more specific sound -
 * and so is anything disabled, which did not do anything to confirm.
 */
export function installUiSounds(): void {
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest<HTMLElement>(
        'button, a[href], [role="radio"], [role="tab"], [role="switch"], summary',
      );
      if (!control || control.closest('[data-cell]')) return;
      if (control.matches(':disabled, [aria-disabled="true"]')) return;

      if (control.getAttribute('role') === 'switch') {
        // This runs in the capture phase, before the switch flips, so the
        // state it is about to take is the opposite of the one it shows.
        sfx.toggle(control.getAttribute('aria-checked') !== 'true');
        return;
      }
      sfx.tap();
    },
    { capture: true },
  );
}
