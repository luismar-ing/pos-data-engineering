-- SPEC-001: catálogo y dispositivos.
create table products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text,
    unit_price_cents integer not null check (unit_price_cents >= 0),
    central_stock integer not null default 0 check (central_stock >= 0),
    active boolean not null default true
);

-- Registro mínimo de dispositivos. Identidad y sesiones se definen en SPEC-003.
create table devices (
    id text primary key,
    name text,
    created_at timestamptz not null default now()
);
