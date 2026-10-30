-- SPEC-001: venta = cabecera + líneas (misma forma que en la app).
-- sales.id es el id del evento sale_created generado en el dispositivo: garantiza idempotencia.
create table sales (
    id uuid primary key,
    device_id text not null,
    total_cents integer not null check (total_cents >= 0),
    payment_method text not null,
    created_at timestamptz not null,
    received_at timestamptz not null default now()
);

create table sale_items (
    id uuid primary key,
    sale_id uuid not null references sales(id),
    product_id uuid not null references products(id),
    quantity integer not null check (quantity > 0),
    unit_price_cents integer not null check (unit_price_cents >= 0)
);

create index idx_sales_created on sales(created_at);
create index idx_sale_items_product on sale_items(product_id);
