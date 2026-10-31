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
│ Dominio: venta, cuota, analítica, QR                  │        │ Servicios: rollingAverage, leases      │
│        │                                              │        │        │                               │
│ SQLite local: products, stock_leases, sales,          │        │ PostgreSQL: products, devices, sales,  │
│   sale_items, settings, sessions,                     │        │   sale_items, stock_leases             │
│   event_log (append-only)                             │        │                                        │
│ Sync worker (Batch ETL) · Monitor de red (NetInfo*)   │        │                                        │
└───────────────────────────────────────────────────────┘        └────────────────────────────────────────┘
* = aún no existe
```

## 2. Estructura de código

### pos-app (feature-first)
```
src/
  App.tsx
  navigation/RootNavigator.tsx      # tabs: Venta, Inventario, Dashboard, Ajustes
  core/db/                          # conexión y esquema SQLite
  core/config.ts                    # API_URL desde EXPO_PUBLIC_API_URL (.env.local)
  core/api/client.ts                # apiFetch + ApiError (forma de error del backend)
  core/device/                      # identidad (id + secreto en expo-secure-store) y registro
  core/network/*                    # monitor de conectividad
  core/sync/*                       # pipeline Batch ETL
  features/<feature>/
    data/                           # repositorios (SQL)
    domain/*                        # reglas puras, testeables
    ui/*                            # pantallas y componentes
  shared/store/                     # stores Zustand
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
  services/         # rollingAverage, (leaseService*)
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
5. Sin red, el registro queda pendiente. Se reintenta al abrir la app o desde Ajustes; no hay reintento automático al volver la red (TD-022).

### 3.0b Catálogo (SPEC-004)
1. Al abrir la app (sin esperar) o con "Actualizar" en Inventario: `GET /catalogo`. Una sola descarga a la vez.
2. `parseCatalog` valida la respuesta. Si un producto es inválido, se descarta toda la descarga.
3. En una transacción exclusiva: todos los productos locales a `active = 0`; upsert de cada producto recibido con `active = 1`; `catalog_synced_at` en `settings`. Lo que no vino queda inactivo (nunca se borra, por las FK); lo que vuelve se reactiva.
4. Sin red se usa el catálogo guardado. Cada venta conserva el precio con que se cobró (`sale_items.unit_price_cents`).

### 3.1 Venta online
1. Vendedor arma carrito → confirma.
2. Se escribe `sale` + `sale_items` + evento en `event_log` (local, transacción única).
3. Se descuenta `quota_used` del lease activo.
4. El sync worker envía el evento de inmediato (lote de 1) → servidor responde → `sync_status = 'synced'`.

### 3.2 Venta offline
Igual que 3.1 pasos 1–3. Si `quota_total - quota_used < cantidad` ⇒ venta bloqueada para ese producto. Los eventos quedan `pending`.

### 3.3 Reconexión (Batch ETL)
1. **Extract:** `select * from event_log where sync_status = 'pending' order by created_at limit N`.
2. **Transform:** agregar `device_id`, `batch_id`, `sent_at`.
3. **Load:** `POST /sync/events` → servidor inserta con `on conflict (event_id) do nothing`.
4. Marcar como `synced` los eventos confirmados (insertados **o** duplicados).

### 3.4 Stock Leasing
1. Con red, la app pide lease por producto: `POST /prestamos/request`.
2. El servidor calcula la cantidad con promedio móvil y **la congela** (resta de `central_stock` y registra el lease).
3. Al sincronizar ventas, el lease se consume; al expirar o renovarse, lo no usado vuelve al stock central.

⚠️ Hoy el paso 2 solo **calcula** la cantidad: no congela stock ni persiste el lease. Ver SPEC-003.

## 4. Modelo de datos

Reglas comunes (SPEC-001): venta = cabecera + líneas en ambos lados; montos en centavos enteros (`*_cents`); el id de la venta es también el id de su evento `sale_created` y la clave de idempotencia en el servidor.

### 4.1 SQLite (app) — `pos-app/src/core/db/migrations.ts`
Versionado con `PRAGMA user_version`; `database.ts` aplica las migraciones pendientes al abrir la BD.

| Tabla | Propósito |
|---|---|
| `products` | Copia local del catálogo (`unit_price_cents`); `active = 0` si ya no viene del servidor. No guarda stock: el stock vendible offline es la suma de leases activos |
| `stock_leases` | Cuotas por dispositivo y producto (`quota_total`, `quota_used ≤ quota_total`, `status`); `id` lo emite el servidor |
| `sales` / `sale_items` | Venta y sus líneas; `sales.session_id` (v2) |
| `settings` | Clave/valor: `device_id`, `device_name`, `registered_at` (v2); `catalog_synced_at` (SPEC-004) |
| `sessions` | Sesiones de vendedor; índice único parcial ⇒ solo una con `closed_at is null` (v2) |
| `event_log` | Bitácora append-only; `sale_created` lleva `{ sale, items }` en `payload_json` |

### 4.2 PostgreSQL (backend) — `pos-backend/db/migrations/NNNN_*.sql`
Se aplican con `npm run db:migrate` (ADR-0006): una transacción por archivo, registradas en `schema_migrations(version, applied_at)`.

| Tabla | Propósito |
|---|---|
| `products` | Catálogo + `central_stock` (`unit_price_cents`) |
| `devices` | Dispositivos registrados; `token_hash` = sha256 del secreto (índice único) |
| `sales` / `sale_items` | Ventas recibidas; PK `sales.id` ⇒ idempotencia; FK `sales.device_id → devices`; `session_id` |
| `stock_leases` | Leases emitidos (la lógica de emisión/congelado es de SPEC-005) |

## 5. Contratos HTTP

Base URL: `http://<host>:<PORT>`. JSON en ambos sentidos.

| Método y ruta | Request | Response 200 | Errores | Estado |
|---|---|---|---|---|
| `GET /health` | — | `{ status: "ok", db: "up" }` | 503 `DB_UNAVAILABLE` (< 1 s) | ✅ implementado |
| `POST /devices/register` | `{ device_id: uuid, name: 1–100, secret: 64 hex }` | 201 nuevo · 200 ya registrado (actualiza `name`) | 400 `VALIDATION_ERROR`, 409 `DEVICE_CONFLICT` (mismo id, otro secreto) | ✅ implementado |
| `GET /catalogo` | — | `[{ id, name, category, unit_price_cents, active }]` | 500 | ✅ implementado |
| `POST /prestamos/request` 🔒 | `{ product_id: uuid }` | `{ product_id, qty_total, created_at }` | 400 `VALIDATION_ERROR`, 401 | 🟡 calcula, no congela |
| `POST /sync/events` 🔒 | ver abajo | `{ received, inserted, duplicated }` | 400 `VALIDATION_ERROR` si `events` no es arreglo o un evento no tiene la forma esperada; 401; 403 si `device_id` no es el autenticado | 🟡 transacción por evento; lotes y validación completa en SPEC-008 |

`POST /sync/events` — request:
```json
{ "events": [ {
    "event_id": "<uuid = sale.id>", "event_type": "sale_created", "device_id": "…", "created_at": "ISO-8601",
    "payload": {
      "sale":  { "id", "device_id", "session_id?", "total_cents", "payment_method", "created_at" },
      "items": [ { "id", "sale_id", "product_id", "quantity", "unit_price_cents" } ]
    } } ] }
```
El `payload` es exactamente el `payload_json` guardado en `event_log` de la app. Reenviar un evento ya recibido cuenta como `duplicated` y no inserta nada.

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
| `FORBIDDEN` | 403 | El evento o la venta es de otro dispositivo |
| `DEVICE_CONFLICT` | 409 | Registro con un `device_id` ya usado con otro secreto |
| `NOT_FOUND` | 404 | Ruta inexistente |
| `DB_UNAVAILABLE` | 503 | `/health` sin BD |
| `INTERNAL_ERROR` | 500 | Cualquier otro error; sin SQL ni trazas en la respuesta |

Contratos pendientes de definir en sus specs: renovación/liberación de lease.

## 6. Decisiones

Ver [adr/](adr/README.md).
