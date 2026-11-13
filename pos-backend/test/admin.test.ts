// SPEC-013 T6: login, bloqueo, vencimiento, logout y credenciales separadas (ADR-0007).
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { setAdmin } from '../src/services/adminAuthService.js';
import { pool, postJson, registerDevice, resetDb, startServer } from './helpers.js';

const PASSWORD = 'clave-segura-1';
const HOT_DOG = '55555555-5555-4555-8555-555555555555';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { server = await startServer(); });
beforeEach(async () => { await resetDb(); await setAdmin(pool, 'admin', PASSWORD); });
after(async () => { await server.close(); await pool.end(); });

const loginAs = (username: string, password: string) => postJson(`${server.url}/admin/login`, { username, password });
const logoutWith = (token: string) => postJson(`${server.url}/admin/logout`, {}, token);

async function loginOk(): Promise<{ token: string; username: string; expires_at: string }> {
    const res = await loginAs('admin', PASSWORD);
    assert.equal(res.status, 200);
    return res.json();
}

async function expectInvalid(res: Response) {
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'INVALID_CREDENTIALS');
}

test('login correcto: token de 64 hex y sesión de 8 h, sin contraseña ni hash en la respuesta (CA-4, RNF-1)', async () => {
    const before = Date.now();
    const body = await loginOk();
    assert.deepEqual(Object.keys(body).sort(), ['expires_at', 'token', 'username']);
    assert.match(body.token, /^[0-9a-f]{64}$/);
    assert.equal(body.username, 'admin');
    const hours = (Date.parse(body.expires_at) - before) / 3_600_000;
    assert.ok(hours > 7.99 && hours < 8.01, `vence en ${hours} h`);

    // En la BD solo queda el hash del token.
    const { rows } = await pool.query('select token_hash from admin_sessions');
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token_hash, body.token);
});

test('contraseña incorrecta y usuario inexistente dan el mismo 401 (RF-6)', async () => {
    const [wrong, unknown] = await Promise.all([loginAs('admin', 'otra-clave'), loginAs('nadie', PASSWORD)]);
    const [a, b] = [await wrong.json(), await unknown.json()];
    assert.equal(wrong.status, 401);
    assert.deepEqual(a, b);
    assert.equal(a.error.code, 'INVALID_CREDENTIALS');
});

test('cuerpo inválido: 400 VALIDATION_ERROR', async () => {
    const res = await postJson(`${server.url}/admin/login`, { username: 'admin' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('5 fallos bloquean 15 min aunque luego llegue la correcta; al vencer el bloqueo entra (CA-5)', async () => {
    for (let i = 0; i < 4; i++) await expectInvalid(await loginAs('admin', 'otra-clave'));
    assert.equal((await pool.query('select failed_attempts from admins')).rows[0].failed_attempts, 4);
    await expectInvalid(await loginAs('admin', 'otra-clave'));

    const { rows: [locked] } = await pool.query(`select extract(epoch from locked_until - now()) / 60 as minutes from admins`);
    assert.ok(locked.minutes > 14.9 && locked.minutes <= 15, `bloqueado ${locked.minutes} min`);
    await expectInvalid(await loginAs('admin', PASSWORD));

    await pool.query(`update admins set locked_until = now() - interval '1 second'`);
    await loginOk();
    assert.deepEqual((await pool.query('select failed_attempts, locked_until from admins')).rows[0], { failed_attempts: 0, locked_until: null });
});

test('un login correcto reinicia el contador de fallos', async () => {
    for (let i = 0; i < 4; i++) await expectInvalid(await loginAs('admin', 'otra-clave'));
    await loginOk();
    for (let i = 0; i < 4; i++) await expectInvalid(await loginAs('admin', 'otra-clave'));
    await loginOk(); // con 4 + 4 fallos sin reinicio ya estaría bloqueado
});

test('5 fallos simultáneos dejan el usuario bloqueado (RF-7)', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => loginAs('admin', 'otra-clave')));
    for (const res of results) await expectInvalid(res);
    await expectInvalid(await loginAs('admin', PASSWORD));
});

test('sesión vencida: 401 UNAUTHORIZED (CA-7)', async () => {
    const { token } = await loginOk();
    await pool.query(`update admin_sessions set expires_at = now() - interval '1 second'`);
    const res = await logoutWith(token);
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'UNAUTHORIZED');
});

test('logout cierra solo esa sesión; repetirlo da 401 (RF-8)', async () => {
    const [first, second] = [await loginOk(), await loginOk()];
    assert.equal((await logoutWith(first.token)).status, 204);
    assert.equal((await logoutWith(first.token)).status, 401);
    assert.equal((await pool.query('select count(*)::int as n from admin_sessions')).rows[0].n, 1);
    assert.equal((await logoutWith(second.token)).status, 204);
});

test('sin credencial o con una desconocida, las rutas del panel dan 401', async () => {
    assert.equal((await postJson(`${server.url}/admin/logout`, {})).status, 401);
    assert.equal((await logoutWith('f'.repeat(64))).status, 401);
});

test('credenciales separadas: el secreto del dispositivo no entra al panel y el token de admin no vende ni sincroniza (CA-8)', async () => {
    const device = await registerDevice(server.url);
    const { token } = await loginOk();

    assert.equal((await logoutWith(device.secret)).status, 401);
    assert.equal((await postJson(`${server.url}/prestamos/request`, { product_ids: [HOT_DOG] }, token)).status, 401);
    assert.equal((await postJson(`${server.url}/prestamos/close`, { leases: [] }, token)).status, 401);
    assert.equal((await postJson(`${server.url}/sync/events`, { batch_id: crypto.randomUUID(), events: [] }, token)).status, 401);
});

test('una petición del dispositivo marca su último contacto (RF-12)', async () => {
    const device = await registerDevice(server.url);
    const seen = async () => (await pool.query('select last_seen_at from devices where id = $1', [device.deviceId])).rows[0].last_seen_at;
    assert.equal(await seen(), null);

    assert.equal((await postJson(`${server.url}/prestamos/request`, { product_ids: [HOT_DOG] }, device.secret)).status, 200);
    const at = await seen();
    assert.ok(at instanceof Date && Date.now() - at.getTime() < 5_000);
});
