// SPEC-015: reinicio de la demo (CA-1..CA-4).
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { after, before, beforeEach, test } from 'node:test';
import { DEMO_DEVICE_ID, DEMO_PRODUCTS, ID, resetDemo } from '../src/dev/demo.js';
import { reconciliation } from '../src/services/adminReconciliationService.js';
import { stockReport } from '../src/services/stockService.js';
import { pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { server = await startServer(); });
beforeEach(async () => { await resetDb(); });
after(async () => { await server.close(); await pool.end(); });

const count = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0].n as number;

/** Foto comparable del estado: conteos, sumas y estados, sin ids ni horas (CA-3). */
async function snapshot() {
    const tables = ['products', 'devices', 'sales', 'sale_items', 'stock_leases', 'sync_events', 'sessions', 'admin_audit'];
    const counts: Record<string, number> = {};
    for (const t of tables) counts[t] = await count(`select count(*)::int as n from ${t}`);
    const products = (await pool.query('select id, active, central_stock, initial_stock from products order by id')).rows;
    const revenue = await count('select coalesce(sum(total_cents), 0)::int as n from sales');
    return { counts, products, revenue };
}

/** Base sucia: préstamo activo, venta, teléfono dado de baja, producto de prueba y un cambio del panel. */
async function dirtyDb() {
    const device = await registerDevice(server.url);
    const res = await postJson(`${server.url}/prestamos/request`, { product_ids: [ID.hotDog] }, device.secret);
    assert.equal(res.status, 200);
    await pool.query('update devices set revoked_at = now() where id = $1', [device.deviceId]);
    const extra = randomUUID();
    await pool.query(`insert into products (id, name, unit_price_cents, central_stock, initial_stock) values ($1, 'Producto de prueba', 100, 7, 9)`, [extra]);
    const { rows: [admin] } = await pool.query(`insert into admins (username, password_hash) values ('demo', 'x') returning id`);
    await pool.query(`insert into admin_audit (request_id, admin_id, action, entity_id) values ($1, $2, 'product_create', $3)`, [randomUUID(), admin.id, extra]);
    return { device, extra };
}

test('el reinicio limpia, reactiva teléfonos, oculta productos de prueba y deja el catálogo de demo (CA-1)', async () => {
    const { device, extra } = await dirtyDb();
    const old = await registerDevice(server.url); // sin contacto en 24 h: se borra
    await pool.query(`update devices set last_seen_at = now() - interval '2 days' where id = $1`, [old.deviceId]);
    await pool.query(`update devices set last_seen_at = now() where id = $1`, [device.deviceId]);
    await resetDemo(pool);

    assert.equal(await count('select count(*)::int as n from devices where id = $1', [old.deviceId]), 0);
    assert.equal(await count(`select count(*)::int as n from devices where id = 'dev-local-1'`), 0); // nunca tuvo contacto
    // Si vuelve, se registra de nuevo con el mismo secreto.
    const again = await postJson(`${server.url}/devices/register`, { device_id: old.deviceId, name: 'Viejo', secret: old.secret });
    assert.equal(again.status, 201);
    await pool.query('delete from devices where id = $1', [old.deviceId]);

    assert.equal(await count(`select count(*)::int as n from stock_leases where status = 'active'`), 0);
    assert.equal(await count('select count(*)::int as n from stock_leases where device_id <> $1', [DEMO_DEVICE_ID]), 0);
    assert.equal(await count('select count(*)::int as n from sales where device_id <> $1', [DEMO_DEVICE_ID]), 0);
    assert.equal(await count('select count(*)::int as n from sync_events where device_id <> $1', [DEMO_DEVICE_ID]), 0);
    assert.equal(await count('select count(*)::int as n from sessions where device_id <> $1 or closed_at is null', [DEMO_DEVICE_ID]), 0);
    assert.equal(await count('select count(*)::int as n from admin_audit'), 0);
    assert.equal(await count('select count(*)::int as n from sales'), 30);
    assert.equal(await count('select count(*)::int as n from admins'), 1); // RF-3: las cuentas se quedan

    const { rows: [phone] } = await pool.query('select revoked_at, token_hash from devices where id = $1', [device.deviceId]);
    assert.equal(phone.revoked_at, null);
    assert.ok(phone.token_hash, 'el teléfono sigue registrado (RF-3)');
    assert.equal((await pool.query('select active from products where id = $1', [extra])).rows[0].active, false);

    const { rows: active } = await pool.query('select id, initial_stock from products where active order by id');
    assert.deepEqual(active.map((r) => r.id), DEMO_PRODUCTS.map((p) => p.id).sort());
    const hotDog = active.find((r) => r.id === ID.hotDog)!;
    assert.equal(hotDog.initial_stock, 10);
    assert.equal(await count('select count(*)::int as n from sale_items where product_id = $1', [ID.hotDog]), 0); // sus 10 son para la demo

    // GET /catalogo solo muestra los 20 de la demo.
    const catalog = (await (await fetch(`${server.url}/catalogo`)).json()) as unknown[];
    assert.equal(catalog.length, DEMO_PRODUCTS.length);
});

test('tras el reinicio el stock cuadra y la conciliación del teléfono de demo no tiene diferencias (CA-2)', async () => {
    await dirtyDb();
    await resetDemo(pool);

    const report = await stockReport(pool);
    assert.deepEqual(report.filter((r) => r.status !== 'ok').map((r) => `${r.name}: ${r.status}`), []);
    const sold = report.reduce((sum, r) => sum + r.synced_sold, 0);
    assert.ok(sold > 30, `${sold} unidades vendidas`);

    const today = new Date(Date.now() - 24 * 3600_000);
    const { leases, unassigned } = await reconciliation(pool, today, new Date(Date.now() + 60_000));
    assert.ok(leases.length >= 3);
    assert.deepEqual(leases.filter((l) => l.result !== 'cuadra'), []);
    assert.deepEqual(unassigned, []);
});

test('correr el reinicio dos veces deja el mismo estado (CA-3)', async () => {
    await dirtyDb();
    await resetDemo(pool);
    const first = await snapshot();
    await resetDemo(pool);
    assert.deepEqual(await snapshot(), first);
});

test('el comando no corre contra una base que no es de desarrollo ni de pruebas (CA-4)', async () => {
    const before = await snapshot();
    const run = promisify(execFile);
    const url = new URL(process.env.DB_URL!);
    url.pathname = '/posde_prod';
    const result = await run(process.execPath, ['--import', 'tsx', 'src/db/cli.ts', 'demo-reset'], { env: { ...process.env, DB_URL: url.toString() } }).then(
        () => ({ code: 0, stderr: '' }),
        (error: { code: number; stderr: string }) => ({ code: error.code, stderr: error.stderr })
    );
    assert.equal(result.code, 1);
    assert.match(result.stderr, /posde_prod/);
    assert.deepEqual(await snapshot(), before);
});
