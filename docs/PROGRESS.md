# Progreso

> Última revisión: **2026-11-17** · Fase actual: **5 — Administración** (SPEC-013 y SPEC-014 cerradas) · Próximo paso: decidir con el usuario (datos semilla y guion de demo, TD-034/TD-031 con el iPhone, o HTTPS para el panel, TD-032).

Leyenda: ✅ hecho · 🟡 parcial / con problemas · 🔴 roto · ⬜ no iniciado

## Resumen

SPEC-001 está terminada y verificada, también en teléfono: app y backend comparten el modelo de venta (cabecera + líneas, montos en centavos), el esquema local tiene migraciones versionadas y el backend recibe ventas sin duplicarlas. Postgres corre en un contenedor propio del proyecto. SPEC-002 deja el backend con comandos estándar, migraciones automáticas, errores con forma única, `/health` y pruebas automatizadas. SPEC-003 da a cada teléfono una identidad registrada en el servidor (secreto en almacén seguro, solo el hash en Postgres), protege `/prestamos` y `/sync`, y exige una sesión de vendedor abierta para cobrar; probado en teléfono, también sin red. SPEC-004 descarga el catálogo al abrir la app o a mano, lo guarda de forma atómica y lo muestra en Inventario sin red; las bajas quedan inactivas y las ventas conservan su precio. SPEC-007 cierra la fase 1: carrito con buscador, cobro con método de pago y cambio, una venta por cobro y precio vigente al cobrar; 34 ms por cobro sin red en teléfono. SPEC-006 abre la fase 2: la app sabe si el servidor responde (`GET /health`), muestra "Sin conexión" en todas las pestañas y, al volver la red, reintenta el registro y el catálogo. SPEC-005 resuelve el núcleo: cada teléfono vende solo lo que el servidor le prestó y congeló, con una cuota según su propio ritmo de venta; lo no vendido vuelve al stock central solo cuando el teléfono lo informa. Probado en teléfono; la prueba con dos dispositivos queda para la fase 4 (TD-027). SPEC-008 cierra la fase 2: la bitácora viaja sola al servidor en lotes de hasta 50, con un resultado por evento y sin duplicados; las sesiones de vendedor también llegan; 500 eventos en 4 s. SPEC-009 abre la fase 3: la pestaña Dashboard muestra, sin red, el ritmo de venta del teléfono, qué se agota primero y los totales y más vendidos de la sesión. SPEC-010 cierra la fase 3: tras cobrar, la app muestra un QR con el recibo en texto que el cliente lee con la cámara de su teléfono, sin red; máximo 1 000 bytes, con "… y N productos más" si el carrito no cabe. SPEC-011 abre la fase 4: un emulador y un iPhone sin red vendieron 10 de 10 hot dogs sin sobreventa ni duplicados, con un reporte de consistencia del stock en el servidor y pruebas de reintentos de sync (TD-027 resuelto). SPEC-012 rediseña la app ("Señalética de feria"). SPEC-013 abre la fase 5: al abrir se elige Vendedor o Administrador; el administrador entra con usuario y contraseña (sesión de 8 h) y ve en la app las ventas y el stock de todos los teléfonos, solo con red; el vendedor cobra sin red igual que antes. SPEC-014 completa el panel: dar de baja y reactivar teléfonos (su cuota vuelve al stock central 32 min después de vencer, ADR-0008), conciliación por préstamo (cada línea de venta guarda su préstamo) y alta, edición y ajuste de stock de productos, con registro de cambios; todos los teléfonos dejan de vender un préstamo 30 min después de vencer sin red.

## Repositorio

Monorepo en `POS_DE_APP/` (ADR-0004), en GitHub como `luismar-ing/pos-data-engineering`. Rama de trabajo actual: `spec/014-admin-acciones` (sale de `spec/013-panel-admin`).

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
| Recibo QR (`features/sales`) | ✅ | Texto plano UTF-8 ≤ 1 000 bytes, nombres a 24 caracteres, corte "… y N productos más"; `react-native-qrcode-svg` (ECC L) en la confirmación del cobro; solo lectura, sin red (SPEC-010) |
| Rol y panel de administración (`features/admin`) | ✅ | Selección de rol (`settings.role`), login con sesión en SecureStore, pestañas Ventas, Stock (alta y edición de productos), Teléfonos, Conciliar y Cuenta (registro de cambios); un 401 vuelve al login; no se cambia de rol con sesión de vendedor abierta (SPEC-013) |
| Préstamo por venta y tope sin red | ✅ | Migración v6 (`sale_items.lease_id`); el cobro guarda el préstamo de cada línea; un préstamo vende hasta `renew_at` + 30 min (ADR-0008); `renew_at` desde el inicio de la petición (SPEC-014) |
| Tests automatizados | 🟡 | `npm test` (70): migraciones, catálogo, carrito, dinero, conectividad, préstamos, sync (incluida respuesta perdida), analítica, recibo QR, rol y sesión de admin, tope sin red y formulario de producto (TD-013) |

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
| Escenario y reporte de stock (`src/dev/scenario.ts`, `src/services/stockService.ts`) | ✅ | `npm run scenario:reset` (solo `posde`/`posde_test`) y `npm run report:stock` (central + prestado + informado = inicial; sync ≤ inicial) (SPEC-011) |
| Administración (`/admin/*`) | ✅ | Migración 0007; `POST /admin/login` y `/logout` (scrypt, token opaco de 8 h, bloqueo por usuario, ADR-0007), `GET /admin/sales` y `GET /admin/stock`; `npm run admin:set`; ~70 ms por vista con 10 000 ventas (SPEC-013) |
| Acciones del panel (SPEC-014) | ✅ | Migración 0008; `GET /admin/devices`, baja y reactivación, `releaseRevokedLeases` (cada 60 s), cierre tardío, `GET /admin/reconciliation`, `/admin/products` (alta, edición, ajuste), `GET /admin/audit`; idempotencia por `request_id`; 31–48 ms por vista con 10 000 ventas |
| Tests automatizados | ✅ | `npm test` (node:test), 95 pruebas contra `posde_test`: pedidos simultáneos, lote cortado, envíos simultáneos del mismo lote, reporte de stock, login de admin, baja y devolución, conciliación, catálogo, idempotencia y rendimiento del panel |

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
| SPEC-010 Recibos QR offline | 🏁 Done (2026-11-05) |
| SPEC-011 Corte de red con dos dispositivos | 🏁 Done (2026-11-06) |
| SPEC-012 Rediseño visual "Señalética de feria" | 🏁 Done (2026-11-13) |
| SPEC-013 Panel de administración: rol, login, ventas y stock | 🏁 Done (2026-11-17) |
| SPEC-014 Panel de administración: dispositivos, conciliación y catálogo | 🏁 Done (2026-11-17) |

## Decisiones pendientes del usuario

1. Siguiente tema (2026-11-17): datos semilla y guion de demo (pendiente desde la fase 4), pruebas con el iPhone (TD-031, TD-034) o HTTPS para el panel (TD-032).
2. SPEC-005 (2026-11-03): tasa por dispositivo; el servidor solo devuelve stock con informe del dispositivo (sin plazo de 2 h).
