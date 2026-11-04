// SPEC-007: carrito, búsqueda y dinero.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_QUANTITY,
  addProduct,
  changeQuantity,
  matchesSearch,
  priceCart,
  removeLine,
} from '../src/features/sales/domain/cart.ts';
import { computeChangeCents, formatCents, parseMoneyToCents } from '../src/shared/utils/money.ts';

test('agregar suma 1 si ya está (CA-1, TD-016)', () => {
  let cart = addProduct([], 'agua');
  cart = addProduct(cart, 'agua');
  cart = addProduct(cart, 'papas');
  assert.deepEqual(cart, [
    { productId: 'agua', quantity: 2 },
    { productId: 'papas', quantity: 1 },
  ]);
});

test('bajar de 1 quita la línea; no pasa del máximo; quitar (CA-2)', () => {
  const cart = [{ productId: 'agua', quantity: 2 }, { productId: 'papas', quantity: 1 }];
  assert.deepEqual(changeQuantity(cart, 'papas', -1), [{ productId: 'agua', quantity: 2 }]);
  assert.deepEqual(changeQuantity(cart, 'agua', 5000), [
    { productId: 'agua', quantity: MAX_QUANTITY },
    { productId: 'papas', quantity: 1 },
  ]);
  assert.deepEqual(addProduct([{ productId: 'agua', quantity: MAX_QUANTITY }], 'agua'), [
    { productId: 'agua', quantity: MAX_QUANTITY },
  ]);
  assert.deepEqual(changeQuantity([], 'agua', -1), []);
  assert.deepEqual(removeLine(cart, 'agua'), [{ productId: 'papas', quantity: 1 }]);
});

test('tope por lo disponible en el préstamo (SPEC-005 RF-8, CA-3)', () => {
  assert.deepEqual(addProduct([], 'agua', 0), []); // agotado: no se agrega
  let cart = addProduct([], 'agua', 2);
  cart = addProduct(cart, 'agua', 2);
  cart = addProduct(cart, 'agua', 2);
  assert.deepEqual(cart, [{ productId: 'agua', quantity: 2 }]);
  assert.deepEqual(changeQuantity(cart, 'agua', 5, 3), [{ productId: 'agua', quantity: 3 }]);
  // la cuota bajó a 1 tras renovar: + no la recorta, − sí baja
  assert.deepEqual(changeQuantity(cart, 'agua', 1, 1), cart);
  assert.deepEqual(changeQuantity(cart, 'agua', -1, 1), [{ productId: 'agua', quantity: 1 }]);
});

test('priceCart: subtotales, total entero y productos no disponibles fuera del total (CA-1, CA-7)', () => {
  const products = new Map([
    ['agua', { name: 'Agua', unit_price_cents: 1500 }],
    ['papas', { name: 'Papas', unit_price_cents: 2500 }],
  ]);
  const cart = [
    { productId: 'agua', quantity: 2 },
    { productId: 'papas', quantity: 1 },
    { productId: 'baja', quantity: 3 },
  ];
  const priced = priceCart(cart, products);
  assert.equal(priced.totalCents, 5500);
  assert.deepEqual(priced.lines.map((l) => [l.name, l.subtotalCents]), [['Agua', 3000], ['Papas', 2500]]);
  assert.deepEqual(priced.unavailable, [{ productId: 'baja', quantity: 3 }]);
});

test('búsqueda sin mayúsculas ni acentos (CA-3)', () => {
  assert.ok(matchesSearch('Cerveza 355 ml', 'cer'));
  assert.ok(matchesSearch('Cerveza 355 ml', 'CER'));
  assert.ok(matchesSearch('Café americano', 'cafe'));
  assert.ok(matchesSearch('Cafe americano', 'café'));
  assert.ok(matchesSearch('Agua', '  '));
  assert.ok(!matchesSearch('Agua 600 ml', 'cer'));
});

test('dinero: leer montos, formato y cambio (CA-6)', () => {
  assert.equal(parseMoneyToCents('100'), 10000);
  assert.equal(parseMoneyToCents(' 100.5 '), 10050);
  assert.equal(parseMoneyToCents('100,50'), 10050);
  assert.equal(parseMoneyToCents('0.07'), 7);
  for (const bad of ['', 'abc', '-1', '1.234', '1e3', '12345678']) assert.equal(parseMoneyToCents(bad), null, bad);
  assert.equal(computeChangeCents(6700, 10000), 3300);
  assert.ok(computeChangeCents(6700, 5000) < 0);
  assert.equal(formatCents(3300), '$33.00');
});
