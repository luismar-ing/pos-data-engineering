// SPEC-009: fórmulas del panel y consultas de agregación (node:sqlite con las migraciones reales).
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/db/migrations.ts';
import {
  LEASE_AVAILABLE_SQL,
  SESSION_TOTALS_SQL,
  SESSION_UNITS_SQL,
  TARGET_SESSION_SQL,
  TOP_PRODUCTS_SQL,
  WINDOW_SALES_SQL,
} from '../src/features/analytics/data/analyticsSql.ts';
import { averageTicketCents, burnRate, buildRunout, TOP_LIMIT, windowMinutes } from '../src/features/analytics/domain/metrics.ts';

const MIN = 60_000;
const NOW = Date.parse('2026-11-03T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

function open() {
  const db = new DatabaseSync(':memory:');
  for (const sql of MIGRATIONS) db.exec(sql);
  db.exec(`insert into products (id, name, unit_price_cents) values ('agua', 'Agua', 1500), ('papas', 'Papas', 2500), ('cerveza', 'Cerveza', 4500)`);
  return db;
}

let saleSeq = 0;
function sell(db, sessionId, atMs, lines) {
  const id = `s${++saleSeq}`;
  const total = lines.reduce((sum, [, qty, price]) => sum + qty * price, 0);
  db.prepare(`insert into sales (id, device_id, total_cents, payment_method, created_at, session_id) values (?, 'd', ?, 'cash', ?, ?)`).run(id, total, iso(atMs), sessionId);
  for (const [productId, qty, price] of lines) {
    db.prepare(`insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values (?, ?, ?, ?, ?)`).run(`${id}-${productId}`, id, productId, qty, price);
  }
}

const openSession = (db, id, openedMs, closedMs = null) =>
  db.prepare(`insert into sessions (id, seller_name, opened_at, closed_at) values (?, 'Ana', ?, ?)`).run(id, iso(openedMs), closedMs === null ? null : iso(closedMs));

test('windowMinutes: desde la primera venta de la ventana, entre 1 y 10 min (P1)', () => {
  assert.equal(windowMinutes(NOW, NOW - 3 * MIN), 3);
  assert.equal(windowMinutes(NOW, NOW - 10 * MIN), 10);
  assert.equal(windowMinutes(NOW, NOW - 10_000), 1); // una venta de hace segundos no dispara el ritmo
  assert.equal(windowMinutes(NOW, null), 10); // sin ventas: el ritmo es 0 de todos modos
});

test('pico: 4 unidades en menos de 1 min ⇒ 4,0 u/min, aunque la sesión sea vieja (P1)', () => {
  assert.equal(burnRate(4, windowMinutes(NOW, NOW - 40_000)), 4);
});

test('Burn Rate y Runout Time (CA-1, CA-2)', () => {
  assert.equal(burnRate(10, 10), 1);
  const { items } = buildRunout([{ product_id: 'agua', name: 'Agua', units: 10 }], [{ product_id: 'agua', name: 'Agua', available: 20 }], 10);
  assert.deepEqual(items, [{ productId: 'agua', name: 'Agua', ratePerMin: 1, minutesLeft: 20, soldOut: false, low: false }]);
});

test('buildRunout: agotados primero, bajos resaltados, sin ventas solo contados (CA-3, CA-4, RF-6, P7)', () => {
  const window = [
    { product_id: 'agua', name: 'Agua', units: 10 }, // 1/min, 20 disponibles ⇒ 20 min
    { product_id: 'papas', name: 'Papas', units: 10 }, // 1/min, 3 disponibles ⇒ 3 min, bajo
    { product_id: 'hotdog', name: 'Hot dog', units: 2 }, // sin préstamo ⇒ agotado
  ];
  const leases = [
    { product_id: 'agua', name: 'Agua', available: 20 },
    { product_id: 'papas', name: 'Papas', available: 3 },
    { product_id: 'cerveza', name: 'Cerveza', available: 0 }, // préstamo agotado sin ventas recientes
    { product_id: 'refresco', name: 'Refresco', available: 5 }, // con cuota y sin ventas ⇒ solo se cuenta
  ];
  const { items, idle } = buildRunout(window, leases, 10);
  assert.deepEqual(items.map((i) => [i.name, i.soldOut, i.low]), [
    ['Cerveza', true, false],
    ['Hot dog', true, false],
    ['Papas', false, true],
    ['Agua', false, false],
  ]);
  assert.equal(idle, 1);
});

test('averageTicketCents redondea y da 0 sin ventas', () => {
  assert.equal(averageTicketCents(10_000, 3), 3333);
  assert.equal(averageTicketCents(0, 0), 0);
});

test('top y totales de la sesión (CA-5, RF-7, RF-8)', () => {
  const db = open();
  openSession(db, 'otra', NOW - 120 * MIN, NOW - 90 * MIN);
  openSession(db, 'ses', NOW - 60 * MIN);
  sell(db, 'ses', NOW - 5 * MIN, [['agua', 2, 1500], ['papas', 1, 2500]]);
  sell(db, 'ses', NOW - 4 * MIN, [['agua', 1, 1500]]);
  sell(db, 'otra', NOW - 3 * MIN, [['cerveza', 9, 4500]]); // otra sesión: no cuenta

  const top = db.prepare(TOP_PRODUCTS_SQL).all('ses', TOP_LIMIT).map((r) => ({ ...r }));
  assert.deepEqual(top, [
    { product_id: 'agua', name: 'Agua', units: 3, revenue_cents: 4500 },
    { product_id: 'papas', name: 'Papas', units: 1, revenue_cents: 2500 },
  ]);
  assert.deepEqual({ ...db.prepare(SESSION_TOTALS_SQL).get('ses') }, { sales: 2, revenue_cents: 7000 });
  assert.deepEqual({ ...db.prepare(SESSION_UNITS_SQL).get('ses') }, { units: 4 });
});

test('sesión objetivo: la abierta gana; si no, la última cerrada (RF-9, CA-8)', () => {
  const db = open();
  assert.equal(db.prepare(TARGET_SESSION_SQL).get(), undefined);
  openSession(db, 'vieja', NOW - 600 * MIN, NOW - 500 * MIN);
  openSession(db, 'reciente', NOW - 300 * MIN, NOW - 200 * MIN);
  assert.equal(db.prepare(TARGET_SESSION_SQL).get().id, 'reciente');
  openSession(db, 'abierta', NOW - 100 * MIN);
  assert.equal(db.prepare(TARGET_SESSION_SQL).get().id, 'abierta');
});

test('la ventana ignora ventas anteriores y lee lo disponible de los préstamos activos (RF-1, RF-3)', () => {
  const db = open();
  sell(db, null, NOW - 30 * MIN, [['agua', 5, 1500]]);
  sell(db, null, NOW - 2 * MIN, [['agua', 3, 1500]]);
  const rows = db.prepare(WINDOW_SALES_SQL).all(iso(NOW - 10 * MIN)).map((r) => ({ ...r }));
  assert.deepEqual(rows, [{ product_id: 'agua', name: 'Agua', units: 3, first_sale_at: iso(NOW - 2 * MIN) }]);

  db.exec(`insert into stock_leases (id, product_id, quota_total, quota_used, status, issued_at, renew_at)
           values ('l1', 'agua', 10, 4, 'active', 'x', 'x'), ('l2', 'papas', 5, 0, 'released', 'x', 'x')`);
  assert.deepEqual(db.prepare(LEASE_AVAILABLE_SQL).all().map((r) => ({ ...r })), [{ product_id: 'agua', name: 'Agua', available: 6 }]);
});

test('2 000 productos y 10 000 ventas: el panel completo en menos de 200 ms (referencia de CA-7)', () => {
  const db = new DatabaseSync(':memory:');
  for (const sql of MIGRATIONS) db.exec(sql);
  db.exec('begin');
  const product = db.prepare('insert into products (id, name, unit_price_cents) values (?, ?, 1000)');
  const lease = db.prepare(`insert into stock_leases (id, product_id, quota_total, quota_used, status, issued_at, renew_at) values (?, ?, 10, 0, 'active', 'x', 'x')`);
  for (let i = 0; i < 2000; i++) {
    product.run(`p${i}`, `Producto ${i}`);
    lease.run(`l${i}`, `p${i}`);
  }
  db.prepare(`insert into sessions (id, seller_name, opened_at) values ('ses', 'Ana', ?)`).run(iso(NOW - 24 * 60 * MIN));
  const sale = db.prepare(`insert into sales (id, device_id, total_cents, payment_method, created_at, session_id) values (?, 'd', 2000, 'cash', ?, 'ses')`);
  const item = db.prepare(`insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values (?, ?, ?, 2, 1000)`);
  for (let i = 0; i < 10_000; i++) {
    sale.run(`s${i}`, iso(NOW - i * 8_000)); // una venta cada 8 s hacia atrás (~22 h)
    item.run(`i${i}`, `s${i}`, `p${i % 2000}`);
  }
  db.exec('commit');

  const started = performance.now();
  db.prepare(TARGET_SESSION_SQL).get();
  db.prepare(WINDOW_SALES_SQL).all(iso(NOW - 10 * MIN));
  db.prepare(LEASE_AVAILABLE_SQL).all();
  db.prepare(SESSION_TOTALS_SQL).get('ses');
  db.prepare(SESSION_UNITS_SQL).get('ses');
  db.prepare(TOP_PRODUCTS_SQL).all('ses', TOP_LIMIT);
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 200, `tardó ${elapsed.toFixed(1)} ms`);
});
