# Progreso

> Última revisión: **2026-11-04** · Fase actual: **3 — Valor agregado** · Próximo paso: redactar SPEC-010 (Recibos QR offline).

Leyenda: ✅ hecho · 🟡 parcial / con problemas · 🔴 roto · ⬜ no iniciado

## Resumen

SPEC-001 está terminada y verificada, también en teléfono: app y backend comparten el modelo de venta (cabecera + líneas, montos en centavos), el esquema local tiene migraciones versionadas y el backend recibe ventas sin duplicarlas. Postgres corre en un contenedor propio del proyecto. SPEC-002 deja el backend con comandos estándar, migraciones automáticas, errores con forma única, `/health` y pruebas automatizadas. SPEC-003 da a cada teléfono una identidad registrada en el servidor (secreto en almacén seguro, solo el hash en Postgres), protege `/prestamos` y `/sync`, y exige una sesión de vendedor abierta para cobrar; probado en teléfono, también sin red. SPEC-004 descarga el catálogo al abrir la app o a mano, lo guarda de forma atómica y lo muestra en Inventario sin red; las bajas quedan inactivas y las ventas conservan su precio. SPEC-007 cierra la fase 1: carrito con buscador, cobro con método de pago y cambio, una venta por cobro y precio vigente al cobrar; 34 ms por cobro sin red en teléfono. SPEC-006 abre la fase 2: la app sabe si el servidor responde (`GET /health`), muestra "Sin conexión" en todas las pestañas y, al volver la red, reintenta el registro y el catálogo. SPEC-005 resuelve el núcleo: cada teléfono vende solo lo que el servidor le prestó y congeló, con una cuota según su propio ritmo de venta; lo no vendido vuelve al stock central solo cuando el teléfono lo informa. Probado en teléfono; la prueba con dos dispositivos queda para la fase 4 (TD-027). SPEC-008 cierra la fase 2: la bitácora viaja sola al servidor en lotes de hasta 50, con un resultado por evento y sin duplicados; las sesiones de vendedor también llegan; 500 eventos en 4 s. SPEC-009 abre la fase 3: la pestaña Dashboard muestra, sin red, el ritmo de venta del teléfono, qué se agota primero y los totales y más vendidos de la sesión.

## Repositorio

Monorepo en `POS_DE_APP/` (ADR-0004), en GitHub como `luismar-ing/pos-data-engineering`. Rama de trabajo actual: `spec/009-edge-analytics`.

## pos-app

| Módulo | Estado | Notas |
|---|---|---|
| Proyecto Expo 58 + TS estricto | ✅ | Actualizado desde SDK 57 (ADR-0005) para usar Expo Go actual |
| Navegación (4 tabs) | ✅ | Venta, Inventario, Dashboard y Ajustes con contenido |
| Identidad de dispositivo | ✅ | id en `settings`, secreto en `expo-secure-store`, registro idempotente al abrir, desde Ajustes y al volver la red (SPEC-003, SPEC-006) |
| Sesión de vendedor | ✅ | Una abierta a la vez; eventos `session_opened`/`session_closed`; sin sesión no se cobra |
| BD local (`database.ts` + `migrations.ts`) | ✅ | Migraciones con `PRAGMA user_version`; la app espera a que la BD esté lista. Probado en teléfono (Expo Go SDK 58) |
| Repositorio de productos | ✅ | API async, `unit_price_cents` |
| Catálogo local | ✅ | Descarga al abrir y a mano, validación, reemplazo atómico, bajas como inactivas; 2 000 productos en 105 ms en teléfono (SPEC-004) |
| Registro de venta (`saleRepository`) | ✅ | Venta + líneas + evento `sale_created` en una transacción; exige sesión abierta y guarda `session_id`; precio y `active` leídos al cobrar (SPEC-007); descuenta la cuota del préstamo (SPEC-005) |
| Préstamos locales (`features/leases`) | ✅ | Migración v3; ciclo `leaseSync` (cerrar `closing` → pedir), cada 30 s, al reconectar, al abrir/cerrar sesión y tras cobrar (SPEC-005) |
| Generación de UUID | ✅ | `expo-crypto` |
| Store de sesión (Zustand) | ✅ | `currentSession`, `catalogSyncedAt`, carrito (`cart.ts`), `isOnline` real (SPEC-006), `leasesUpdatedAt` (SPEC-005), `eventsSyncedAt` (SPEC-008) |
| Monitor de red | ✅ | `expo-network` + `/health` (200 = en línea, 3 s máx.), reintento cada 15 s sin conexión, `onReconnect`, franja "Sin conexión" (SPEC-006) |
| Pantalla de inventario | ✅ | Lista del catálogo, hora de actualización, botón Actualizar, "Disponible N" por préstamo (SPEC-005) |
| Pantalla de venta | ✅ | Buscador, carrito (−/+, tope por lo disponible y 999), cobro con Efectivo/Tarjeta/Transferencia y cambio (SPEC-007); "Quedan N" / "Agotado" (SPEC-005) |
| Dashboard (`features/analytics`) | ✅ | Migración v5 (índices); Burn Rate desde la primera venta del teléfono en 10 min, Runout Time (ámbar < 5 min), top 5 y totales de la sesión; refresco al enfocar, cada 15 s y tras cobrar; < 200 ms con 2 000 productos y 10 000 ventas (PC) (SPEC-009) |
| Sync worker (`core/sync`) | ✅ | Migración v4 (`sync_error`); `syncEvents` en lotes de 50 y < 80 kB hasta vaciar la cola; tras cobrar, al abrir/cerrar sesión, al reconectar, cada 30 s y desde Ajustes (resumen y "Sincronizar ahora") (SPEC-008) |
| Recibo QR | ⬜ | SPEC-010 |
| Tests automatizados | 🟡 | `npm test` (43): migraciones, catálogo, carrito, dinero, conectividad, préstamos, sync y analítica (TD-013) |

