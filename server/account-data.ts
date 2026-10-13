import { Buffer } from 'node:buffer';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { ROOM_CODE_ALPHABET } from '@/protocol';
import {
  CLOUD_SAVE_MAX_BYTES,
  cloudSavePutSchema,
  deleteAccountRequestSchema,
  RECOVERY_CODE_COUNT,
  recoverRequestSchema,
} from '@/protocol/social';
import { type Context, Hono } from 'hono';
import { mergeEnvelopes } from '@/features/cloud/merge';
import { addressOf, FixedWindowLimiter, readJson } from './api.js';
import { accountOf } from './auth.js';
import type { Correspondence } from './correspondence.js';
import { type Accounts, generateToken, nameKey } from './db/accounts.js';
import type { Db } from './db/database.js';
import type { Matches } from './db/matches.js';
import { log } from './log.js';

/**
 * What a player can do with their own account's data: recover it, take it
 * with them, delete it, and keep their solo progress in the cloud.
 *
 * **Recovery codes** are the way back into an account when the password is
 * forgotten or was never set. They are shown once, stored only as hashes, and
 * each works once. A code is about 59 bits from the CSPRNG, so one SHA-256 is
 * enough - the same reasoning as the account token - and every stored hash is
 * compared in constant time.
 *
 * **Export** returns everything the server holds about the account as JSON,
 * secrets excepted. **Deletion** forfeits the account's games so nobody is
 * left waiting, then removes the account and everything keyed to it. Match
 * records stay, because they are also the opponent's history; they show the
 * deleted side as "Former player" and keep only an id that now points nowhere.
 */

const HOUR_MS = 3_600_000;
const RECOVERY_LOCKOUT_MS = 15 * 60_000;
const RECOVERY_FAILURES_PER_NAME = 5;
const CODE_LENGTH = 12;

/** Columns never included in an export, whatever table they are in. */
const SECRET_COLUMN = /hash|token|secret|password|^auth$|p256dh/i;

export interface AccountDataOptions {
  readonly db: Db;
  readonly accounts: Accounts;
  readonly matches: Matches;
  readonly correspondence: Correspondence;
  readonly trustProxy?: boolean;
  readonly now?: () => number;
  /** Remove a live connection and resign its game before the account goes. */
  readonly evict?: (accountId: string) => void;
}

/** A fresh recovery code, `XXXX-XXXX-XXXX`. */
export function generateRecoveryCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

/** Keyed by account, so the same code on two accounts hashes differently. */
function hashRecoveryCode(accountId: string, normalisedCode: string): string {
  return createHash('sha256').update(`${accountId}:${normalisedCode}`).digest('base64');
}

/**
 * The account token's stored form. Mirrors `hashToken` in `db/accounts.ts`; a
 * test signs in with a token rotated here to keep the two in step.
 */
