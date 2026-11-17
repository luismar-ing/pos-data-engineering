# Arquitectura

> Estado: **objetivo + estado actual**. Las secciones marcadas ⚠️ describen diferencias entre lo implementado y lo planeado. Actualizar al cerrar cada spec.

## 1. Vista general

```
┌──────────────── Dispositivo (pos-app) ────────────────┐        ┌──────── Servidor (pos-backend) ────────┐
│ UI (React Native)                                     │        │ Express 5                              │
│   Venta · Inventario · Dashboard · Ajustes            │        │   /catalogo   GET catálogo             │
│        │                                              │  HTTP  │   /devices    registro de dispositivo  │
│        │                                              │        │   /prestamos  leases (stock leasing)   │
│ Estado (Zustand: sesión, carrito, online/offline)     │◄──────►│   /sync       ingesta batch idempotente│
│        │                                              │  JSON  │        │                               │
│ Dominio: venta, cuota, analítica, QR                  │        │ Servicios: leaseService                │
│        │                                              │        │        │                               │
│ SQLite local: products, stock_leases, sales,          │        │ PostgreSQL: products, devices, sales,  │
│   sale_items, settings, sessions,                     │        │   sale_items, stock_leases             │
│   event_log (append-only)                             │        │   sync_events, sessions                │
│ Sync worker (ETL) · Monitor de red (expo-network)     │        │                                        │
└───────────────────────────────────────────────────────┘        └────────────────────────────────────────┘
```

## 2. Estructura de código

### pos-app (feature-first)
```
src/
  App.tsx
  navigation/RootNavigator.tsx      # tabs: Venta, Inventario, Dashboard, Ajustes
  core/db/                          # conexión y esquema SQLite
  core/config.ts                    # API_URL desde EXPO_PUBLIC_API_URL (.env.local)
  core/api/client.ts                # apiFetch + ApiError (forma de error del backend; sin red ⇒ NETWORK_ERROR)
  core/device/                      # identidad (id + secreto en expo-secure-store) y registro
  core/network/                     # monitor de conectividad: connectivity.ts (lógica pura) + monitor.ts (expo-network, AppState)
  core/sync/                        # Batch ETL: syncSql + syncBatch (puros), syncRepository, syncWorker
  features/<feature>/
    data/                           # repositorios (SQL)
    domain/*                        # reglas puras, testeables
    ui/*                            # pantallas y componentes
  features/analytics/               # panel Dashboard (SPEC-009): analyticsSql + metrics (puros), analyticsRepository, DashboardScreen
  features/sales/                   # carrito y cobro (SPEC-007); recibo QR (SPEC-010): receipt + receiptSql (puros), receiptRepository, ReceiptQr
  shared/store/                     # stores Zustand
  shared/ui/OfflineBanner.tsx       # franja "Sin conexión" sobre cada pestaña
  shared/utils/money.ts             # formatCents, parseMoneyToCents, computeChangeCents
```

### pos-backend
```
src/
  index.ts          # arranque: createApp().listen(PORT)
  app.ts            # createApp(): routers + notFound + errorHandler
  config.ts         # lee .env; exige DB_URL, PORT por defecto 3000
  http/errors.ts    # HttpError, notFound, errorHandler (forma única de error)
  http/auth.ts      # hashSecret, requireDevice (Bearer <secreto>)
  db/pool.ts        # pool pg (+ pool.on('error'))
  db/migrate.ts     # migrate() y seed(); db/cli.ts los expone a npm
  routes/           # health, devices, catalogo, prestamos, sync
  services/         # leaseService (cálculo de cuota, pedir y cerrar préstamos)
test/               # node:test vía tsx; usan la BD posde_test
db/migrations/      # NNNN_*.sql, npm run db:migrate (tabla schema_migrations)
db/seed/            # datos de desarrollo repetibles, npm run db:seed
db/docker-init/     # solo crea posde_test al crear el volumen (compose.yaml, puerto 5434)
```

Comandos (en `pos-backend/`): `npm run dev` · `build` · `start` · `typecheck` · `test` · `db:migrate` · `db:seed` · `scenario:reset` · `report:stock` (los dos últimos solo en desarrollo, SPEC-011).

## 3. Flujos principales

