import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, beforeEach, test } from 'node:test';
import { calculateLeaseQty } from '../src/services/rollingAverage.js';
import { pool, resetDb } from './helpers.js';

const WATER = '11111111-1111-4111-8111-111111111111'; // central_stock 200
const HOT_DOG = '55555555-5555-4555-8555-555555555555'; // central_stock 60

beforeEach(resetDb);
after(() => pool.end());

async function sell(productId: string, quantity: number, minutesAgo = 1) {
    const id = randomUUID();
    await pool.query(
        `insert into sales (id, device_id, total_cents, payment_method, created_at)
         values ($1, 'dev-local-1', 0, 'cash', now() - ($2 * interval '1 minute'))`,
        [id, minutesAgo]
    );
    await pool.query(
        `insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values ($1, $2, $3, $4, 0)`,
        [randomUUID(), id, productId, quantity]
    );
}

test('sin ventas recientes → mínimo 5', async () => {
    assert.equal(await calculateLeaseQty(WATER), 5);
});

test('ventas de los últimos 5 min → ceil(u/5 · 3 · 1.2)', async () => {
    await sell(WATER, 50);
    assert.equal(await calculateLeaseQty(WATER), 36);
});

test('ventas de hace más de 5 min no cuentan', async () => {
    await sell(WATER, 50, 10);
    assert.equal(await calculateLeaseQty(WATER), 5);
});

test('nunca supera el stock central', async () => {
    await sell(HOT_DOG, 100);
    assert.equal(await calculateLeaseQty(HOT_DOG), 60);
});

test('stock central 0 → 0', async () => {
    await pool.query('update products set central_stock = 0 where id = $1', [WATER]);
    assert.equal(await calculateLeaseQty(WATER), 0);
});

test('producto inexistente → 0', async () => {
    assert.equal(await calculateLeaseQty(randomUUID()), 0);
});
