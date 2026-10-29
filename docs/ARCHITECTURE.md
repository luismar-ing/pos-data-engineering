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
│ SQLite local: products, stock_leases, sales,          │        │ PostgreSQL: products, device_sessions, │
│   sale_items, event_log (append-only)                 │        │   stock_leases*, sale_events           │
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
  index.ts          # app Express + montaje de routers
  db/pool.ts        # pool pg
  routes/           # catalogo, prestamos, sync
  services/         # rollingAverage, (leaseService*)
db/schema.sql       # esquema Postgres (sin migraciones aún)
docker-compose.yml  # Postgres 16 en puerto 5433
```

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

### 4.1 SQLite (app) — `pos-app/src/core/db/schema.ts`
| Tabla | Propósito |
|---|---|
| `products` | Copia local del catálogo |
| `stock_leases` | Cuotas arrendadas por producto (`quota_total`, `quota_used`, `status`) |
| `sales` / `sale_items` | Venta y sus líneas |
| `event_log` | Bitácora append-only a sincronizar |

⚠️ El esquema actual no compila (ver TECH_DEBT TD-001 a TD-004).

### 4.2 PostgreSQL (backend) — `pos-backend/db/schema.sql`
| Tabla | Propósito |
|---|---|
| `products` | Catálogo + `central_stock` |
| `device_sessions` | Registro de dispositivos/sesiones |
| `sale_events` | Eventos de venta recibidos (PK `event_id` ⇒ idempotencia) |
| `stock_leases`* | Leases emitidos y su estado (pendiente, SPEC-003) |

⚠️ Desalineación de modelo: la app agrupa venta → líneas (`sales` + `sale_items`), el backend recibe un evento por producto (`sale_events`). Se resuelve en SPEC-001.

## 5. Contratos HTTP

Base URL: `http://<host>:<PORT>`. JSON en ambos sentidos.

| Método y ruta | Request | Response 200 | Errores | Estado |
|---|---|---|---|---|
| `GET /catalogo` | — | `[{ id, name, category, unit_price, active }]` | 500 | ✅ implementado |
| `POST /prestamos/request` | `{ product_id }` | `{ product_id, qty_total, created_at }` | 400 sin `product_id` | 🟡 calcula, no congela |
| `POST /sync/events` | `{ events: [{ event_id, device_id, product_id, quantity, created_at }] }` | `{ received, insertado, duplicado }` | — (sin validación) | 🟡 sin validación ni transacción |

Contratos pendientes de definir en sus specs: renovación/liberación de lease, registro de dispositivo, healthcheck.

## 6. Decisiones

Ver [adr/](adr/README.md).