### 3.0 Identidad de dispositivo y sesión (SPEC-003)
1. Primer arranque: la app genera `device_id` (UUID) y un secreto de 32 bytes (hex). El id va a `settings`; el secreto a `expo-secure-store` (`device_secret.<id>`). El secreto nunca se escribe en logs.
2. Con red, `POST /devices/register` (idempotente). El servidor guarda solo `sha256(secreto)` en `devices.token_hash`.
3. `/prestamos` y `/sync` exigen `Authorization: Bearer <secreto>`. Sync rechaza eventos cuyo `device_id` no sea el del dispositivo autenticado.
4. Para cobrar hace falta una sesión abierta (nombre del vendedor), una a la vez por dispositivo. Abrir y cerrar funciona sin red y escribe `session_opened` / `session_closed` en `event_log`. Cada venta lleva `session_id`.
5. Sin red, el registro queda pendiente. Se reintenta al abrir la app, desde Ajustes y al volver la red (SPEC-006).

### 3.0b Catálogo (SPEC-004)
1. Al abrir la app (sin esperar) o con "Actualizar" en Inventario: `GET /catalogo`. Una sola descarga a la vez.
2. `parseCatalog` valida la respuesta. Si un producto es inválido, se descarta toda la descarga.
3. En una transacción exclusiva: todos los productos locales a `active = 0`; upsert de cada producto recibido con `active = 1`; `catalog_synced_at` en `settings`. Lo que no vino queda inactivo (nunca se borra, por las FK); lo que vuelve se reactiva.
4. Sin red se usa el catálogo guardado. Cada venta conserva el precio con que se cobró (`sale_items.unit_price_cents`).
5. Al volver la red se descarga de nuevo si la última descarga correcta tiene más de 5 min (SPEC-006).

### 3.0c Conectividad (SPEC-006)
1. Un único estado: `isOnline` en el store. **En línea = `GET /health` responde 200** en 3 s o menos. Un 503 (Postgres caído), un Wi-Fi sin internet o un servidor inalcanzable cuentan como sin conexión. Sin `EXPO_PUBLIC_API_URL`, siempre sin conexión.
2. Se comprueba al arrancar, en cada cambio de red de `expo-network` y al volver la app a primer plano. Si el teléfono dice que no hay red, pasa a sin conexión sin petición. Si `apiFetch` falla por red, también.
3. Sin conexión se vuelve a comprobar cada 15 s; en línea no hay comprobación periódica. Una sola comprobación a la vez.
4. Al pasar de sin conexión a en línea, `onReconnect` avisa una vez por transición: reintenta el registro, el catálogo (si tiene más de 5 min) y el ciclo de préstamos (SPEC-005). SPEC-008 se suscribirá aquí.
5. El cobro nunca consulta `isOnline`.

### 3.1 Venta online
1. Vendedor arma carrito (SPEC-007): el carrito guarda solo `{ productId, quantity }` en memoria; nombre y precio se leen del catálogo local al mostrarlo. Elige método de pago (`cash` / `card` / `transfer`) y confirma.
2. `createSale`, en una transacción exclusiva: lee la sesión abierta y el precio vigente y `active` de cada producto (inactivo ⇒ `ProductUnavailableError`, nada se escribe); descuenta cada línea de la cuota del préstamo activo (no alcanza ⇒ `InsufficientQuotaError`, nada se escribe); escribe `sale` + `sale_items` + evento `sale_created` en `event_log`. Un toque de "Confirmar" = una venta.
3. Tras cobrar, el ciclo de préstamos corre en segundo plano por si queda menos del 20 % (SPEC-005).
4. Tras cobrar, `syncEvents()` envía los pendientes en segundo plano; con red, la venta llega al servidor de inmediato (SPEC-008).

### 3.2 Venta offline
Igual que 3.1 pasos 1–2: el descuento de cuota es local, así que con o sin red funciona igual. Sin cuota el producto sale "Agotado". Un préstamo vencido sin red sigue vendiendo lo que le queda. Los eventos quedan `pending`.

