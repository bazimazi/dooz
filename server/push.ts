import { Buffer } from 'node:buffer';
import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  type ECDH,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  sign,
} from 'node:crypto';
import type { Db } from './db/database.js';
import { log } from './log.js';

/**
 * Web Push, implemented directly on `node:crypto`.
 *
 * Two standards are involved and both are small enough to own:
 *
 * - **VAPID** (RFC 8292) identifies this server to the browser's push service
 *   with an ES256-signed JWT, so a stolen subscription cannot be used by
 *   anyone without our private key.
 * - **aes128gcm** message encryption (RFC 8291 over RFC 8188) encrypts the
 *   payload to the subscribing browser's key, so the push service relays a
 *   message it cannot read.
 *
 * Push endpoints are URLs a client hands us, which makes sending to them a
 * server-side request forgery waiting to happen. Every endpoint is checked
 * against an allow-list of the real push services on the way in and again on
 * the way out, must be HTTPS on the default port, and redirects are refused.
 */

export interface VapidKeys {
  /** Uncompressed P-256 point, base64url (65 bytes). Shared with browsers. */
  readonly publicKey: string;
  /** The private scalar, base64url (32 bytes). Never leaves the server. */
  readonly privateKey: string;
  /** `mailto:` or `https:` contact the push services can reach us at. */
  readonly subject: string;
}

export interface PushPayload {
  readonly title: string;
  readonly body: string;
  /** Relative in-app path to open when the notification is tapped. */
  readonly url?: string;
  /** Collapses notifications of the same kind on the device. */
  readonly tag?: string;
  readonly kind?: string;
}

export interface PushSubscriptionInput {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

/**
 * The browsers' push services. `*.` matches any subdomain. Configurable with
 * `PUSH_HOSTS` for a deployment that needs another (a self-hosted autopush).
 */
export const DEFAULT_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  '*.push.services.mozilla.com',
  '*.notify.windows.com',
  'web.push.apple.com',
  '*.push.apple.com',
] as const;

/** Devices one account may register; the oldest is retired past this. */
export const MAX_SUBSCRIPTIONS_PER_ACCOUNT = 10;
/** Payloads stay well under the 4 KB push services accept after encryption. */
const MAX_PAYLOAD_BYTES = 3000;
const RECORD_SIZE = 4096;
const JWT_LIFETIME_S = 12 * 3600;
const SEND_TIMEOUT_MS = 10_000;
/** Pushes in flight at once; beyond this new ones are dropped and logged. */
const MAX_IN_FLIGHT = 200;

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function base64UrlEncode(data: Buffer | Uint8Array): string {
  return Buffer.from(data).toString('base64url');
}

export function base64UrlDecode(text: string): Buffer {
  return Buffer.from(text.replace(/=+$/, ''), 'base64url');
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** A fresh VAPID key pair, for `scripts/generate-vapid-keys.mjs` and tests. */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  if (!jwk.x || !jwk.y || !jwk.d) throw new Error('Key export did not include the curve point');
  const point = Buffer.concat([Buffer.from([4]), base64UrlDecode(jwk.x), base64UrlDecode(jwk.y)]);
  return { publicKey: base64UrlEncode(point), privateKey: jwk.d };
}

/**
 * VAPID keys from the environment, or `null` when push is not configured.
 *
 * Malformed keys are a deployment mistake worth failing loudly over, so they
 * throw rather than quietly turning push off.
 */
export function vapidFromEnv(env: NodeJS.ProcessEnv): VapidKeys | null {
  const publicKey = env['VAPID_PUBLIC_KEY']?.trim();
  const privateKey = env['VAPID_PRIVATE_KEY']?.trim();
  if (!publicKey || !privateKey) return null;

  const point = base64UrlDecode(publicKey);
  const scalar = base64UrlDecode(privateKey);
  if (point.length !== 65 || point[0] !== 4 || scalar.length !== 32) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not a P-256 key pair');
  }
  const subject = env['VAPID_SUBJECT']?.trim() || 'mailto:admin@localhost';
  if (!/^(mailto:|https:\/\/)/.test(subject)) {
    throw new Error('VAPID_SUBJECT must be a mailto: or https: URL');
  }
  return { publicKey, privateKey, subject };
}

function signingKey(keys: VapidKeys) {
  const point = base64UrlDecode(keys.publicKey);
  return createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: keys.privateKey.replace(/=+$/, ''),
      x: base64UrlEncode(point.subarray(1, 33)),
      y: base64UrlEncode(point.subarray(33, 65)),
    },
    format: 'jwk',
  });
}

