// Uso: tsx src/db/cli.ts migrate|seed|reset-scenario|report|admin-set <usuario>
import type { Pool } from 'pg';
import { config } from '../config.js';
import { assertDevDatabase, resetScenario } from '../dev/scenario.js';
import { stockReport, type StockStatus } from '../services/stockService.js';
import { setAdmin } from '../services/adminAuthService.js';
import { pool } from './pool.js';
import { migrate, seed } from './migrate.js';

// SPEC-011: escenario de dos dispositivos y reporte de consistencia del stock.
const STATUS_TEXT: Record<StockStatus, string> = {
    ok: 'ok',
    no_cuadra: 'inconsistente: el total no cuadra',
    sync_supera_stock: 'inconsistente: sync vende más que el stock',
    sin_stock_inicial: 'sin stock inicial',
};

async function resetCommand(p: Pool) {
    assertDevDatabase(config.dbUrl);
    await resetScenario(p);
    console.log('scenario: listo (sin préstamos, ventas, eventos ni sesiones; Hot dog en 10)');
}

async function reportCommand(p: Pool) {
    const started = Date.now();
    const rows = await stockReport(p);
    console.table(
        rows.map((r) => ({
            producto: r.name,
            inicial: r.initial_stock ?? '—',
            central: r.central_stock,
            prestado: r.leased_active,
            informado: r.reported_sold,
            'vendido sync': r.synced_sold,
            total: r.balance,
            estado: STATUS_TEXT[r.status],
        }))
    );
    console.log(`report: ${Date.now() - started} ms`);
    if (rows.some((r) => r.status === 'no_cuadra' || r.status === 'sync_supera_stock')) process.exitCode = 1; // sirve en scripts
}

// SPEC-013 RF-9: la contraseña llega por ADMIN_PASSWORD, nunca por argumentos (no queda en el historial del shell).
async function adminSetCommand(p: Pool) {
    const username = process.argv[3] ?? '';
    const { created } = await setAdmin(p, username, process.env.ADMIN_PASSWORD);
    console.log(created ? `admin: creado "${username}"` : `admin: contraseña cambiada para "${username}"; sus sesiones se cerraron`);
}

const commands: Record<string, (p: Pool) => Promise<unknown>> = {
    migrate,
    seed,
    'reset-scenario': resetCommand,
    report: reportCommand,
    'admin-set': adminSetCommand,
};
const run = commands[process.argv[2] ?? ''];

if (!run) {
    console.error('Uso: tsx src/db/cli.ts migrate|seed|reset-scenario|report|admin-set <usuario>');
    process.exit(1);
}

try {
    await run(pool);
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
