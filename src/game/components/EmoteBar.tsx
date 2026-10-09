import type { Player } from '@/game/engine';
import { type Emote, EMOTES } from '@/protocol';
import { useEffect } from 'react';
import { MuteIcon, SpeakIcon } from '@/components/art/ui-icons';
import { IconButton } from '@/components/ui/IconButton';
import { cx } from '@/lib/cx';
import { sfx } from '@/lib/sound';
import type { IncomingEmote } from '@/features/online/store';

/**
 * The fixed set of things one player can say to another.
 *
 * Six phrases and no free text. That is a deliberate ceiling rather than a
 * missing feature: a closed set needs no moderation queue, cannot carry a slur
 * or a link, and is the same in every language the app is translated into -
 * while still covering everything two strangers actually want to say over a
 * board. Anything it does not cover is what the mute button is for.
 */
const LABELS: Record<Emote, { glyph: string; text: string }> = {
  gg: { glyph: '🤝', text: 'Good game' },
  nice: { glyph: '👏', text: 'Nice move' },
  oops: { glyph: '😅', text: 'Oops' },
  thinking: { glyph: '🤔', text: 'Thinking…' },
  hurry: { glyph: '⏳', text: 'Your turn' },
  hello: { glyph: '👋', text: 'Hello' },
};

export function EmoteBar({
  onSend,
  muted,
  onMuteChange,
  disabled = false,
}: {
  onSend: (emote: Emote) => void;
  muted: boolean;
  onMuteChange: (muted: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1 rounded-tile border border-stroke-soft bg-surface/50 p-1">
        {EMOTES.map((emote) => (
          <button
            key={emote}
            type="button"
            disabled={disabled}
            onClick={() => onSend(emote)}
            title={LABELS[emote].text}
            aria-label={`Send: ${LABELS[emote].text}`}
            className={cx(
              'flex size-9 items-center justify-center rounded-lg text-lg',
              'transition-[transform,background-color] duration-150 ease-spring',
              'hover:scale-110 hover:bg-stroke-soft active:scale-95',
              'disabled:pointer-events-none disabled:opacity-40',
            )}
          >
            <span aria-hidden="true">{LABELS[emote].glyph}</span>
          </button>
        ))}
      </div>

      <IconButton
        tone="bare"
        size="small"
        label={muted ? 'Unmute your opponent' : 'Mute your opponent'}
        aria-pressed={muted}
        onClick={() => onMuteChange(!muted)}
      >
        {muted ? <MuteIcon /> : <SpeakIcon />}
      </IconButton>
    </div>
  );
}

/**
 * An emote that has arrived, floating beside the board.
 *
 * It removes itself after a few seconds. Nothing about it is interactive and it
 * never covers the board - both because it is positioned outside the grid and
 * because the store keeps at most three alive at a time.
 */
export function EmoteToast({
  emote,
  you,
  onDone,
}: {
  emote: IncomingEmote;
  you: Player | null;
  onDone: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(emote.id), 3200);
    return () => clearTimeout(timer);
  }, [emote.id, onDone]);

  // Heard as well as seen: a reaction scrolled past under the board is easy to
  // miss. Each toast is its own element, so mounting is arriving.
  useEffect(() => {
    sfx.emote();
  }, []);

  const fromYou = you !== null && emote.from === you;
  const label = LABELS[emote.emote];

  return (
    <div
      className={cx(
        'flex animate-emote-in items-center gap-2 rounded-full border border-stroke-soft',
        'bg-surface px-3 py-1.5 text-sm shadow-[0_8px_20px_-12px_var(--color-shadow)]',
        fromYou ? 'self-end' : 'self-start',
      )}
      role="status"
    >
      <span aria-hidden="true" className="text-base">
        {label.glyph}
      </span>
      <span className="text-ink-muted">
        {fromYou ? 'You' : 'Opponent'}: {label.text}
      </span>
    </div>
  );
}

export { LABELS as EMOTE_LABELS };
