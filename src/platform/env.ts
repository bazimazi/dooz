import { isTauri as tauriRuntime } from '@tauri-apps/api/core';

/**
 * Where the game is running.
 *
 * The same build serves the browser, an installed PWA and the Tauri shells, so
 * the few places that behave differently ask here rather than sniffing user
 * agents. The platform name comes from the Tauri CLI at build time
 * (`TAURI_ENV_PLATFORM`, kept by Vite's `envPrefix`): each native build targets
 * exactly one platform, so it is known for certain before any code runs.
 */
export type PlatformName = 'web' | 'windows' | 'macos' | 'linux' | 'android' | 'ios';

const NATIVE: readonly PlatformName[] = ['windows', 'macos', 'linux', 'android', 'ios'];

/** True inside a Tauri webview, where the native plugins can be called. */
export function isTauri(): boolean {
  try {
    return tauriRuntime();
  } catch {
    return false;
  }
}

/** The platform this build was made for, or `web` for the browser and PWA. */
export function platformName(): PlatformName {
  const built = import.meta.env.TAURI_ENV_PLATFORM as string | undefined;
  if (!isTauri()) return 'web';
  return NATIVE.find((name) => name === built) ?? 'web';
}

export function isNativeMobile(): boolean {
  const name = platformName();
  return name === 'android' || name === 'ios';
}

export function isNativeDesktop(): boolean {
  const name = platformName();
  return name === 'windows' || name === 'macos' || name === 'linux';
}
