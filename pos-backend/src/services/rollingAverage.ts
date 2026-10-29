import {pool} from '../db/pool.js';

const SESSION_MINUTES = 5;
const LEASE_MINUTES = 3;
const LEASE_MARGIN = 1.2;
const MIN_LEASE = 5;

export async function calculateLeaseQty(productId: string): Promise<number> {
     const stockResult = await pool.query(
        `select central_stock from products where id = $1`,
        [productId]
    );
    const remainingStock = stockResult.rows[0]?.central_stock ?? 0;
    
    if (remainingStock <= 0) {
        return 0;
    }
    
    const result = await pool.query(
        `select coalesce(sum(quantity), 0) as total_units
        from sale_events
        where product_id = $1 and created_at > now() - ($2 * interval '1 minute')`,
        [productId, SESSION_MINUTES]
    );

    const totalUnits = Number(result.rows[0].total_units);
    const unitsPerMinute = totalUnits / SESSION_MINUTES;
    const estimatedLease = Math.ceil(unitsPerMinute * LEASE_MINUTES * LEASE_MARGIN);

    const preferedLease = Math.max(estimatedLease, MIN_LEASE);

    return Math.min(preferedLease, remainingStock);
}