### 3.3 Batch ETL (SPEC-008)
`syncEvents()` (una ejecución a la vez) corre tras cobrar, al abrir y cerrar sesión, al reconectar, cada 30 s y con "Sincronizar ahora" en Ajustes. Sin pendientes no hace ninguna petición. En bucle hasta vaciar la cola:
1. **Extract:** hasta 50 eventos `pending` de `event_log`, en orden `created_at, id`.
2. **Transform:** `toWireEvent` agrega `device_id` y deja el `payload` intacto; `fitBatch` recorta el lote a menos de 80 kB; el lote lleva `batch_id` y `sent_at`.
3. **Load:** `POST /sync/events`. El servidor procesa cada evento en su propia transacción: `sync_events … on conflict do nothing` (⇒ `duplicate`), luego la venta o la sesión. Una forma inválida, otro dispositivo o una restricción de la BD ⇒ `rejected` sin afectar a los demás.
4. **Marcado local** (una transacción): `inserted`/`duplicate` ⇒ `synced` + `synced_at`; `rejected` ⇒ `failed` + `sync_error`. Error de red o de servidor ⇒ siguen `pending`. Solo cambian esas columnas, nunca el evento.

### 3.4 Stock Leasing (SPEC-005)
1. **Ciclo** (`leaseSync`, una ejecución a la vez): al arrancar, al abrir y cerrar sesión, al reconectar, cada 30 s y tras cobrar. Solo corre con red.
2. **Cerrar:** en una transacción local, los préstamos activos vencidos (3 min), con menos del 20 % o sin sesión abierta pasan a `closing` con `quota_reported = quota_used`; desde ese momento no venden. `POST /prestamos/close` con todos los `closing`, también los de intentos fallidos y con el mismo valor ⇒ `released`. El servidor devuelve `quota_total - quota_used` a `central_stock`.
3. **Pedir** (solo con sesión abierta): `POST /prestamos/request` con los productos activos sin préstamo, en grupos de 200. El servidor bloquea cada producto (`for update`, en orden de id), calcula la cuota y la **congela**: resta de `central_stock` e inserta el préstamo en la misma transacción.
4. **Cuota** = `ceil(unidades / minutos × 3 × 1.2)`, mínimo 5, tope `central_stock`. Unidades y minutos salen de los préstamos que ese dispositivo cerró en los últimos 5 min (hora del servidor).
5. El servidor solo devuelve stock con un `close`, salvo en un dispositivo dado de baja (SPEC-014, ADR-0008): sus préstamos activos se cierran como `expired` a `expires_at + 32 min`. Al sincronizar ventas (SPEC-008) no se vuelve a descontar stock.
6. **Tope sin red (ADR-0008):** un préstamo `active` vende solo mientras `renew_at > ahora − 30 min`. `renew_at` = hora local de inicio de la petición + duración que dio el servidor, así el tope del teléfono cae antes que el del servidor.

### 3.5 Edge Analytics (SPEC-009)
1. `getDashboard(now)` solo lee SQLite, con o sin red. Corre al enfocar Dashboard, cada 15 s mientras está visible y cuando cambia `leasesUpdatedAt` (tras cobrar y al cambiar préstamos); una consulta a la vez.
2. **Burn Rate:** unidades vendidas por **este teléfono** (de cualquier sesión) en los últimos 10 min ÷ minutos desde la primera de esas ventas, entre 1 y 10. Por producto y en total.
3. **Runout Time:** disponible del préstamo activo ÷ Burn Rate. Lista: productos con ventas en la ventana y préstamos agotados; agotados primero, luego del que se acaba antes; < 5 min en ámbar. Préstamos con cuota sin ventas solo se cuentan.
4. **Sesión:** la abierta o, si no hay, la última cerrada. Top 5 por unidades con ingreso; ventas, unidades, ingreso y ticket promedio (centavos enteros).

### 3.6 Recibo QR (SPEC-010)
1. En la confirmación del cobro, "Recibo QR" llama a `getReceiptText(saleId)`: solo lee SQLite (venta, líneas, nombre del producto, vendedor de la sesión) y el nombre del dispositivo. No escribe ni genera eventos.
2. `buildReceiptText` arma texto plano UTF-8: "POS-DE · <dispositivo>", fecha local, id corto y completo, vendedor, una línea por producto (`cantidad x nombre subtotal`), total y método de pago. Montos de los centavos guardados.
3. Máximo 1 000 bytes (`RECEIPT_MAX_BYTES`); nombres a 24 caracteres con "…". Si no caben las líneas, cierra con "… y N productos más" por la suma de las que faltan; el total es el de la venta.
4. `react-native-qrcode-svg` (sobre `react-native-svg`) dibuja el código en el teléfono, corrección L, fondo blanco y margen. El cliente lo lee con la cámara, sin red. Sin contratos HTTP.

