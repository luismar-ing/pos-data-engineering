// SPEC-014 T5–T9: registro de cambios, baja y devolución, conciliación y catálogo.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { resetScenario } from '../src/dev/scenario.js';
import { setAdmin } from '../src/services/adminAuthService.js';
import { releaseRevokedLeases } from '../src/services/leaseService.js';
import { stockReport } from '../src/services/stockService.js';
import { getJson, pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

const HOT_DOG = '55555555-5555-4555-8555-555555555555';
const WATER = '11111111-1111-4111-8111-111111111111';

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
type Lease = { id: string; quota_total: number };

const admin = (path: string, body: unknown, method = 'POST') =>
    fetch(`${server.url}/admin${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    });
const adminGet = async (path: string) => {
    const res = await getJson(`${server.url}/admin${path}`, token);
    assert.equal(res.status, 200);
    return res.json() as Promise<any>;
};

async function requestLease(device: Device, productId = HOT_DOG) {
    const res = await postJson(`${server.url}/prestamos/request`, { product_ids: [productId] }, device.secret);
    assert.equal(res.status, 200);
    return (await res.json()) as { leases: Lease[]; unavailable: string[] };
}

async function sell(device: Device, quantity: number, leaseId: string | null, productId = HOT_DOG) {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    const item: Record<string, unknown> = { id: randomUUID(), sale_id: id, product_id: productId, quantity, unit_price_cents: 5500 };
    if (leaseId !== null) item.lease_id = leaseId;
    const event = {
        event_id: id, event_type: 'sale_created', device_id: device.deviceId, created_at,
        payload: { sale: { id, device_id: device.deviceId, total_cents: quantity * 5500, payment_method: 'cash', created_at, session_id: null }, items: [item] },
    };
    const res = await postJson(`${server.url}/sync/events`, { batch_id: randomUUID(), sent_at: created_at, events: [event] }, device.secret);
    assert.equal((await res.json()).results[0].status, 'inserted');
}

const close = (device: Device, leaseId: string, quota_used: number) =>
    postJson(`${server.url}/prestamos/close`, { leases: [{ lease_id: leaseId, quota_used }] }, device.secret);
const central = async (id = HOT_DOG) => (await pool.query('select central_stock from products where id = $1', [id])).rows[0].central_stock as number;
const revoke = (device: Device, request_id: string = randomUUID()) => admin(`/devices/${device.deviceId}/revoke`, { request_id });
/** Lleva el préstamo al pasado: `minutes` después de su vencimiento. */
const ageLease = (id: string, minutes: number) =>
    pool.query(`update stock_leases set expires_at = now() - make_interval(mins => $2) where id = $1`, [id, minutes]);
const allOk = async () => assert.ok((await stockReport(pool)).every((p) => p.status === 'ok'));

// --- Baja, devolución y reactivación ---

test('baja: sin préstamos nuevos y el activo sigue prestado antes del plazo (CA-1)', async () => {
    const device = await registerDevice(server.url);
    const { leases: [lease] } = await requestLease(device);
    assert.equal((await revoke(device)).status, 200);

    assert.deepEqual(await requestLease(device, WATER), { leases: [], unavailable: [WATER] });
    await ageLease(lease!.id, 31); // pasó el tope sin red pero no los 2 min de margen
    assert.equal(await releaseRevokedLeases(pool), 0);

    const { devices } = await adminGet('/devices');
    const listed = devices.find((d: any) => d.id === device.deviceId);
    assert.ok(listed.revoked_at);
    assert.equal(listed.leases[0].id, lease!.id);
    assert.equal(Date.parse(listed.leases[0].release_at) - Date.parse(listed.leases[0].expires_at), 32 * 60_000);
    await allOk();
});

test('pasado el plazo y sin ventas, el servidor cierra y el central sube la cuota (CA-2)', async () => {
    const device = await registerDevice(server.url);
    const { leases: [lease] } = await requestLease(device);
    const before = await central();
    await revoke(device);
    await ageLease(lease!.id, 33);
    assert.equal(await releaseRevokedLeases(pool), 1);
    assert.equal(await central(), before + lease!.quota_total);
    const { rows: [row] } = await pool.query('select status, quota_used from stock_leases where id = $1', [lease!.id]);
    assert.deepEqual(row, { status: 'expired', quota_used: 0 });
    await allOk();
});

test('ventas sin red que llegan tras el cierre: aceptadas y 3 devueltas de más; cierre tardío idempotente (CA-3, RF-6)', async () => {
    const device = await registerDevice(server.url);
    const { leases: [lease] } = await requestLease(device);
    await revoke(device);
    await ageLease(lease!.id, 33);
    await releaseRevokedLeases(pool);
    await sell(device, 3, lease!.id);

    // El teléfono vuelve y cierra tarde: 200 sin mover stock; repetir con lo mismo también; con otro valor, 400.
    const centralBefore = await central();
    assert.equal((await close(device, lease!.id, 3)).status, 200);
    assert.equal((await close(device, lease!.id, 3)).status, 200);
    assert.equal((await close(device, lease!.id, 4)).status, 400);
    assert.equal(await central(), centralBefore);

    const day = new Date();
    const { leases } = await adminGet(`/reconciliation?from=${new Date(day.getTime() - 3_600_000).toISOString()}&to=${new Date(day.getTime() + 3_600_000).toISOString()}`);
    assert.equal(leases.length, 1);
    assert.equal(leases[0].status, 'expired');
    assert.equal(leases[0].returned_extra, 3);
    assert.equal(leases[0].reported, 3);
    assert.equal(leases[0].synced, 3);
});

test('el teléfono cierra antes del plazo: vale su cierre y vuelven 6 de 10 (CA-4)', async () => {
    await pool.query('update products set central_stock = 50, initial_stock = 50 where id = $1', [HOT_DOG]);
    const device = await registerDevice(server.url);
    // Cuota de 10 forzada para seguir el ejemplo de la spec.
    const { leases: [lease] } = await requestLease(device);
    await pool.query('update stock_leases set quota_total = 10 where id = $1', [lease!.id]);
    await pool.query('update products set central_stock = 40 where id = $1', [HOT_DOG]);
    await revoke(device);

    assert.equal((await close(device, lease!.id, 4)).status, 200);
    assert.equal(await central(), 46);
    await ageLease(lease!.id, 60);
    assert.equal(await releaseRevokedLeases(pool), 0);
    await allOk();
});

test('reactivar vuelve a prestar; repetir el mismo request_id no cambia la hora de la baja (CA-5, RNF-2)', async () => {
    const device = await registerDevice(server.url);
    const requestId = randomUUID();
    const first = await (await revoke(device, requestId)).json();
    const again = await (await revoke(device, requestId)).json();
    assert.deepEqual(again, first);

    assert.equal((await admin(`/devices/${device.deviceId}/reactivate`, { request_id: randomUUID() })).status, 200);
    assert.equal((await requestLease(device)).leases.length, 1);
    assert.equal((await admin('/devices/no-existe/revoke', { request_id: randomUUID() })).status, 404);
});

test('baja en el registro de cambios con usuario y hora (CA-12)', async () => {
    const device = await registerDevice(server.url);
    const requestId = randomUUID();
    await revoke(device, requestId);
    await revoke(device, requestId);
    const { entries } = await adminGet('/audit');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].request_id, requestId);
    assert.equal(entries[0].username, 'admin');
    assert.equal(entries[0].action, 'device_revoke');
    assert.equal(entries[0].entity_id, device.deviceId);
    assert.equal(entries[0].before.revoked_at, null);
    assert.ok(entries[0].after.revoked_at);
    assert.ok(Date.now() - Date.parse(entries[0].created_at) < 60_000);
});

// --- Conciliación ---

test('8 informadas y 6 sincronizadas = faltan_ventas, primero; líneas sin préstamo aparte (CA-8, CA-7)', async () => {
    await pool.query('update products set central_stock = 50, initial_stock = 50 where id = $1', [HOT_DOG]);
    const device = await registerDevice(server.url);
    const { leases: [ok] } = await requestLease(device, WATER);
    await sell(device, 2, ok!.id, WATER);
    await close(device, ok!.id, 2);

    const { leases: [lease] } = await requestLease(device);
    await pool.query('update stock_leases set quota_total = 10 where id = $1', [lease!.id]);
    await sell(device, 6, lease!.id);
    await sell(device, 1, null);
    assert.equal((await close(device, lease!.id, 8)).status, 200);

    const now = Date.now();
    const body = await adminGet(`/reconciliation?from=${new Date(now - 3_600_000).toISOString()}&to=${new Date(now + 3_600_000).toISOString()}`);
    assert.deepEqual(body.leases.map((l: any) => [l.product_id, l.result, l.reported, l.synced]), [
        [HOT_DOG, 'faltan_ventas', 8, 6],
        [WATER, 'cuadra', 2, 2],
    ]);
    assert.deepEqual(body.unassigned.map((u: any) => [u.product_id, u.units]), [[HOT_DOG, 1]]);
});

// --- Catálogo ---

test('ajuste: −5 con 3 de central da 409; −3 deja 0 y lo prestado sigue; +20 cuadra (CA-10, CA-11)', async () => {
    const device = await registerDevice(server.url);
    const { leases: [lease] } = await requestLease(device);
    const leased = lease!.quota_total;
    await admin(`/products/${HOT_DOG}/stock`, { request_id: randomUUID(), delta: 3 - (await central()) });
    assert.equal(await central(), 3);

    const rejected = await admin(`/products/${HOT_DOG}/stock`, { request_id: randomUUID(), delta: -5 });
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).error.code, 'STOCK_BELOW_ZERO');
    assert.equal(await central(), 3);

    assert.equal((await admin(`/products/${HOT_DOG}/stock`, { request_id: randomUUID(), delta: -3 })).status, 200);
    assert.equal(await central(), 0);
    const { rows: [l] } = await pool.query('select quota_total, status from stock_leases where id = $1', [lease!.id]);
    assert.deepEqual(l, { quota_total: leased, status: 'active' });

    const added = await (await admin(`/products/${HOT_DOG}/stock`, { request_id: randomUUID(), delta: 20 })).json();
    assert.equal(added.product.central_stock, 20);
    const stock = await adminGet('/stock');
    assert.equal(stock.products.find((p: any) => p.product_id === HOT_DOG).status, 'ok');
});

test('el mismo ajuste dos veces (reintento) se aplica una vez (RNF-2)', async () => {
    const requestId = randomUUID();
    const before = await central();
    const [a, b] = await Promise.all([
        admin(`/products/${HOT_DOG}/stock`, { request_id: requestId, delta: 7 }),
        admin(`/products/${HOT_DOG}/stock`, { request_id: requestId, delta: 7 }),
    ]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.deepEqual(await a.json(), await b.json());
    assert.equal(await central(), before + 7);
});

test('ajuste y pedidos de préstamo simultáneos: el central nunca queda negativo (RNF-3)', async () => {
    const devices = await Promise.all([1, 2, 3].map(() => registerDevice(server.url)));
    const results = await Promise.all([
        admin(`/products/${HOT_DOG}/stock`, { request_id: randomUUID(), delta: -8 }),
        ...devices.map((d) => postJson(`${server.url}/prestamos/request`, { product_ids: [HOT_DOG] }, d.secret)),
    ]);
    assert.ok([200, 409].includes(results[0]!.status));
    assert.ok((await central()) >= 0);
    await allOk();
});

test('alta, cambio de precio y desactivar: catálogo y préstamos (RF-13, RF-14, RF-16)', async () => {
    const created = await admin('/products', { request_id: randomUUID(), name: 'Elote', category: 'Comida', unit_price_cents: 3000, initial_stock: 12 });
    assert.equal(created.status, 201);
    const { product } = await created.json();
    assert.equal(product.central_stock, 12);
    assert.equal(product.initial_stock, 12);

    const patched = await (await admin(`/products/${product.id}`, { request_id: randomUUID(), unit_price_cents: 3500 }, 'PATCH')).json();
    assert.equal(patched.product.unit_price_cents, 3500);
    assert.equal(patched.product.name, 'Elote'); // lo que no viene no cambia
    let catalog = await (await getJson(`${server.url}/catalogo`)).json();
    assert.equal(catalog.find((p: any) => p.id === product.id).unit_price_cents, 3500);

    await admin(`/products/${product.id}`, { request_id: randomUUID(), active: false }, 'PATCH');
    catalog = await (await getJson(`${server.url}/catalogo`)).json();
    assert.equal(catalog.some((p: any) => p.id === product.id), false);
    const device = await registerDevice(server.url);
    assert.deepEqual((await requestLease(device, product.id)).unavailable, [product.id]);

    assert.equal((await admin(`/products/${product.id}`, { request_id: randomUUID() }, 'PATCH')).status, 400);
    assert.equal((await admin(`/products/${randomUUID()}/stock`, { request_id: randomUUID(), delta: 1 })).status, 404);
    await allOk();
});

test('rutas nuevas sin sesión de administrador: 401', async () => {
    const device = await registerDevice(server.url);
    for (const path of ['/admin/devices', '/admin/audit', '/admin/reconciliation?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z']) {
        assert.equal((await getJson(`${server.url}${path}`, device.secret)).status, 401);
    }
    assert.equal((await postJson(`${server.url}/admin/products`, { request_id: randomUUID() }, device.secret)).status, 401);
});
