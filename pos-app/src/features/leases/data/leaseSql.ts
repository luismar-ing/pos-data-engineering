// SPEC-005: SQL de los préstamos locales. Sin imports: test/leases.test.mjs lo prueba con node:sqlite.

/**
 * Unidades que quedan por producto; solo cuentan los préstamos activos (`closing` no vende) y dentro del tope sin red.
 * Parámetro: `capFrom(now)` (SPEC-014 RF-4).
 */
export const AVAILABLE_SQL = `select product_id, quota_total - quota_used as available from stock_leases where status = 'active' and renew_at > ?`;

export const ACTIVE_LEASES_SQL = `select id, quota_total, quota_used, renew_at from stock_leases where status = 'active'`;

export const HAS_OPEN_SESSION_SQL = 'select 1 from sessions where closed_at is null';

/** Congela lo vendido: el reintento del cierre envía este mismo valor. */
export const MARK_CLOSING_SQL = `update stock_leases set status = 'closing', quota_reported = quota_used where id = ? and status = 'active'`;

export const CLOSING_SQL = `select id, quota_reported from stock_leases where status = 'closing'`;

export const MARK_RELEASED_SQL = `update stock_leases set status = 'released' where id = ? and status = 'closing'`;

export const PRODUCTS_WITHOUT_LEASE_SQL = `
  select p.id from products p
  where p.active = 1
    and not exists (select 1 from stock_leases l where l.product_id = p.id and l.status in ('active', 'closing'))
  order by p.id`;

/** Un préstamo que ya está guardado se ignora: lo vendido localmente manda sobre lo que dice el servidor. */
export const SAVE_LEASE_SQL = `
  insert into stock_leases (id, product_id, quota_total, quota_used, issued_at, renew_at)
  values (?, ?, ?, ?, ?, ?)
  on conflict do nothing`;

/**
 * Descuenta una línea de venta (SPEC-005 RF-7) y devuelve el id del préstamo (SPEC-014 RF-8).
 * Parámetros: cantidad, producto, cantidad, `capFrom(now)`. Sin fila ⇒ sin préstamo vigente o no alcanza.
 */
export const CONSUME_QUOTA_SQL = `
  update stock_leases set quota_used = quota_used + ?
  where product_id = ? and status = 'active' and quota_used + ? <= quota_total and renew_at > ?
  returning id`;
