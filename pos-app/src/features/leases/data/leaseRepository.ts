import { getDatabase } from '../../../core/db/database';
import { isLeaseDue, renewAt, type DueCheck } from '../domain/leasePolicy';
import {
  ACTIVE_LEASES_SQL,
  AVAILABLE_SQL,
  CLOSING_SQL,
  HAS_OPEN_SESSION_SQL,
  MARK_CLOSING_SQL,
  MARK_RELEASED_SQL,
  PRODUCTS_WITHOUT_LEASE_SQL,
  SAVE_LEASE_SQL,
} from './leaseSql';

/** Préstamo tal como lo devuelve `POST /prestamos/request`. */
export interface ServerLease {
  id: string;
  product_id: string;
  quota_total: number;
  quota_used: number;
  issued_at: string;
  expires_at: string;
}

/** Unidades disponibles por producto; un producto sin entrada está agotado (RF-8). */
export async function getAvailableQuota(): Promise<Map<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ product_id: string; available: number }>(AVAILABLE_SQL);
  return new Map(rows.map((row) => [row.product_id, row.available]));
}

/**
 * Pasa a `closing` los préstamos que toca cerrar, en una transacción (no se cruza con un cobro).
 * Devuelve si hay sesión abierta y cuántos marcó.
 */
export async function markDueAsClosing(nowMs: number): Promise<{ sessionOpen: boolean; marked: number }> {
  const db = await getDatabase();
  let result = { sessionOpen: false, marked: 0 };
  await db.withExclusiveTransactionAsync(async (txn) => {
    const sessionOpen = (await txn.getFirstAsync(HAS_OPEN_SESSION_SQL)) !== null;
    const active = await txn.getAllAsync<DueCheck & { id: string }>(ACTIVE_LEASES_SQL);
    const due = active.filter((lease) => isLeaseDue(lease, nowMs, sessionOpen));
    for (const lease of due) await txn.runAsync(MARK_CLOSING_SQL, [lease.id]);
    result = { sessionOpen, marked: due.length };
  });
  return result;
}

export async function getClosing(): Promise<{ id: string; quota_reported: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync(CLOSING_SQL);
}

export async function markReleased(ids: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const id of ids) await txn.runAsync(MARK_RELEASED_SQL, [id]);
  });
}

export async function productsWithoutLease(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>(PRODUCTS_WITHOUT_LEASE_SQL);
  return rows.map((row) => row.id);
}

export async function saveLeases(leases: ServerLease[], receivedAtMs: number): Promise<void> {
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const lease of leases) {
      await txn.runAsync(SAVE_LEASE_SQL, [
        lease.id,
        lease.product_id,
        lease.quota_total,
        lease.quota_used,
        lease.issued_at,
        renewAt(lease.issued_at, lease.expires_at, receivedAtMs),
      ]);
    }
  });
}
