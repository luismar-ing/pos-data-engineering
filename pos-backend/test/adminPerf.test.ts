// SPEC-013 T9 y SPEC-014 T10 / RNF-6: cada vista del panel en < 2 s con 10 dispositivos, 2 000 productos y 10 000 ventas.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { setAdmin } from '../src/services/adminAuthService.js';
import { getJson, pool, postJson, resetDb, startServer } from './helpers.js';

const LIMIT_MS = 2_000;
const DAY = '2026-11-12T00:00:00.000Z';
const NEXT_DAY = '2026-11-13T00:00:00.000Z';

let server: Awaited<ReturnType<typeof startServer>>;
let token: string;

before(async () => {
    server = await startServer();
    await resetDb();
    // Datos en bloque con generate_series: 2 000 productos, 10 dispositivos, 10 000 ventas de 2 líneas
    // repartidas en el día, un evento de sync por venta y 4 000 préstamos (mitad activos, mitad cerrados).
    await pool.query(`
        insert into products (name, category, unit_price_cents, central_stock, initial_stock)
        select 'Producto ' || i, 'Perf', 1000 + i, 1000, 1000 from generate_series(1, 2000) i;

        insert into devices (id, name, last_seen_at)
        select 'perf-' || i, 'Caja ' || i, now() from generate_series(0, 9) i;

        insert into sessions (id, device_id, seller_name, opened_at)
        select gen_random_uuid(), 'perf-' || i, 'Vendedor ' || i, '${DAY}' from generate_series(0, 9) i;

        with numbered as (select id, row_number() over (order by name) as rn from products where category = 'Perf'),
             sold as (
                insert into sales (id, device_id, session_id, total_cents, payment_method, created_at)
                select gen_random_uuid(), 'perf-' || (i % 10),
                       (select id from sessions where device_id = 'perf-' || (i % 10)),
                       3000, (array['cash', 'card', 'transfer'])[1 + i % 3],
                       '${DAY}'::timestamptz + make_interval(secs => i * 8.6)
                from generate_series(0, 9999) i
                returning id, created_at
             ),
             ordered as (select id, created_at, row_number() over (order by created_at) as n from sold)
        insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents)
        select gen_random_uuid(), o.id, p.id, 1, 1500
        from ordered o join numbered p on p.rn in (1 + o.n % 2000, 1 + (o.n * 7) % 2000);

        insert into sync_events (event_id, device_id, event_type, batch_id, received_at)
        select id, device_id, 'sale_created', gen_random_uuid(), created_at + interval '1 minute' from sales where device_id like 'perf-%';

        with numbered as (select id, row_number() over (order by name) as rn from products where category = 'Perf')
        insert into stock_leases (device_id, product_id, quota_total, quota_used, status, closed_at)
        select 'perf-' || d, p.id, 5, 2, s.status, case when s.status = 'released' then now() end
        from generate_series(0, 9) d
        join numbered p on p.rn between d * 200 + 1 and d * 200 + 200
        cross join (values ('active'), ('released')) s(status);

        -- SPEC-014: cada línea apunta al préstamo cerrado de su producto (uno por producto).
        update sale_items si set lease_id = l.id from stock_leases l where l.product_id = si.product_id and l.status = 'released';

        analyze;
    `);
    await setAdmin(pool, 'admin', 'clave-segura-1');
    token = (await (await postJson(`${server.url}/admin/login`, { username: 'admin', password: 'clave-segura-1' })).json()).token;
});
after(async () => { await server.close(); await pool.end(); });

async function timed(path: string): Promise<{ ms: number; body: any }> {
    const started = performance.now();
    const res = await getJson(`${server.url}${path}`, token);
    const body = await res.json();
    const ms = performance.now() - started;
    assert.equal(res.status, 200);
    return { ms, body };
}

test('GET /admin/sales del día en < 2 s (RNF-6)', async () => {
    const { ms, body } = await timed(`/admin/sales?from=${DAY}&to=${NEXT_DAY}`);
    console.log(`perf: /admin/sales ${ms.toFixed(0)} ms`);
    assert.equal(body.totals.sales, 10_000);
    assert.equal(body.by_device.filter((d: { device_id: string }) => d.device_id.startsWith('perf-')).length, 10);
    assert.ok(ms < LIMIT_MS, `${ms.toFixed(0)} ms`);
});

test('GET /admin/stock en < 2 s (RNF-6)', async () => {
    const { ms, body } = await timed('/admin/stock');
    console.log(`perf: /admin/stock ${ms.toFixed(0)} ms`);
    assert.ok(body.products.length >= 2_000);
    assert.ok(ms < LIMIT_MS, `${ms.toFixed(0)} ms`);
});

test('GET /admin/devices en < 2 s (SPEC-014 RNF-6)', async () => {
    const { ms, body } = await timed('/admin/devices');
    console.log(`perf: /admin/devices ${ms.toFixed(0)} ms`);
    assert.equal(body.devices.filter((d: { id: string }) => d.id.startsWith('perf-')).length, 10);
    assert.ok(ms < LIMIT_MS, `${ms.toFixed(0)} ms`);
});

test('GET /admin/reconciliation en < 2 s (SPEC-014 RNF-6)', async () => {
    const now = Date.now();
    const { ms, body } = await timed(`/admin/reconciliation?from=${new Date(now - 3_600_000).toISOString()}&to=${new Date(now + 3_600_000).toISOString()}`);
    console.log(`perf: /admin/reconciliation ${ms.toFixed(0)} ms`);
    assert.equal(body.leases.length, 2_000);
    assert.ok(ms < LIMIT_MS, `${ms.toFixed(0)} ms`);
});
