export const SCHEMA_SQL = `
create table if not exists products (
    id text primary key,
    stock integer unique not null,
    name text not null,
    category text,
    unit_price real not null,
    active integer not null default 1,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))

);

create table if not exists stock_leases (
    id text primary key,
    product_id text not null references products(id) on delete cascade,
    session_id text not null,
    quota_total integer not null,
    quota_used integer not null default 0,
    status text not null default 'active',
    issued_at text not null default (datetime('now'))
);

create table if not exist sales (
    id text primary key,
    device_id text not null,
    total_amount real not null
    payment_method text not null,
    sync_status text not null default 'pending',
    created_at text not null default (datetime('now'))
);

create table if not exist sale_items (
    id text primary key,
    sale_id text not null references sales(id) on delete cascade,
    product_id text not null references products(id) on delete cascade,
    quantity integer not null,
    unit_price real not null
);

create table if not exist event_log (
    id text primary key,
    event_type text not null,
    entity_type text not null,
    entity_id text not null,
    payload_json text not null,
    sync_status text not null default 'pending',
    created_at text not null default (datetime('now'))
    synced_at text
);

create index if not exists idx_event_log_sync_status on event_log(sync_status);
create index if not exists idx_stock_leases_product on stock_leases(product_id, status);
`;

 