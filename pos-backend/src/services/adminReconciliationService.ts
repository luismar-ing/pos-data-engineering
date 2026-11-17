// SPEC-014 RF-10..RF-12: informado al cerrar contra ventas sincronizadas, por préstamo.
import type { Pool } from 'pg';

export type ReconciliationResult = 'cuadra' | 'faltan_ventas' | 'sobran_ventas';

interface LeaseRow {
    lease_id: string;
    device_id: string;
    device_name: string | null;
    product_id: string;
    product_name: string;
    status: 'released' | 'expired';
    closed_at: Date;
    reported: number;
    /** `quota_used` al cierre: en `expired` es lo sincronizado en ese momento. */
    closed_used: number;
    synced: number;
}

const LEASES_SQL = `
    select l.id as lease_id, l.device_id, d.name as device_name, l.product_id, p.name as product_name,
           l.status, l.closed_at,
           case when l.status = 'expired' then coalesce(l.quota_reported, l.quota_used) else l.quota_used end as reported,
           l.quota_used as closed_used,
           (select coalesce(sum(si.quantity), 0) from sale_items si where si.lease_id = l.id)::int as synced
    from stock_leases l
    join devices d on d.id = l.device_id
    join products p on p.id = l.product_id
    where l.status <> 'active' and l.closed_at >= $1 and l.closed_at < $2`;

const UNASSIGNED_SQL = `
    select s.device_id, d.name as device_name, si.product_id, p.name as product_name, sum(si.quantity)::int as units
    from sale_items si
    join sales s on s.id = si.sale_id
    join devices d on d.id = s.device_id
    join products p on p.id = si.product_id
    where si.lease_id is null and s.created_at >= $1 and s.created_at < $2
    group by s.device_id, d.name, si.product_id, p.name
    order by units desc, p.name`;

export function classify(reported: number, synced: number): ReconciliationResult {
    return reported === synced ? 'cuadra' : reported > synced ? 'faltan_ventas' : 'sobran_ventas';
}

export async function reconciliation(pool: Pool, from: Date, to: Date) {
    // Una sola foto de la BD, como el resumen de ventas.
    const client = await pool.connect();
    try {
        await client.query('begin transaction isolation level repeatable read read only');
        const { rows: leaseRows } = await client.query<LeaseRow>(LEASES_SQL, [from, to]);
        const { rows: unassigned } = await client.query(UNASSIGNED_SQL, [from, to]);
        await client.query('commit');

        const leases = leaseRows
            .map(({ closed_used, ...row }) => ({
                ...row,
                result: classify(row.reported, row.synced),
                // RF-6: unidades que el servidor devolvió de más por ventas que llegaron después del cierre.
                returned_extra: row.status === 'expired' ? Math.max(row.synced - closed_used, 0) : 0,
            }))
            .sort((a, b) => Number(a.result === 'cuadra') - Number(b.result === 'cuadra') || b.closed_at.getTime() - a.closed_at.getTime());
        return { generated_at: new Date().toISOString(), from: from.toISOString(), to: to.toISOString(), leases, unassigned };
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}
