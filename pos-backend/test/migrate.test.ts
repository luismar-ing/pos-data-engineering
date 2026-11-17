import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { migrate } from '../src/db/migrate.js';
import { pool } from './helpers.js';

after(() => pool.end());

test('migrate dos veces: la segunda no aplica nada (RF-3)', async () => {
    await migrate(pool);
    assert.deepEqual(await migrate(pool), []);
});

test('0008: columnas e índices de SPEC-014 y admin_audit con request_id único', async () => {
    await migrate(pool);
    const { rows: cols } = await pool.query<{ col: string }>(
        `select table_name || '.' || column_name as col from information_schema.columns
         where (table_name, column_name) in (('devices', 'revoked_at'), ('stock_leases', 'quota_reported'), ('sale_items', 'lease_id'))
         order by 1`
    );
    assert.deepEqual(cols.map((c) => c.col), ['devices.revoked_at', 'sale_items.lease_id', 'stock_leases.quota_reported']);
    const { rows: [audit] } = await pool.query(`select to_regclass('public.admin_audit') as tbl`);
    assert.equal(audit.tbl, 'admin_audit');
});

test('migración con SQL roto: lanza error y no deja nada aplicado (CA-4)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'posde-migr-'));
    try {
        await writeFile(path.join(dir, '9999_broken.sql'), 'create table broken_probe (id int);\nselect * from no_such_table;');
        await assert.rejects(migrate(pool, dir));

        const { rows } = await pool.query(
            `select to_regclass('public.broken_probe') as tbl,
                    exists(select 1 from schema_migrations where version = '9999_broken') as registered`
        );
        assert.equal(rows[0].tbl, null);
        assert.equal(rows[0].registered, false);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('0007 sobre una base con préstamos: initial_stock deja todo cuadrando (SPEC-013 plan §4)', async () => {
    const migrations = fileURLToPath(new URL('../db/migrations', import.meta.url));
    const before = await mkdtemp(path.join(tmpdir(), 'posde-0006-'));
    try {
        for (const file of (await readdir(migrations)).filter((f) => f.endsWith('.sql') && f < '0007')) {
            await copyFile(path.join(migrations, file), path.join(before, file));
        }
        // Base vacía en el estado de 0006 (solo posde_test: ver test/env.ts).
        await pool.query('drop schema public cascade; create schema public;');
        await migrate(pool, before);

        await pool.query(`insert into devices (id, name) values ('d1', 'Uno')`);
        await pool.query(
            `insert into products (id, name, unit_price_cents, central_stock) values
                ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Con préstamos', 100, 40),
                ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sin préstamos', 100, 7)`
        );
        // Prestado 10 (active) + informado 3 de un préstamo de 5 (released; los otros 2 ya volvieron al central).
        await pool.query(
            `insert into stock_leases (device_id, product_id, quota_total, quota_used, status, closed_at) values
                ('d1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 10, 4, 'active', null),
                ('d1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5, 3, 'released', now())`
        );

        assert.equal((await migrate(pool))[0], '0007_admin.sql');
        const { rows } = await pool.query<{ name: string; initial_stock: number }>(
            'select name, initial_stock from products order by name'
        );
        assert.deepEqual(rows, [
            { name: 'Con préstamos', initial_stock: 40 + 10 + 3 },
            { name: 'Sin préstamos', initial_stock: 7 },
        ]);
    } finally {
        await rm(before, { recursive: true, force: true });
    }
});
