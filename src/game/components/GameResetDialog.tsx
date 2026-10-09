import { Button } from '@/components/ui/Button';
import { useDialog } from '@/lib/useDialog';
import { useClosing } from '@/lib/useClosing';
import { cx } from '@/lib/cx';

/** Only shown when an action would replace a round already in progress. */
export function GameResetDialog({
  title = 'Start a new round?',
  description = 'This will replace the round you are playing.',
  actionLabel = 'New round',
  onConfirm,
  onCancel,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { closing, close } = useClosing(onCancel);
  const panelRef = useDialog<HTMLDivElement>(close);
  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5 backdrop-blur-[2px]',
        closing && 'animate-fade-out',
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="max-h-[calc(100dvh-2.5rem)] w-full max-w-80 overflow-y-auto rounded-panel border border-stroke bg-surface p-6 shadow-lg outline-none"
      >
        <h2 className="font-display text-xl">{title}</h2>
        <p className="mt-2 text-sm text-ink-muted">{description}</p>
        <div className="mt-5 flex flex-col gap-3">
          <Button size="small" block onClick={close}>
            Keep playing
          </Button>
          <Button size="small" variant="ghost" block onClick={onConfirm}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
