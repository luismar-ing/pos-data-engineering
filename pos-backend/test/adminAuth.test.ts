// SPEC-013 T5: contraseñas y cuentas de administrador (ADR-0007).
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { hashPassword, setAdmin, verifyPassword } from '../src/services/adminAuthService.js';
import { pool, resetDb } from './helpers.js';

beforeEach(resetDb);
after(() => pool.end());

test('hashPassword: formato scrypt con sal distinta cada vez y sin la contraseña (RNF-1)', async () => {
    const [a, b] = [await hashPassword('clave-segura-1'), await hashPassword('clave-segura-1')];
    assert.match(a, /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    assert.notEqual(a, b);
    assert.ok(!a.includes('clave-segura-1'));
});

test('verifyPassword: correcta, incorrecta y hash mal formado', async () => {
    const stored = await hashPassword('clave-segura-1');
    assert.equal(await verifyPassword('clave-segura-1', stored), true);
    assert.equal(await verifyPassword('clave-segura-2', stored), false);
    for (const bad of ['', 'texto', 'bcrypt$1$2$3$aa$bb', 'scrypt$0$8$1$aa$bb', 'scrypt$16384$8$1$aa$', `${stored}$extra`]) {
        assert.equal(await verifyPassword('clave-segura-1', bad), false, bad);
    }
});

test('setAdmin crea el usuario y guarda solo el hash (RF-9)', async () => {
    assert.deepEqual(await setAdmin(pool, 'admin', 'clave-segura-1'), { created: true });
    const { rows } = await pool.query('select username, password_hash, failed_attempts, locked_until from admins');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].username, 'admin');
    assert.ok(!rows[0].password_hash.includes('clave-segura-1'));
    assert.equal(await verifyPassword('clave-segura-1', rows[0].password_hash), true);
});

test('setAdmin sobre un usuario existente: cambia la contraseña, quita el bloqueo y cierra sus sesiones', async () => {
    await setAdmin(pool, 'admin', 'clave-segura-1');
    const { rows: [admin] } = await pool.query(
        `update admins set failed_attempts = 3, locked_until = now() + interval '15 minutes' returning id`
    );
    await pool.query(`insert into admin_sessions (token_hash, admin_id, expires_at) values ('h', $1, now() + interval '8 hours')`, [admin.id]);

    assert.deepEqual(await setAdmin(pool, 'admin', 'clave-segura-2'), { created: false });
    const { rows: [after] } = await pool.query('select password_hash, failed_attempts, locked_until from admins');
    assert.equal(await verifyPassword('clave-segura-2', after.password_hash), true);
    assert.equal(await verifyPassword('clave-segura-1', after.password_hash), false);
    assert.deepEqual([after.failed_attempts, after.locked_until], [0, null]);
    assert.equal((await pool.query('select count(*)::int as n from admin_sessions')).rows[0].n, 0);
});

test('setAdmin rechaza usuario inválido y contraseña corta, larga o ausente sin guardar nada', async () => {
    await assert.rejects(setAdmin(pool, 'Ad', 'clave-segura-1'), /usuario/);
    await assert.rejects(setAdmin(pool, 'admin con espacio', 'clave-segura-1'), /usuario/);
    await assert.rejects(setAdmin(pool, 'admin', 'corta'), /ADMIN_PASSWORD/);
    await assert.rejects(setAdmin(pool, 'admin', 'x'.repeat(201)), /ADMIN_PASSWORD/);
    await assert.rejects(setAdmin(pool, 'admin', undefined), /ADMIN_PASSWORD/);
    assert.equal((await pool.query('select count(*)::int as n from admins')).rows[0].n, 0);
});
