import { getDatabase } from '../db/database';
import { BATCH_SIZE, type EventRow } from './syncBatch';
import {
  GET_EVENTS_SYNCED_AT_SQL,
  MARK_FAILED_SQL,
  MARK_SYNCED_SQL,
  PENDING_BATCH_SQL,
  SET_EVENTS_SYNCED_AT_SQL,
  SYNC_COUNTS_SQL,
} from './syncSql';

/** Resultado por evento de `POST /sync/events`. */
export interface EventResult {
  event_id: string;
  status: 'inserted' | 'duplicate' | 'rejected';
  reason?: string;
}

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
      const { changes } =
        result.status === 'rejected'
          ? await txn.runAsync(MARK_FAILED_SQL, [result.reason ?? 'Rechazado por el servidor', result.event_id])
          : await txn.runAsync(MARK_SYNCED_SQL, [nowIso, result.event_id]);
      changed += changes;
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
