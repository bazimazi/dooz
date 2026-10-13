import { parseAuthHeader } from '@/protocol';
import type { Context } from 'hono';
import type { AccountRow, Accounts } from './db/accounts.js';

/**
 * The account behind a request's `Authorization` header, or `null`.
 *
 * The same check the core API makes, shared by the social, account-data and
 * moderation routes so there is one way a request proves who it is.
 */
export function accountOf(c: Context, accounts: Accounts): AccountRow | null {
  const credentials = parseAuthHeader(c.req.header('authorization'));
  if (!credentials) return null;
  return accounts.authenticate(credentials.accountId, credentials.token);
}
