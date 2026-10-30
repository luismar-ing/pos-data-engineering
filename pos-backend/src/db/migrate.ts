import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

// Igual desde src/db/ (tsx) y dist/db/ (compilado), sin depender del cwd.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../db/migrations', import.meta.url));
const SEED_DIR = fileURLToPath(new URL('../../db/seed', import.meta.url));

// shortcut: línea base fija para BD creadas por el init.sh de SPEC-001; borrarla cuando no queden BD de desarrollo anteriores a SPEC-002.
const BASELINE = ['0001_init', '0002_sales', '0003_stock_leases'];

async function sqlFiles(dir: string): Promise<string[]> {
    return (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
}

// shortcut: sin pg_advisory_lock, añadirlo cuando haya despliegue con varias instancias.
export async function migrate(pool: Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
    const client = await pool.connect();
    try {
        // Tabla de control + línea base en una transacción: un corte a medias no deja la tabla vacía.
        await client.query('begin');
        try {
            const { rows: [state] } = await client.query<{ tracked: boolean; legacy: boolean }>(
                `select to_regclass('public.schema_migrations') is not null as tracked,
                        to_regclass('public.products') is not null as legacy`
            );
            await client.query(
                `create table if not exists schema_migrations (
                    version text primary key,
                    applied_at timestamptz not null default now()
                )`
            );
            if (!state?.tracked && state?.legacy) {
                await client.query(
                    `insert into schema_migrations (version) select unnest($1::text[]) on conflict do nothing`,
                    [BASELINE]
                );
                console.log(`migrate: BD existente, registradas como aplicadas: ${BASELINE.join(', ')}`);
            }
            await client.query('commit');
        } catch (error) {
            await client.query('rollback');
            throw error;
        }

        const { rows } = await client.query<{ version: string }>('select version from schema_migrations');
        const applied = new Set(rows.map((r) => r.version));
        const pending = (await sqlFiles(dir)).filter((f) => !applied.has(f.replace(/\.sql$/, '')));

        for (const file of pending) {
            const sql = await readFile(path.join(dir, file), 'utf8');
            await client.query('begin');
            try {
                await client.query(sql);
                await client.query('insert into schema_migrations (version) values ($1)', [file.replace(/\.sql$/, '')]);
                await client.query('commit');
                console.log(`migrate: aplicada ${file}`);
            } catch (error) {
                await client.query('rollback');
                console.error(`migrate: falló ${file}`);
                throw error;
            }
        }
        if (pending.length === 0) console.log('migrate: nada pendiente');
        return pending;
    } finally {
        client.release();
    }
}

export async function seed(pool: Pool, dir = SEED_DIR): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('begin');
        for (const file of await sqlFiles(dir)) {
            await client.query(await readFile(path.join(dir, file), 'utf8'));
            console.log(`seed: aplicada ${file}`);
        }
        await client.query('commit');
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}
