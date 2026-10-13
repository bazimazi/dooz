import { Buffer } from 'node:buffer';
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Accounts } from './db/accounts.js';
import { type Db, openDatabase } from './db/database.js';
import {
  base64UrlDecode,
  base64UrlEncode,
  encryptPayload,
  generateVapidKeys,
  isAllowedEndpoint,
  DEFAULT_PUSH_HOSTS,
  MAX_SUBSCRIPTIONS_PER_ACCOUNT,
  PushService,
  vapidAuthorization,
  vapidFromEnv,
} from './push.js';

/**
 * The receiving browser's half of RFC 8291, written independently of the
 * sender so a round trip proves the two agree with the standard rather than
 * merely with each other's mistakes.
 */
function decrypt(body: Buffer, userAgentPrivate: Buffer, authSecret: Buffer): Buffer {
  const salt = body.subarray(0, 16);
  const idLength = body.readUInt8(20);
  const serverPublic = body.subarray(21, 21 + idLength);
  const ciphertext = body.subarray(21 + idLength);

  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(userAgentPrivate);
  const userAgentPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(serverPublic);

  const prkKey = Buffer.from(
    hkdfSync(
      'sha256',
      shared,
      authSecret,
      Buffer.concat([Buffer.from('WebPush: info\0'), userAgentPublic, serverPublic]),
      32,
    ),
  );
  const cek = Buffer.from(
    hkdfSync('sha256', prkKey, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
  );
  const nonce = Buffer.from(
    hkdfSync('sha256', prkKey, salt, Buffer.from('Content-Encoding: nonce\0'), 12),
  );

  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const padded = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ]);
  // Strip the delimiter and any zero padding after the content.
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  expect(padded[end]).toBe(2);
  return padded.subarray(0, end);
}

function browserKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = Buffer.from('0123456789abcdef');
  return {
    privateKey: ecdh.getPrivateKey(),
    p256dh: base64UrlEncode(ecdh.getPublicKey()),
    auth: base64UrlEncode(auth),
    authSecret: auth,
  };
}

