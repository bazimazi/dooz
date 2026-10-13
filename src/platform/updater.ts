import { isNativeDesktop } from './env';

/**
 * Self-updates for the desktop builds.
 *
 * Off unless a release build was configured with an update feed and signing
 * key (`TAURI_UPDATER_ENDPOINTS`, `TAURI_UPDATER_PUBKEY`; see
 * `scripts/tauri.mjs`). An unconfigured build never registers the updater
 * plugin, so `check()` fails and this reports "no update" - the same as an
 * up-to-date build, which is exactly how it should look to the player.
 *
 * Phones are updated by their stores and the web build by its service worker,
 * so neither ever checks.
 */
export interface AvailableUpdate {
  version: string;
  notes?: string;
  /** Download, verify the signature, install, and restart into it. */
  install(): Promise<void>;
  /** Release the native handle when the player says "later". */
  dismiss(): void;
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isNativeDesktop()) return null;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      notes: update.body,
      async install() {
        await update.downloadAndInstall();
        // Windows' installer closes the app on its own; macOS and Linux swap
        // the files in place and need a restart to run them.
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      },
      dismiss() {
        void update.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}
