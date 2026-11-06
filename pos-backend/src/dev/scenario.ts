// SPEC-011: escenario de prueba con dos dispositivos y reporte de consistencia del stock. Solo desarrollo.
import type { Pool } from 'pg';
import { seed } from '../db/migrate.js';

/** Stock inicial del escenario: el del seed de desarrollo, con "Hot dog" en 10 para la prueba (P2). */
export const SCENARIO_STOCK: Record<string, number> = {
    '11111111-1111-4111-8111-111111111111': 200, // Agua 600 ml
    '22222222-2222-4222-8222-222222222222': 150, // Refresco 355 ml
    '33333333-3333-4333-8333-333333333333': 300, // Cerveza 355 ml
    '44444444-4444-4444-8444-444444444444': 80, // Papas fritas
    '55555555-5555-4555-8555-555555555555': 10, // Hot dog
};

const DEV_DATABASES = ['posde', 'posde_test'];

/** El reinicio borra datos: solo contra la base de desarrollo o la de pruebas (RNF-3). */
export function assertDevDatabase(dbUrl: string): void {
    let name: string;
    try {
        name = new URL(dbUrl).pathname.replace(/^\//, '');
    } catch {
        throw new Error('DB_URL no es una URL válida');
    }
    if (!DEV_DATABASES.includes(name)) {
        throw new Error(`El escenario solo corre en ${DEV_DATABASES.join(' o ')}; DB_URL apunta a "${name}"`);
    }
}

/** Deja el backend como al inicio del escenario: sin préstamos, ventas, eventos ni sesiones, y con SCENARIO_STOCK (RF-2). */
export async function resetScenario(pool: Pool): Promise<void> {
    await seed(pool); // on conflict do nothing: solo asegura que existan los productos
    const client = await pool.connect();
    try {
        await client.query('begin');
        // Los dispositivos se quedan: un teléfono ya registrado no se registra de nuevo solo.
        await client.query('delete from sync_events');
        await client.query('delete from sale_items');
        await client.query('delete from sales');
        await client.query('delete from sessions');
        await client.query('delete from stock_leases');
        for (const [id, stock] of Object.entries(SCENARIO_STOCK)) {
            await client.query('update products set central_stock = $2, active = true where id = $1', [id, stock]);
        }
        await client.query('commit');
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}

/** Por producto: stock central, cuota activa, vendido informado al cerrar y unidades por sync (RF-4). Solo lectura (RF-6). */
export const STOCK_REPORT_SQL = `
    select p.id, p.name, p.central_stock,
           coalesce(sum(l.quota_total) filter (where l.status = 'active'), 0)::int as leased_active,
           coalesce(sum(l.quota_used) filter (where l.status = 'released'), 0)::int as reported_sold,
           (select coalesce(sum(si.quantity), 0) from sale_items si where si.product_id = p.id)::int as synced_sold
    from products p
    left join stock_leases l on l.product_id = p.id
    group by p.id
    order by p.name
`;

export interface StockRow {
    id: string;
    name: string;
    central_stock: number;
    leased_active: number;
    reported_sold: number;
    synced_sold: number;
}

export interface StockCheck extends StockRow {
    initial: number | null;
    /** Debe ser igual al stock inicial: lo que salió del stock central solo pasa por los préstamos. */
    balance: number;
    status: 'ok' | 'inconsistente: el total no cuadra' | 'inconsistente: sync vende más que el stock' | 'sin escenario';
}

/** Compara cada producto con su stock inicial (RF-5). */
export function checkStock(rows: StockRow[], initial: Record<string, number> = SCENARIO_STOCK): StockCheck[] {
    return rows.map((row) => {
        const start = initial[row.id] ?? null;
        const balance = row.central_stock + row.leased_active + row.reported_sold;
        const status: StockCheck['status'] =
            start === null
                ? 'sin escenario'
                : row.synced_sold > start
                  ? 'inconsistente: sync vende más que el stock'
                  : balance !== start
                    ? 'inconsistente: el total no cuadra'
                    : 'ok';
        return { ...row, initial: start, balance, status };
    });
}

export async function stockReport(pool: Pool): Promise<StockCheck[]> {
    const { rows } = await pool.query<StockRow>(STOCK_REPORT_SQL);
    return checkStock(rows);
}
