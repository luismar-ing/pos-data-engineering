-- SPEC-013: cuentas y sesiones de administrador (ADR-0007), último contacto del dispositivo y stock inicial.
create table admins (
    id uuid primary key default gen_random_uuid(),
    username text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
    password_hash text not null,
    failed_attempts integer not null default 0 check (failed_attempts >= 0),
    locked_until timestamptz,
    created_at timestamptz not null default now()
);

-- Solo el sha256 del token; las vencidas se ignoran por expires_at.
create table admin_sessions (
    token_hash text primary key,
    admin_id uuid not null references admins(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);
create index idx_admin_sessions_admin on admin_sessions(admin_id);

alter table devices add column last_seen_at timestamptz;

-- Stock inicial del reporte (SPEC-011 §3.7). Se rellena para que una base existente cuadre desde ya:
-- central + prestado (active) + informado (released).
alter table products add column initial_stock integer check (initial_stock >= 0);
update products p set initial_stock = p.central_stock
    + coalesce((select sum(l.quota_total) from stock_leases l where l.product_id = p.id and l.status = 'active'), 0)
    + coalesce((select sum(l.quota_used) from stock_leases l where l.product_id = p.id and l.status = 'released'), 0);

-- GET /admin/sales: ventas por dispositivo en un rango.
create index idx_sales_device_created on sales(device_id, created_at);
