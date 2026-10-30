-- SPEC-001: tabla de leases. La lógica de emisión, congelado y liberación es de SPEC-005.
create table stock_leases (
    id uuid primary key default gen_random_uuid(),
    device_id text not null,
    product_id uuid not null references products(id),
    quota_total integer not null check (quota_total >= 0),
    quota_used integer not null default 0 check (quota_used >= 0 and quota_used <= quota_total),
    status text not null default 'active' check (status in ('active', 'expired', 'released')),
    issued_at timestamptz not null default now(),
    expires_at timestamptz
);

create index idx_stock_leases_device_product on stock_leases(device_id, product_id, status);
