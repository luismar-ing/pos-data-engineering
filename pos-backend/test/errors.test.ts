import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

let server: Awaited<ReturnType<typeof startServer>>;
let secret: string;
before(async () => { await resetDb(); server = await startServer(); ({ secret } = await registerDevice(server.url)); });
after(async () => { await server.close(); await pool.end(); });

test('JSON mal formado → 400 INVALID_JSON', async () => {
    const res = await postJson(`${server.url}/prestamos/request`, '{"product_id":');
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: { code: 'INVALID_JSON', message: 'El cuerpo no es JSON válido' } });
});

test('cuerpo demasiado grande → 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await postJson(`${server.url}/sync/events`, { events: [], pad: 'x'.repeat(200_000) });
    assert.equal(res.status, 413);
    assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('ruta inexistente → 404 NOT_FOUND', async () => {
    const res = await fetch(`${server.url}/no-existe`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

for (const [name, body] of [['sin product_id', {}], ['product_id no UUID', { product_id: 'abc' }]] as const) {
    test(`POST /prestamos/request ${name} → 400 VALIDATION_ERROR`, async () => {
        const res = await postJson(`${server.url}/prestamos/request`, body, secret);
        assert.equal(res.status, 400);
        const { error } = await res.json();
        assert.equal(error.code, 'VALIDATION_ERROR');
        assert.equal(error.details[0].path, 'product_id');
    });
}

test('POST /prestamos/request válido → 200 con el contrato de siempre', async () => {
    const product_id = '11111111-1111-4111-8111-111111111111';
    const res = await postJson(`${server.url}/prestamos/request`, { product_id }, secret);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['created_at', 'product_id', 'qty_total']);
    assert.equal(body.product_id, product_id);
});

for (const path of ['/prestamos/request', '/sync/events']) {
    for (const [name, credential] of [['sin credencial', undefined], ['credencial falsa', 'f'.repeat(64)]] as const) {
        test(`POST ${path} ${name} → 401 UNAUTHORIZED (CA-4)`, async () => {
            const before = await pool.query('select count(*)::int as n from sales');
            const res = await postJson(`${server.url}${path}`, { product_id: '11111111-1111-4111-8111-111111111111', events: [] }, credential);
            assert.equal(res.status, 401);
            assert.equal((await res.json()).error.code, 'UNAUTHORIZED');
            const after = await pool.query('select count(*)::int as n from sales');
            assert.equal(after.rows[0].n, before.rows[0].n);
        });
    }
}