/**
 * The `Authorization` header for one push request (RFC 8292).
 *
 * The audience is the push service's origin, so a token minted for one service
 * is useless at another, and it expires in hours rather than the day allowed.
 */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now: number): string {
  const header = base64UrlEncode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = base64UrlEncode(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + JWT_LIFETIME_S,
        sub: keys.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  // JWTs carry the raw r||s pair, not the DER structure Node produces by default.
  const signature = sign('sha256', Buffer.from(unsigned), {
    key: signingKey(keys),
    dsaEncoding: 'ieee-p1363',
  });
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${keys.publicKey}`;
}

// ---------------------------------------------------------------------------
// Payload encryption (RFC 8291)
// ---------------------------------------------------------------------------

/**
 * Encrypt `plaintext` to a browser subscription's keys, as one aes128gcm record.
 *
 * `salt` and `ecdh` are injectable only so the RFC's worked example can be
 * reproduced in a test; in use both are fresh for every message, which is what
 * makes each message's content key unique.
 */
export function encryptPayload(
  plaintext: Buffer,
  p256dh: string,
  auth: string,
  options: { salt?: Buffer; ecdh?: ECDH } = {},
): Buffer {
  const userAgentPublic = base64UrlDecode(p256dh);
  const authSecret = base64UrlDecode(auth);
  if (userAgentPublic.length !== 65 || userAgentPublic[0] !== 4) {
    throw new Error('Subscription key is not an uncompressed P-256 point');
  }
  if (authSecret.length !== 16) throw new Error('Subscription auth secret must be 16 bytes');
  if (plaintext.length > RECORD_SIZE - 17) throw new Error('Payload too large for one record');

  let ecdh = options.ecdh;
  if (!ecdh) {
    ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
  }
  const serverPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(userAgentPublic);

  // IKM = HKDF(auth, ecdh_secret, "WebPush: info" || 0 || ua_public || as_public)
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    userAgentPublic,
    serverPublic,
  ]);
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));

  const salt = options.salt ?? randomBytes(16);
  const contentKey = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12),
  );

  // A single record, so the padding delimiter is 2 ("last record") and no
  // further padding is added.
  const cipher = createCipheriv('aes-128-gcm', contentKey, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.concat([plaintext, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(RECORD_SIZE, 16);
  header.writeUInt8(serverPublic.length, 20);
  return Buffer.concat([header, serverPublic, ciphertext]);
}

// ---------------------------------------------------------------------------
// Endpoint checks
// ---------------------------------------------------------------------------

export function parsePushHosts(value: string | undefined): string[] {
  if (!value?.trim()) return [...DEFAULT_PUSH_HOSTS];
  return value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether `endpoint` is an HTTPS URL on one of the allowed push services. */
export function isAllowedEndpoint(endpoint: string, hosts: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return hosts.some((allowed) =>
    allowed.startsWith('*.') ? host.endsWith(allowed.slice(1)) : host === allowed,
  );
}

function isValidKeys(keys: PushSubscriptionInput['keys']): boolean {
  const point = base64UrlDecode(keys.p256dh);
  return point.length === 65 && point[0] === 4 && base64UrlDecode(keys.auth).length === 16;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushOptions {
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
  readonly allowedHosts?: readonly string[];
}

export class PushService {
  private readonly now: () => number;
  private readonly fetcher: typeof fetch;
  private readonly hosts: readonly string[];
  private inFlight = 0;
  private sent = 0;
  private failed = 0;

  constructor(
    private readonly db: Db,
    private readonly keys: VapidKeys | null,
    options: PushOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.fetcher = options.fetch ?? fetch;
    this.hosts = options.allowedHosts ?? DEFAULT_PUSH_HOSTS;
  }

  get enabled(): boolean {
    return this.keys !== null;
  }

  get publicKey(): string | null {
    return this.keys?.publicKey ?? null;
  }

  /** Register a device. An endpoint already registered moves to this account. */
  subscribe(accountId: string, subscription: PushSubscriptionInput): 'ok' | 'invalid' | 'host' {
    if (!isAllowedEndpoint(subscription.endpoint, this.hosts)) return 'host';
    if (!isValidKeys(subscription.keys)) return 'invalid';

    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO push_subscriptions (endpoint, account_id, p256dh, auth, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(endpoint) DO UPDATE SET
             account_id = excluded.account_id, p256dh = excluded.p256dh,
             auth = excluded.auth, created_at = excluded.created_at`,
        )
        .run(
          subscription.endpoint,
          accountId,
          subscription.keys.p256dh,
          subscription.keys.auth,
          this.now(),
        );
      // Retire the oldest devices beyond the cap rather than refusing the
      // newest, which is the one the player is holding.
      this.db
        .prepare(
          `DELETE FROM push_subscriptions WHERE account_id = ? AND endpoint NOT IN (
             SELECT endpoint FROM push_subscriptions WHERE account_id = ?
             ORDER BY created_at DESC LIMIT ?
           )`,
        )
        .run(accountId, accountId, MAX_SUBSCRIPTIONS_PER_ACCOUNT);
    })();
    return 'ok';
  }

  unsubscribe(accountId: string, endpoint: string): boolean {
    return (
      this.db
        .prepare('DELETE FROM push_subscriptions WHERE account_id = ? AND endpoint = ?')
        .run(accountId, endpoint).changes > 0
    );
  }

  count(accountId?: string): number {
    const row = accountId
      ? this.db
          .prepare<[string], { n: number }>(
            'SELECT COUNT(*) AS n FROM push_subscriptions WHERE account_id = ?',
          )
          .get(accountId)
      : this.db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM push_subscriptions').get();
    return row?.n ?? 0;
  }

  stats(): { enabled: boolean; subscriptions: number; sent: number; failed: number } {
    return {
      enabled: this.enabled,
      subscriptions: this.count(),
      sent: this.sent,
      failed: this.failed,
    };
  }

  /**
   * Push `payload` to every device the account registered. Resolves with how
   * many accepted it; never rejects, because a notification failing must not
   * fail whatever caused it.
   */
  async send(accountId: string, payload: PushPayload): Promise<number> {
    const keys = this.keys;
    if (!keys) return 0;

    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    if (body.length > MAX_PAYLOAD_BYTES) {
      log.warn('push.payload.tooLarge', { accountId, bytes: body.length });
      return 0;
    }

    const rows = this.db
      .prepare<[string], SubscriptionRow>(
        'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = ?',
      )
      .all(accountId);

    const results = await Promise.all(rows.map((row) => this.deliver(row, body, payload, keys)));
    return results.filter(Boolean).length;
  }

  private async deliver(
    row: SubscriptionRow,
    body: Buffer,
    payload: PushPayload,
    keys: VapidKeys,
  ): Promise<boolean> {
    // Checked again on the way out: the allow-list may have narrowed since the
    // subscription was stored.
    if (!isAllowedEndpoint(row.endpoint, this.hosts)) {
      this.drop(row.endpoint);
      return false;
    }
    if (this.inFlight >= MAX_IN_FLIGHT) {
      log.warn('push.backpressure', { inFlight: this.inFlight });
      return false;
    }

    this.inFlight += 1;
    try {
      const encrypted = encryptPayload(body, row.p256dh, row.auth);
      const headers: Record<string, string> = {
        TTL: String(24 * 3600),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Urgency: 'normal',
        Authorization: vapidAuthorization(row.endpoint, keys, this.now()),
      };
      // A topic replaces an undelivered message with the same one, so a
      // phone that was off sees the latest "your turn", not a stack of them.
      if (payload.tag && /^[\w-]{1,32}$/.test(payload.tag)) headers['Topic'] = payload.tag;

      const response = await this.fetcher(row.endpoint, {
        method: 'POST',
        headers,
        body: new Uint8Array(encrypted),
        redirect: 'error',
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (response.status === 404 || response.status === 410) {
        // The browser unsubscribed or the subscription expired. It will never
        // work again, so it is forgotten rather than retried.
        this.drop(row.endpoint);
        this.failed += 1;
        return false;
      }
      if (!response.ok) {
        log.warn('push.rejected', { status: response.status, host: new URL(row.endpoint).host });
        this.failed += 1;
        return false;
      }
      this.db
        .prepare('UPDATE push_subscriptions SET last_success_at = ? WHERE endpoint = ?')
        .run(this.now(), row.endpoint);
      this.sent += 1;
      return true;
    } catch (error) {
      log.exception('push.failed', error, { host: safeHost(row.endpoint) });
      this.failed += 1;
      return false;
    } finally {
      this.inFlight -= 1;
    }
  }

  private drop(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return 'invalid';
  }
}
