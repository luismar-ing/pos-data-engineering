// SPEC-009: consultas de agregación del panel. Sin imports: test/analytics.test.mjs las prueba con node:sqlite.
// Las fechas son ISO-8601 en UTC (toISOString), así que compararlas como texto respeta el orden.

/** La sesión abierta o, si no hay, la última cerrada (RF-9). */
export const TARGET_SESSION_SQL = `
  select id, seller_name, opened_at, closed_at from sessions
  order by closed_at is not null, opened_at desc
  limit 1`;

/** Unidades por producto desde el inicio de la ventana, con la hora de la primera venta (RF-1, RF-2). */
export const WINDOW_SALES_SQL = `
  select si.product_id, p.name, sum(si.quantity) as units, min(s.created_at) as first_sale_at
  from sales s
  join sale_items si on si.sale_id = s.id
  join products p on p.id = si.product_id
  where s.created_at >= ?
  group by si.product_id, p.name`;

/** Lo que queda de cada préstamo activo, con el nombre del producto (RF-3). */
export const LEASE_AVAILABLE_SQL = `
  select l.product_id, p.name, l.quota_total - l.quota_used as available
  from stock_leases l
  join products p on p.id = l.product_id
  where l.status = 'active'`;

/** Ventas e ingreso de la sesión; sin join para no duplicar el total de cada venta (RF-8). */
export const SESSION_TOTALS_SQL = `
  select count(*) as sales, coalesce(sum(total_cents), 0) as revenue_cents from sales where session_id = ?`;

export const SESSION_UNITS_SQL = `
  select coalesce(sum(si.quantity), 0) as units
  from sales s join sale_items si on si.sale_id = s.id
  where s.session_id = ?`;

/** Más vendidos de la sesión por unidades, con su ingreso (RF-7). */
export const TOP_PRODUCTS_SQL = `
  select si.product_id, p.name, sum(si.quantity) as units, sum(si.quantity * si.unit_price_cents) as revenue_cents
  from sales s
  join sale_items si on si.sale_id = s.id
  join products p on p.id = si.product_id
  where s.session_id = ?
  group by si.product_id, p.name
  order by units desc, revenue_cents desc, p.name
  limit ?`;
