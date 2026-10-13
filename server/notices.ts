import { randomUUID } from 'node:crypto';
import type { Notice } from '@/protocol';
import { log } from './log.js';
import type { PushService } from './push.js';

/**
 * Notices: telling one player about something that is not their current game.
 *
 * Three channels, tried in order of immediacy:
 *
 * 1. **The socket**, when the player has one open. Instant.
 * 2. **An inbox** the app drains every time it checks in (`/api/social/pulse`),
 *    for a player who has the app open but no socket - the socket only runs on
 *    the online screens.
 * 3. **Web Push**, for a player who has opted in and is not looking at the app
 *    at all.
 *
 * The inbox lives in memory on purpose. Everything that belongs in it is
 * either short-lived (a challenge is only good while the challenger waits in
 * the room) or already stored elsewhere (a correspondence move is in its game,
 * a friend request in its table), so losing the inbox to a restart costs a
 * banner, not a fact. It is bounded per account, in age, and in how many
 * accounts it holds.
 *
 * `notify` is the one entry point the rest of the server uses - tournaments,
 * correspondence, friends - so how a notice travels is decided here and only
 * here.
 */

export type NoticeInput = Omit<Notice, 'id' | 'at'>;

export interface NotifierOptions {
  readonly now?: () => number;
  readonly newId?: () => string;
  /** Deliver over a live socket. Returns whether the account had one. */
  readonly live?: (accountId: string, notice: Notice) => boolean;
  readonly push?: PushService | null;
}

const INBOX_LIMIT = 20;
const INBOX_TTL_MS = 15 * 60_000;
const MAX_INBOXES = 20_000;
const MAX_HEARTBEATS = 50_000;
/**
 * How recently the app must have checked in to count as open. The client
 * polls every 20 seconds while visible, so this is two missed polls.
 */
export const ACTIVE_WINDOW_MS = 45_000;

export class Notifier {
  private readonly inbox = new Map<string, Notice[]>();
  private readonly heartbeats = new Map<string, number>();
  private readonly now: () => number;
  private readonly newId: () => string;
  private live: (accountId: string, notice: Notice) => boolean;
  private readonly push: PushService | null;
  private delivered = { live: 0, inbox: 0, push: 0 };

  constructor(options: NotifierOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newId = options.newId ?? (() => randomUUID());
    this.live = options.live ?? (() => false);
    this.push = options.push ?? null;
  }

  /** Wire the socket channel once the lobby exists. */
  setLive(live: (accountId: string, notice: Notice) => boolean): void {
    this.live = live;
  }

  /**
   * Tell `accountId` about something.
   *
   * `push: false` keeps it off the lock screen - for notices that only make
   * sense while the app is open.
   */
  notify(accountId: string, input: NoticeInput, options: { push?: boolean } = {}): Notice {
    const notice: Notice = { ...input, id: this.newId(), at: this.now() };

    let delivered = false;
    try {
      delivered = this.live(accountId, notice);
    } catch (error) {
      log.exception('notice.live.failed', error, { accountId });
    }

    if (delivered) {
      this.delivered.live += 1;
    } else {
      this.store(accountId, notice);
      this.delivered.inbox += 1;
    }

    // A player with the app open hears about it within one poll; a push on
    // top would buzz the phone in their hand about what is already on screen.
    const push = this.push;
    if (push?.enabled && options.push !== false && !delivered && !this.isActive(accountId)) {
      this.delivered.push += 1;
      void push.send(accountId, {
        title: notice.title,
        body: notice.body,
        kind: notice.kind,
        ...(notice.url ? { url: notice.url } : {}),
        tag: notice.kind,
      });
    }
    return notice;
  }

  /** Everything waiting for `accountId`, removed from the inbox. Counts as a check-in. */
  drain(accountId: string): Notice[] {
    this.heartbeat(accountId);
    const cutoff = this.now() - INBOX_TTL_MS;
    const waiting = (this.inbox.get(accountId) ?? []).filter((notice) => notice.at > cutoff);
    this.inbox.delete(accountId);
    return waiting;
  }

  /** Drop a notice that is no longer true - a challenge withdrawn, say. */
  retract(accountId: string, predicate: (notice: Notice) => boolean): void {
    const waiting = this.inbox.get(accountId);
    if (!waiting) return;
    const kept = waiting.filter((notice) => !predicate(notice));
    if (kept.length === 0) this.inbox.delete(accountId);
    else this.inbox.set(accountId, kept);
  }

  heartbeat(accountId: string): void {
    // Re-inserting moves the key to the end, so the map stays in rough
    // recency order and the oldest entries are the first to be evicted.
    this.heartbeats.delete(accountId);
    this.heartbeats.set(accountId, this.now());
    if (this.heartbeats.size > MAX_HEARTBEATS) {
      const oldest = this.heartbeats.keys().next().value;
      if (oldest !== undefined) this.heartbeats.delete(oldest);
    }
  }

  lastSeen(accountId: string): number | null {
    return this.heartbeats.get(accountId) ?? null;
  }

  isActive(accountId: string): boolean {
    const seen = this.heartbeats.get(accountId);
    return seen !== undefined && this.now() - seen <= ACTIVE_WINDOW_MS;
  }

  /** Expire old notices and stale heartbeats. Called from the server tick. */
  sweep(): void {
    const at = this.now();
    for (const [accountId, notices] of this.inbox) {
      const kept = notices.filter((notice) => at - notice.at <= INBOX_TTL_MS);
      if (kept.length === 0) this.inbox.delete(accountId);
      else if (kept.length !== notices.length) this.inbox.set(accountId, kept);
    }
    for (const [accountId, seen] of this.heartbeats) {
      if (at - seen > INBOX_TTL_MS) this.heartbeats.delete(accountId);
    }
  }

  stats(): { inboxes: number; delivered: { live: number; inbox: number; push: number } } {
    return { inboxes: this.inbox.size, delivered: { ...this.delivered } };
  }

  private store(accountId: string, notice: Notice): void {
    const waiting = this.inbox.get(accountId) ?? [];
    waiting.push(notice);
    // The newest notices matter most, so the oldest give way.
    while (waiting.length > INBOX_LIMIT) waiting.shift();
    this.inbox.delete(accountId);
    this.inbox.set(accountId, waiting);
    if (this.inbox.size > MAX_INBOXES) {
      const oldest = this.inbox.keys().next().value;
      if (oldest !== undefined) this.inbox.delete(oldest);
    }
  }
}