### 3.7 Consistencia del stock y prueba con dos dispositivos (SPEC-011)
1. El stock central solo cambia por los préstamos y por los ajustes del panel (SPEC-014, que mueven también `initial_stock`): pedir resta `quota_total`, cerrar devuelve `quota_total − quota_used`; el sync de ventas no lo toca. Por producto: **stock central + Σ `quota_total` (active) + Σ `quota_used` (released, expired) = stock inicial**.
2. `npm run report:stock` (`src/services/stockService.ts` → `STOCK_REPORT_SQL`, `checkStock`; SPEC-013) imprime por producto stock inicial (`products.initial_stock`), central, prestado, informado, vendido por sync y el total; marca inconsistente si el total no da el stock inicial o si lo vendido por sync lo supera. `checkStock` devuelve códigos estables (`ok`, `no_cuadra`, `sync_supera_stock`, `sin_stock_inicial`) que `GET /admin/stock` reutiliza. Solo lee; termina con código 1 si algo no cuadra.
3. `npm run scenario:reset` borra préstamos, ventas, eventos y sesiones y fija `SCENARIO_STOCK` ("Hot dog" en 10) como stock central e inicial. Solo corre si la base es `posde` o `posde_test` (`assertDevDatabase`). No borra `devices`.
4. Procedimiento con un emulador y un teléfono: `docs/testing/dos-dispositivos.md`. Idempotencia de reintentos probada en `sync.test.ts` (lote cortado, envíos simultáneos) y `sync.test.mjs` (respuesta perdida, `markStatement`).

### 3.8 Rol y panel de administración (SPEC-013)
1. Al abrir, `App.tsx` lee `role` de `settings` (`roleRepository`) y la sesión de administrador de SecureStore (`adminSession`); una sesión vencida (`isSessionValid`) se borra. Sin rol, `RoleSelectScreen`; con `seller`, las 4 pestañas de siempre; con `admin`, login o panel. No se cambia de rol con una sesión de vendedor abierta (`canSwitchRole`).
2. `AdminLoginScreen` llama a `POST /admin/login` (ADR-0007) y guarda `{ token, username, expires_at }` en SecureStore. Sin red el botón queda deshabilitado; los errores se muestran con un mensaje genérico.
3. Pestañas Ventas (`GET /admin/sales` del día local), Stock (`GET /admin/stock`) y Cuenta (cerrar sesión con `POST /admin/logout`, cambiar de rol). Solo con red; no se guarda nada del panel en el teléfono. Cualquier 401 borra la sesión y vuelve al login.
4. El panel no comparte nada con el flujo de venta: el vendedor cobra sin red igual que antes (CA-11: 241–365 ms por cobro con y sin el panel consultando el servidor).

### 3.9 Acciones del panel: baja, conciliación y catálogo (SPEC-014)
1. **Préstamo de cada venta:** `createSale` descuenta la cuota con `update … returning id` (solo préstamos `active` con `renew_at > capFrom(now)`) y guarda ese id en `sale_items.lease_id` y en el evento. El backend lo guarda sin FK; los eventos anteriores llegan sin él.
2. **Baja:** `POST /admin/devices/:id/revoke` fija `devices.revoked_at`; `requestLeases` ya no le presta. `releaseRevokedLeases` (cada 60 s en `index.ts` y al abrir Teléfonos, Stock o Conciliación) cierra como `expired` sus préstamos activos a `expires_at + 32 min`: cuenta como vendido lo sincronizado y devuelve el resto. Un cierre del teléfono antes de ese plazo gana; uno después responde como cerrado y guarda `quota_reported` (ADR-0008).
3. **Conciliación:** por préstamo cerrado, informado contra `Σ sale_items.quantity` de ese `lease_id`; `returned_extra` en los `expired`; las líneas sin `lease_id` van aparte.
4. **Catálogo y stock:** alta, edición (nombre, categoría, precio, activo) y ajuste del central con la fila del producto bloqueada; el ajuste mueve también `initial_stock`, así el reporte de §3.7 sigue cuadrando.
5. **Registro e idempotencia:** cada acción y su fila de `admin_audit` van en una transacción; el `request_id` lo genera la app y se conserva si la petición falla por red, así un reintento devuelve lo guardado sin aplicar dos veces.
6. **App:** pestañas Ventas, Stock (toca un producto para editarlo; "Nuevo producto"), Teléfonos, Conciliar y Cuenta (registro de cambios). Las acciones piden confirmación y se deshabilitan sin red.

