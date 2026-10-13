#!/usr/bin/env node
/**
 * Print a fresh VAPID key pair for Web Push, ready to paste into server/.env.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * Generate it once per deployment and keep it: browsers bind each push
 * subscription to the public key, so replacing the pair silently stops every
 * existing subscription from receiving anything until players turn
 * notifications off and on again. The private key is a secret - treat it like
 * a database password.
 */
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const point = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url'),
]);

console.log(`VAPID_PUBLIC_KEY=${point.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log('VAPID_SUBJECT=mailto:you@example.com');
