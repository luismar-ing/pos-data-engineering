# SPEC-014 — Plan técnico

## 1. Enfoque

### Lo que no cambia
- Login, sesión de administrador y rutas de SPEC-013. Las rutas nuevas van bajo `/admin` con `requireAdmin` (🔑).
- El flujo de venta solo cambia en dos puntos: el tope sin red (RF-4) y el préstamo de cada línea (RF-8). El cobro sigue siendo una sola transacción local.
- Sin dependencias nuevas, en la app y en el backend.

### Tope sin red (RF-4) — ADR-0008
Va en **ADR-0008** antes de implementar. Reemplaza SPEC-005 P3.
- Constante `OFFLINE_CAP_MINUTES = 30` en `leasePolicy.ts`. Un préstamo `active` vende solo si `renew_at > ahora − 30 min`.
- El filtro va en el SQL: `AVAILABLE_SQL`, `CONSUME_QUOTA_SQL` y `LEASE_AVAILABLE_SQL` (Dashboard) reciben `capFrom` = `ahora − 30 min` en ISO. `renew_at` ya se guarda en ISO UTC, así que se compara como texto.
- `renew_at` se calcula desde **la hora local de inicio de la petición** de préstamos, no desde la llegada de la respuesta. Así el tope del teléfono siempre cae antes que el del servidor, aunque la red tarde (ADR-0008).
- La pantalla Venta ya muestra "Agotado" cuando un producto no tiene fila en lo disponible. Al volver la red, `leaseSync` cierra el préstamo vencido y pide uno nuevo, como hoy (CA-3b).

### Baja, reactivación y devolución (RF-2, RF-3, RF-5, RF-7)
- Columna `devices.revoked_at`. **Dar de baja** la fija; **reactivar** la pone en nulo. Repetir la misma acción no cambia nada (RNF-2).
- `requestLeases` con un dispositivo dado de baja devuelve todos los productos en `unavailable` y no emite nada (RF-2). El dispositivo sigue pudiendo sincronizar y cerrar préstamos (RF-6, CA-4).
- **Devolución:** `releaseRevokedLeases()` en `leaseService` cierra los préstamos `active` de dispositivos dados de baja con `expires_at + 32 min <= now()`. Bloquea producto y préstamo en el mismo orden que `closeLeases`, fija `status = 'expired'`, `quota_used` = unidades ya sincronizadas de ese préstamo (tope `quota_total`) y devuelve `quota_total − quota_used` al stock central (CA-2). Se ejecuta cada 60 s desde `index.ts` y al inicio de las rutas `GET /admin/devices`, `/admin/stock` y `/admin/reconciliation`, para que el panel nunca muestre un dato atrasado.
- **Cierre tardío:** si el teléfono llama a `POST /prestamos/close` para un préstamo `expired`, el servidor responde 200 sin tocar el stock y guarda lo informado en `stock_leases.quota_reported` para la conciliación. Hoy ese caso daría 400 `INVALID_QUOTA_USED` y el teléfono reintentaría para siempre.
- Si el teléfono cierra antes del plazo, vale su cierre normal: el préstamo ya no está `active` y `releaseRevokedLeases` no lo toca (CA-4).
- La fórmula del stock (§3.7 de `ARCHITECTURE.md`) suma `expired` igual que `released`: **central + Σ `quota_total` (active) + Σ `quota_used` (released, expired) = stock inicial**.

### Préstamo de cada venta (RF-8, RF-9)
- App: columna `sale_items.lease_id` (migración v6). Al cobrar, `createSale` lee el id del préstamo activo y vigente de cada producto antes de descontar la cuota, en la misma transacción, y lo guarda en la línea y en el payload del evento.
- Backend: columna `sale_items.lease_id uuid` nula y **sin FK**: un id que el servidor no conozca no puede trabar la cola de sync. El esquema Zod de la línea agrega `lease_id: z.uuid().nullable().optional()`. Los eventos guardados antes del cambio llegan sin el campo y quedan con `lease_id` nulo (RF-9, CA-7). Un backend viejo ignora el campo, porque Zod descarta las claves que no conoce (RNF-4).

### Conciliación (RF-10, RF-11, RF-12)
`adminReconciliationService.ts`, una sola consulta por rango `[from, to)` sobre `closed_at`:
- **Informado:** `quota_used` de los préstamos `released`; en los `expired`, `quota_reported` si el teléfono cerró tarde.
- **Sincronizado:** `Σ sale_items.quantity` con ese `lease_id`.
- **Estado:** `cuadra`, `faltan_ventas` (informado > sincronizado) o `sobran_ventas` (sincronizado > informado). Ordenado con los que no cuadran primero.
- **Posteriores a la baja (RF-6):** para los `expired`, `sincronizado − quota_used` al cierre = unidades devueltas de más (CA-3).
- **Sin préstamo asignado:** líneas con `lease_id` nulo en el rango, por `sales.created_at`, agrupadas por dispositivo y producto.

