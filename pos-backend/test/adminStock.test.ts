// SPEC-013 T8: GET /admin/stock (RF-13, RF-14, CA-10).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { resetScenario } from '../src/dev/scenario.js';
import { setAdmin } from '../src/services/adminAuthService.js';
import { stockReport } from '../src/services/stockService.js';
import { getJson, pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

const HOT_DOG = '55555555-5555-4555-8555-555555555555';

let server: Awaited<ReturnType<typeof startServer>>;
let token: string;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); await pool.end(); });

beforeEach(async () => {
    await resetDb();
    await resetScenario(pool);
    await setAdmin(pool, 'admin', 'clave-segura-1');
    token = (await (await postJson(`${server.url}/admin/login`, { username: 'admin', password: 'clave-segura-1' })).json()).token;
});

type Device = { deviceId: string; secret: string };

async function lease(device: Device) {
    const res = await postJson(`${server.url}/prestamos/request`, { product_ids: [HOT_DOG] }, device.secret);
    return ((await res.json()) as { leases: { id: string }[] }).leases[0]!;
}

async function sell(device: Device, quantity: number) {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    const event = {
        event_id: id, event_type: 'sale_created', device_id: device.deviceId, created_at,
        payload: {
            sale: { id, device_id: device.deviceId, total_cents: quantity * 5500, payment_method: 'cash', created_at, session_id: null },
            items: [{ id: randomUUID(), sale_id: id, product_id: HOT_DOG, quantity, unit_price_cents: 5500 }],
        },
    };
    const res = await postJson(`${server.url}/sync/events`, { batch_id: randomUUID(), sent_at: created_at, events: [event] }, device.secret);
    assert.equal(res.status, 200);
}

const stock = async () => {
    const res = await getJson(`${server.url}/admin/stock`, token);
    assert.equal(res.status, 200);
    return res.json() as Promise<{ generated_at: string; products: Record<string, unknown>[] }>;
};

test('escenario de SPEC-011: coincide con report:stock y todo cuadra (CA-10)', async () => {
    const [a, b] = [await registerDevice(server.url), await registerDevice(server.url)];
    const [la] = [await lease(a), await lease(b)];
    await sell(a, 5);
    await sell(b, 3);
    const res = await postJson(`${server.url}/prestamos/close`, { leases: [{ lease_id: la.id, quota_used: 5 }] }, a.secret);
    assert.equal(res.status, 200);

    const body = await stock();
    assert.ok(Date.now() - Date.parse(body.generated_at) < 5_000);
    const report = await stockReport(pool);
    assert.deepEqual(body.products, report.map(({ id, ...row }) => ({ product_id: id, ...row })));
    assert.ok(body.products.every((p) => p.status === 'ok'));

    const hotDog = body.products.find((p) => p.product_id === HOT_DOG)!;
    assert.equal(hotDog.initial_stock, 10);
    assert.equal(hotDog.synced_sold, 8);
    assert.equal(hotDog.balance, 10);
});

test('préstamo cerrado como expired con 3 sincronizadas: cuenta como informado y cuadra (SPEC-014 T3)', async () => {
    const device = await registerDevice(server.url);
    const l = await lease(device);
    await sell(device, 3);
    // Lo que hará releaseRevokedLeases: cierra con lo sincronizado y devuelve el resto.
    const { rows: [row] } = await pool.query<{ quota_total: number }>(
        `update stock_leases set status = 'expired', quota_used = 3, closed_at = now() where id = $1 returning quota_total`,
        [l.id]
    );
    await pool.query('update products set central_stock = central_stock + $2 where id = $1', [HOT_DOG, row!.quota_total - 3]);

    const hotDog = (await stock()).products.find((p) => p.product_id === HOT_DOG)!;
    assert.equal(hotDog.reported_sold, 3);
    assert.equal(hotDog.status, 'ok');
});

test('un producto que no cuadra sale como no_cuadra y los demás siguen en ok (RF-14)', async () => {
    await pool.query('update products set central_stock = central_stock + 1 where id = $1', [HOT_DOG]);
    const { products } = await stock();
    assert.equal(products.find((p) => p.product_id === HOT_DOG)!.status, 'no_cuadra');
    assert.ok(products.filter((p) => p.product_id !== HOT_DOG).every((p) => p.status === 'ok'));
});

test('sin sesión de administrador: 401; con el secreto de un dispositivo: 401', async () => {
    const device = await registerDevice(server.url);
    assert.equal((await getJson(`${server.url}/admin/stock`)).status, 401);
    assert.equal((await getJson(`${server.url}/admin/stock`, device.secret)).status, 401);
});
