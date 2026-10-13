/**
 * Everything that differs between the browser, the PWA and the native shells,
 * behind one interface that works - or quietly does nothing - everywhere.
 */
export { isNativeDesktop, isNativeMobile, isTauri, platformName, type PlatformName } from './env';
export { hapticsSupported, playHaptic, warmHaptics, type HapticIntent } from './haptics';
export {
  notificationAccess,
  requestNotificationAccess,
  showNotification,
  type LocalNotification,
  type NotificationAccess,
} from './notifications';
export { deepLinkPath, installDeepLinks } from './deep-links';
export { checkForUpdate, type AvailableUpdate } from './updater';
export {
  gameServices,
  type AchievementService,
  type GameServices,
  type LeaderboardService,
  type PurchaseProduct,
  type PurchaseService,
} from './game-services';
