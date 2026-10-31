-- SPEC-003: autenticación de dispositivos y sesión en ventas.
-- token_hash = sha256 del secreto que genera el dispositivo; nunca se guarda el secreto.
alter table devices add column token_hash text;
create unique index devices_token_hash_key on devices(token_hash);

-- Ventas previas de dispositivos que no existen en devices (solo datos de desarrollo).
insert into devices (id) select distinct device_id from sales on conflict do nothing;
alter table sales add constraint sales_device_id_fkey foreign key (device_id) references devices(id);

-- Nulo solo en ventas anteriores a SPEC-003. Las sesiones viven en el dispositivo (SPEC-008 las sincroniza).
alter table sales add column session_id uuid;
