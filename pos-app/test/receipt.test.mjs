// SPEC-010: texto del recibo QR.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { MIGRATIONS } from '../src/core/db/migrations.ts';
import { RECEIPT_ITEMS_SQL, RECEIPT_SALE_SQL } from '../src/features/sales/data/receiptSql.ts';
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_NAME_MAX,
  buildReceiptText,
  formatReceiptDate,
  truncateName,
  utf8Bytes,
} from '../src/features/sales/domain/receipt.ts';

const SALE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
// Hora local: el recibo la muestra así, sin importar la zona de la máquina.
const CREATED_AT = new Date(2026, 10, 5, 14, 32).toISOString();

const data = (overrides = {}) => ({
  deviceName: 'Caja 3',
  sellerName: 'Ana',
  saleId: SALE_ID,
  createdAt: CREATED_AT,
  totalCents: 5500,
  paymentMethod: 'cash',
  lines: [
    { name: 'Agua', quantity: 2, unitPriceCents: 1500 },
    { name: 'Papas', quantity: 1, unitPriceCents: 2500 },
  ],
  ...overrides,
});

test('CA-1: encabezado, fecha, ids, vendedor, líneas, total y método, en ese orden', () => {
  assert.equal(
    buildReceiptText(data()),
    [
      'POS-DE · Caja 3',
      '05/11/2026 14:32',
      'Venta 1a2b3c4d',
      SALE_ID,
      'Vendedor: Ana',
      '------------------------',
      '2 x Agua $30.00',
      '1 x Papas $25.00',
      '------------------------',
      'TOTAL $55.00',
      'Efectivo',
    ].join('\n')
  );
});

test('CA-2: subtotales de los centavos guardados y total de la venta', () => {
  const text = buildReceiptText(data({ totalCents: 4199, lines: [{ name: 'Café', quantity: 3, unitPriceCents: 1399 }] }));
  assert.match(text, /^3 x Café \$41\.97$/m);
  assert.match(text, /^TOTAL \$41\.99$/m); // el total es el guardado, no se recalcula
});

test('método de pago: etiqueta conocida o el valor tal cual', () => {
  assert.match(buildReceiptText(data({ paymentMethod: 'transfer' })), /\nTransferencia$/);
  assert.match(buildReceiptText(data({ paymentMethod: 'cripto' })), /\ncripto$/);
});

test('venta sin sesión: vendedor "—"', () => {
  assert.match(buildReceiptText(data({ sellerName: null })), /^Vendedor: —$/m);
});

test('CA-3: con muchas líneas corta con "… y N productos más" por la suma exacta', () => {
  const lines = Array.from({ length: 200 }, (_, i) => ({ name: `Producto ${i + 1}`, quantity: (i % 3) + 1, unitPriceCents: 1000 + i }));
  const totalCents = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
  const text = buildReceiptText(data({ lines, totalCents }));

  assert.ok(utf8Bytes(text) <= RECEIPT_MAX_BYTES, `${utf8Bytes(text)} bytes`);
  const body = text.split('\n').slice(6, -3);
  const shown = body.slice(0, -1);
  const more = /^… y (\d+) productos más \$(\d+)\.(\d{2})$/.exec(body.at(-1));
  assert.ok(more, body.at(-1));
  assert.ok(shown.length >= 20, `solo ${shown.length} líneas`);
  assert.equal(Number(more[1]), 200 - shown.length);
  const restCents = lines.slice(shown.length).reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
  assert.equal(Number(more[2]) * 100 + Number(more[3]), restCents);
  assert.equal(shown[0], '1 x Producto 1 $10.00'); // en el orden del carrito
  assert.match(text, new RegExp(`TOTAL \\$${(totalCents / 100).toFixed(2).replace('.', '\\.')}\n`));
});

test('CA-3: si falta una sola línea dice "1 producto más"', () => {
  // Solo pasa si la línea que falta ocupa más que "… y 1 producto más": la última es larga.
  // Busca la cantidad de líneas en la que justo esa queda fuera.
  const last = { name: 'Combo familiar con refresco grande', quantity: 999, unitPriceCents: 999_999 };
  for (let n = 1; n < 100; n++) {
    const short = Array.from({ length: n }, (_, i) => ({ name: `P${i + 1}`, quantity: 1, unitPriceCents: 100 }));
    const text = buildReceiptText(data({ lines: [...short, last] }));
    if (text.includes('… y 1 producto más')) {
      assert.match(text, /^… y 1 producto más \$9989990\.01$/m);
      assert.ok(utf8Bytes(text) <= RECEIPT_MAX_BYTES);
      return;
    }
  }
  assert.fail('nunca quedó fuera una sola línea');
});

