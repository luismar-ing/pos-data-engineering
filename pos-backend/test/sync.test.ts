// SPEC-008: recepción de lotes con resultado por evento.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

const WATER = '11111111-1111-4111-8111-111111111111';

let server: Awaited<ReturnType<typeof startServer>>;
let device: { deviceId: string; secret: string };
before(async () => { server = await startServer(); });
beforeEach(async () => { await resetDb(); device = await registerDevice(server.url); });
after(async () => { await server.close(); await pool.end(); });

function saleEvent(deviceId = device.deviceId, quantity = 2) {
    const id = randomUUID();
    const created_at = new Date().toISOString();
    return {
        event_id: id,
        event_type: 'sale_created',
        device_id: deviceId,
        created_at,
        payload: {
            sale: { id, device_id: deviceId, total_cents: quantity * 1500, payment_method: 'cash', created_at, session_id: randomUUID() as string | null },
            items: [{ id: randomUUID(), sale_id: id, product_id: WATER, quantity, unit_price_cents: 1500 }],
        },
    };
}

function sessionEvent(type: 'session_opened' | 'session_closed', sessionId: string) {
    const opened_at = '2026-11-03T10:00:00.000Z';
    const closed_at = type === 'session_closed' ? '2026-11-03T18:00:00.000Z' : null;
    return {
        event_id: randomUUID(),
        event_type: type,
        device_id: device.deviceId,
        created_at: closed_at ?? opened_at,
        payload: { session: { id: sessionId, device_id: device.deviceId, seller_name: 'Ana', opened_at, closed_at } },
    };
}

async function send(events: unknown[], secret = device.secret, batch_id: string = randomUUID()) {
    const res = await postJson(`${server.url}/sync/events`, { batch_id, sent_at: new Date().toISOString(), events }, secret);
    return { status: res.status, body: await res.json() };
}

const count = async (table: string) => (await pool.query(`select count(*)::int as n from ${table}`)).rows[0].n as number;
const statuses = (body: any) => body.results.map((r: { status: string }) => r.status);

test('venta, apertura y cierre en un lote ⇒ los tres inserted (RF-2, CA-5)', async () => {
    const sessionId = randomUUID();
    const sale = saleEvent();
    const { status, body } = await send([sessionEvent('session_opened', sessionId), sale, sessionEvent('session_closed', sessionId)]);
    assert.equal(status, 200);
    assert.deepEqual(statuses(body), ['inserted', 'inserted', 'inserted']);
    assert.equal(body.inserted, 3);

    assert.equal(await count('sale_items'), 1);
    const { rows } = await pool.query('select device_id, seller_name, opened_at, closed_at from sessions where id = $1', [sessionId]);
    assert.equal(rows[0].device_id, device.deviceId);
    assert.equal(rows[0].seller_name, 'Ana');
    assert.equal(rows[0].opened_at.toISOString(), '2026-11-03T10:00:00.000Z');
    assert.equal(rows[0].closed_at.toISOString(), '2026-11-03T18:00:00.000Z');
});

test('el mismo lote dos veces ⇒ todo duplicate y nada se repite (CA-2, RF-7)', async () => {
    const sessionId = randomUUID();
    const events = [sessionEvent('session_opened', sessionId), saleEvent(), saleEvent()];
    await send(events);
    const again = await send(events);
    assert.deepEqual(statuses(again.body), ['duplicate', 'duplicate', 'duplicate']);
    assert.equal(again.body.duplicated, 3);
    assert.equal(await count('sales'), 2);
    assert.equal(await count('sale_items'), 2);
    assert.equal(await count('sessions'), 1);
});

test('un inválido entre dos válidos ⇒ solo él se rechaza (CA-3, RF-8)', async () => {
    const bad = saleEvent();
    bad.payload.sale.total_cents = 1;
    const { body } = await send([saleEvent(), bad, saleEvent()]);
    assert.deepEqual(statuses(body), ['inserted', 'rejected', 'inserted']);
    assert.match(body.results[1].reason, /total_cents/);
    assert.equal(await count('sales'), 2);
});

