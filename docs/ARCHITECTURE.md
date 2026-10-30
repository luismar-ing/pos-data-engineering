# Arquitectura

> Estado: **objetivo + estado actual**. Las secciones marcadas ⚠️ describen diferencias entre lo implementado y lo planeado. Actualizar al cerrar cada spec.

## 1. Vista general

```
┌──────────────── Dispositivo (pos-app) ────────────────┐        ┌──────── Servidor (pos-backend) ────────┐
│ UI (React Native)                                     │        │ Express 5                              │
│   Venta · Inventario · Dashboard · Ajustes            │        │   /catalogo   GET catálogo             │
│        │                                              │  HTTP  │   /prestamos  leases (stock leasing)   │
│ Estado (Zustand: sesión, carrito, online/offline)     │◄──────►│   /sync       ingesta batch idempotente│
│        │                                              │  JSON  │        │                               │
│ Dominio: venta, cuota, analítica, QR                  │        │ Servicios: rollingAverage, leases      │
│        │                                              │        │        │                               │
│ SQLite local: products, stock_leases, sales,          │        │ PostgreSQL: products, devices, sales,  │
│   sale_items, event_log (append-only)                 │        │   sale_items, stock_leases             │
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
  db/pool.ts        # pool pg (+ pool.on('error'))
  db/migrate.ts     # migrate() y seed(); db/cli.ts los expone a npm
  routes/           # health, catalogo, prestamos, sync
  services/         # rollingAverage, (leaseService*)
test/               # node:test vía tsx; usan la BD posde_test
db/migrations/      # NNNN_*.sql, npm run db:migrate (tabla schema_migrations)
db/seed/            # datos de desarrollo repetibles, npm run db:seed
db/docker-init/     # solo crea posde_test al crear el volumen (compose.yaml, puerto 5434)
```

Comandos (en `pos-backend/`): `npm run dev` · `build` · `start` · `typecheck` · `test` · `db:migrate` · `db:seed`.

## 3. Flujos principales

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
| `products` | Copia local del catálogo (`unit_price_cents`). No guarda stock: el stock vendible offline es la suma de leases activos |
| `stock_leases` | Cuotas por dispositivo y producto (`quota_total`, `quota_used ≤ quota_total`, `status`); `id` lo emite el servidor |
| `sales` / `sale_items` | Venta y sus líneas |
| `event_log` | Bitácora append-only; `sale_created` lleva `{ sale, items }` en `payload_json` |

### 4.2 PostgreSQL (backend) — `pos-backend/db/migrations/NNNN_*.sql`
Se aplican con `npm run db:migrate` (ADR-0006): una transacción por archivo, registradas en `schema_migrations(version, applied_at)`.

| Tabla | Propósito |
|---|---|
| `products` | Catálogo + `central_stock` (`unit_price_cents`) |
| `devices` | Registro mínimo de dispositivos (se amplía en SPEC-003) |
| `sales` / `sale_items` | Ventas recibidas; PK `sales.id` ⇒ idempotencia |
| `stock_leases` | Leases emitidos (la lógica de emisión/congelado es de SPEC-005) |

## 5. Contratos HTTP

Base URL: `http://<host>:<PORT>`. JSON en ambos sentidos.

| Método y ruta | Request | Response 200 | Errores | Estado |
|---|---|---|---|---|
| `GET /health` | — | `{ status: "ok", db: "up" }` | 503 `DB_UNAVAILABLE` (< 1 s) | ✅ implementado |
| `GET /catalogo` | — | `[{ id, name, category, unit_price_cents, active }]` | 500 | ✅ implementado |
| `POST /prestamos/request` | `{ product_id: uuid }` | `{ product_id, qty_total, created_at }` | 400 `VALIDATION_ERROR` | 🟡 calcula, no congela |
| `POST /sync/events` | ver abajo | `{ received, inserted, duplicated }` | 400 `VALIDATION_ERROR` si `events` no es arreglo o un evento no tiene la forma esperada | 🟡 transacción por evento; lotes y validación completa en SPEC-008 |

`POST /sync/events` — request:
```json
{ "events": [ {
    "event_id": "<uuid = sale.id>", "event_type": "sale_created", "device_id": "…", "created_at": "ISO-8601",
    "payload": {
      "sale":  { "id", "device_id", "total_cents", "payment_method", "created_at" },
      "items": [ { "id", "sale_id", "product_id", "quantity", "unit_price_cents" } ]
    } } ] }
```
El `payload` es exactamente el `payload_json` guardado en `event_log` de la app. Reenviar un evento ya recibido cuenta como `duplicated` y no inserta nada.

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
| `NOT_FOUND` | 404 | Ruta inexistente |
| `DB_UNAVAILABLE` | 503 | `/health` sin BD |
| `INTERNAL_ERROR` | 500 | Cualquier otro error; sin SQL ni trazas en la respuesta |

Contratos pendientes de definir en sus specs: renovación/liberación de lease, registro de dispositivo.

## 6. Decisiones

Ver [adr/](adr/README.md).