## 4. Modelo de datos

Reglas comunes (SPEC-001): venta = cabecera + líneas en ambos lados; montos en centavos enteros (`*_cents`); el id de la venta es también el id de su evento `sale_created` y la clave de idempotencia en el servidor.

### 4.1 SQLite (app) — `pos-app/src/core/db/migrations.ts`
Versionado con `PRAGMA user_version`; `database.ts` aplica las migraciones pendientes al abrir la BD.

| Tabla | Propósito |
|---|---|
| `products` | Copia local del catálogo (`unit_price_cents`); `active = 0` si ya no viene del servidor. No guarda stock: el stock vendible offline es la suma de leases activos |
| `stock_leases` | Préstamos recibidos (v3): `quota_total`, `quota_used ≤ quota_total`, `quota_reported`, `status` `active`/`closing`/`released`, `issued_at` (servidor), `renew_at` (hora local); uno activo por producto; `id` lo emite el servidor |
| `sales` / `sale_items` | Venta y sus líneas; `sales.session_id` (v2); índices `sales(created_at)`, `sales(session_id)`, `sale_items(sale_id)` para el panel (v5); `sale_items.lease_id` = préstamo del que salió la línea, nulo en ventas anteriores (v6, SPEC-014) |
| `settings` | Clave/valor: `device_id`, `device_name`, `registered_at` (v2); `catalog_synced_at` (SPEC-004); `role` = `seller`/`admin` (SPEC-013; sin migración; una instalación anterior con sesión de vendedor abierta arranca como `seller`). El token de administrador va en SecureStore (`admin_session`), no aquí |
| `sessions` | Sesiones de vendedor; índice único parcial ⇒ solo una con `closed_at is null` (v2) |
| `event_log` | Bitácora append-only; `sale_created` lleva `{ sale, items }` y `session_opened`/`session_closed` llevan `{ session }` en `payload_json`; `sync_status`, `synced_at`, `sync_error` (v4) |

### 4.2 PostgreSQL (backend) — `pos-backend/db/migrations/NNNN_*.sql`
Se aplican con `npm run db:migrate` (ADR-0006): una transacción por archivo, registradas en `schema_migrations(version, applied_at)`.

| Tabla | Propósito |
|---|---|
| `products` | Catálogo + `central_stock` (`unit_price_cents`); `initial_stock` para el reporte de stock (0007, SPEC-013) |
| `devices` | Dispositivos registrados; `token_hash` = sha256 del secreto (índice único); `last_seen_at` = última petición autenticada (0007; lo marca `requireDevice`); `revoked_at` = dado de baja (0008) |
| `sales` / `sale_items` | Ventas recibidas; PK `sales.id` ⇒ idempotencia; FK `sales.device_id → devices`; `session_id`; `sale_items.lease_id` sin FK, nulo en eventos anteriores (0008) |
| `stock_leases` | Préstamos emitidos: FK a `devices`, `status` `active`/`released`/`expired` (cerrado por el servidor tras una baja, 0008), `closed_at`; `quota_reported` = lo que informó el teléfono al cerrar tarde un `expired` (0008); uno activo por dispositivo y producto (0005) |
| `admin_audit` | Registro de cambios del panel: `request_id` (PK, lo genera la app ⇒ idempotencia), `admin_id`, `action`, `entity_id`, `before`/`after` (`jsonb`), `created_at` (0008) |
| `sync_events` | Un registro por evento recibido (`event_id` PK, `device_id`, `event_type`, `batch_id`, `received_at`): idempotencia de todos los tipos (0006) |
| `sessions` | Sesiones de vendedor recibidas: `seller_name`, `opened_at`, `closed_at` (cualquiera puede llegar primero) (0006) |
| `admins` | Cuentas de administrador: `username` único (`^[a-z0-9._-]{3,40}$`), `password_hash` (`scrypt$N$r$p$sal$hash`, ADR-0007), `failed_attempts`, `locked_until` (0007) |
| `admin_sessions` | Sesiones de administrador: `token_hash` (sha256 del token, PK), FK `admin_id → admins` (`on delete cascade`), `expires_at` = login + 8 h (0007) |

