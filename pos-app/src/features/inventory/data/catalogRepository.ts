import type { SQLiteDatabase } from 'expo-sqlite';
import type { CatalogProduct } from '../domain/catalog';

// Sin imports de Expo en tiempo de ejecución: test/catalog.test.mjs prueba este SQL con node:sqlite.

/** Paso 1: todo inactivo. Lo que no venga en el catálogo queda así (RF-5); nunca se borra por las FK. */
export const DEACTIVATE_ALL_SQL = 'update products set active = 0 where active = 1';

/** Paso 2: alta o actualización; reactiva si había quedado inactivo (P3). */
export const UPSERT_PRODUCT_SQL = `
  insert into products (id, name, category, unit_price_cents, active, updated_at)
  values (?, ?, ?, ?, 1, ?)
  on conflict(id) do update set
    name = excluded.name,
    category = excluded.category,
    unit_price_cents = excluded.unit_price_cents,
    active = 1,
    updated_at = excluded.updated_at`;

export const SET_SYNCED_AT_SQL = `insert or replace into settings (key, value) values ('catalog_synced_at', ?)`;
export const GET_SYNCED_AT_SQL = `select value from settings where key = 'catalog_synced_at'`;

/** Reemplaza el catálogo local en una transacción: se aplica completo o no cambia nada (RF-3). */
export async function applyCatalog(db: SQLiteDatabase, products: CatalogProduct[], syncedAt: string): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(DEACTIVATE_ALL_SQL);
    const upsert = await txn.prepareAsync(UPSERT_PRODUCT_SQL);
    try {
      for (const p of products) {
        await upsert.executeAsync([p.id, p.name, p.category, p.unit_price_cents, syncedAt]);
      }
    } finally {
      await upsert.finalizeAsync();
    }
    await txn.runAsync(SET_SYNCED_AT_SQL, [syncedAt]);
  });
}

export async function getCatalogSyncedAt(db: SQLiteDatabase): Promise<string | null> {
  return (await db.getFirstAsync<{ value: string }>(GET_SYNCED_AT_SQL))?.value ?? null;
}
