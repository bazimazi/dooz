import type * as NotificationPlugin from '@tauri-apps/plugin-notification';
import { isTauri } from './env';

/**
 * Local notifications - "it's your turn", "your daily puzzle is ready" - shown
 * by this device, from this running app.
 *
 * Native builds use `tauri-plugin-notification`, which posts a real system
 * notification on every desktop and phone. The browser and PWA use the
 * Notification API, through the service worker where there is one: Chrome on
 * Android refuses `new Notification()` outright and only accepts
 * `registration.showNotification()`.
 *
 * Remote push (a notification while the app is closed) is separate: the web
 * build receives it in the service worker, and native stores need their own
 * push services, which take owner credentials.
 */
export type NotificationAccess = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface LocalNotification {
  title: string;
  body?: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag?: string;
}

type NotificationModule = typeof NotificationPlugin;
let nativeModule: Promise<NotificationModule | null> | null = null;

function loadNative(): Promise<NotificationModule | null> {
  nativeModule ??= import('@tauri-apps/plugin-notification').catch(() => null);
  return nativeModule;
}

function webNotifications(): typeof Notification | null {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification : null;
}

/** Whether notifications may be shown, without asking. */
export async function notificationAccess(): Promise<NotificationAccess> {
  if (isTauri()) {
    const plugin = await loadNative();
    if (!plugin) return 'unsupported';
    try {
      return (await plugin.isPermissionGranted()) ? 'granted' : 'prompt';
    } catch {
      return 'unsupported';
    }
  }
  const api = webNotifications();
  if (!api) return 'unsupported';
  return api.permission === 'default' ? 'prompt' : api.permission;
}

/**
 * Ask for permission. Call it from a button the player pressed: browsers
 * ignore or penalise a prompt nobody asked for, and so do players.
 */
export async function requestNotificationAccess(): Promise<boolean> {
  try {
    if (isTauri()) {
      const plugin = await loadNative();
      return (await plugin?.requestPermission()) === 'granted';
    }
    const api = webNotifications();
    return (await api?.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Show `notification` if allowed. Resolves `false` rather than throwing. */
export async function showNotification(notification: LocalNotification): Promise<boolean> {
  if ((await notificationAccess()) !== 'granted') return false;
  try {
    if (isTauri()) {
      const plugin = await loadNative();
      if (!plugin) return false;
      plugin.sendNotification({ title: notification.title, body: notification.body });
      return true;
    }
    const options: NotificationOptions = {
      body: notification.body,
      tag: notification.tag,
      icon: '/brand/icon-192.png',
    };
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(notification.title, options);
      return true;
    }
    const shown = new Notification(notification.title, options);
    return Boolean(shown);
  } catch {
    return false;
  }
}
