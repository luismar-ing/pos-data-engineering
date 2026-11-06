// SPEC-011: reinicio del escenario y reporte de consistencia del stock.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { assertDevDatabase, checkStock, resetScenario, stockReport, type StockRow } from '../src/dev/scenario.js';
import { pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

const HOT_DOG = '55555555-5555-4555-8555-555555555555';
const WATER = '11111111-1111-4111-8111-111111111111';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { server = await startServer(); });
beforeEach(async () => { await resetDb(); await resetScenario(pool); });
after(async () => { await server.close(); await pool.end(); });

type Device = { deviceId: string; secret: string };

async function lease(device: Device, productId: string) {
    const res = await postJson(`${server.url}/prestamos/request`, { product_ids: [productId] }, device.secret);
    return (await res.json()) as { leases: { id: string; quota_total: number }[]; unavailable: string[] };
}

async function sell(device: Device, productId: string, quantity: number) {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    const event = {
        event_id: id,
        event_type: 'sale_created',
        device_id: device.deviceId,
        created_at,
        payload: {
            sale: { id, device_id: device.deviceId, total_cents: quantity * 5500, payment_method: 'cash', created_at, session_id: null },
            items: [{ id: randomUUID(), sale_id: id, product_id: productId, quantity, unit_price_cents: 5500 }],
        },
    };
    const res = await postJson(`${server.url}/sync/events`, { batch_id: randomUUID(), sent_at: created_at, events: [event] }, device.secret);
    assert.equal(res.status, 200);
}

const hotDog = async () => (await stockReport(pool)).find((r) => r.id === HOT_DOG)!;

test('assertDevDatabase: solo posde y posde_test (CA-9, RNF-3)', () => {
    assert.doesNotThrow(() => assertDevDatabase('postgres://u:p@localhost:5434/posde'));
    assert.doesNotThrow(() => assertDevDatabase('postgres://u:p@localhost:5434/posde_test'));
    assert.throws(() => assertDevDatabase('postgres://u:p@db.example.com/posde_prod'), /posde_prod/);
    assert.throws(() => assertDevDatabase('postgres://u:p@localhost/postgres'), /postgres/);
    assert.throws(() => assertDevDatabase('no es url'), /válida/);
});

test('checkStock: ok, total que no cuadra, sync de más y producto sin escenario (CA-8)', () => {
    const row = (id: string, central: number, active: number, reported: number, synced: number): StockRow => ({
        id, name: id, central_stock: central, leased_active: active, reported_sold: reported, synced_sold: synced,
    });
    const initial = { a: 10, b: 10, c: 10 };
    const result = checkStock([row('a', 0, 5, 5, 5), row('b', 1, 5, 5, 5), row('c', 0, 5, 5, 11), row('d', 3, 0, 0, 0)], initial);
    assert.deepEqual(result.map((r) => r.status), [
        'ok',
        'inconsistente: el total no cuadra',
        'inconsistente: sync vende más que el stock',
        'sin escenario',
    ]);
    assert.deepEqual(result.map((r) => r.balance), [10, 11, 10, 3]);
});

test('el reinicio deja Hot dog en 10 sin préstamos, ventas ni sesiones', async () => {
    const device = await registerDevice(server.url);
    await lease(device, HOT_DOG);
    await sell(device, HOT_DOG, 2);
    await resetScenario(pool);

    const row = await hotDog();
    assert.deepEqual({ central: row.central_stock, active: row.leased_active, reported: row.reported_sold, synced: row.synced_sold, status: row.status },
        { central: 10, active: 0, reported: 0, synced: 0, status: 'ok' });
    for (const table of ['stock_leases', 'sales', 'sale_items', 'sync_events', 'sessions']) {
        assert.equal((await pool.query(`select count(*)::int as n from ${table}`)).rows[0].n, 0, table);
    }
    assert.equal((await pool.query('select count(*)::int as n from devices where id = $1', [device.deviceId])).rows[0].n, 1); // se queda registrado
});

test('dos dispositivos: préstamo, venta por sync y cierre mantienen el stock consistente (CA-2, CA-3, CA-4)', async () => {
    const a = await registerDevice(server.url);
    const b = await registerDevice(server.url);
    const [la, lb] = [await lease(a, HOT_DOG), await lease(b, HOT_DOG)];
    assert.equal(la.leases[0]!.quota_total + lb.leases[0]!.quota_total, 10);

    // CA-3: con todo prestado, otro pedido no recibe nada.
    const c = await registerDevice(server.url);
    assert.deepEqual((await lease(c, HOT_DOG)).unavailable, [HOT_DOG]);

    await sell(a, HOT_DOG, 5);
    await sell(b, HOT_DOG, 3);
    let row = await hotDog();
    assert.deepEqual([row.central_stock, row.leased_active, row.synced_sold, row.status], [0, 10, 8, 'ok']);

    // CA-4: al cerrar, lo no vendido vuelve al stock central.
    for (const [device, l, used] of [[a, la, 5], [b, lb, 3]] as const) {
        const res = await postJson(`${server.url}/prestamos/close`, { leases: [{ lease_id: l.leases[0]!.id, quota_used: used }] }, device.secret);
        assert.equal(res.status, 200);
    }
    row = await hotDog();
    assert.deepEqual([row.central_stock, row.leased_active, row.reported_sold, row.synced_sold, row.status], [2, 0, 8, 8, 'ok']);
});

test('datos alterados salen inconsistentes y los demás productos no (CA-8)', async () => {
    const device = await registerDevice(server.url);
    await lease(device, HOT_DOG);
    await pool.query('update products set central_stock = central_stock + 1 where id = $1', [HOT_DOG]);
    assert.equal((await hotDog()).status, 'inconsistente: el total no cuadra');

    await resetScenario(pool);
    await sell(device, HOT_DOG, 11); // el servidor acepta ventas por sync sin mirar el stock (SPEC-008 RF-11)
    assert.equal((await hotDog()).status, 'inconsistente: sync vende más que el stock');
    assert.equal((await stockReport(pool)).find((r) => r.id === WATER)!.status, 'ok');
});
