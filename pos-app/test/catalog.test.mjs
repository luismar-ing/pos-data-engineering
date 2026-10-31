// SPEC-004: validación del catálogo y su reemplazo local, con el SQL real sobre node:sqlite.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/db/migrations.ts';
import { parseCatalog } from '../src/features/inventory/domain/catalog.ts';
import {
  DEACTIVATE_ALL_SQL,
  GET_SYNCED_AT_SQL,
  SET_SYNCED_AT_SQL,
  UPSERT_PRODUCT_SQL,
} from '../src/features/inventory/data/catalogRepository.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const product = (id, name, price, category = 'Bebidas') => ({ id, name, category, unit_price_cents: price });

// --- parseCatalog (RF-7, CA-6) ---

test('parseCatalog acepta la forma del servidor e ignora campos extra', () => {
  const json = [{ ...product(A, ' Agua ', 1500), active: true, extra: 1 }, product(B, 'Papas', 0, null)];
  assert.deepEqual(parseCatalog(json), [product(A, 'Agua', 1500), product(B, 'Papas', 0, null)]);
  assert.deepEqual(parseCatalog([]), []);
});

test('parseCatalog rechaza la descarga entera si un producto es inválido', () => {
  const ok = product(A, 'Agua', 1500);
  const cases = {
    'no es arreglo': { products: [ok] },
    'precio negativo': [ok, product(B, 'Papas', -1)],
    'precio decimal': [ok, product(B, 'Papas', 10.5)],
    'precio como texto': [ok, { ...product(B, 'Papas', 0), unit_price_cents: '100' }],
    'nombre vacío': [ok, product(B, '  ', 100)],
    'id no UUID': [ok, product('abc', 'Papas', 100)],
    'id repetido': [ok, product(A, 'Otra agua', 100)],
    'categoría numérica': [ok, { ...product(B, 'Papas', 100), category: 3 }],
    'elemento nulo': [ok, null],
  };
  for (const [name, json] of Object.entries(cases)) {
    assert.throws(() => parseCatalog(json), Error, name);
  }
});

// --- Reemplazo local (RF-3..RF-6) ---

function openDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of MIGRATIONS) db.exec(sql);
  return db;
}

// Mismo orden que applyCatalog(), con node:sqlite (síncrono) en vez de expo-sqlite.
function apply(db, products, syncedAt) {
  db.exec('begin');
  try {
    db.prepare(DEACTIVATE_ALL_SQL).run();
    const upsert = db.prepare(UPSERT_PRODUCT_SQL);
    for (const p of products) upsert.run(p.id, p.name, p.category, p.unit_price_cents, syncedAt);
    db.prepare(SET_SYNCED_AT_SQL).run(syncedAt);
    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

const rows = (db) =>
  db.prepare('select id, name, unit_price_cents as price, active from products order by id').all().map((r) => ({ ...r }));

test('alta, cambio de precio, baja y reactivación; la venta previa conserva su precio', () => {
  const db = openDb();
  apply(db, [product(A, 'Agua', 1500), product(B, 'Papas', 2500)], 't1');

  // Venta con el precio viejo de A.
  db.exec(`insert into sales (id, device_id, total_cents, payment_method) values ('s1', 'd1', 1500, 'cash')`);
  db.exec(`insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values ('i1', 's1', '${A}', 1, 1500)`);

  // A cambia de precio, B se da de baja, C es nuevo.
  apply(db, [product(A, 'Agua', 1800), product(C, 'Cerveza', 4500)], 't2');
  assert.deepEqual(rows(db), [
    { id: A, name: 'Agua', price: 1800, active: 1 },
    { id: B, name: 'Papas', price: 2500, active: 0 },
    { id: C, name: 'Cerveza', price: 4500, active: 1 },
  ]);
  assert.equal(db.prepare('select unit_price_cents as p from sale_items').get().p, 1500);
  assert.equal(db.prepare(GET_SYNCED_AT_SQL).get().value, 't2');

  // B vuelve: se reactiva con datos nuevos (P3).
  apply(db, [product(A, 'Agua', 1800), product(B, 'Papas grandes', 3000), product(C, 'Cerveza', 4500)], 't3');
  assert.deepEqual(rows(db)[1], { id: B, name: 'Papas grandes', price: 3000, active: 1 });
});

test('si falla a mitad, no cambia nada (rollback)', () => {
  const db = openDb();
  apply(db, [product(A, 'Agua', 1500)], 't1');
  const before = rows(db);

  // El CHECK de la tabla rechaza el segundo producto (parseCatalog ya lo filtraría; aquí se prueba la transacción).
  assert.throws(() => apply(db, [product(B, 'Papas', 2500), product(C, 'Cerveza', -1)], 't2'), /CHECK constraint failed/);
  assert.deepEqual(rows(db), before);
  assert.equal(db.prepare(GET_SYNCED_AT_SQL).get().value, 't1');
});

test('aplicar el mismo catálogo dos veces deja el mismo estado', () => {
  const db = openDb();
  const catalog = [product(A, 'Agua', 1500), product(B, 'Papas', 2500)];
  apply(db, catalog, 't1');
  const first = rows(db);
  apply(db, catalog, 't1');
  assert.deepEqual(rows(db), first);
});