test('cantidad 0, otro dispositivo, tipo desconocido y producto inexistente ⇒ rejected sin nada a medias (RF-8, RF-9)', async () => {
    const zero = saleEvent(device.deviceId, 0);
    const other = await registerDevice(server.url);
    const foreign = saleEvent(other.deviceId);
    const unknownType = { ...saleEvent(), event_type: 'stock_moved' };
    const missingProduct = saleEvent();
    missingProduct.payload.items[0]!.product_id = randomUUID();

    const { body } = await send([zero, foreign, unknownType, missingProduct]);
    assert.deepEqual(statuses(body), ['rejected', 'rejected', 'rejected', 'rejected']);
    assert.match(body.results[1].reason, /otro dispositivo/);
    assert.match(body.results[3].reason, /Restricción/);
    assert.equal(await count('sales'), 0);
    assert.equal(await count('sync_events'), 0);
});

test('el cierre antes que la apertura deja la sesión completa (RF-10)', async () => {
    const sessionId = randomUUID();
    await send([sessionEvent('session_closed', sessionId)]);
    await send([sessionEvent('session_opened', sessionId)]);
    const { rows } = await pool.query('select opened_at, closed_at from sessions where id = $1', [sessionId]);
    assert.ok(rows[0].opened_at);
    assert.ok(rows[0].closed_at);
});

test('sincronizar ventas no cambia central_stock (CA-8, RF-11)', async () => {
    const before = (await pool.query('select central_stock from products where id = $1', [WATER])).rows[0].central_stock;
    await send([saleEvent(device.deviceId, 5)]);
    const after = (await pool.query('select central_stock from products where id = $1', [WATER])).rows[0].central_stock;
    assert.equal(after, before);
});

for (const [name, body] of [
    ['sin batch_id', { sent_at: new Date().toISOString(), events: [{ event_id: randomUUID() }] }],
    ['events vacío', { batch_id: randomUUID(), sent_at: new Date().toISOString(), events: [] }],
    ['51 eventos', { batch_id: randomUUID(), sent_at: new Date().toISOString(), events: Array.from({ length: 51 }, () => ({ event_id: randomUUID() })) }],
    ['event_id repetido', (() => { const id = randomUUID(); return { batch_id: randomUUID(), sent_at: new Date().toISOString(), events: [{ event_id: id }, { event_id: id }] }; })()],
    ['event_id no UUID', { batch_id: randomUUID(), sent_at: new Date().toISOString(), events: [{ event_id: 'abc' }] }],
] as const) {
    test(`sobre inválido (${name}) ⇒ 400 VALIDATION_ERROR`, async () => {
        const res = await postJson(`${server.url}/sync/events`, body, device.secret);
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    });
}

test('la venta guarda su session_id', async () => {
    const sale = saleEvent();
    await send([sale]);
    const { rows } = await pool.query('select session_id from sales where id = $1', [sale.event_id]);
    assert.equal(rows[0].session_id, sale.payload.sale.session_id);
});

// SPEC-011: reintentos de sync.
test('lote cortado: lo ya guardado responde duplicate y lo demás inserted, sin repetir ventas (SPEC-011 CA-5, RF-7)', async () => {
    const events = [saleEvent(), saleEvent(), saleEvent(), saleEvent()];
    const first = await send(events.slice(0, 2)); // el servidor guardó dos y la respuesta no llegó al teléfono
    assert.deepEqual(statuses(first.body), ['inserted', 'inserted']);

    const retry = await send(events);
    assert.equal(retry.status, 200);
    assert.deepEqual(statuses(retry.body), ['duplicate', 'duplicate', 'inserted', 'inserted']);
    assert.equal(await count('sales'), 4);
    assert.equal(await count('sale_items'), 4);
    assert.equal(await count('sync_events'), 4);
});

test('el mismo lote dos veces a la vez: cada evento una sola vez y sin errores (SPEC-011 CA-6, RF-8)', async () => {
    const events = Array.from({ length: 5 }, () => saleEvent());
    const [a, b] = await Promise.all([send(events), send(events)]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    events.forEach((_, i) => {
        assert.deepEqual([a.body.results[i].status, b.body.results[i].status].sort(), ['duplicate', 'inserted']);
    });
    assert.equal(await count('sales'), 5);
    assert.equal(await count('sale_items'), 5);
    assert.equal(await count('sync_events'), 5);
});
