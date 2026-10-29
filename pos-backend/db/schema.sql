create table products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text,
    unit_price numeric(10, 2) not null,
    central_stock integer not null default 0,
    active boolean not null default true
);

create table device_sessions (
    id uuid primary key default gen_random_uuid(),
    device_id text not null,
    event_id text not null,
    created_at timestamptz not null default now()
);

create table sale_events (
    event_id text primary key,
    device_id text not null,
    product_id uuid not null references products(id),
    quantity integer not null,
    created_at timestamptz not null,
    received_at timestamptz not null default now()
);

create index idx_sale_events_product_time on sale_events(product_id, created_at);