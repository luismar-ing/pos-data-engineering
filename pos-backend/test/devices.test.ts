import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { pool, postJson, resetDb, startServer } from './helpers.js';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { await resetDb(); server = await startServer(); });
after(async () => { await server.close(); await pool.end(); });

const secret = () => randomBytes(32).toString('hex');
const register = (body: unknown) => postJson(`${server.url}/devices/register`, body);

test('registro nuevo → 201 y el servidor guarda solo el hash', async () => {
    const body = { device_id: randomUUID(), name: 'Pixel 7', secret: secret() };
    const res = await register(body);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { device_id: body.device_id, name: 'Pixel 7' });

    const { rows } = await pool.query('select token_hash from devices where id = $1', [body.device_id]);
    assert.notEqual(rows[0].token_hash, body.secret);
    assert.equal(rows[0].token_hash.length, 64);
});

test('reintento con mismo id y secreto → 200, un solo dispositivo, nombre actualizado (CA-3)', async () => {
    const body = { device_id: randomUUID(), name: 'Pixel 7', secret: secret() };
    await register(body);
    const res = await register({ ...body, name: 'Caja 2' });
    assert.equal(res.status, 200);

    const { rows } = await pool.query('select count(*)::int as n, max(name) as name from devices where id = $1', [body.device_id]);
    assert.deepEqual(rows[0], { n: 1, name: 'Caja 2' });
});

test('mismo id con otro secreto → 409 DEVICE_CONFLICT', async () => {
    const body = { device_id: randomUUID(), name: 'Pixel 7', secret: secret() };
    await register(body);
    const res = await register({ ...body, secret: secret() });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, 'DEVICE_CONFLICT');
});

for (const [name, body] of [
    ['id no UUID', { device_id: 'abc', name: 'x', secret: 'a'.repeat(64) }],
    ['secreto corto', { device_id: randomUUID(), name: 'x', secret: 'abc' }],
    ['sin nombre', { device_id: randomUUID(), name: ' ', secret: 'a'.repeat(64) }],
] as const) {
    test(`registro con ${name} → 400`, async () => {
        const res = await register(body);
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
    });
}
