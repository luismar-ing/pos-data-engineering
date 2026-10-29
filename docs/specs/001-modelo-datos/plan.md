# SPEC-001 — Plan técnico

> Supone aceptadas las recomendaciones de P1–P4. Si alguna cambia, ajustar este plan antes de implementar.

## 1. Enfoque
- App: reemplazar `SCHEMA_SQL` por una lista de migraciones numeradas aplicadas con `PRAGMA user_version` dentro de una transacción.
- Backend: pasar de `schema.sql` a `db/migrations/NNNN_*.sql` con una tabla `schema_migrations` (el runner se construye en SPEC-002; aquí solo se escriben los SQL).
- Venta = cabecera + líneas en ambos lados. El evento `sale_created` lleva la venta completa en el payload.

## 2. Trazabilidad
| Requisito | Componente | Cómo se cumple |
|---|---|---|
| RF-1 | `core/db/migrations.ts` | SQL corregido (TD-001..004) |
| RF-2 | `core/db/database.ts` | Lee `user_version`, aplica migraciones > versión |
| RF-3 | tablas `sales`, `sale_items` | Montos en centavos |
| RF-4 | `features/sales/data/saleRepository.ts` | `withTransactionAsync`: sale + items + event_log |
| RF-5 | backend `0002_sales.sql` | `sales.id` PK = id de venta; `on conflict do nothing` |
| RF-6 | tablas `stock_leases` (ambos) | `id` (del servidor), `device_id`, `product_id` |
| RF-7 | columnas `*_cents integer` | Aritmética entera |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/core/db/schema.ts` | Eliminar | Reemplazado por migraciones |
| `src/core/db/migrations.ts` | Crear | `export const MIGRATIONS: string[]` (índice = versión − 1) |
| `src/core/db/database.ts` | Modificar | `PRAGMA foreign_keys = ON`; aplicar migraciones pendientes |
| `src/features/inventory/data/productRepository.ts` | Modificar | `getAllAsync`; tipos con `unit_price_cents` |
| `src/features/sales/data/saleRepository.ts` | Crear | `createSale(sale, items)` atómico + evento |
| `src/App.tsx`, `index.ts` | Limpiar | Imports sin uso (TD-015) |

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `db/migrations/0001_init.sql` | Crear | `products`, `devices` |
| `db/migrations/0002_sales.sql` | Crear | `sales`, `sale_items` (reemplaza `sale_events`) |
| `db/migrations/0003_stock_leases.sql` | Crear | Tabla de leases (lógica en SPEC-005) |
| `db/schema.sql` | Eliminar | Tras migrar |
| `src/services/rollingAverage.ts` | Modificar | Consultar `sale_items` join `sales` |
| `src/routes/sync.ts` | Modificar mínimo | Aceptar forma nueva del evento (validación completa en SPEC-008) |

## 4. Modelo de datos

### SQLite — migración 1
```sql
create table if not exists products (
  id text primary key,
  name text not null,
  category text,
  unit_price_cents integer not null,
  active integer not null default 1,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists stock_leases (
  id text primary key,                 -- emitido por el servidor
  device_id text not null,
  product_id text not null references products(id),
  quota_total integer not null,
  quota_used integer not null default 0 check (quota_used <= quota_total),
  status text not null default 'active' check (status in ('active','expired','released')),
  issued_at text not null,
  expires_at text
);

create table if not exists sales (
  id text primary key,                 -- UUID v4 generado en el dispositivo
  device_id text not null,
  total_cents integer not null,
  payment_method text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists sale_items (
  id text primary key,
  sale_id text not null references sales(id),
  product_id text not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null
);

create table if not exists event_log (
  id text primary key,                 -- UUID del evento (= sale.id para sale_created)
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload_json text not null,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','failed')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  synced_at text
);

create index if not exists idx_event_log_sync_status on event_log(sync_status, created_at);
create index if not exists idx_stock_leases_product on stock_leases(product_id, status);
create index if not exists idx_sale_items_product on sale_items(product_id);
```
Notas: se quita `stock` de `products` local (el stock disponible offline es la suma de leases activos); sin `on delete cascade` en ventas porque los registros son inmutables.

### Postgres — `0002_sales.sql` (resumen)
```sql
create table sales (
  id uuid primary key,
  device_id text not null,
  total_cents integer not null,
  payment_method text not null,
  created_at timestamptz not null,
  received_at timestamptz not null default now()
);
create table sale_items (
  id uuid primary key,
  sale_id uuid not null references sales(id),
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null
);
create index idx_sale_items_product on sale_items(product_id);
create index idx_sales_created on sales(created_at);
```

## 5. Contratos HTTP
Cambia el cuerpo de `POST /sync/events`:
```
Request: { events: [ { event_id, event_type: "sale_created", device_id, created_at,
                       payload: { sale: {...}, items: [...] } } ] }
Response: { received, inserted, duplicated }
```
(Validación, transacción y lotes: SPEC-008.)

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Manual (emulador) | App limpia abre sin errores; `select name from sqlite_master` lista 5 tablas | CA-1 |
| Manual | Subir `user_version` con migración dummy, reabrir, datos intactos | CA-2 |
| Manual / script | Insertar 2 productos con mismo precio/stock | CA-3 |
| Unitaria (cuando exista runner, SPEC-002) | `createSale` → conteos y payload | CA-4 |
| `curl` x2 | Mismo evento dos veces ⇒ 1 venta | CA-5 |
| Unitaria | Suma en centavos | CA-6 |

## 7. Riesgos y alternativas descartadas
- Borrar la BD local existente es aceptable (solo hay datos de prueba): la migración 1 parte de cero. Documentarlo en DEVLOG.
- Descartado mantener `real` para montos (errores de coma flotante).

## 8. Chequeo de constitución
- [x] Nunca sobrevender — stock offline = leases
- [x] Offline-first — venta se escribe local primero
- [x] Eventos inmutables — sin cascadas ni updates de payload
- [x] Idempotencia — id de venta = id de evento = PK en backend
- [x] UI fluida — solo APIs async
- [x] Contratos documentados — §5
