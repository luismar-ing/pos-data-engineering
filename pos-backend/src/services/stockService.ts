// Consistencia del stock (SPEC-011 RF-4, RF-5): lo usan `report:stock` y GET /admin/stock (SPEC-013 RF-13, RF-14).
import type { Pool } from 'pg';

/** Por producto: stock inicial, central, cuota activa, vendido informado al cerrar y unidades por sync. Solo lectura. */
export const STOCK_REPORT_SQL = `
    select p.id, p.name, p.initial_stock, p.central_stock,
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
    initial_stock: number | null;
    central_stock: number;
    leased_active: number;
    reported_sold: number;
    synced_sold: number;
}

export type StockStatus = 'ok' | 'no_cuadra' | 'sync_supera_stock' | 'sin_stock_inicial';

export interface StockCheck extends StockRow {
    /** Debe ser igual al stock inicial: lo que salió del stock central solo pasa por los préstamos. */
    balance: number;
    status: StockStatus;
}

/** central + prestado + informado = inicial, y lo vendido por sync no supera el inicial (SPEC-011 RF-5). */
export function checkStock(rows: StockRow[]): StockCheck[] {
    return rows.map((row) => {
        const balance = row.central_stock + row.leased_active + row.reported_sold;
        const status: StockStatus =
            row.initial_stock === null
                ? 'sin_stock_inicial'
                : row.synced_sold > row.initial_stock
                  ? 'sync_supera_stock'
                  : balance !== row.initial_stock
                    ? 'no_cuadra'
                    : 'ok';
        return { ...row, balance, status };
    });
}

export async function stockReport(pool: Pool): Promise<StockCheck[]> {
    const { rows } = await pool.query<StockRow>(STOCK_REPORT_SQL);
    return checkStock(rows);
}
