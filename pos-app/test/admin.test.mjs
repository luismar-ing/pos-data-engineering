// SPEC-013 T10: reglas puras del rol y de la sesión de administrador.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canSwitchRole, isRole } from '../src/features/admin/domain/role.ts';
import { isSessionValid, parseAdminSession, todayRange } from '../src/features/admin/domain/session.ts';

const NOW = Date.parse('2026-11-13T15:30:00.000Z');
const session = (expires_at) => ({ token: 'a'.repeat(64), username: 'admin', expires_at });

test('isRole: solo seller y admin', () => {
  assert.equal(isRole('seller'), true);
  assert.equal(isRole('admin'), true);
  for (const value of [null, undefined, '', 'Admin', 'vendedor']) assert.equal(isRole(value), false, String(value));
});

test('canSwitchRole: no con sesión de vendedor abierta (RF-4, CA-3)', () => {
  assert.equal(canSwitchRole(true), false);
  assert.equal(canSwitchRole(false), true);
});

test('isSessionValid: antes, justo y después de vencer (RF-8, CA-7)', () => {
  assert.equal(isSessionValid(session(new Date(NOW + 1).toISOString()), NOW), true);
  assert.equal(isSessionValid(session(new Date(NOW).toISOString()), NOW), false);
  assert.equal(isSessionValid(session(new Date(NOW - 1).toISOString()), NOW), false);
  assert.equal(isSessionValid(session('no es fecha'), NOW), false);
  assert.equal(isSessionValid(null, NOW), false);
});

test('parseAdminSession: JSON válido o nada', () => {
  const ok = session('2026-11-13T23:30:00.000Z');
  assert.deepEqual(parseAdminSession(JSON.stringify({ ...ok, extra: 1 })), ok);
  for (const raw of [null, '', '{', 'null', '[]', '"texto"', JSON.stringify({ ...ok, token: 1 }), JSON.stringify({ username: 'admin' })]) {
    assert.equal(parseAdminSession(raw), null, String(raw));
  }
});

test('todayRange: desde la medianoche local hasta ahora (RF-10)', () => {
  const { from, to } = todayRange(NOW);
  assert.equal(to, new Date(NOW).toISOString());
  const start = new Date(from);
  assert.deepEqual([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()], [0, 0, 0, 0]);
  assert.equal(start.toDateString(), new Date(NOW).toDateString());
});

// SPEC-014: formulario de producto y ajuste de stock.
import { parseProductForm, parseStockDelta } from '../src/features/admin/domain/productForm.ts';

test('formulario de producto: valores limpios o el primer error (RF-13, RF-14)', () => {
  assert.deepEqual(parseProductForm({ name: ' Elote ', category: ' ', price: '30,5', initialStock: '12' }), {
    name: 'Elote', category: null, unit_price_cents: 3050, initial_stock: 12,
  });
  assert.deepEqual(parseProductForm({ name: 'Elote', category: 'Comida', price: '30' }), { name: 'Elote', category: 'Comida', unit_price_cents: 3000 });
  assert.match(parseProductForm({ name: '  ', category: '', price: '1' }).error, /nombre/);
  assert.match(parseProductForm({ name: 'A', category: '', price: '1.234' }).error, /Precio/);
  assert.match(parseProductForm({ name: 'A', category: '', price: '1', initialStock: '-1' }).error, /Stock inicial/);
  assert.match(parseProductForm({ name: 'A', category: '', price: '1', initialStock: '' }).error, /Stock inicial/);
});

test('ajuste de stock: entero con signo, distinto de 0 (RF-15)', () => {
  assert.equal(parseStockDelta('+20'), 20);
  assert.equal(parseStockDelta('-5'), -5);
  assert.equal(parseStockDelta(' 7 '), 7);
  for (const bad of ['0', '', '1.5', 'abc', '--2', '99999999']) assert.equal(parseStockDelta(bad), null, bad);
});
