import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { pool, postJson, resetDb, startServer } from './helpers.js';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { await resetDb(); server = await startServer(); });
after(async () => { await server.close(); await pool.end(); });

function saleEvent(id = randomUUID()) {
    const created_at = new Date().toISOString();
    return {
        event_id: id,
        event_type: 'sale_created',
        device_id: 'dev-local-1',
        created_at,
        payload: {
            sale: { id, device_id: 'dev-local-1', total_cents: 3000, payment_method: 'cash', created_at },
            items: [{ id: randomUUID(), sale_id: id, product_id: '11111111-1111-4111-8111-111111111111', quantity: 2, unit_price_cents: 1500 }],
        },
    };
}

test('el mismo lote dos veces: la segunda vez todo es duplicado (CA-9)', async () => {
    const batch = { events: [saleEvent(), saleEvent()] };
    const first = await postJson(`${server.url}/sync/events`, batch);
    assert.deepEqual(await first.json(), { received: 2, inserted: 2, duplicated: 0 });
    const second = await postJson(`${server.url}/sync/events`, batch);
    assert.deepEqual(await second.json(), { received: 2, inserted: 0, duplicated: 2 });

    const { rows } = await pool.query('select count(*)::int as n from sale_items');
    assert.equal(rows[0].n, 2);
});

test('evento con sale.id distinto de event_id → 400 y no toca la BD', async () => {
    const event = saleEvent();
    event.payload.sale.id = randomUUID();
    const before = await pool.query('select count(*)::int as n from sales');

    const res = await postJson(`${server.url}/sync/events`, { events: [event] });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');

    const afterCount = await pool.query('select count(*)::int as n from sales');
    assert.equal(afterCount.rows[0].n, before.rows[0].n);
});

for (const event of [{ event_id: 'x' }, { event_id: 'x', event_type: 'sale_created', payload: {} }]) {
    test(`evento incompleto ${JSON.stringify(event)} → 400, no 500`, async () => {
        const res = await postJson(`${server.url}/sync/events`, { events: [event] });
        assert.equal(res.status, 400);
    });
}

test('ids que no son UUID → 400 antes de llegar a Postgres', async () => {
    const event = saleEvent();
    event.payload.items[0]!.product_id = 'no-uuid';
    const res = await postJson(`${server.url}/sync/events`, { events: [event] });
    assert.equal(res.status, 400);
});

test('events que no es arreglo → 400 VALIDATION_ERROR', async () => {
    const res = await postJson(`${server.url}/sync/events`, { events: 'x' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.details[0].path, 'events');
});
