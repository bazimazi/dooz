import { useAccountStore } from '@/features/account/store';
import { ApiError } from './api';
import { socialApi } from './social-api';

/**
 * Web Push on the client: asking permission, subscribing the service worker,
 * and telling the server where to send.
 *
 * Only the installed web app has a service worker to receive pushes; the
 * desktop and mobile shells do not register one, and neither does the dev
 * server, so for them this reports `unsupported` and the setting stays hidden.
 * Nothing here runs until the player turns notifications on - a permission
 * prompt nobody asked for is the fastest way to have it denied for good.
 */

export type PushState =
  /** No service worker or Push API here. */
  | 'unsupported'
  /** The server has no VAPID keys configured. */
  | 'unavailable'
  /** The player (or the browser) refused permission. */
  | 'denied'
  | 'off'
  | 'on';

const READY_TIMEOUT_MS = 3_000;

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** The active registration, or `null` if none turns up promptly. */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function pushState(): Promise<PushState> {
  const worker = await registration();
  if (!worker) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const subscription = await worker.pushManager.getSubscription();
  return subscription && Notification.permission === 'granted' ? 'on' : 'off';
}

/**
 * Turn notifications on: permission, subscription, then the server. Each step
 * can fail on its own, and the state returned says where it stopped.
 */
export async function enablePush(): Promise<PushState> {
  const worker = await registration();
  if (!worker) return 'unsupported';

  let publicKey: string | null;
  try {
    publicKey = (await socialApi.pushKey()).publicKey;
  } catch {
    return 'unavailable';
  }
  if (!publicKey) return 'unavailable';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  if (!(await useAccountStore.getState().ensureOnline())) return 'off';
  const credentials = useAccountStore.getState().credentials;
  if (!credentials) return 'off';

  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }));
  try {
    await socialApi.subscribePush(credentials, subscription.toJSON());
  } catch (error) {
    // The server would not take it, so do not leave a subscription it will
    // never send to sitting in the browser.
    await subscription.unsubscribe().catch(() => undefined);
    if (error instanceof ApiError && error.status === 503) return 'unavailable';
    return 'off';
  }
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const worker = await registration();
  if (!worker) return 'unsupported';
  const subscription = await worker.pushManager.getSubscription();
  if (subscription) {
    const credentials = useAccountStore.getState().credentials;
    if (credentials) {
      await socialApi.unsubscribePush(credentials, subscription.endpoint).catch(() => undefined);
    }
    await subscription.unsubscribe().catch(() => undefined);
  }
  return Notification.permission === 'denied' ? 'denied' : 'off';
}
