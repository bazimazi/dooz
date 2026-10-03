import type { BoardHint } from './Board';

const LABELS = { win: 'Win here', threat: 'Block here', best: 'Suggested move' } as const;

/** The same shapes as the board, with words so a colour is never the explanation. */
export function HintLegend({ hints }: { hints: readonly BoardHint[] }) {
  const kinds = (['win', 'threat', 'best'] as const).filter((kind) =>
    hints.some((hint) => hint.kind === kind),
  );
  return (
    <p
      className="flex min-h-5 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-muted"
      aria-live="polite"
      aria-atomic="true"
    >
      {kinds.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-flex size-4 items-center justify-center border-2 ${
              kind === 'win'
                ? 'rounded-full border-ok'
                : kind === 'threat'
                  ? 'rounded-sm border-warn text-warn'
                  : 'rounded-full border-dashed border-ink'
            }`}
          >
            {kind === 'threat' ? '!' : null}
          </span>
          <span>{LABELS[kind]}</span>
        </span>
      ))}
    </p>
  );
}