function hashAccountToken(token: string): string {
  return createHash('sha256').update(token).digest('base64');
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class AccountData {
  private readonly db: Db;
  private readonly accounts: Accounts;
  private readonly now: () => number;

  constructor(private readonly options: AccountDataOptions) {
    this.db = options.db;
    this.accounts = options.accounts;
    this.now = options.now ?? Date.now;
  }

  // -------------------------------------------------------------------------
  // Recovery
  // -------------------------------------------------------------------------

  /** Issue a new set of codes, retiring any earlier set. Returned once, never stored. */
  issueRecoveryCodes(accountId: string): string[] {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    const at = this.now();
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM recovery_codes WHERE account_id = ?').run(accountId);
      const insert = this.db.prepare(
        'INSERT INTO recovery_codes (account_id, code_hash, created_at) VALUES (?, ?, ?)',
      );
      for (const code of codes) {
        insert.run(accountId, hashRecoveryCode(accountId, code.replace(/-/g, '')), at);
      }
    })();
    return codes;
  }

  remainingCodes(accountId: string): number {
    return (
      this.db
        .prepare<[string], { n: number }>(
          'SELECT COUNT(*) AS n FROM recovery_codes WHERE account_id = ? AND used_at IS NULL',
        )
        .get(accountId)?.n ?? 0
    );
  }

  /**
   * Sign in with a name and a recovery code. Burns the code and rotates the
   * account token, so whichever device held the old one is signed out.
   *
   * An unknown name does the same work as a wrong code, so the answer cannot
   * be used to learn which names exist.
   */
  recover(
    displayName: string,
    normalisedCode: string,
  ): { accountId: string; token: string; remaining: number } | null {
    const row = this.db
      .prepare<[string], { id: string }>('SELECT id FROM accounts WHERE name_key = ?')
      .get(nameKey(displayName));
    const accountId = row?.id ?? '00000000-0000-0000-0000-000000000000';
    const presented = hashRecoveryCode(accountId, normalisedCode);

    const stored = this.db
      .prepare<[string], { code_hash: string }>(
        'SELECT code_hash FROM recovery_codes WHERE account_id = ? AND used_at IS NULL',
      )
      .all(accountId);
    // Compare against every unused code (and a dummy when there are none), so
    // the time taken says nothing about which, or whether, one matched.
    let matched: string | null = null;
    for (const candidate of stored.length > 0
      ? stored
      : [{ code_hash: presented.replace(/./g, 'x') }]) {
      if (constantTimeEqual(candidate.code_hash, presented)) matched = candidate.code_hash;
    }
    if (!row || !matched) return null;

    const token = generateToken();
    const used = this.db.transaction(() => {
      const burned = this.db
        .prepare(
          'UPDATE recovery_codes SET used_at = ? WHERE account_id = ? AND code_hash = ? AND used_at IS NULL',
        )
        .run(this.now(), row.id, matched);
      if (burned.changes === 0) return false;
      this.db
        .prepare('UPDATE accounts SET token_hash = ?, last_seen_at = ? WHERE id = ?')
        .run(hashAccountToken(token), this.now(), row.id);
      return true;
    })();
    if (!used) return null;

    return { accountId: row.id, token, remaining: this.remainingCodes(row.id) };
  }

  // -------------------------------------------------------------------------
  // Export and deletion
  // -------------------------------------------------------------------------

  /**
   * Everything held about an account, as one JSON document.
   *
   * Tables are discovered rather than listed: any table with a foreign key to
   * `accounts` contributes the rows that point at this account, so data added
   * by later features is exported without anyone remembering to add it here.
   * Credential columns are dropped wherever they appear.
   */
  exportData(accountId: string): Record<string, unknown> | null {
    const account = this.db
      .prepare<[string], Record<string, unknown>>('SELECT * FROM accounts WHERE id = ?')
      .get(accountId);
    if (!account) return null;

    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const { table, columns } of this.accountReferences()) {
      const where = columns.map((column) => `"${column}" = ?`).join(' OR ');
      const rows = this.db
        .prepare<unknown[], Record<string, unknown>>(`SELECT * FROM "${table}" WHERE ${where}`)
        .all(...columns.map(() => accountId));
      if (rows.length > 0) tables[table] = rows.map(redact);
    }

    tables['reports_filed'] = this.db
      .prepare<[string], Record<string, unknown>>(
        'SELECT id, match_id, reason, detail, created_at FROM reports WHERE reporter_id = ?',
      )
      .all(accountId);

    const lookup = (id: string) => this.accounts.get(id);
    return {
      format: 'dooz-account-export',
      version: 1,
      exportedAt: new Date(this.now()).toISOString(),
      account: redact(account),
      matches: this.options.matches.recentFor(accountId, 100_000, lookup),
      tables,
    };
  }

  /**
   * Delete an account and everything keyed to it.
   *
   * Games are resolved first - a live one resigned, correspondence games
   * forfeited - so opponents get a result. Then every row that references the
   * account goes: most by `ON DELETE CASCADE`, and any table whose foreign key
   * does not cascade is cleared explicitly, so a later feature that forgot the
   * clause cannot make deletion fail.
   */
  deleteAccount(accountId: string): boolean {
    if (!this.accounts.get(accountId)) return false;

    this.options.evict?.(accountId);
    this.options.correspondence.forfeitAll(accountId);

    this.db.transaction(() => {
      this.db.prepare('DELETE FROM reports WHERE reporter_id = ?').run(accountId);
      for (const { table, columns, cascades } of this.accountReferences()) {
        if (cascades) continue;
        for (const column of columns) {
          this.db.prepare(`DELETE FROM "${table}" WHERE "${column}" = ?`).run(accountId);
        }
      }
      this.db.prepare('DELETE FROM accounts WHERE id = ?').run(accountId);
    })();
    log.info('account.delete', { accountId });
    return true;
  }

  private accountReferences(): { table: string; columns: string[]; cascades: boolean }[] {
    const tables = this.db
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all();
    const references: { table: string; columns: string[]; cascades: boolean }[] = [];
    for (const { name } of tables) {
      if (name === 'accounts') continue;
      const keys = this.db
        .prepare<[], { table: string; from: string; on_delete: string }>(
          `PRAGMA foreign_key_list("${name.replace(/"/g, '""')}")`,
        )
        .all()
        .filter((key) => key.table === 'accounts');
      if (keys.length === 0) continue;
      references.push({
        table: name,
        columns: [...new Set(keys.map((key) => key.from))],
        cascades: keys.every((key) => key.on_delete.toUpperCase() === 'CASCADE'),
      });
    }
    return references;
  }

  // -------------------------------------------------------------------------
  // Cloud save
  // -------------------------------------------------------------------------

  cloudSave(accountId: string): {
    revision: number;
    data: Record<string, unknown> | null;
    updatedAt: number | null;
  } {
    const row = this.db
      .prepare<[string], { revision: number; data: string; updated_at: number }>(
        'SELECT revision, data, updated_at FROM cloud_saves WHERE account_id = ?',
      )
      .get(accountId);
    if (!row) return { revision: 0, data: null, updatedAt: null };
    return { revision: row.revision, data: safeParse(row.data), updatedAt: row.updated_at };
  }

  /**
   * Merge a device's progress into the stored copy and return the result.
   *
   * The server merges rather than overwriting, so two devices syncing in
   * either order both end up with everything either earned.
   */
  putCloudSave(
    accountId: string,
    incoming: Record<string, unknown>,
  ): { revision: number; data: Record<string, unknown>; updatedAt: number } | 'tooLarge' {
    return this.db.transaction(() => {
      const current = this.cloudSave(accountId);
      const merged = mergeEnvelopes(current.data, incoming) as unknown as Record<string, unknown>;
      const text = JSON.stringify(merged);
      if (Buffer.byteLength(text) > CLOUD_SAVE_MAX_BYTES) return 'tooLarge' as const;

      const revision = current.revision + 1;
      const at = this.now();
      this.db
        .prepare(
          `INSERT INTO cloud_saves (account_id, revision, data, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id) DO UPDATE SET revision = excluded.revision, data = excluded.data, updated_at = excluded.updated_at`,
        )
        .run(accountId, revision, text, at);
      return { revision, data: merged, updatedAt: at };
    })();
  }

  // -------------------------------------------------------------------------
  // Routes
  // -------------------------------------------------------------------------

  routes(): Hono {
    const app = new Hono();
    const now = this.now;
    const trustProxy = this.options.trustProxy ?? false;
    const recoverByAddress = new FixedWindowLimiter(10, HOUR_MS, now);
    const recoverFailures = new FixedWindowLimiter(
      RECOVERY_FAILURES_PER_NAME,
      RECOVERY_LOCKOUT_MS,
      now,
    );
    const exports = new FixedWindowLimiter(5, HOUR_MS, now);
    const saves = new FixedWindowLimiter(120, HOUR_MS, now);
    const codeIssues = new FixedWindowLimiter(5, HOUR_MS, now);
    const auth = (c: Context) => accountOf(c, this.accounts);

    app.get('/api/account/recovery-codes', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      return c.json({ remaining: this.remainingCodes(me.id) });
    });

    app.post('/api/account/recovery-codes', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (!codeIssues.hit(me.id)) return c.json({ error: 'Too many requests' }, 429);
      const codes = this.issueRecoveryCodes(me.id);
      log.info('account.recovery.issue', { accountId: me.id });
      // Never cached anywhere on the way back: these are shown exactly once.
      c.header('Cache-Control', 'no-store');
      return c.json({ codes });
    });

    app.post('/api/account/recover', async (c) => {
      if (!recoverByAddress.hit(addressOf(c, trustProxy))) {
        return c.json({ error: 'Too many attempts from here' }, 429);
      }
      const parsed = recoverRequestSchema.safeParse(await readJson(c.req.raw));
      if (!parsed.success) return c.json({ error: 'Invalid request' }, 400);

      const key = nameKey(parsed.data.displayName);
      if (recoverFailures.exhausted(key)) {
        return c.json({ error: 'Too many attempts for that name. Try again later.' }, 429);
      }
      const result = this.recover(parsed.data.displayName, parsed.data.code);
      if (!result) {
        recoverFailures.hit(key);
        log.warn('account.recovery.failed', { name: parsed.data.displayName });
        return c.json({ error: 'That name and code did not match' }, 401);
      }
      log.info('account.recovery.used', { accountId: result.accountId });
      c.header('Cache-Control', 'no-store');
      return c.json(result);
    });

    app.get('/api/account/export', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (!exports.hit(me.id)) return c.json({ error: 'Too many exports - try again later' }, 429);
      const data = this.exportData(me.id);
      if (!data) return c.json({ error: 'Not found' }, 404);
      log.info('account.export', { accountId: me.id });
      c.header('Cache-Control', 'no-store');
      c.header('Content-Disposition', 'attachment; filename="dooz-account.json"');
      return c.json(data);
    });

    app.delete('/api/account', async (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      const parsed = deleteAccountRequestSchema.safeParse(await readJson(c.req.raw));
      // Typing the name again is the confirmation: deletion cannot be undone.
      if (!parsed.success || nameKey(parsed.data.confirm) !== nameKey(me.displayName)) {
        return c.json({ error: 'Type your display name to confirm' }, 400);
      }
      this.deleteAccount(me.id);
      return c.body(null, 204);
    });

    app.get('/api/cloud-save', (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      return c.json(this.cloudSave(me.id));
    });

    app.put('/api/cloud-save', async (c) => {
      const me = auth(c);
      if (!me) return c.json({ error: 'Unauthorized' }, 401);
      if (!saves.hit(me.id)) return c.json({ error: 'Slow down' }, 429);

      const length = Number(c.req.header('content-length') ?? 0);
      if (length > CLOUD_SAVE_MAX_BYTES) return c.json({ error: 'Save too large' }, 413);
      const text = await c.req.text();
      if (Buffer.byteLength(text) > CLOUD_SAVE_MAX_BYTES) {
        return c.json({ error: 'Save too large' }, 413);
      }
      const parsed = cloudSavePutSchema.safeParse(safeParse(text));
      if (!parsed.success) return c.json({ error: 'Invalid save' }, 400);

      const result = this.putCloudSave(me.id, parsed.data.data);
      if (result === 'tooLarge') return c.json({ error: 'Save too large' }, 413);
      return c.json(result);
    });

    return app;
  }
}

function redact(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([column]) => !SECRET_COLUMN.test(column)));
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
