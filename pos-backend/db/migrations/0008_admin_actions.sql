-- SPEC-014: baja de dispositivos, préstamo de cada venta, conciliación y registro de cambios del panel.

-- RF-2, RF-7: baja de dispositivo (nulo = activo).
alter table devices add column revoked_at timestamptz;

-- RF-6: lo que informó un teléfono al cerrar tarde un préstamo que el servidor ya cerró como 'expired'.
alter table stock_leases add column quota_reported integer check (quota_reported >= 0);
-- releaseRevokedLeases: préstamos activos por vencimiento.
create index idx_stock_leases_active_expires on stock_leases(expires_at) where status = 'active';
-- Conciliación: préstamos cerrados por fecha de cierre.
create index idx_stock_leases_closed_at on stock_leases(closed_at) where status <> 'active';

-- RF-8: préstamo de cada línea. Sin FK: un id desconocido no debe trabar la sync del teléfono.
alter table sale_items add column lease_id uuid;
create index idx_sale_items_lease on sale_items(lease_id);

-- RF-18, RNF-2: registro de cambios; request_id lo genera la app y hace idempotente cada acción.
create table admin_audit (
    request_id uuid primary key,
    admin_id uuid not null references admins(id),
    action text not null check (action in ('device_revoke', 'device_reactivate', 'product_create', 'product_update', 'stock_adjust')),
    entity_id text not null,
    before jsonb,
    after jsonb,
    created_at timestamptz not null default now()
);
create index idx_admin_audit_created on admin_audit(created_at desc);
