// SPEC-005: cálculo, congelado, cierre e idempotencia de los préstamos.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { calculateLeaseQty } from '../src/services/leaseService.js';
import { pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

const WATER = '11111111-1111-4111-8111-111111111111'; // central_stock 200
const HOT_DOG = '55555555-5555-4555-8555-555555555555'; // central_stock 60

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { server = await startServer(); });
beforeEach(resetDb);
after(async () => { await server.close(); await pool.end(); });

type Device = { deviceId: string; secret: string };
type Lease = { id: string; product_id: string; quota_total: number; quota_used: number; issued_at: string; expires_at: string };

async function request(device: Device, productIds: string[]): Promise<{ status: number; body: any }> {
    const res = await postJson(`${server.url}/prestamos/request`, { product_ids: productIds }, device.secret);
    return { status: res.status, body: await res.json() };
}

async function close(device: Device, leases: { lease_id: string; quota_used: number }[]) {
    const res = await postJson(`${server.url}/prestamos/close`, { leases }, device.secret);
    return { status: res.status, body: await res.json() };
}

async function stock(productId: string): Promise<number> {
    const { rows } = await pool.query('select central_stock from products where id = $1', [productId]);
    return rows[0].central_stock;
}

test('calculateLeaseQty: mínimo, tasa, tope y stock 0 (RF-2)', () => {
    assert.equal(calculateLeaseQty({ units: 0, minutes: 0, centralStock: 200 }), 5);
    assert.equal(calculateLeaseQty({ units: 10, minutes: 3, centralStock: 200 }), 12);
    assert.equal(calculateLeaseQty({ units: 50, minutes: 5, centralStock: 200 }), 36);
    assert.equal(calculateLeaseQty({ units: 2, minutes: 0.1, centralStock: 200 }), 8); // menos de 1 min cuenta como 1
    assert.equal(calculateLeaseQty({ units: 100, minutes: 5, centralStock: 60 }), 60);
    assert.equal(calculateLeaseQty({ units: 100, minutes: 5, centralStock: 0 }), 0);
});

test('pedir congela la cuota; pedir otra vez devuelve el mismo préstamo (RF-3, RF-5)', async () => {
    const device = await registerDevice(server.url);
    const first = await request(device, [WATER]);
    assert.equal(first.status, 200);
    const [lease] = first.body.leases as Lease[];
    assert.equal(lease!.quota_total, 5);
    assert.equal(await stock(WATER), 195);

    const second = await request(device, [WATER]);
    assert.equal(second.body.leases[0].id, lease!.id);
    assert.equal(await stock(WATER), 195);
});

test('pedidos simultáneos nunca reparten el mismo stock (CA-1, RNF-4)', async () => {
    await pool.query('update products set central_stock = 23 where id = $1', [HOT_DOG]);
    const devices = await Promise.all(Array.from({ length: 8 }, () => registerDevice(server.url)));
    const results = await Promise.all(devices.map((device) => request(device, [HOT_DOG])));

    const total = results.flatMap((r) => r.body.leases as Lease[]).reduce((sum, lease) => sum + lease.quota_total, 0);
    assert.equal(total, 23);
    assert.equal(await stock(HOT_DOG), 0);
    assert.equal(results.filter((r) => r.body.unavailable.includes(HOT_DOG)).length, 3); // 4 × 5 + 3 = 23
});

test('la cuota sigue la tasa de cada dispositivo (CA-2)', async () => {
    const fast = await registerDevice(server.url);
    const slow = await registerDevice(server.url);
    for (const [device, sold] of [[fast, 5], [slow, 0]] as const) {
        const { body } = await request(device, [WATER]);
        await close(device, [{ lease_id: body.leases[0].id, quota_used: sold }]);
    }
    const fastLease = (await request(fast, [WATER])).body.leases[0] as Lease;
    const slowLease = (await request(slow, [WATER])).body.leases[0] as Lease;
    assert.equal(fastLease.quota_total, 18); // 5 en < 1 min ⇒ ceil(5 · 3 · 1.2)
    assert.equal(slowLease.quota_total, 5);
});

test('cerrar devuelve lo no vendido; cerrar otra vez no cambia nada (CA-5, CA-6)', async () => {
    const device = await registerDevice(server.url);
    const lease = (await request(device, [WATER])).body.leases[0] as Lease;
    assert.equal(await stock(WATER), 195);

    const first = await close(device, [{ lease_id: lease.id, quota_used: 3 }]);
    assert.deepEqual(first, { status: 200, body: { closed: [lease.id] } });
    assert.equal(await stock(WATER), 197);

    const again = await close(device, [{ lease_id: lease.id, quota_used: 3 }]);
    assert.equal(again.status, 200);
    assert.equal(await stock(WATER), 197);

    const different = await close(device, [{ lease_id: lease.id, quota_used: 4 }]);
    assert.equal(different.body.error.code, 'INVALID_QUOTA_USED');
});

test('cantidad inválida o préstamo ajeno: rechazo y nada se aplica (P6)', async () => {
    const owner = await registerDevice(server.url);
    const other = await registerDevice(server.url);
    const { body } = await request(owner, [WATER, HOT_DOG]);
    const [water, hotDog] = [WATER, HOT_DOG].map((id) => (body.leases as Lease[]).find((l) => l.product_id === id)!);

    const tooMany = await close(owner, [{ lease_id: water!.id, quota_used: 1 }, { lease_id: hotDog!.id, quota_used: 6 }]);
    assert.equal(tooMany.status, 400);
    assert.equal(tooMany.body.error.code, 'INVALID_QUOTA_USED');
    assert.equal(await stock(WATER), 195); // el primero tampoco se cerró

    const foreign = await close(other, [{ lease_id: water!.id, quota_used: 0 }]);
    assert.equal(foreign.status, 404);
    assert.equal(foreign.body.error.code, 'LEASE_NOT_FOUND');

    const unknown = await close(owner, [{ lease_id: randomUUID(), quota_used: 0 }]);
    assert.equal(unknown.status, 404);
});

test('sin stock, inactivo o inexistente ⇒ unavailable (CA-10)', async () => {
    const device = await registerDevice(server.url);
    await pool.query('update products set central_stock = 0 where id = $1', [WATER]);
    await pool.query('update products set active = false where id = $1', [HOT_DOG]);
    const missing = randomUUID();
    const { body } = await request(device, [WATER, HOT_DOG, missing]);
    assert.deepEqual(body.leases, []);
    assert.deepEqual([...body.unavailable].sort(), [WATER, HOT_DOG, missing].sort());
});

test('un préstamo vencido sin cerrar nunca vuelve al stock (CA-8, RF-15)', async () => {
    const device = await registerDevice(server.url);
    const lease = (await request(device, [WATER])).body.leases[0] as Lease;
    await pool.query(
        `update stock_leases set issued_at = now() - interval '1 day', expires_at = now() - interval '1 day' where id = $1`,
        [lease.id]
    );
    const again = (await request(device, [WATER])).body.leases[0] as Lease;
    assert.equal(again.id, lease.id);
    assert.equal(await stock(WATER), 195);
});

test('product_ids repetidos ⇒ 400 VALIDATION_ERROR', async () => {
    const device = await registerDevice(server.url);
    const res = await request(device, [WATER, WATER]);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});
