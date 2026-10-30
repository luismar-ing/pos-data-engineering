/**
 * Migraciones del esquema local. La posición en el arreglo es la versión:
 * MIGRATIONS[0] lleva la BD de la versión 0 a la 1, y así sucesivamente.
 * Nunca editar una migración ya publicada: agregar una nueva al final.
 */
export const MIGRATIONS: string[] = [
  // v1 — SPEC-001: modelo de datos unificado.
  // Borra las tablas del esquema anterior (sin versión y con errores); solo tenían datos de prueba.
  `
  drop table if exists sale_items;
  drop table if exists sales;
  drop table if exists stock_leases;
  drop table if exists event_log;
  drop table if exists products;

  create table products (
    id text primary key,
    name text not null,
    category text,
    unit_price_cents integer not null check (unit_price_cents >= 0),
    active integer not null default 1,
    updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  create table stock_leases (
    id text primary key,
    device_id text not null,
    product_id text not null references products(id),
    quota_total integer not null check (quota_total >= 0),
    quota_used integer not null default 0 check (quota_used >= 0 and quota_used <= quota_total),
    status text not null default 'active' check (status in ('active', 'expired', 'released')),
    issued_at text not null,
    expires_at text
  );

  create table sales (
    id text primary key,
    device_id text not null,
    total_cents integer not null check (total_cents >= 0),
    payment_method text not null,
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  create table sale_items (
    id text primary key,
    sale_id text not null references sales(id),
    product_id text not null references products(id),
    quantity integer not null check (quantity > 0),
    unit_price_cents integer not null check (unit_price_cents >= 0)
  );

  create table event_log (
    id text primary key,
    event_type text not null,
    entity_type text not null,
    entity_id text not null,
    payload_json text not null,
    sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'failed')),
    created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at text
  );

  create index idx_event_log_sync_status on event_log(sync_status, created_at);
  create index idx_stock_leases_product on stock_leases(product_id, status);
  create index idx_sale_items_product on sale_items(product_id);
  `,
];
