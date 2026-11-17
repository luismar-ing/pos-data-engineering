// Prueba el SQL de las migraciones con node:sqlite (Node ≥ 24 importa .ts quitando los tipos).
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/db/migrations.ts';

function open(upTo = MIGRATIONS.length) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of MIGRATIONS.slice(0, upTo)) db.exec(sql);
  return db;
}

test('v1 → v2 conserva una venta previa, sin sesión (P6)', () => {
  const db = open(1);
  db.exec(`insert into sales (id, device_id, total_cents, payment_method) values ('s1', 'd1', 100, 'cash')`);
  for (const sql of MIGRATIONS.slice(1)) db.exec(sql);
  assert.deepEqual({ ...db.prepare('select id, session_id from sales').get() }, { id: 's1', session_id: null });
});

test('una sola sesión abierta (RF-9); tras cerrarla se puede abrir otra', () => {
  const db = open();
  const openSession = (id) =>
    db.prepare(`insert into sessions (id, seller_name, opened_at) values (?, 'Ana', '2026-10-30T10:00:00Z')`).run(id);

  openSession('a');
  assert.throws(() => openSession('b'), /UNIQUE constraint failed/);

  db.exec(`update sessions set closed_at = '2026-10-30T18:00:00Z' where id = 'a'`);
  openSession('b');
  assert.equal(db.prepare('select count(*) as n from sessions where closed_at is null').get().n, 1);
});

test('el vendedor no puede ser vacío', () => {
  const db = open();
  assert.throws(
    () => db.exec(`insert into sessions (id, seller_name, opened_at) values ('a', '  ', '2026-10-30T10:00:00Z')`),
    /CHECK constraint failed/
  );
});

test('sales.session_id debe existir en sessions', () => {
  const db = open();
  assert.throws(
    () => db.exec(`insert into sales (id, device_id, total_cents, payment_method, session_id) values ('s1', 'd1', 0, 'cash', 'no-existe')`),
    /FOREIGN KEY constraint failed/
  );
});

test('v5 → v6: las líneas anteriores quedan sin préstamo y las nuevas lo guardan (SPEC-014 RF-8, RF-9)', () => {
  const db = open(5);
  db.exec(`insert into products (id, name, unit_price_cents) values ('agua', 'Agua', 1500)`);
  db.exec(`insert into sales (id, device_id, total_cents, payment_method, created_at) values ('s1', 'd', 1500, 'cash', '2026-11-17T10:00:00Z')`);
  db.exec(`insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values ('i1', 's1', 'agua', 1, 1500)`);
  db.exec(MIGRATIONS[5]);
  db.exec(`insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents, lease_id) values ('i2', 's1', 'agua', 1, 1500, 'l1')`);
  const rows = db.prepare('select id, lease_id from sale_items order by id').all().map((r) => ({ ...r }));
  assert.deepEqual(rows, [{ id: 'i1', lease_id: null }, { id: 'i2', lease_id: 'l1' }]);
});
