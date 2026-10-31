import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

let server: Awaited<ReturnType<typeof startServer>>;
let device: { deviceId: string; secret: string };
before(async () => { await resetDb(); server = await startServer(); device = await registerDevice(server.url); });
after(async () => { await server.close(); await pool.end(); });

function saleEvent(id = randomUUID(), deviceId = device.deviceId) {
    const created_at = new Date().toISOString();
    return {
        event_id: id,
        event_type: 'sale_created',
        device_id: deviceId,
        created_at,
        payload: {
            sale: { id, device_id: deviceId, total_cents: 3000, payment_method: 'cash', created_at, session_id: randomUUID() as string | null },
            items: [{ id: randomUUID(), sale_id: id, product_id: '11111111-1111-4111-8111-111111111111', quantity: 2, unit_price_cents: 1500 }],
        },
    };
}

test('el mismo lote dos veces: la segunda vez todo es duplicado (CA-9)', async () => {
    const batch = { events: [saleEvent(), saleEvent()] };
    const first = await postJson(`${server.url}/sync/events`, batch, device.secret);
    assert.deepEqual(await first.json(), { received: 2, inserted: 2, duplicated: 0 });
    const second = await postJson(`${server.url}/sync/events`, batch, device.secret);
    assert.deepEqual(await second.json(), { received: 2, inserted: 0, duplicated: 2 });

    const { rows } = await pool.query('select count(*)::int as n from sale_items');
    assert.equal(rows[0].n, 2);
});

test('evento con sale.id distinto de event_id → 400 y no toca la BD', async () => {
    const event = saleEvent();
    event.payload.sale.id = randomUUID();
    const before = await pool.query('select count(*)::int as n from sales');

    const res = await postJson(`${server.url}/sync/events`, { events: [event] }, device.secret);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');

    const afterCount = await pool.query('select count(*)::int as n from sales');
    assert.equal(afterCount.rows[0].n, before.rows[0].n);
});

for (const event of [{ event_id: 'x' }, { event_id: 'x', event_type: 'sale_created', payload: {} }]) {
    test(`evento incompleto ${JSON.stringify(event)} → 400, no 500`, async () => {
        const res = await postJson(`${server.url}/sync/events`, { events: [event] }, device.secret);
        assert.equal(res.status, 400);
    });
}

test('ids que no son UUID → 400 antes de llegar a Postgres', async () => {
    const event = saleEvent();
    event.payload.items[0]!.product_id = 'no-uuid';
    const res = await postJson(`${server.url}/sync/events`, { events: [event] }, device.secret);
    assert.equal(res.status, 400);
});

test('events que no es arreglo → 400 VALIDATION_ERROR', async () => {
    const res = await postJson(`${server.url}/sync/events`, { events: 'x' }, device.secret);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.details[0].path, 'events');
});

test('evento de otro dispositivo → 403 FORBIDDEN y no se guarda (CA-5)', async () => {
    const other = await registerDevice(server.url);
    const event = saleEvent(randomUUID(), other.deviceId);
    const res = await postJson(`${server.url}/sync/events`, { events: [event] }, device.secret);
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.code, 'FORBIDDEN');
    const { rows } = await pool.query('select count(*)::int as n from sales where id = $1', [event.event_id]);
    assert.equal(rows[0].n, 0);
});

test('la venta guarda su session_id', async () => {
    const event = saleEvent();
    await postJson(`${server.url}/sync/events`, { events: [event] }, device.secret);
    const { rows } = await pool.query('select session_id from sales where id = $1', [event.event_id]);
    assert.equal(rows[0].session_id, event.payload.sale.session_id);
});

test('venta con dispositivo no registrado: la FK la rechaza (CA-9)', async () => {
    await assert.rejects(
        pool.query(`insert into sales (id, device_id, total_cents, payment_method, created_at) values ($1, 'no-existe', 0, 'cash', now())`, [randomUUID()]),
        /sales_device_id_fkey/
    );
});