## pos-backend

| Módulo | Estado | Notas |
|---|---|---|
| Express 5 + TS (ESM) | ✅ | Scripts `dev`/`build`/`start`/`typecheck`/`test`; config validada; errores con forma única (ADR-0006); sobrevive a cortes de Postgres |
| `GET /health` | ✅ | 200 con BD, 503 `DB_UNAVAILABLE` en < 1 s sin ella |
| Postgres 16 en Docker | ✅ | `compose.yaml` en la raíz (contenedor `pos-de-db`, puerto 5434, BD `posde`); crea `posde` y `posde_test` vacías; esquema y semilla con `npm run db:migrate` / `db:seed` |
| Esquema (`db/migrations/`) | ✅ | `products`, `devices` (+`token_hash`), `sales` (+FK a `devices`, `session_id`), `sale_items`, `stock_leases` (+FK a `devices`, `closed_at`, uno activo por dispositivo y producto), `sync_events`, `sessions` (0006). Runner con `schema_migrations` (ADR-0006) |
| `POST /devices/register` + autenticación | ✅ | Bearer con el secreto del dispositivo; 401/403/409 (SPEC-003) |
| `GET /catalogo` | ✅ | Público; solo activos, por nombre; `unit_price_cents`; con pruebas |
| `POST /prestamos/request` y `/close` | ✅ | Exigen dispositivo registrado. Pedir congela la cuota con la fila del producto bloqueada; cerrar devuelve lo no vendido; ambos idempotentes (SPEC-005) |
| `POST /sync/events` | ✅ | Exige dispositivo registrado. Lotes de 1–50 con `batch_id`; ventas y sesiones; un resultado por evento (`inserted`/`duplicate`/`rejected`); idempotente por `sync_events`; validación completa; no toca stock (SPEC-008) |
| `leaseService` | ✅ | Tasa por dispositivo desde sus préstamos cerrados (hora del servidor); ventana 5 min, préstamo 3 min, margen 1.2, mínimo 5; con pruebas |
| Tests automatizados | ✅ | `npm test` (node:test), 43 pruebas contra `posde_test`, incluida la de pedidos simultáneos |

## Specs

| Spec | Estado |
|---|---|
| SPEC-001 Modelo de datos unificado | 🏁 Done (2026-10-30) |
| SPEC-002 Infraestructura backend | 🏁 Done (2026-10-30) |
| SPEC-003 Identidad de dispositivo y sesión | 🏁 Done (2026-10-30) |
| SPEC-004 Catálogo: descarga y caché local | 🏁 Done (2026-10-30) |
| SPEC-007 Flujo de venta | 🏁 Done (2026-11-01) |
| SPEC-006 Monitor de conectividad y modo offline | 🏁 Done (2026-11-03) |
| SPEC-005 Stock Leasing | 🏁 Done (2026-11-03) |
| SPEC-008 Bitácora + Batch Sync ETL | 🏁 Done (2026-11-03) |
| SPEC-009 Edge Analytics | 🏁 Done (2026-11-04) |
| SPEC-010 | ⬜ Sin redactar (ver `specs/README.md`) |

## Decisiones pendientes del usuario

1. Ninguna. SPEC-005 (2026-11-03): tasa por dispositivo; el servidor solo devuelve stock con informe del dispositivo (sin plazo de 2 h).
