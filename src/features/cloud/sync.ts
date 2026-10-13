import { useAccountStore } from '@/features/account/store';
import { replaceProgress, useProgressStore } from '@/features/progress/store';
import { ApiError } from '@/lib/api';
import { socialApi } from '@/lib/social-api';
import { CLOUD_SAVE_VERSION, mergeProgress } from './merge';

/**
 * Keeping solo progress in the cloud.
 *
 * The device's progress (journey stars, puzzles, bot records, XP, whatever the
 * progress store keeps) is uploaded whole and merged on the server with what
 * other devices uploaded; the merged copy comes back and replaces the local
 * one. Because the merge only ever keeps the better of two values, uploading
 * from any device at any time can only add.
 *
 * It is an offline queue of one: a change marks the save dirty (in storage, so
 * it survives a relaunch), and a dirty save is uploaded a few seconds after the
 * last change, on reconnecting, and on signing in - which is how a second
 * device's progress is merged into the account the moment it signs in.
 *
 * Nothing here creates an account: a device without one keeps its progress
 * locally, as it always did, until online play or a sign-in makes one.
 */

const PROGRESS_KEY = 'dooz.progress';
const META_KEY = 'dooz.cloud-sync';
const DEBOUNCE_MS = 5_000;
const RETRY_MS = [30_000, 120_000, 600_000];

interface Meta {
  /** The account the last successful sync was for. */
  accountId: string | null;
  dirty: boolean;
  lastSyncedAt: number | null;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let failures = 0;
let applying = false;
let installed = false;

/** True while a downloaded save is being written into the store. */
export function applyingCloudSave(): boolean {
  return applying;
}

function readMeta(): Meta {
  try {
    const parsed = JSON.parse(localStorage.getItem(META_KEY) ?? 'null') as Partial<Meta> | null;
    return {
      accountId: typeof parsed?.accountId === 'string' ? parsed.accountId : null,
      dirty: parsed?.dirty !== false,
      lastSyncedAt: typeof parsed?.lastSyncedAt === 'number' ? parsed.lastSyncedAt : null,
    };
  } catch {
    return { accountId: null, dirty: true, lastSyncedAt: null };
  }
}

function writeMeta(meta: Meta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Without storage the sync still runs; it just forgets it is dirty on relaunch.
  }
}

function readLocal(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function cloudSyncStatus(): Meta & { syncing: boolean } {
  return { ...readMeta(), syncing: running };
}

function schedule(delay: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delay);
}

function markDirty(): void {
  if (applying) return;
  const meta = readMeta();
  if (!meta.dirty) writeMeta({ ...meta, dirty: true });
  if (useAccountStore.getState().credentials) schedule(DEBOUNCE_MS);
}

/**
 * Upload, merge and apply now. Resolves `true` when the device and the cloud
 * agree afterwards.
 */
export async function syncNow(): Promise<boolean> {
  const credentials = useAccountStore.getState().credentials;
  if (!credentials || running) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  running = true;
  const sent = readLocal();
  const sentText = JSON.stringify(sent);
  try {
    const result = await socialApi.putCloudSave(credentials, {
      v: CLOUD_SAVE_VERSION,
      progress: sent,
    });
    // The account may have changed while the request was out.
    if (useAccountStore.getState().credentials?.accountId !== credentials.accountId) return false;

    const remote =
      result.data && typeof result.data['progress'] === 'object' && result.data['progress'] !== null
        ? (result.data['progress'] as Record<string, unknown>)
        : {};
    // Anything earned on this device while the upload was in flight is merged
    // on top, so it is not overwritten by the copy the server sent back.
    const current = readLocal();
    const changedMeanwhile = JSON.stringify(current) !== sentText;
    const merged = mergeProgress(remote, current) as Record<string, unknown>;

    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      applying = true;
      try {
        replaceProgress(merged);
      } finally {
        applying = false;
      }
    }

    failures = 0;
    writeMeta({
      accountId: credentials.accountId,
      dirty: changedMeanwhile,
      lastSyncedAt: Date.now(),
    });
    if (changedMeanwhile) schedule(DEBOUNCE_MS);
    return !changedMeanwhile;
  } catch (error) {
    // A refused token is the account store's to sort out; anything else is
    // retried with a growing delay while the save stays dirty.
    if (!(error instanceof ApiError && error.status === 401)) {
      schedule(RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]!);
      failures += 1;
    }
    return false;
  } finally {
    running = false;
  }
}

/** Start syncing. Called once at launch. */
export function installCloudSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  useProgressStore.subscribe(() => markDirty());

  useAccountStore.subscribe((state, previous) => {
    const now = state.credentials?.accountId ?? null;
    if (now && now !== (previous.credentials?.accountId ?? null)) {
      // Signed in, or a new account was made: this device's progress belongs
      // in it, and whatever the account already had belongs here.
      const meta = readMeta();
      writeMeta({ ...meta, dirty: true });
      schedule(0);
    }
  });

  window.addEventListener('online', () => {
    if (readMeta().dirty) schedule(1_000);
  });

  const meta = readMeta();
  const credentials = useAccountStore.getState().credentials;
  if (credentials && (meta.dirty || meta.accountId !== credentials.accountId)) schedule(3_000);
}
