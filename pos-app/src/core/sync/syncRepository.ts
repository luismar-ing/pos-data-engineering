import { getDatabase } from '../db/database';
import { BATCH_SIZE, type EventRow } from './syncBatch';
import {
  GET_EVENTS_SYNCED_AT_SQL,
  markStatement,
  PENDING_BATCH_SQL,
  SET_EVENTS_SYNCED_AT_SQL,
  SYNC_COUNTS_SQL,
  type EventResult,
} from './syncSql';

export type { EventResult };

export async function getPendingBatch(limit = BATCH_SIZE): Promise<EventRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<EventRow>(PENDING_BATCH_SQL, [limit]);
}

/** Load: marca cada evento según su resultado, en una transacción. Devuelve cuántos cambiaron. */
export async function applyResults(results: EventResult[], nowIso: string): Promise<number> {
  const db = await getDatabase();
  let changed = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const result of results) {
      const [sql, params] = markStatement(result, nowIso);
      changed += (await txn.runAsync(sql, params)).changes;
    }
    await txn.runAsync(SET_EVENTS_SYNCED_AT_SQL, [nowIso]);
  });
  return changed;
}

export interface SyncSummary {
  pending: number;
  failed: number;
  syncedAt: string | null;
}

export async function getSyncSummary(): Promise<SyncSummary> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ sync_status: string; n: number }>(SYNC_COUNTS_SQL);
  const counts = new Map(rows.map((row) => [row.sync_status, row.n]));
  const syncedAt = await db.getFirstAsync<{ value: string }>(GET_EVENTS_SYNCED_AT_SQL);
  return { pending: counts.get('pending') ?? 0, failed: counts.get('failed') ?? 0, syncedAt: syncedAt?.value ?? null };
}
