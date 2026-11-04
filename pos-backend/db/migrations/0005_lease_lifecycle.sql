-- SPEC-005: ciclo de vida del préstamo. Hasta ahora la ruta no guardaba ningún préstamo.
delete from stock_leases;

alter table stock_leases
    add constraint stock_leases_device_fk foreign key (device_id) references devices(id),
    add column closed_at timestamptz,
    add constraint stock_leases_closed check ((status = 'active') = (closed_at is null));

-- RF-5: un préstamo activo por dispositivo y producto.
create unique index idx_stock_leases_one_active on stock_leases(device_id, product_id) where status = 'active';
-- RF-2: tasa por dispositivo desde los préstamos cerrados recientes.
create index idx_stock_leases_rate on stock_leases(device_id, product_id, closed_at);
