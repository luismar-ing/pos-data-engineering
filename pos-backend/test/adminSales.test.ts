// SPEC-013 T7: GET /admin/sales (RF-10..RF-12, CA-9).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { setAdmin } from '../src/services/adminAuthService.js';
import { getJson, pool, postJson, resetDb, startServer } from './helpers.js';

const AGUA = '11111111-1111-4111-8111-111111111111';
const CERVEZA = '33333333-3333-4333-8333-333333333333';
const HOT_DOG = '55555555-5555-4555-8555-555555555555';
const PRICE: Record<string, number> = { [AGUA]: 1500, [CERVEZA]: 4500, [HOT_DOG]: 5500 };
const [SESSION_A, SESSION_B] = [randomUUID(), randomUUID()];
const FROM = '2026-11-12T10:00:00.000Z';
const TO = '2026-11-12T12:00:00.000Z';

let server: Awaited<ReturnType<typeof startServer>>;
let token: string;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); await pool.end(); });

async function sale(device: string, session: string | null, at: string, method: string, items: [string, number][]) {
    const id = randomUUID();
    const total = items.reduce((sum, [product, qty]) => sum + qty * PRICE[product]!, 0);
    await pool.query(
        'insert into sales (id, device_id, session_id, total_cents, payment_method, created_at) values ($1, $2, $3, $4, $5, $6)',
        [id, device, session, total, method, at]
    );
    for (const [product, qty] of items) {
        await pool.query(
            'insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values ($1, $2, $3, $4, $5)',
            [randomUUID(), id, product, qty, PRICE[product]]
        );
    }
}

beforeEach(async () => {
    await resetDb();
    await pool.query(`insert into devices (id, name, last_seen_at) values ('dA', 'Caja A', '2026-11-12T11:59:00Z'), ('dB', 'Caja B', null), ('dC', 'Caja C', null)`);
    await pool.query(
        `insert into sessions (id, device_id, seller_name, opened_at) values ($1, 'dA', 'Ana', $3), ($2, 'dB', 'Beto', $3)`,
        [SESSION_A, SESSION_B, FROM]
    );
    await pool.query(
        `insert into sync_events (event_id, device_id, event_type, batch_id, received_at)
         values ($1, 'dA', 'sale_created', $2, '2026-11-12T11:58:00Z')`,
        [randomUUID(), randomUUID()]
    );
    await sale('dA', SESSION_A, '2026-11-12T10:05:00Z', 'cash', [[HOT_DOG, 2]]); //               11 000
    await sale('dA', SESSION_A, '2026-11-12T10:40:00Z', 'card', [[AGUA, 1], [HOT_DOG, 1]]); //     7 000
    await sale('dB', SESSION_B, '2026-11-12T11:15:00Z', 'cash', [[CERVEZA, 3]]); //               13 500
    await sale('dB', null, '2026-11-12T11:50:00Z', 'transfer', [[AGUA, 4]]); //                     6 000
    // Fuera del rango [from, to): justo antes y justo en `to`.
    await sale('dA', SESSION_A, '2026-11-12T09:59:59Z', 'cash', [[HOT_DOG, 10]]);
    await sale('dA', SESSION_A, TO, 'cash', [[HOT_DOG, 10]]);

    await setAdmin(pool, 'admin', 'clave-segura-1');
    token = (await (await postJson(`${server.url}/admin/login`, { username: 'admin', password: 'clave-segura-1' })).json()).token;
});

const summary = async (from = FROM, to = TO) => {
    const res = await getJson(`${server.url}/admin/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, token);
    assert.equal(res.status, 200);
    return res.json();
};

const sum = (rows: { revenue_cents: number; sales: number }[]) =>
    rows.reduce((acc, r) => ({ revenue_cents: acc.revenue_cents + r.revenue_cents, sales: acc.sales + r.sales }), { revenue_cents: 0, sales: 0 });

test('totales del rango y cada desglose suma lo mismo (RF-10, RF-11, CA-9)', async () => {
    const body = await summary();
    assert.equal(body.from, FROM);
    assert.equal(body.to, TO);
    assert.deepEqual(body.totals, { revenue_cents: 37_500, sales: 4, average_ticket_cents: 9_375 });
    for (const key of ['by_device', 'by_session', 'by_hour', 'by_payment_method']) {
        assert.deepEqual(sum(body[key]), { revenue_cents: 37_500, sales: 4 }, key);
    }
});

test('por dispositivo: incluye los que no vendieron, con último contacto y última sync (RF-12)', async () => {
    const { by_device } = await summary();
    assert.deepEqual(
        by_device.map((d: { device_id: string; revenue_cents: number; sales: number }) => [d.device_id, d.revenue_cents, d.sales]),
        [['dB', 19_500, 2], ['dA', 18_000, 2], ['dC', 0, 0], ['dev-local-1', 0, 0]]
    );
    const a = by_device.find((d: { device_id: string }) => d.device_id === 'dA');
    assert.deepEqual([a.name, a.last_seen_at, a.last_sync_at], ['Caja A', '2026-11-12T11:59:00.000Z', '2026-11-12T11:58:00.000Z']);
    const c = by_device.find((d: { device_id: string }) => d.device_id === 'dC');
    assert.deepEqual([c.last_seen_at, c.last_sync_at], [null, null]);
});

test('por sesión, hora, método de pago y top de productos', async () => {
    const body = await summary();
    assert.deepEqual(
        body.by_session.map((s: { seller_name: string | null; device_id: string; revenue_cents: number }) => [s.seller_name, s.device_id, s.revenue_cents]),
        [['Ana', 'dA', 18_000], ['Beto', 'dB', 13_500], [null, 'dB', 6_000]]
    );
    assert.deepEqual(body.by_hour, [
        { hour: '2026-11-12T10:00:00.000Z', revenue_cents: 18_000, sales: 2 },
        { hour: '2026-11-12T11:00:00.000Z', revenue_cents: 19_500, sales: 2 },
    ]);
    assert.deepEqual(
        body.by_payment_method.map((p: { payment_method: string; revenue_cents: number }) => [p.payment_method, p.revenue_cents]),
        [['cash', 24_500], ['card', 7_000], ['transfer', 6_000]]
    );
    assert.deepEqual(
        body.top_products.map((p: { name: string; units: number; revenue_cents: number }) => [p.name, p.units, p.revenue_cents]),
        [['Agua 600 ml', 5, 7_500], ['Hot dog', 3, 16_500], ['Cerveza 355 ml', 3, 13_500]]
    );
});

test('rango sin ventas: todo en 0 y ticket promedio 0', async () => {
    const body = await summary('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z');
    assert.deepEqual(body.totals, { revenue_cents: 0, sales: 0, average_ticket_cents: 0 });
    assert.deepEqual([body.by_session, body.by_hour, body.by_payment_method, body.top_products], [[], [], [], []]);
    assert.equal(body.by_device.length, 4);
});

test('rango inválido: 400 VALIDATION_ERROR; sin sesión de admin: 401', async () => {
    const bad = [
        `from=${FROM}`,
        `from=ayer&to=${TO}`,
        `from=${TO}&to=${FROM}`,
        'from=2026-10-01T00:00:00Z&to=2026-11-02T00:00:00Z', // 32 días
    ];
    for (const query of bad) {
        const res = await getJson(`${server.url}/admin/sales?${query}`, token);
        assert.equal(res.status, 400, query);
        assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    }
    assert.equal((await getJson(`${server.url}/admin/sales?from=${FROM}&to=${TO}`)).status, 401);
});
