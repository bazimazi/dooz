/**
 * Build the link that gets a friend into a private room.
 *
 * `VITE_PUBLIC_URL` is what makes this work from the desktop and mobile apps:
 * their own origin is `tauri://localhost`, which means nothing to the person
 * receiving the message, so the link has to point at the deployed web app.
 */
export function inviteUrl(code: string): string {
  const base =
    import.meta.env.VITE_PUBLIC_URL ??
    (typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.origin
      : null);

  // With nowhere sensible to point, the code itself is still shareable.
  if (!base) return code;

  const url = new URL('/play/online', base);
  url.searchParams.set('code', code);
  return url.toString();
}

/**
 * Put `text` on the clipboard, falling back to the platform share sheet.
 *
 * Returns what actually happened so the caller can show the right feedback —
 * "copied" is wrong if the share sheet opened instead.
 */
export async function shareOrCopy(
  text: string,
  title: string,
): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {
      // Dismissed, or unsupported for this payload — fall through to copying.
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