## 5. Contratos HTTP

Base URL: `http://<host>:<PORT>`. JSON en ambos sentidos.

| Método y ruta | Request | Response 200 | Errores | Estado |
|---|---|---|---|---|
| `GET /health` | — | `{ status: "ok", db: "up" }` | 503 `DB_UNAVAILABLE` (< 1 s) | ✅ implementado |
| `POST /devices/register` | `{ device_id: uuid, name: 1–100, secret: 64 hex }` | 201 nuevo · 200 ya registrado (actualiza `name`) | 400 `VALIDATION_ERROR`, 409 `DEVICE_CONFLICT` (mismo id, otro secreto) | ✅ implementado |
| `GET /catalogo` | — | `[{ id, name, category, unit_price_cents, active }]` | 500 | ✅ implementado |
| `POST /prestamos/request` 🔒 | `{ product_ids: uuid[] }` (1–200, sin repetidos) | `{ leases: Lease[], unavailable: uuid[] }`: el préstamo activo de cada producto (existente o nuevo, ya congelado); `unavailable` = sin stock, inactivo o inexistente | 400 `VALIDATION_ERROR`, 401 | ✅ implementado |
| `POST /prestamos/close` 🔒 | `{ leases: [{ lease_id: uuid, quota_used: int ≥ 0 }] }` (1–200) | `{ closed: uuid[] }`: devuelve `quota_total - quota_used` al stock central; incluye los ya cerrados (idempotente) | 400 `VALIDATION_ERROR`, 400 `INVALID_QUOTA_USED`, 404 `LEASE_NOT_FOUND`, 401 | ✅ implementado |
| `POST /sync/events` 🔒 | ver abajo (1–50 eventos) | `{ batch_id, results: [{ event_id, status, reason? }], inserted, duplicated, rejected }` | 400 `VALIDATION_ERROR` si el sobre es inválido (sin `batch_id`, `events` vacío o > 50, `event_id` no UUID o repetido); 401; 413. Un evento inválido o de otro dispositivo **no** da error: va como `rejected` | ✅ implementado |
| `POST /admin/login` | `{ username: 3–40, password: 1–200 }` | `{ token: 64 hex, username, expires_at }` | 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS` | ✅ implementado (SPEC-013) |
| `POST /admin/logout` 🔑 | — | 204: borra esa sesión | 401 | ✅ implementado (SPEC-013) |
| `GET /admin/sales?from=ISO&to=ISO` 🔑 | — | resumen de ventas (ver abajo) | 400 `VALIDATION_ERROR` (falta `from`/`to`, `from > to` o rango > 31 días), 401 | ✅ implementado (SPEC-013) |
| `GET /admin/stock` 🔑 | — | stock por producto (ver abajo) | 401 | ✅ implementado (SPEC-013) |
| `GET /admin/devices` 🔑 | — | dispositivos con estado y préstamos (ver abajo) | 401 | ✅ implementado (SPEC-014) |
| `POST /admin/devices/:id/revoke` 🔑 | `{ request_id: uuid }` | `{ device }`: fija `revoked_at` | 400 `VALIDATION_ERROR`, 404 `DEVICE_NOT_FOUND`, 401 | ✅ implementado (SPEC-014) |
| `POST /admin/devices/:id/reactivate` 🔑 | `{ request_id: uuid }` | `{ device }`: `revoked_at = null` | 400 `VALIDATION_ERROR`, 404 `DEVICE_NOT_FOUND`, 401 | ✅ implementado (SPEC-014) |
| `GET /admin/reconciliation?from=ISO&to=ISO` 🔑 | — | conciliación por préstamo (ver abajo) | 400 `VALIDATION_ERROR` (como `/admin/sales`), 401 | ✅ implementado (SPEC-014) |
| `POST /admin/products` 🔑 | `{ request_id, name: 1–100, category?: 1–50, unit_price_cents: int ≥ 0, initial_stock: int ≥ 0 }` | 201 `{ product }` | 400 `VALIDATION_ERROR`, 401 | ✅ implementado (SPEC-014) |
| `PATCH /admin/products/:id` 🔑 | `{ request_id, name?, category?: string\|null, unit_price_cents?, active? }` (al menos uno) | `{ product }` | 400 `VALIDATION_ERROR`, 404 `PRODUCT_NOT_FOUND`, 401 | ✅ implementado (SPEC-014) |
| `POST /admin/products/:id/stock` 🔑 | `{ request_id, delta: int ≠ 0 }` | `{ product }`: `central_stock` e `initial_stock` += `delta` | 400 `VALIDATION_ERROR`, 404 `PRODUCT_NOT_FOUND`, 409 `STOCK_BELOW_ZERO`, 401 | ✅ implementado (SPEC-014) |
| `GET /admin/audit?limit=1–200&before=ISO` 🔑 | — | `{ entries: [{ request_id, username, action, entity_id, before, after, created_at }] }`, la más reciente primero (50 por defecto) | 400 `VALIDATION_ERROR`, 401 | ✅ implementado (SPEC-014) |

`Lease = { id, product_id, quota_total, quota_used, issued_at, expires_at }` — `expires_at` (3 min) indica cuándo renovar. Renovar = `close` + `request`. En ambas rutas, si un elemento falla, la petición entera hace rollback. Con un dispositivo dado de baja (SPEC-014), `request` devuelve todos los productos en `unavailable`; `close` de un préstamo que el servidor ya cerró como `expired` responde como cerrado, sin mover stock, y guarda lo informado en `quota_reported` (la primera vez).

`product` (rutas `/admin/products`) = `{ id, name, category, unit_price_cents, active, central_stock, initial_stock }`. Las rutas 🔑 que cambian algo reciben `request_id`; repetirlo devuelve la misma respuesta sin aplicar nada (también si el cuerpo cambió) y queda en `GET /admin/audit`.

`GET /admin/devices` — response:
```json
{ "generated_at": "ISO",
  "devices": [ { "id", "name", "revoked_at": "ISO|null", "last_seen_at": "ISO|null", "last_sync_at": "ISO|null",
                 "open_session": { "seller_name", "opened_at" } | null,
                 "leases": [ { "id", "product_id", "product_name", "quota_total", "quota_used", "expires_at",
                               "release_at": "ISO|null (expires_at + 32 min si el dispositivo está dado de baja)" } ] } ] }
