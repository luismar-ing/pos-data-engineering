// Uso: tsx src/db/cli.ts migrate|seed|reset-scenario|demo-reset|demo-init|report|admin-set <usuario>
import type { Pool } from 'pg';
import { config } from '../config.js';
import { initDemo, resetDemo } from '../dev/demo.js';
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

// SPEC-015: estado inicial de la demo (catálogo de 20 productos e historial de "Caja 2 (demo)").
async function demoResetCommand(p: Pool) {
    assertDevDatabase(config.dbUrl);
    const started = Date.now();
    await resetDemo(p);
    console.log(`demo: lista en ${Date.now() - started} ms (20 productos, Hot dog en 10, historial de "Caja 2 (demo)"; teléfonos activos)`);
}

// SPEC-016: arranque en Render (ADR-0009). La contraseña llega por ADMIN_PASSWORD y no se imprime.
async function demoInitCommand(p: Pool) {
    assertDevDatabase(config.dbUrl);
    const { demoLoaded, adminCreated } = await initDemo(p, { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD });
    console.log(`demo-init: ${demoLoaded ? 'demo cargada' : 'la base ya tenía productos'}; ${adminCreated ? `administrador "${process.env.ADMIN_USERNAME}" creado` : 'sin administrador nuevo'}`);
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
    'demo-reset': demoResetCommand,
    'demo-init': demoInitCommand,
    report: reportCommand,
    'admin-set': adminSetCommand,
};
const run = commands[process.argv[2] ?? ''];

if (!run) {
    console.error('Uso: tsx src/db/cli.ts migrate|seed|reset-scenario|demo-reset|demo-init|report|admin-set <usuario>');
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