### Catálogo (RF-13 a RF-17)
- Crear: nombre, categoría opcional, precio y stock central inicial. `initial_stock = central_stock` = el inicial.
- Editar: nombre, categoría, precio y `active`. `GET /catalogo` ya filtra los inactivos y `requestLeases` ya rechaza un producto inactivo (RF-16).
- Ajustar stock central: `delta` entero ≠ 0. Con la fila del producto bloqueada (`for update`, mismo orden que los préstamos, RNF-3) se rechaza con 409 `STOCK_BELOW_ZERO` si `central_stock + delta < 0`; si no, `central_stock += delta` y `initial_stock += delta` (RF-15, RF-17, CA-10, CA-11).

### Registro de cambios e idempotencia (RF-18, RNF-2)
- Tabla `admin_audit`. Cada acción del panel manda un `request_id` (uuid generado en la app) que es la clave primaria de su fila.
- La acción y su fila de registro van en la misma transacción. Si el `request_id` ya existe, se devuelve el resultado guardado sin aplicar nada (un reintento por red no ajusta dos veces).
- La fila guarda administrador, acción, entidad, valor anterior y nuevo (`jsonb`) y la hora.

### App: panel
- Pestañas del panel: **Ventas**, **Stock** (con acciones de catálogo), **Teléfonos**, **Conciliación** y **Cuenta** (con el registro de cambios).
- Toda acción que cambia algo pide confirmación explícita, con el texto de lo que va a pasar (RF-2). El `request_id` se genera al abrir la confirmación y se reutiliza si el usuario reintenta.
- Sin red, los botones de acción se deshabilitan como el login (SPEC-013 RNF-5).

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `adminDevicesService.ts`, `GET /admin/devices`, `AdminDevicesScreen` | Estado, `last_seen_at`, última sync (`max(sync_events.received_at)`), sesión abierta y préstamos activos |
| RF-2 | `devices.revoked_at`, `requestLeases`, `POST /admin/devices/:id/revoke` | Sin préstamos nuevos tras la baja |
| RF-3, RF-5 | `releaseRevokedLeases` | Cierre a `expires_at + 32 min` con lo sincronizado; cierre normal previo gana |
| RF-4 | `leasePolicy.ts`, `leaseSql.ts`, `leaseSync.ts`, `analyticsSql` | Filtro `renew_at > ahora − 30 min`; `renew_at` desde el inicio de la petición |
| RF-6 | `closeLeases` (cierre tardío), conciliación | Ventas aceptadas; unidades devueltas de más |
| RF-7 | `POST /admin/devices/:id/reactivate` | `revoked_at = null` |
| RF-8 | `saleRepository.ts`, migración v6, `syncService.ts`, `0008_admin_actions.sql` | `lease_id` en la línea y en el evento |
| RF-9 | `syncService.ts` | `lease_id` opcional; nulo = sin préstamo asignado |
| RF-10–12 | `adminReconciliationService.ts`, `AdminReconciliationScreen` | Ver §1 |
| RF-13–17 | `adminCatalogService.ts`, `AdminStockScreen` + `ProductFormSheet` | Ver §1 |
| RF-18 | `admin_audit`, `GET /admin/audit`, `AdminAccountScreen` | Ver §1 |
| RNF-1 | ADR-0008, `releaseRevokedLeases`, ajuste con tope en 0 | Ver §1 |
| RNF-2 | `request_id` en `admin_audit` | Ver §1 |
| RNF-3 | `for update` sobre `products` en ajuste y en préstamos | Mismo bloqueo que SPEC-005 RF-3 |
| RNF-4 | Zod con `lease_id` opcional | Eventos viejos válidos |
| RNF-5 | Solo el tope de RF-4 toca la venta | ADR-0008 |
| RNF-6 | `test/adminPerf.test.ts` | Mismo volumen que SPEC-013 |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/core/db/migrations.ts` | Modificar | v6: `alter table sale_items add column lease_id text` |
| `src/features/leases/domain/leasePolicy.ts` | Modificar | `OFFLINE_CAP_MINUTES`, `capFrom(nowMs)` |
| `src/features/leases/data/leaseSql.ts` | Modificar | Filtro del tope en `AVAILABLE_SQL` y `CONSUME_QUOTA_SQL`; `ACTIVE_LEASE_ID_SQL` |
| `src/features/leases/data/leaseSync.ts` | Modificar | `saveLeases` con la hora de inicio de la petición |
| `src/features/leases/data/leaseRepository.ts` | Modificar | Pasar `capFrom` a lo disponible |
| `src/features/sales/data/saleRepository.ts` | Modificar | `lease_id` por línea, leído en la transacción |
| `src/features/analytics/data/analyticsSql.ts` | Modificar | Mismo filtro del tope |
| `src/features/admin/data/adminApi.ts` | Modificar | Llamadas nuevas (dispositivos, baja, conciliación, catálogo, registro) |
| `src/features/admin/ui/AdminDevicesScreen.tsx` | Crear | Lista, baja y reactivación con confirmación |
| `src/features/admin/ui/AdminReconciliationScreen.tsx` | Crear | Rango (hoy por defecto), préstamos, posteriores a la baja y sin préstamo |
| `src/features/admin/ui/AdminStockScreen.tsx` | Modificar | Crear, editar, ajustar, desactivar |
| `src/features/admin/ui/ProductFormSheet.tsx` | Crear | Formulario de alta/edición/ajuste con `shared/ui` |
| `src/features/admin/ui/AdminAccountScreen.tsx` | Modificar | Registro de cambios |
| `src/navigation/RootNavigator.tsx` | Modificar | Pestañas Teléfonos y Conciliación |
| `test/leases.test.mjs`, `test/migrations.test.mjs` | Modificar | Tope sin red, `renew_at` desde el inicio de la petición, migración v6 y `lease_id` en la venta |

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `db/migrations/0008_admin_actions.sql` | Crear | Ver §4 |
| `src/services/leaseService.ts` | Modificar | Baja en `requestLeases`, cierre tardío en `closeLeases`, `releaseRevokedLeases` |
| `src/services/syncService.ts` | Modificar | `lease_id` en las líneas |
| `src/services/stockService.ts` | Modificar | `expired` en la fórmula |
| `src/services/adminDevicesService.ts` | Crear | Lista, baja, reactivación |
| `src/services/adminReconciliationService.ts` | Crear | Conciliación |
| `src/services/adminCatalogService.ts` | Crear | Alta, edición, ajuste |
| `src/services/adminAuditService.ts` | Crear | `withAudit(client, adminId, requestId, action, fn)` y listado |
| `src/routes/admin.ts` | Modificar | Rutas de §5 |
| `src/index.ts` | Modificar | `setInterval(releaseRevokedLeases, 60 s)` |
| `test/*.test.ts` | Crear/Modificar | Ver §6 |

## 4. Modelo de datos y migraciones

### PostgreSQL — `0008_admin_actions.sql`
```sql
-- RF-2, RF-7: baja de dispositivo.
alter table devices add column revoked_at timestamptz;

-- RF-6: lo que informó un teléfono al cerrar tarde un préstamo que el servidor ya cerró.
alter table stock_leases add column quota_reported integer check (quota_reported >= 0);
-- Préstamos de dispositivos dados de baja pendientes de devolver.
create index idx_stock_leases_active_expires on stock_leases(expires_at) where status = 'active';

-- RF-8: préstamo de cada línea. Sin FK: un id desconocido no debe trabar la sync.
alter table sale_items add column lease_id uuid;
create index idx_sale_items_lease on sale_items(lease_id);

-- RF-18, RNF-2: registro de cambios; request_id lo genera la app.
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
```
El check de `stock_leases.status` ya admite `expired` (0003). Una base existente no necesita relleno: todos los dispositivos quedan activos, las líneas viejas quedan sin préstamo y el registro arranca vacío.

### SQLite (app) — v6
```sql
alter table sale_items add column lease_id text;
```
Las ventas anteriores quedan con `lease_id` nulo; sus eventos ya guardados no cambian (principio 3).

## 5. Contratos HTTP
Todas 🔑. Las que cambian algo reciben `request_id` (uuid) y responden lo mismo al repetirse.

```
GET /admin/devices
Response: { devices: [{ id, name, revoked_at|null, last_seen_at|null, last_sync_at|null,
            open_session: { seller_name, opened_at }|null,
            leases: [{ id, product_id, product_name, quota_total, quota_used, expires_at, release_at|null }] }] }
          release_at = expires_at + 32 min solo si el dispositivo está dado de baja.

POST /admin/devices/:id/revoke      { request_id }  → 200 { device }   404 DEVICE_NOT_FOUND
POST /admin/devices/:id/reactivate  { request_id }  → 200 { device }   404 DEVICE_NOT_FOUND

GET /admin/reconciliation?from=ISO&to=ISO   (rango ≤ 31 días, como /admin/sales)
Response: { leases: [{ lease_id, device_id, device_name, product_id, product_name, status: 'released'|'expired',
            closed_at, reported, synced, result: 'cuadra'|'faltan_ventas'|'sobran_ventas', returned_extra }],
            unassigned: [{ device_id, device_name, product_id, product_name, units }] }

POST  /admin/products              { request_id, name, category?, unit_price_cents, initial_stock }  → 201 { product }
PATCH /admin/products/:id          { request_id, name?, category?, unit_price_cents?, active? }       → 200 { product }
POST  /admin/products/:id/stock    { request_id, delta }   → 200 { product }   409 STOCK_BELOW_ZERO
         404 PRODUCT_NOT_FOUND en las tres; 400 VALIDATION_ERROR

GET /admin/audit?limit=50&before=ISO
Response: { entries: [{ request_id, username, action, entity_id, before, after, created_at }] }
```
`POST /prestamos/request` y `/close` no cambian de forma: a un dispositivo dado de baja `request` le devuelve todo en `unavailable`, y `close` sobre un préstamo `expired` responde 200 como si estuviera cerrado.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria (app) | Lo disponible y el descuento ignoran un préstamo con `renew_at` de hace más de 30 min; `renewAt` desde el inicio de la petición | CA-3b |
| Unitaria (app) | `createSale` guarda `lease_id` en la línea y en el payload | CA-6 |
| Integración (backend) | Baja: sin préstamos nuevos; préstamo sigue `active` antes del plazo; `releaseRevokedLeases` lo cierra después y el central sube | CA-1, CA-2 |
| Integración (backend) | Baja + 3 ventas sincronizadas tras el cierre: aceptadas, `returned_extra = 3` | CA-3 |
| Integración (backend) | Cierre normal antes del plazo vale; cierre tardío de un `expired` da 200 y guarda `quota_reported` | CA-4, RF-6 |
| Integración (backend) | Reactivar vuelve a prestar | CA-5 |
| Integración (backend) | Evento con `lease_id` y evento viejo sin él; conciliación los muestra como asignado y sin préstamo | CA-6, CA-7 |
| Integración (backend) | Préstamo con 8 informadas y 6 sincronizadas = `faltan_ventas` | CA-8 |
| Integración (backend) | Ajuste −5 con 3 de central = 409 y central sigue en 3; −3 deja 0 y lo prestado igual; +20 y `checkStock` en `ok` | CA-10, CA-11 |
| Integración (backend) | Ajuste y pedido de préstamo simultáneos: central nunca negativo | RNF-3 |
| Integración (backend) | Repetir el mismo `request_id` no aplica dos veces | RNF-2 |
| Integración (backend) | Baja aparece en `/admin/audit` con usuario y hora | CA-12 |
| Rendimiento | `/admin/devices` y `/admin/reconciliation` < 2 s con el volumen de SPEC-013 | RNF-6 |
| Manual (emulador) | Cambio de precio y cobro con el precio nuevo; ventas viejas con el viejo | CA-9 |
| Manual (emulador) | Sin red con `renew_at` adelantado 30 min a mano: "Agotado"; al volver la red, se vende | CA-3b |
| Manual (emulador) | Baja desde el panel, registro de cambios, conciliación en pantalla | CA-1, CA-12 |

## 7. Riesgos y alternativas descartadas
- **Reloj del teléfono atrasado a mano** mientras está sin red: alarga el tope. Riesgo aceptado en ADR-0008.
- **FK de `sale_items.lease_id`:** descartada; un rechazo trabaría la cola de sync del teléfono (principio 3).
- **Devolver al instante al dar de baja:** descartada; sobreventa (ADR-0008).
- **Ajustar el stock central solo con las ventas posteriores a una baja:** fuera de alcance; el administrador lo hace con RF-15.
- **Tarea programada externa (cron):** descartada; un `setInterval` en el proceso del backend basta para un solo servidor. Si algún día hay varios, la consulta ya es segura con `for update`.

## 8. Chequeo de constitución
- [x] Nunca sobrevender: ADR-0008 y ajuste con tope en 0 bajo bloqueo
- [x] Offline-first: solo el tope de 30 min, registrado en ADR-0008
- [x] Eventos inmutables: `lease_id` es un campo nuevo; los eventos viejos no cambian
- [x] Idempotencia: `request_id` en las acciones; cierre tardío idempotente
- [x] UI fluida: el cobro solo suma una lectura por línea en la misma transacción
- [x] Contratos documentados: §5, se copian a `ARCHITECTURE.md` en la primera tarea
