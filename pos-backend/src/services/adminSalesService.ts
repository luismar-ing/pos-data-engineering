// SPEC-013 RF-10..RF-12: ventas consolidadas de todos los dispositivos para GET /admin/sales.
import type { Pool } from 'pg';

const TOP_LIMIT = 5;

// Rango [from, to) sobre sales.created_at (hora del teléfono al cobrar). Montos en bigint: ::bigint llega como texto.
const RANGE = 's.created_at >= $1 and s.created_at < $2';

const TOTALS_SQL = `
    select coalesce(sum(s.total_cents), 0)::bigint as revenue_cents, count(*)::int as sales
    from sales s where ${RANGE}`;

// Todos los dispositivos, también sin ventas en el rango, para ver su último contacto (RF-12).
const BY_DEVICE_SQL = `
    select d.id as device_id, d.name, coalesce(sum(s.total_cents), 0)::bigint as revenue_cents, count(s.id)::int as sales,
           d.last_seen_at, (select max(e.received_at) from sync_events e where e.device_id = d.id) as last_sync_at
    from devices d
    left join sales s on s.device_id = d.id and ${RANGE}
    group by d.id
    order by revenue_cents desc, d.name, d.id`;

const BY_SESSION_SQL = `
    select s.session_id, se.seller_name, s.device_id, sum(s.total_cents)::bigint as revenue_cents, count(*)::int as sales
    from sales s left join sessions se on se.id = s.session_id
    where ${RANGE}
    group by s.session_id, se.seller_name, s.device_id
    order by revenue_cents desc, se.seller_name nulls last, s.device_id`;

const BY_HOUR_SQL = `
    select date_trunc('hour', s.created_at, 'UTC') as hour, sum(s.total_cents)::bigint as revenue_cents, count(*)::int as sales
    from sales s where ${RANGE}
    group by 1 order by 1`;

const BY_PAYMENT_SQL = `
    select s.payment_method, sum(s.total_cents)::bigint as revenue_cents, count(*)::int as sales
    from sales s where ${RANGE}
    group by s.payment_method order by revenue_cents desc, s.payment_method`;

const TOP_PRODUCTS_SQL = `
    select si.product_id, p.name, sum(si.quantity)::int as units, sum(si.quantity * si.unit_price_cents)::bigint as revenue_cents
    from sale_items si
    join sales s on s.id = si.sale_id
    join products p on p.id = si.product_id
    where ${RANGE}
    group by si.product_id, p.name
    order by units desc, revenue_cents desc, p.name
    limit ${TOP_LIMIT}`;

type Money<T> = Omit<T, 'revenue_cents'> & { revenue_cents: number };
const money = <T extends { revenue_cents: string }>(rows: T[]): Money<T>[] =>
    rows.map((row) => ({ ...row, revenue_cents: Number(row.revenue_cents) }));

export async function salesSummary(pool: Pool, from: Date, to: Date) {
    const client = await pool.connect();
    try {
        // Una sola foto de la BD: una sync en medio no deja desgloses que no sumen el total.
        await client.query('begin isolation level repeatable read read only');
        const params = [from, to];
        const [totals, byDevice, bySession, byHour, byPayment, top] = [
            (await client.query<{ revenue_cents: string; sales: number }>(TOTALS_SQL, params)).rows[0]!,
            (await client.query(BY_DEVICE_SQL, params)).rows,
            (await client.query(BY_SESSION_SQL, params)).rows,
            (await client.query(BY_HOUR_SQL, params)).rows,
            (await client.query(BY_PAYMENT_SQL, params)).rows,
            (await client.query(TOP_PRODUCTS_SQL, params)).rows,
        ];
        await client.query('commit');

        const revenue = Number(totals.revenue_cents);
        return {
            generated_at: new Date().toISOString(),
            from: from.toISOString(),
            to: to.toISOString(),
            // Ticket promedio en centavos enteros, 0 sin ventas (igual que SPEC-009).
            totals: { revenue_cents: revenue, sales: totals.sales, average_ticket_cents: totals.sales > 0 ? Math.round(revenue / totals.sales) : 0 },
            by_device: money(byDevice),
            by_session: money(bySession),
            by_hour: money(byHour),
            by_payment_method: money(byPayment),
            top_products: money(top),
        };
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}
