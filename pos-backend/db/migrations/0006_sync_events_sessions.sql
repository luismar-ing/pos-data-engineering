-- SPEC-008: idempotencia de todos los tipos de evento y sesiones de vendedor.
create table sync_events (
    event_id uuid primary key,
    device_id text not null references devices(id),
    event_type text not null,
    batch_id uuid not null,
    received_at timestamptz not null default now()
);

-- Las ventas recibidas antes de esta spec ya eran eventos sale_created (sale.id = event_id).
insert into sync_events (event_id, device_id, event_type, batch_id, received_at)
select id, device_id, 'sale_created', '00000000-0000-0000-0000-000000000000', received_at from sales;

create table sessions (
    id uuid primary key,
    device_id text not null references devices(id),
    seller_name text not null check (length(trim(seller_name)) > 0),
    opened_at timestamptz,          -- nulo si el cierre llegó antes que la apertura
    closed_at timestamptz,
    received_at timestamptz not null default now()
);