describe('payload encryption', () => {
  it('reproduces the worked example in RFC 8291 appendix A', () => {
    const serverEcdh = createECDH('prime256v1');
    serverEcdh.setPrivateKey(base64UrlDecode('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'));

    const body = encryptPayload(
      Buffer.from('When I grow up, I want to be a watermelon'),
      'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      'BTBZMqHH6r4Tts7J_aSIgg',
      { salt: base64UrlDecode('DGv6ra1nlYgDCS1FRnbzlw'), ecdh: serverEcdh },
    );

    expect(base64UrlEncode(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });

  it('round-trips through an independent decryptor', () => {
    const browser = browserKeys();
    const message = Buffer.from(JSON.stringify({ title: 'Your move', body: 'Ada played.' }));
    const body = encryptPayload(message, browser.p256dh, browser.auth);
    expect(decrypt(body, browser.privateKey, browser.authSecret).toString()).toBe(
      message.toString(),
    );
  });

  it('uses a fresh key and salt for every message', () => {
    const browser = browserKeys();
    const a = encryptPayload(Buffer.from('same'), browser.p256dh, browser.auth);
    const b = encryptPayload(Buffer.from('same'), browser.p256dh, browser.auth);
    expect(a.equals(b)).toBe(false);
  });

  it('refuses keys that are not a P-256 point and a 16-byte secret', () => {
    const browser = browserKeys();
    expect(() => encryptPayload(Buffer.from('x'), 'AAAA', browser.auth)).toThrow();
    expect(() => encryptPayload(Buffer.from('x'), browser.p256dh, 'AAAA')).toThrow();
  });
});

describe('VAPID', () => {
  it('signs a JWT the public key verifies, scoped to the push service origin', () => {
    const generated = generateVapidKeys();
    const keys = { ...generated, subject: 'mailto:ops@example.com' };
    const header = vapidAuthorization(
      'https://fcm.googleapis.com/fcm/send/abc',
      keys,
      1_700_000_000_000,
    );

    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, head, claims, signature, k] = match!;
    expect(k).toBe(keys.publicKey);

    const parsed = JSON.parse(base64UrlDecode(claims!).toString()) as Record<string, unknown>;
    expect(parsed).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_700_000_000 + 12 * 3600,
      sub: 'mailto:ops@example.com',
    });

    const point = base64UrlDecode(keys.publicKey);
    const publicKey = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: base64UrlEncode(point.subarray(1, 33)),
        y: base64UrlEncode(point.subarray(33)),
      },
      format: 'jwk',
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${head}.${claims}`),
        { key: publicKey, dsaEncoding: 'ieee-p1363' },
        base64UrlDecode(signature!),
      ),
    ).toBe(true);
  });

  it('reads keys from the environment and rejects malformed ones', () => {
    const keys = generateVapidKeys();
    expect(vapidFromEnv({})).toBeNull();
    expect(
      vapidFromEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey }),
    ).toMatchObject({ publicKey: keys.publicKey });
    expect(() =>
      vapidFromEnv({ VAPID_PUBLIC_KEY: 'short', VAPID_PRIVATE_KEY: keys.privateKey }),
    ).toThrow();
    expect(() =>
      vapidFromEnv({
        VAPID_PUBLIC_KEY: keys.publicKey,
        VAPID_PRIVATE_KEY: keys.privateKey,
        VAPID_SUBJECT: 'javascript:alert(1)',
      }),
    ).toThrow();
  });
});

describe('endpoint allow-list', () => {
  it('admits the real push services only, over HTTPS on the default port', () => {
    const hosts = DEFAULT_PUSH_HOSTS;
    expect(isAllowedEndpoint('https://fcm.googleapis.com/fcm/send/x', hosts)).toBe(true);
    expect(isAllowedEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x', hosts)).toBe(
      true,
    );
    expect(isAllowedEndpoint('https://web.push.apple.com/abc', hosts)).toBe(true);

    expect(isAllowedEndpoint('http://fcm.googleapis.com/fcm/send/x', hosts)).toBe(false);
    expect(isAllowedEndpoint('https://fcm.googleapis.com:8443/x', hosts)).toBe(false);
    expect(isAllowedEndpoint('https://user:pw@fcm.googleapis.com/x', hosts)).toBe(false);
    expect(isAllowedEndpoint('https://evil.example/fcm.googleapis.com', hosts)).toBe(false);
    expect(isAllowedEndpoint('https://fcm.googleapis.com.evil.example/x', hosts)).toBe(false);
    expect(isAllowedEndpoint('https://169.254.169.254/latest/meta-data', hosts)).toBe(false);
    expect(isAllowedEndpoint('https://notify.windows.com.evil/x', hosts)).toBe(false);
    expect(isAllowedEndpoint('not a url', hosts)).toBe(false);
  });
});

describe('push service', () => {
  let db: Db;
  let accountId: string;
  const requests: { url: string; init: RequestInit }[] = [];
  let status = 201;

  const fakeFetch: typeof fetch = async (url, init) => {
    requests.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} });
    return new Response(null, { status });
  };

  beforeEach(() => {
    db = openDatabase(':memory:');
    accountId = new Accounts(db).create('Pusher', 'fox').account.id;
    requests.length = 0;
    status = 201;
  });
  afterEach(() => db.close());

  function service() {
    const keys = { ...generateVapidKeys(), subject: 'mailto:ops@example.com' };
    return new PushService(db, keys, { fetch: fakeFetch, now: () => 1_700_000_000_000 });
  }

  it('encrypts and posts to every registered device', async () => {
    const push = service();
    const browser = browserKeys();
    expect(
      push.subscribe(accountId, {
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
        keys: { p256dh: browser.p256dh, auth: browser.auth },
      }),
    ).toBe('ok');

    expect(
      await push.send(accountId, { title: 'Your move', body: 'Ada played', tag: 'turn' }),
    ).toBe(1);
    expect(requests).toHaveLength(1);
    const headers = requests[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers['Topic']).toBe('turn');
    expect(headers['Authorization']).toMatch(/^vapid t=/);
    expect(requests[0]!.init.redirect).toBe('error');

    const body = Buffer.from(requests[0]!.init.body as Buffer);
    const plain = JSON.parse(decrypt(body, browser.privateKey, browser.authSecret).toString());
    expect(plain).toMatchObject({ title: 'Your move', body: 'Ada played' });
  });

  it('refuses endpoints outside the allow-list and malformed keys', () => {
    const push = service();
    const browser = browserKeys();
    expect(
      push.subscribe(accountId, {
        endpoint: 'https://internal.example/hook',
        keys: { p256dh: browser.p256dh, auth: browser.auth },
      }),
    ).toBe('host');
    expect(
      push.subscribe(accountId, {
        endpoint: 'https://fcm.googleapis.com/fcm/send/x',
        keys: { p256dh: browser.auth, auth: browser.auth },
      }),
    ).toBe('invalid');
    expect(push.count(accountId)).toBe(0);
  });

  it('forgets a subscription the push service says is gone', async () => {
    const push = service();
    const browser = browserKeys();
    push.subscribe(accountId, {
      endpoint: 'https://fcm.googleapis.com/fcm/send/old',
      keys: { p256dh: browser.p256dh, auth: browser.auth },
    });
    status = 410;
    expect(await push.send(accountId, { title: 't', body: 'b' })).toBe(0);
    expect(push.count(accountId)).toBe(0);
  });

  it('keeps only the newest devices past the per-account cap', () => {
    let clock = 1;
    const keys = { ...generateVapidKeys(), subject: 'mailto:ops@example.com' };
    const push = new PushService(db, keys, { fetch: fakeFetch, now: () => clock++ });
    const browser = browserKeys();
    for (let i = 0; i < MAX_SUBSCRIPTIONS_PER_ACCOUNT + 3; i++) {
      push.subscribe(accountId, {
        endpoint: `https://fcm.googleapis.com/fcm/send/d${i}`,
        keys: { p256dh: browser.p256dh, auth: browser.auth },
      });
    }
    expect(push.count(accountId)).toBe(MAX_SUBSCRIPTIONS_PER_ACCOUNT);
  });

  it('does nothing when VAPID keys are not configured', async () => {
    const push = new PushService(db, null, { fetch: fakeFetch });
    expect(push.enabled).toBe(false);
    expect(await push.send(accountId, { title: 't', body: 'b' })).toBe(0);
    expect(requests).toHaveLength(0);
  });
});
