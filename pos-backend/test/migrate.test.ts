import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { migrate } from '../src/db/migrate.js';
import { pool } from './helpers.js';

after(() => pool.end());

test('migrate dos veces: la segunda no aplica nada (RF-3)', async () => {
    await migrate(pool);
    assert.deepEqual(await migrate(pool), []);
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
