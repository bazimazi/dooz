import { platformName, type PlatformName } from './env';

/**
 * Hooks for the platform game services a store release can plug into:
 * achievements, leaderboards and in-app purchases.
 *
 * The game keeps its own achievements and ladder on its own server, and that
 * stays the source of truth. These hooks only *mirror* what already happened
 * to the platform's service, so a player also sees their unlocks in Steam or
 * Game Center. Every call is fire-and-forget and may silently do nothing.
 *
 * Nothing here talks to a real service yet: each one needs the owner's
 * developer account, app IDs and signing set up in that store's console, and
 * most need a native SDK linked into the Tauri shell. Until then every
 * platform gets the no-op implementation, and callers can use these hooks
 * freely without checking where they run.
 */
export interface AchievementService {
  /** `id` is the game's own achievement id; map it to the store's id inside. */
  unlock(id: string): Promise<void>;
}

export interface LeaderboardService {
  /** `board` is the game's ladder id (a mode), `score` its rating. */
  submit(board: string, score: number): Promise<void>;
}

export interface PurchaseProduct {
  id: string;
  title: string;
  price: string;
}

export interface PurchaseService {
  /** Whether purchases can be made here at all. */
  available(): boolean;
  products(): Promise<PurchaseProduct[]>;
  /** Resolves `true` once the store confirms the purchase. */
  purchase(productId: string): Promise<boolean>;
  /** Product ids the player already owns, for a reinstall or a new device. */
  restore(): Promise<string[]>;
}

export interface GameServices {
  achievements: AchievementService;
  leaderboards: LeaderboardService;
  purchases: PurchaseService;
}

const none: GameServices = {
  achievements: { unlock: async () => {} },
  leaderboards: { submit: async () => {} },
  purchases: {
    available: () => false,
    products: async () => [],
    purchase: async () => false,
    restore: async () => [],
  },
};

/**
 * The services for this platform.
 *
 * TODO(steam): Steamworks on Windows/macOS/Linux store builds. Needs the
 *   Steamworks SDK linked into `src-tauri` (a Rust binding, exposed as Tauri
 *   commands), an App ID, and achievement/leaderboard names created in the
 *   Steamworks partner site. Only for builds shipped through Steam - an
 *   installer from the website must not require Steam to be running.
 * TODO(game-center): Game Center and StoreKit on iOS/macOS App Store builds.
 *   Needs a Tauri mobile plugin in Swift (GameKit, StoreKit 2), the Game Center
 *   capability on the App ID, and achievements/leaderboards/products created in
 *   App Store Connect.
 * TODO(play-games): Google Play Games Services v2 and Play Billing on Android.
 *   Needs a Tauri mobile plugin in Kotlin, the Play Games project linked in the
 *   Play Console with an OAuth client for the release signing key, and products
 *   created there.
 */
export function gameServices(platform: PlatformName = platformName()): GameServices {
  switch (platform) {
    case 'windows':
    case 'macos':
    case 'linux':
    case 'ios':
    case 'android':
    case 'web':
      return none;
  }
}