test('CA-4: nombres largos se recortan a 24 con "…" sin partir caracteres', () => {
  assert.equal(truncateName('Agua'), 'Agua');
  assert.equal(truncateName('a'.repeat(RECEIPT_NAME_MAX)), 'a'.repeat(RECEIPT_NAME_MAX));
  const cut = truncateName('Jugo de piña con limón y menta extra grande');
  assert.equal(Array.from(cut).length, RECEIPT_NAME_MAX);
  assert.equal(cut, 'Jugo de piña con limón …');
  const emoji = truncateName('🍺'.repeat(30));
  assert.equal(emoji, `${'🍺'.repeat(RECEIPT_NAME_MAX - 1)}…`);
  assert.equal(truncateName('  Hot\n dog  '), 'Hot dog'); // un salto de línea no rompe el recibo
});

test('CA-4, CA-5: el recibo nunca pasa del máximo, aun con tildes, ñ y emoji', () => {
  for (const name of ['Ñandú añejo con jalapeño', '🍔🍟🌭🍕🥤🍺🍷🍸🍹🍾🧃🧉🍔🍟🌭🍕🥤🍺🍷🍸🍹🍾🧃🧉🍔', 'x']) {
    for (const count of [1, 10, 30, 80, 999]) {
      const lines = Array.from({ length: count }, () => ({ name, quantity: 999, unitPriceCents: 999_999 }));
      const text = buildReceiptText(data({ lines, deviceName: '🍺'.repeat(40), sellerName: 'Ñ'.repeat(40), totalCents: 999_999_999 }));
      assert.ok(utf8Bytes(text) <= RECEIPT_MAX_BYTES, `${name} × ${count}: ${utf8Bytes(text)} bytes`);
    }
  }
});

test('fecha en dd/mm/aaaa hh:mm local', () => {
  assert.equal(formatReceiptDate(new Date(2026, 0, 2, 3, 4).toISOString()), '02/01/2026 03:04');
});

function open() {
  const db = new DatabaseSync(':memory:');
  for (const sql of MIGRATIONS) db.exec(sql);
  db.exec(`
    insert into products (id, name, unit_price_cents) values ('agua', 'Agua', 1500), ('papas', 'Papas', 2500), ('cafe', 'Café', 3000);
    insert into sessions (id, seller_name, opened_at) values ('ses1', 'Ana', '2026-11-05T14:00:00.000Z');
    insert into sales (id, device_id, total_cents, payment_method, created_at, session_id)
      values ('v1', 'dev', 7000, 'card', '2026-11-05T14:32:00.000Z', 'ses1'),
             ('v0', 'dev', 1500, 'cash', '2026-10-30T10:00:00.000Z', null);
    -- Orden del carrito: papas, agua, café (no alfabético ni por id).
    insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values
      ('z', 'v1', 'papas', 1, 2500), ('a', 'v1', 'agua', 2, 1500), ('m', 'v1', 'cafe', 1, 1000),
      ('i0', 'v0', 'agua', 1, 1500);
  `);
  return db;
}

test('CA-1: la venta trae el vendedor de su sesión; una venta sin sesión, nulo', () => {
  const db = open();
  assert.deepEqual({ ...db.prepare(RECEIPT_SALE_SQL).get('v1') }, {
    id: 'v1',
    total_cents: 7000,
    payment_method: 'card',
    created_at: '2026-11-05T14:32:00.000Z',
    seller_name: 'Ana',
  });
  assert.equal(db.prepare(RECEIPT_SALE_SQL).get('v0').seller_name, null);
  assert.equal(db.prepare(RECEIPT_SALE_SQL).get('nada'), undefined);
});

test('CA-1, CA-2: líneas en el orden del carrito, con nombre y el precio guardado', () => {
  const db = open();
  db.exec(`update products set unit_price_cents = 9900, name = 'Café grande' where id = 'cafe'`); // el catálogo cambia después
  const items = db.prepare(RECEIPT_ITEMS_SQL).all('v1').map((row) => ({ ...row }));
  assert.deepEqual(items, [
    { quantity: 1, unit_price_cents: 2500, name: 'Papas' },
    { quantity: 2, unit_price_cents: 1500, name: 'Agua' },
    { quantity: 1, unit_price_cents: 1000, name: 'Café grande' },
  ]);
});

test('CA-6: leer el recibo no escribe en la bitácora', () => {
  const db = open();
  const count = () => db.prepare('select count(*) as n from event_log').get().n;
  const before = count();
  db.prepare(RECEIPT_SALE_SQL).get('v1');
  db.prepare(RECEIPT_ITEMS_SQL).all('v1');
  assert.equal(count(), before);
});
