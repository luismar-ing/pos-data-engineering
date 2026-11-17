// SPEC-005: préstamos locales (SQL con node:sqlite) y reglas de renovación.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/db/migrations.ts';
import {
  AVAILABLE_SQL,
  CLOSING_SQL,
  CONSUME_QUOTA_SQL,
  MARK_CLOSING_SQL,
  MARK_RELEASED_SQL,
  PRODUCTS_WITHOUT_LEASE_SQL,
  SAVE_LEASE_SQL,
} from '../src/features/leases/data/leaseSql.ts';
import { capFrom, chunk, isLeaseDue, OFFLINE_CAP_MINUTES, renewAt } from '../src/features/leases/domain/leasePolicy.ts';

function open() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const sql of MIGRATIONS) db.exec(sql);
  db.exec(`insert into products (id, name, unit_price_cents) values ('agua', 'Agua', 1500), ('papas', 'Papas', 2500)`);
  return db;
}

const save = (db, id, productId, total, used = 0) =>
  db.prepare(SAVE_LEASE_SQL).run(id, productId, total, used, '2026-11-03T12:00:00Z', '2026-11-03T12:03:00Z');
// Sin tope por defecto: las fijas son de 2026-11-03; las pruebas del tope pasan su propio `cap`.
const OPEN_CAP = '2000-01-01T00:00:00.000Z';
const available = (db, cap = OPEN_CAP) => Object.fromEntries(db.prepare(AVAILABLE_SQL).all(cap).map((r) => [r.product_id, r.available]));
const consume = (db, productId, qty, cap = OPEN_CAP) => (db.prepare(CONSUME_QUOTA_SQL).get(qty, productId, qty, cap) ? 1 : 0);

test('cobrar descuenta cuota y nunca pasa del total (RF-7, CA-3, CA-4)', () => {
  const db = open();
  save(db, 'l1', 'agua', 5);
  assert.equal(consume(db, 'agua', 3), 1);
  assert.deepEqual(available(db), { agua: 2 });
  assert.equal(consume(db, 'agua', 3), 0); // no alcanza: no cambia nada
  assert.deepEqual(available(db), { agua: 2 });
  assert.equal(consume(db, 'agua', 2), 1);
  assert.deepEqual(available(db), { agua: 0 });
  assert.equal(consume(db, 'papas', 1), 0); // sin préstamo
});

test('closing no vende y guarda lo informado; released no cuenta (RF-12)', () => {
  const db = open();
  save(db, 'l1', 'agua', 5, 2);
  db.prepare(MARK_CLOSING_SQL).run('l1');
  assert.equal(consume(db, 'agua', 1), 0);
  assert.deepEqual(available(db), {});
  assert.deepEqual({ ...db.prepare(CLOSING_SQL).get() }, { id: 'l1', quota_reported: 2 });
  db.prepare(MARK_RELEASED_SQL).run('l1');
  assert.equal(db.prepare(CLOSING_SQL).all().length, 0);
});

test('un solo préstamo activo por producto; guardar dos veces el mismo no lo pisa (RF-5, RF-6)', () => {
  const db = open();
  save(db, 'l1', 'agua', 5);
  consume(db, 'agua', 4);
  save(db, 'l1', 'agua', 5, 0); // el servidor lo devuelve otra vez con quota_used 0
  assert.deepEqual(available(db), { agua: 1 });
  save(db, 'l2', 'agua', 8); // otro activo del mismo producto: se ignora
  assert.deepEqual(available(db), { agua: 1 });
});

test('productos sin préstamo: activos y sin préstamo activo ni en cierre (P1)', () => {
  const db = open();
  assert.deepEqual(db.prepare(PRODUCTS_WITHOUT_LEASE_SQL).all().map((r) => r.id), ['agua', 'papas']);
  save(db, 'l1', 'agua', 5);
  db.exec(`update products set active = 0 where id = 'papas'`);
  assert.deepEqual(db.prepare(PRODUCTS_WITHOUT_LEASE_SQL).all(), []);
  db.prepare(MARK_CLOSING_SQL).run('l1');
  assert.deepEqual(db.prepare(PRODUCTS_WITHOUT_LEASE_SQL).all(), []);
  db.prepare(MARK_RELEASED_SQL).run('l1');
  assert.deepEqual(db.prepare(PRODUCTS_WITHOUT_LEASE_SQL).all().map((r) => r.id), ['agua']);
});

test('isLeaseDue: vencido, poca cuota o sin sesión (RF-10, RF-13)', () => {
  const now = Date.parse('2026-11-03T12:01:00Z');
  const lease = { quota_total: 10, quota_used: 0, renew_at: '2026-11-03T12:03:00Z' };
  assert.equal(isLeaseDue(lease, now, true), false);
  assert.equal(isLeaseDue(lease, Date.parse('2026-11-03T12:03:00Z'), true), true);
  assert.equal(isLeaseDue({ ...lease, quota_used: 8 }, now, true), false); // queda 20 %
  assert.equal(isLeaseDue({ ...lease, quota_used: 9 }, now, true), true); // queda 10 %
  assert.equal(isLeaseDue(lease, now, false), true);
});

test('renewAt usa la duración del servidor sobre la hora local de recepción', () => {
  const received = Date.parse('2026-11-03T08:00:00Z'); // reloj del teléfono 4 h atrasado
  assert.equal(renewAt('2026-11-03T12:00:00Z', '2026-11-03T12:03:00Z', received), '2026-11-03T08:03:00.000Z');
});

test('chunk parte en grupos de 200', () => {
  const ids = Array.from({ length: 450 }, (_, i) => i);
  assert.deepEqual(chunk(ids).map((part) => part.length), [200, 200, 50]);
  assert.deepEqual(chunk([]), []);
});

// SPEC-014 RF-4 (ADR-0008): tope sin red.
test('tope sin red: 31 min después de renew_at no vende ni descuenta; 29 min después, sí (CA-3b)', () => {
  const renew = Date.parse('2026-11-03T12:03:00.000Z');
  const db = open();
  db.prepare(SAVE_LEASE_SQL).run('l1', 'agua', 5, 0, '2026-11-03T12:00:00Z', new Date(renew).toISOString());
  assert.equal(OFFLINE_CAP_MINUTES, 30);

  const at29 = capFrom(renew + 29 * 60_000);
  assert.deepEqual(available(db, at29), { agua: 5 });
  assert.deepEqual({ ...db.prepare(CONSUME_QUOTA_SQL).get(1, 'agua', 1, at29) }, { id: 'l1' }); // devuelve el préstamo de la línea

  const at31 = capFrom(renew + 31 * 60_000);
  assert.deepEqual(available(db, at31), {});
  assert.equal(consume(db, 'agua', 1, at31), 0);
  assert.deepEqual(available(db), { agua: 4 }); // no se descontó nada al rechazar
});

test('renewAt cuenta desde el inicio de la petición: la demora de la red no alarga el plazo (ADR-0008)', () => {
  const requestedAt = Date.parse('2026-11-03T12:00:00.000Z');
  // El servidor emitió 40 s después de que el teléfono pidió; la duración (3 min) es lo único que se usa.
  assert.equal(renewAt('2026-11-03T12:00:40Z', '2026-11-03T12:03:40Z', requestedAt), '2026-11-03T12:03:00.000Z');
});