```

`GET /admin/reconciliation` — préstamos cerrados en `[from, to)` por `closed_at`:
```json
{ "generated_at": "ISO", "from": "ISO", "to": "ISO",
  "leases": [ { "lease_id", "device_id", "device_name", "product_id", "product_name", "status": "released" | "expired",
                "closed_at", "reported": "int|null", "synced", "result": "cuadra" | "faltan_ventas" | "sobran_ventas",
                "returned_extra": "int (solo expired: synced − quota_used al cierre, mínimo 0)" } ],
  "unassigned": [ { "device_id", "device_name", "product_id", "product_name", "units" } ] }
```
`reported` = `quota_used` en `released`; en `expired`, `quota_reported` (nulo si el teléfono no cerró) o, si es nulo, `quota_used` al cierre. Los que no cuadran van primero. `unassigned` = líneas sin `lease_id` de ventas con `sales.created_at` en el rango.

`POST /sync/events` — request:
```json
{ "batch_id": "<uuid>", "sent_at": "ISO-8601",
  "events": [ {
    "event_id": "<uuid>", "event_type": "sale_created" | "session_opened" | "session_closed",
    "device_id": "…", "created_at": "ISO-8601", "payload": … } ] }
```
| `event_type` | `payload` |
|---|---|
| `sale_created` | `{ sale: { id = event_id, device_id, session_id?, total_cents = Σ líneas, payment_method, created_at }, items: [ { id, sale_id = event_id, product_id, quantity > 0, unit_price_cents ≥ 0, lease_id?: uuid\|null } ] }` (`lease_id` desde SPEC-014; los eventos anteriores no lo traen) |
| `session_opened` | `{ session: { id, device_id, seller_name, opened_at, closed_at: null } }` |
| `session_closed` | `{ session: { id, device_id, seller_name, opened_at, closed_at } }` |

`status` por evento: `inserted` (guardado), `duplicate` (ya recibido: no cambia nada), `rejected` (`reason`: forma inválida, otro dispositivo o una restricción de la BD). Cada evento se guarda en su propia transacción; un `rejected` no afecta a los demás. El `payload` es exactamente el `payload_json` guardado en `event_log` de la app. Recibir ventas no cambia `central_stock`.

🔒 = exige `Authorization: Bearer <secreto>` de un dispositivo registrado.

🔑 = exige `Authorization: Bearer <token>` de una sesión de administrador vigente (ADR-0007). Un secreto de dispositivo no sirve en 🔑 y un token de administrador no sirve en 🔒.

`POST /admin/login`: usuario inexistente, contraseña incorrecta y usuario bloqueado (5 fallos seguidos ⇒ 15 min) dan el mismo 401 `INVALID_CREDENTIALS`. La sesión vence a las 8 h. Repetir `logout` con el mismo token da 401 sin efectos.

`GET /admin/sales` — response (rango `[from, to)` por `sales.created_at`, hora del teléfono al cobrar; todo sale de una misma foto de la BD, así los desgloses suman el total):
```json
{ "generated_at": "ISO", "from": "ISO", "to": "ISO",
  "totals": { "revenue_cents": 0, "sales": 0, "average_ticket_cents": 0 },
  "by_device": [ { "device_id", "name", "revenue_cents", "sales", "last_seen_at": "ISO|null", "last_sync_at": "ISO|null" } ],
  "by_session": [ { "session_id": "uuid|null", "seller_name": "…|null", "device_id", "revenue_cents", "sales" } ],
  "by_hour": [ { "hour": "ISO (UTC, inicio de la hora)", "revenue_cents", "sales" } ],
  "by_payment_method": [ { "payment_method", "revenue_cents", "sales" } ],
  "top_products": [ { "product_id", "name", "units", "revenue_cents" } ] }
