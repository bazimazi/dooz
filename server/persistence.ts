import { gameConfigSchema, matchKindSchema, playerSchema, roomCodeSchema } from '@/protocol';
import { z } from 'zod';
import type { Db } from './db/database.js';
import { log } from './log.js';
import type { PersistedRoom } from './social-hooks.js';

/**
 * Carrying games in progress across a deploy.
 *
 * On a graceful shutdown the lobby's live rooms are written to `live_rooms`
 * just before the sockets close. On boot they are read back, replayed through
 * the engine, and seated with every player disconnected - so the client's
 * ordinary reconnect (`hello` finds the seat, `resumed: true`, `matched`) puts
 * both players back on the board they left, with the clocks where they were.
 * The time the server spent down is charged to nobody.
 *
 * The table is emptied as soon as it is read. A snapshot is only ever written
 * by a shutdown that also stopped the game clock, so restoring it once is
 * safe; restoring a stale one twice could replay a game that had since ended.
 */

/** Snapshots older than this describe games nobody is still waiting on. */
const MAX_AGE_MS = 30 * 60_000;

const persistedRoomSchema = z.object({
  code: roomCodeSchema,
  config: gameConfigSchema,
  gameConfig: gameConfigSchema,
  kind: matchKindSchema,
  startingPlayer: playerSchema,
  moves: z.array(z.number().int().nonnegative()).max(4096),
  moveTimesMs: z.array(z.number().int().nonnegative()).max(4096),
  startedAt: z.number().int().nonnegative(),
  seats: z
    .array(
      z.object({
        accountId: z.string().min(1).max(64),
        player: playerSchema,
        ratingBefore: z.number().int(),
        mayOfferDraw: z.boolean(),
      }),
    )
    .min(1)
    .max(2),
  clock: z
    .object({
      x: z.number().int().nonnegative(),
      o: z.number().int().nonnegative(),
      running: playerSchema.nullable(),
      incrementMs: z.number().int().nonnegative(),
    })
    .nullable(),
});

export interface RoomStore {
  exportRooms(): PersistedRoom[];
  importRoom(room: PersistedRoom): boolean;
}

/** Write every live room down. Returns how many were saved. */
export function saveLiveRooms(db: Db, lobby: RoomStore, now: number = Date.now()): number {
  const rooms = lobby.exportRooms();
  db.transaction(() => {
    db.prepare('DELETE FROM live_rooms').run();
    const insert = db.prepare('INSERT INTO live_rooms (code, state, saved_at) VALUES (?, ?, ?)');
    for (const room of rooms) insert.run(room.code, JSON.stringify(room), now);
  })();
  log.info('rooms.saved', { rooms: rooms.length });
  return rooms.length;
}

/** Read saved rooms back into the lobby, then forget them. Returns how many came back. */
export function restoreLiveRooms(db: Db, lobby: RoomStore, now: number = Date.now()): number {
  const rows = db
    .prepare<[], { code: string; state: string; saved_at: number }>(
      'SELECT code, state, saved_at FROM live_rooms',
    )
    .all();
  db.prepare('DELETE FROM live_rooms').run();

  let restored = 0;
  for (const row of rows) {
    if (now - row.saved_at > MAX_AGE_MS) continue;
    let state: unknown;
    try {
      state = JSON.parse(row.state);
    } catch {
      continue;
    }
    const parsed = persistedRoomSchema.safeParse(state);
    if (!parsed.success) {
      log.warn('rooms.restore.invalid', { code: row.code });
      continue;
    }
    try {
      if (lobby.importRoom(parsed.data)) restored += 1;
      else log.warn('rooms.restore.refused', { code: row.code });
    } catch (error) {
      log.exception('rooms.restore.failed', error, { code: row.code });
    }
  }
  if (rows.length > 0) log.info('rooms.restored', { saved: rows.length, restored });
  return restored;
}
