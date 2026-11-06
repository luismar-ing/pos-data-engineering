// Uso: tsx src/db/cli.ts migrate|seed|reset-scenario|report
import type { Pool } from 'pg';
import { config } from '../config.js';
import { assertDevDatabase, resetScenario, stockReport } from '../dev/scenario.js';
import { pool } from './pool.js';
import { migrate, seed } from './migrate.js';

// SPEC-011: escenario de dos dispositivos y reporte de consistencia del stock.
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
            inicial: r.initial ?? '—',
            central: r.central_stock,
            prestado: r.leased_active,
            informado: r.reported_sold,
            'vendido sync': r.synced_sold,
            total: r.balance,
            estado: r.status,
        }))
    );
    console.log(`report: ${Date.now() - started} ms`);
    if (rows.some((r) => r.status.startsWith('inconsistente'))) process.exitCode = 1; // sirve en scripts
}

const commands: Record<string, (p: Pool) => Promise<unknown>> = { migrate, seed, 'reset-scenario': resetCommand, report: reportCommand };
const run = commands[process.argv[2] ?? ''];

if (!run) {
    console.error('Uso: tsx src/db/cli.ts migrate|seed|reset-scenario|report');
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