```
`by_device` incluye los dispositivos sin ventas en el rango. `top_products` trae como máximo 5. `last_sync_at` = último `sync_events.received_at` del dispositivo.

`GET /admin/stock` — response:
```json
{ "generated_at": "ISO",
  "products": [ { "product_id", "name", "category", "unit_price_cents", "active", "initial_stock": "int|null", "central_stock", "leased_active", "reported_sold",
                  "synced_sold", "balance", "status": "ok" | "no_cuadra" | "sync_supera_stock" | "sin_stock_inicial" } ] }
```
Mismo cálculo que `npm run report:stock` (§3.7): `balance` = central + prestado + informado; `ok` si es igual a `initial_stock` y `synced_sold` no lo supera.

Errores (todas las rutas, ADR-0006):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Datos de entrada inválidos",
             "details": [ { "path": "product_id", "message": "Invalid UUID" } ] } }
```
| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Cuerpo no cumple el esquema; `details` lista los campos |
| `INVALID_JSON` | 400 | JSON mal formado |
| `PAYLOAD_TOO_LARGE` | 413 | Cuerpo mayor que el límite de `express.json()` (100 kB) |
| `BAD_REQUEST` | 4xx | Otro error del parser de cuerpo (p. ej. 415 codificación no soportada) |
| `UNAUTHORIZED` | 401 | Ruta 🔒 o 🔑 sin credencial, con una desconocida o con una sesión de administrador vencida |
| `INVALID_CREDENTIALS` | 401 | `POST /admin/login` con usuario inexistente, contraseña incorrecta o usuario bloqueado (mismo mensaje en los tres casos) |
| `DEVICE_CONFLICT` | 409 | Registro con un `device_id` ya usado con otro secreto |
| `NOT_FOUND` | 404 | Ruta inexistente |
| `LEASE_NOT_FOUND` | 404 | El préstamo no existe o es de otro dispositivo |
| `DEVICE_NOT_FOUND` | 404 | `/admin/devices/:id/*` con un dispositivo inexistente |
| `PRODUCT_NOT_FOUND` | 404 | `/admin/products/:id*` con un producto inexistente |
| `STOCK_BELOW_ZERO` | 409 | Ajuste que dejaría `central_stock` por debajo de 0 |
| `INVALID_QUOTA_USED` | 400 | `quota_used` mayor que `quota_total`, menor que lo ya informado, o distinto de lo informado si el préstamo ya estaba cerrado |
| `DB_UNAVAILABLE` | 503 | `/health` sin BD |
| `INTERNAL_ERROR` | 500 | Cualquier otro error; sin SQL ni trazas en la respuesta |

Contratos pendientes de definir en sus specs: renovación/liberación de lease.

## 6. Decisiones

Ver [adr/](adr/README.md).
