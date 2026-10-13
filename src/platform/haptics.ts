import type * as HapticsPlugin from '@tauri-apps/plugin-haptics';
import { isNativeDesktop, isNativeMobile } from './env';

/**
 * Haptic feedback, routed to the best motor driver the platform has.
 *
 * - Native phones go through `tauri-plugin-haptics`, which uses the system's
 *   own feedback styles: Core Haptics on iOS (where the web has no vibration
 *   API at all) and the tuned effect constants on Android. A "success" there
 *   feels like every other app's success, not like a guessed buzz pattern.
 * - Browsers and the PWA use `navigator.vibrate` with a pattern.
 * - Desktops have no motor, so it is a no-op.
 *
 * Callers say what the moment *means* and may pass the pattern they want on
 * the web; the native styles are chosen from the meaning.
 */
export type HapticIntent =
  'selection' | 'light' | 'impact' | 'heavy' | 'success' | 'warning' | 'error';

/** What each intent buzzes on the web when the caller gives no pattern. */
const WEB_PATTERNS: Record<HapticIntent, number | number[]> = {
  selection: 5,
  light: 8,
  impact: 16,
  heavy: 32,
  success: [30, 50, 30, 50, 90],
  warning: [20, 40, 20],
  error: 140,
};

type HapticsModule = typeof HapticsPlugin;
let nativeModule: Promise<HapticsModule | null> | null = null;

/**
 * Loaded on first use rather than at startup: the plugin is only ever needed
 * on a phone, and the web build should not pay for it up front.
 */
function loadNative(): Promise<HapticsModule | null> {
  nativeModule ??= import('@tauri-apps/plugin-haptics').catch(() => null);
  return nativeModule;
}

/** Whether a buzz can be felt here at all, for showing the setting. */
export function hapticsSupported(): boolean {
  if (isNativeMobile()) return true;
  if (isNativeDesktop()) return false;
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Begin loading the native driver early, so the first move is not silent. */
export function warmHaptics(): void {
  if (isNativeMobile()) void loadNative();
}

/** Never throws, never rejects: a missing buzz is not an error. */
export function playHaptic(intent: HapticIntent, webPattern?: number | number[]): void {
  if (isNativeMobile()) {
    void loadNative()
      .then((plugin) => (plugin ? playNative(plugin, intent) : undefined))
      .catch(() => {});
    return;
  }
  if (isNativeDesktop() || typeof navigator === 'undefined') return;
  try {
    navigator.vibrate?.(webPattern ?? WEB_PATTERNS[intent]);
  } catch {
    // Not every webview exposes it.
  }
}

function playNative(plugin: HapticsModule, intent: HapticIntent): Promise<unknown> {
  switch (intent) {
    case 'selection':
      return plugin.selectionFeedback();
    case 'light':
      return plugin.impactFeedback('light');
    case 'impact':
      return plugin.impactFeedback('medium');
    case 'heavy':
      return plugin.impactFeedback('heavy');
    case 'success':
    case 'warning':
    case 'error':
      return plugin.notificationFeedback(intent);
  }
}

/**
 * The intent an old-style call means, judged from its web pattern: a single
 * short pulse is a tap, anything longer or repeated is a bump.
 */
export function intentForPattern(pattern: number | number[]): HapticIntent {
  if (typeof pattern === 'number') return pattern <= 12 ? 'light' : 'impact';
  return 'impact';
}
