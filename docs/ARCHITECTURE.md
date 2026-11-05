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

Comandos (en `pos-backend/`): `npm run dev` · `build` · `start` · `typecheck` · `test` · `db:migrate` · `db:seed`.

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
5. El servidor **nunca** devuelve stock sin un `close`: la cuota de un teléfono sin red queda congelada para él. Al sincronizar ventas (SPEC-008) no se vuelve a descontar stock.

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

## 4. Modelo de datos

Reglas comunes (SPEC-001): venta = cabecera + líneas en ambos lados; montos en centavos enteros (`*_cents`); el id de la venta es también el id de su evento `sale_created` y la clave de idempotencia en el servidor.

### 4.1 SQLite (app) — `pos-app/src/core/db/migrations.ts`
Versionado con `PRAGMA user_version`; `database.ts` aplica las migraciones pendientes al abrir la BD.

| Tabla | Propósito |
|---|---|
| `products` | Copia local del catálogo (`unit_price_cents`); `active = 0` si ya no viene del servidor. No guarda stock: el stock vendible offline es la suma de leases activos |
| `stock_leases` | Préstamos recibidos (v3): `quota_total`, `quota_used ≤ quota_total`, `quota_reported`, `status` `active`/`closing`/`released`, `issued_at` (servidor), `renew_at` (hora local); uno activo por producto; `id` lo emite el servidor |
| `sales` / `sale_items` | Venta y sus líneas; `sales.session_id` (v2); índices `sales(created_at)`, `sales(session_id)`, `sale_items(sale_id)` para el panel (v5) |
| `settings` | Clave/valor: `device_id`, `device_name`, `registered_at` (v2); `catalog_synced_at` (SPEC-004) |
| `sessions` | Sesiones de vendedor; índice único parcial ⇒ solo una con `closed_at is null` (v2) |
| `event_log` | Bitácora append-only; `sale_created` lleva `{ sale, items }` y `session_opened`/`session_closed` llevan `{ session }` en `payload_json`; `sync_status`, `synced_at`, `sync_error` (v4) |

### 4.2 PostgreSQL (backend) — `pos-backend/db/migrations/NNNN_*.sql`
Se aplican con `npm run db:migrate` (ADR-0006): una transacción por archivo, registradas en `schema_migrations(version, applied_at)`.

| Tabla | Propósito |
|---|---|
| `products` | Catálogo + `central_stock` (`unit_price_cents`) |
| `devices` | Dispositivos registrados; `token_hash` = sha256 del secreto (índice único) |
| `sales` / `sale_items` | Ventas recibidas; PK `sales.id` ⇒ idempotencia; FK `sales.device_id → devices`; `session_id` |
| `stock_leases` | Préstamos emitidos: FK a `devices`, `status` `active`/`released`, `closed_at`; uno activo por dispositivo y producto (0005) |
| `sync_events` | Un registro por evento recibido (`event_id` PK, `device_id`, `event_type`, `batch_id`, `received_at`): idempotencia de todos los tipos (0006) |
| `sessions` | Sesiones de vendedor recibidas: `seller_name`, `opened_at`, `closed_at` (cualquiera puede llegar primero) (0006) |

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

`Lease = { id, product_id, quota_total, quota_used, issued_at, expires_at }` — `expires_at` (3 min) solo indica cuándo renovar: el servidor nunca devuelve stock sin un `close`. Renovar = `close` + `request`. En ambas rutas, si un elemento falla, la petición entera hace rollback.

`POST /sync/events` — request:
```json
{ "batch_id": "<uuid>", "sent_at": "ISO-8601",
  "events": [ {
    "event_id": "<uuid>", "event_type": "sale_created" | "session_opened" | "session_closed",
    "device_id": "…", "created_at": "ISO-8601", "payload": … } ] }
```
| `event_type` | `payload` |
|---|---|
| `sale_created` | `{ sale: { id = event_id, device_id, session_id?, total_cents = Σ líneas, payment_method, created_at }, items: [ { id, sale_id = event_id, product_id, quantity > 0, unit_price_cents ≥ 0 } ] }` |
| `session_opened` | `{ session: { id, device_id, seller_name, opened_at, closed_at: null } }` |
| `session_closed` | `{ session: { id, device_id, seller_name, opened_at, closed_at } }` |

`status` por evento: `inserted` (guardado), `duplicate` (ya recibido: no cambia nada), `rejected` (`reason`: forma inválida, otro dispositivo o una restricción de la BD). Cada evento se guarda en su propia transacción; un `rejected` no afecta a los demás. El `payload` es exactamente el `payload_json` guardado en `event_log` de la app. Recibir ventas no cambia `central_stock`.

🔒 = exige `Authorization: Bearer <secreto>` de un dispositivo registrado.

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
| `UNAUTHORIZED` | 401 | Ruta 🔒 sin credencial o con una desconocida |
| `DEVICE_CONFLICT` | 409 | Registro con un `device_id` ya usado con otro secreto |
| `NOT_FOUND` | 404 | Ruta inexistente |
| `LEASE_NOT_FOUND` | 404 | El préstamo no existe o es de otro dispositivo |
| `INVALID_QUOTA_USED` | 400 | `quota_used` mayor que `quota_total`, menor que lo ya informado, o distinto de lo informado si el préstamo ya estaba cerrado |
| `DB_UNAVAILABLE` | 503 | `/health` sin BD |
| `INTERNAL_ERROR` | 500 | Cualquier otro error; sin SQL ni trazas en la respuesta |

Contratos pendientes de definir en sus specs: renovación/liberación de lease.

## 6. Decisiones

Ver [adr/](adr/README.md).
