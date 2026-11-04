// SPEC-008: bitácora para el sync (SQL con node:sqlite) y armado de lotes.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/db/migrations.ts';
import { fitBatch, toWireEvent } from '../src/core/sync/syncBatch.ts';
import { MARK_FAILED_SQL, MARK_SYNCED_SQL, PENDING_BATCH_SQL, SYNC_COUNTS_SQL } from '../src/core/sync/syncSql.ts';

function open() {
  const db = new DatabaseSync(':memory:');
  for (const sql of MIGRATIONS) db.exec(sql);
  const insert = db.prepare(
    `insert into event_log (id, event_type, entity_type, entity_id, payload_json, created_at) values (?, 'sale_created', 'sale', ?, ?, ?)`
  );
  // Insertados fuera de orden a propósito.
  insert.run('e3', 'e3', '{"n":3}', '2026-11-03T10:00:03Z');
  insert.run('e1', 'e1', '{"n":1}', '2026-11-03T10:00:01Z');
  insert.run('e2', 'e2', '{"n":2}', '2026-11-03T10:00:02Z');
  return db;
}

const pending = (db, limit = 50) => db.prepare(PENDING_BATCH_SQL).all(limit).map((r) => r.id);

test('extract: pendientes en orden de creación y con límite (RF-1)', () => {
  const db = open();
  assert.deepEqual(pending(db), ['e1', 'e2', 'e3']);
  assert.deepEqual(pending(db, 2), ['e1', 'e2']);
});

test('marcar synced y failed solo toca pendientes y no cambia el evento (RF-12, RF-13, RF-15)', () => {
  const db = open();
  db.prepare(MARK_SYNCED_SQL).run('2026-11-03T11:00:00Z', 'e1');
  db.prepare(MARK_FAILED_SQL).run('total_cents: no cuadra', 'e2');
  db.prepare(MARK_SYNCED_SQL).run('2026-11-03T12:00:00Z', 'e2'); // ya failed: no cambia
  assert.deepEqual(pending(db), ['e3']);

  const rows = db.prepare('select id, sync_status, synced_at, sync_error, payload_json from event_log order by id').all().map((r) => ({ ...r }));
  assert.deepEqual(rows, [
    { id: 'e1', sync_status: 'synced', synced_at: '2026-11-03T11:00:00Z', sync_error: null, payload_json: '{"n":1}' },
    { id: 'e2', sync_status: 'failed', synced_at: null, sync_error: 'total_cents: no cuadra', payload_json: '{"n":2}' },
    { id: 'e3', sync_status: 'pending', synced_at: null, sync_error: null, payload_json: '{"n":3}' },
  ]);
  const counts = Object.fromEntries(db.prepare(SYNC_COUNTS_SQL).all().map((r) => [r.sync_status, r.n]));
  assert.deepEqual(counts, { failed: 1, pending: 1, synced: 1 });
});

test('toWireEvent conserva el payload (RF-3)', () => {
  const payload = { sale: { id: 's1', total_cents: 3000 }, items: [{ quantity: 2 }] };
  const row = { id: 's1', event_type: 'sale_created', payload_json: JSON.stringify(payload), created_at: '2026-11-03T10:00:00Z' };
  assert.deepEqual(toWireEvent(row, 'dev-1'), {
    event_id: 's1',
    event_type: 'sale_created',
    device_id: 'dev-1',
    created_at: '2026-11-03T10:00:00Z',
    payload,
  });
});

test('fitBatch respeta el peso máximo y deja al menos uno (RNF-4)', () => {
  const event = (i, size) => ({ event_id: `e${i}`, event_type: 'x', device_id: 'd', created_at: 't', payload: 'x'.repeat(size) });
  const events = [event(1, 400), event(2, 400), event(3, 400)];
  const size = JSON.stringify(events[0]).length + 1;
  assert.equal(fitBatch(events, size * 2).length, 2);
  assert.equal(fitBatch(events, 10_000).length, 3);
  assert.equal(fitBatch([event(1, 5000)], 100).length, 1); // uno solo, aunque pese más
  assert.deepEqual(fitBatch([]), []);
});
