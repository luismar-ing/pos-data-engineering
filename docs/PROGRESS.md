# Progreso

> Última revisión: **2026-10-30** · Fase actual: **0 — Cimientos** · Próximo paso: redactar SPEC-007 (flujo de venta: carrito → cobro → registro local).

Leyenda: ✅ hecho · 🟡 parcial / con problemas · 🔴 roto · ⬜ no iniciado

## Resumen

SPEC-001 está terminada y verificada, también en teléfono: app y backend comparten el modelo de venta (cabecera + líneas, montos en centavos), el esquema local tiene migraciones versionadas y el backend recibe ventas sin duplicarlas. Postgres corre en un contenedor propio del proyecto. SPEC-002 deja el backend con comandos estándar, migraciones automáticas, errores con forma única, `/health` y pruebas automatizadas. SPEC-003 da a cada teléfono una identidad registrada en el servidor (secreto en almacén seguro, solo el hash en Postgres), protege `/prestamos` y `/sync`, y exige una sesión de vendedor abierta para cobrar; probado en teléfono, también sin red. SPEC-004 descarga el catálogo al abrir la app o a mano, lo guarda de forma atómica y lo muestra en Inventario sin red; las bajas quedan inactivas y las ventas conservan su precio. El núcleo del proyecto (congelar stock en leases, TD-007) sigue pendiente para SPEC-005.

## Repositorio

Monorepo en `POS_DE_APP/` (ADR-0004), en GitHub como `luismar-ing/pos-data-engineering`. Rama de trabajo actual: `spec/004-catalogo`.

## pos-app

| Módulo | Estado | Notas |
|---|---|---|
| Proyecto Expo 58 + TS estricto | ✅ | Actualizado desde SDK 57 (ADR-0005) para usar Expo Go actual |
| Navegación (4 tabs) | 🟡 | Venta, Inventario y Ajustes con contenido; Dashboard placeholder |
| Identidad de dispositivo | ✅ | id en `settings`, secreto en `expo-secure-store`, registro idempotente al abrir y desde Ajustes (SPEC-003) |
| Sesión de vendedor | ✅ | Una abierta a la vez; eventos `session_opened`/`session_closed`; sin sesión no se cobra |
| BD local (`database.ts` + `migrations.ts`) | ✅ | Migraciones con `PRAGMA user_version`; la app espera a que la BD esté lista. Probado en teléfono (Expo Go SDK 58) |
| Repositorio de productos | ✅ | API async, `unit_price_cents` |
| Catálogo local | ✅ | Descarga al abrir y a mano, validación, reemplazo atómico, bajas como inactivas; 2 000 productos en 105 ms en teléfono (SPEC-004) |
| Registro de venta (`saleRepository`) | ✅ | Venta + líneas + evento `sale_created` en una transacción; exige sesión abierta y guarda `session_id` |
| Generación de UUID | ✅ | `expo-crypto` |
| Store de sesión (Zustand) | 🟡 | `currentSession`, carrito e `isOnline`; sin conexión real a la red (TD-016) |
| Monitor de red | ⬜ | SPEC-006 |
| Pantalla de inventario | ✅ | Lista del catálogo, hora de actualización, botón Actualizar (stock por lease en SPEC-005) |
| Pantallas de venta (carrito) / dashboard | ⬜ | SPEC-007, SPEC-009 |
| Sync worker | ⬜ | SPEC-008 |
| Recibo QR | ⬜ | SPEC-010 |
| Tests automatizados | 🟡 | `npm test` (9): migraciones y catálogo con `node:sqlite` (TD-013) |

## pos-backend

| Módulo | Estado | Notas |
|---|---|---|
| Express 5 + TS (ESM) | ✅ | Scripts `dev`/`build`/`start`/`typecheck`/`test`; config validada; errores con forma única (ADR-0006); sobrevive a cortes de Postgres |
| `GET /health` | ✅ | 200 con BD, 503 `DB_UNAVAILABLE` en < 1 s sin ella |
| Postgres 16 en Docker | ✅ | `compose.yaml` en la raíz (contenedor `pos-de-db`, puerto 5434, BD `posde`); crea `posde` y `posde_test` vacías; esquema y semilla con `npm run db:migrate` / `db:seed` |
| Esquema (`db/migrations/`) | ✅ | `products`, `devices` (+`token_hash`), `sales` (+FK a `devices`, `session_id`), `sale_items`, `stock_leases`. Runner con `schema_migrations` (ADR-0006) |
| `POST /devices/register` + autenticación | ✅ | Bearer con el secreto del dispositivo; 401/403/409 (SPEC-003) |
| `GET /catalogo` | ✅ | Público; solo activos, por nombre; `unit_price_cents`; con pruebas |
| `POST /prestamos/request` | 🟡 | Exige dispositivo registrado. Calcula con promedio móvil, **no congela ni persiste** (TD-007, TD-008) |
| `POST /sync/events` | 🟡 | Exige dispositivo registrado y rechaza eventos de otro (403). Recibe `sale_created`, idempotente, transacción por evento, 400 si la forma es inválida. Faltan lotes y descontar stock (TD-009) |
| `rollingAverage` | 🟡 | Usa `sale_items` + `sales`; ventana 5 min, lease 3 min, margen 1.2, mínimo 5; con pruebas |
| Tests automatizados | ✅ | `npm test` (node:test), 35 pruebas contra `posde_test` |

## Specs

| Spec | Estado |
|---|---|
| SPEC-001 Modelo de datos unificado | 🏁 Done (2026-10-30) |
| SPEC-002 Infraestructura backend | 🏁 Done (2026-10-30) |
| SPEC-003 Identidad de dispositivo y sesión | 🏁 Done (2026-10-30) |
| SPEC-004 Catálogo: descarga y caché local | 🏁 Done (2026-10-30) |
| SPEC-005 … SPEC-010 | ⬜ Sin redactar (ver `specs/README.md`) |

## Decisiones pendientes del usuario

1. ¿La tasa de consumo para el lease es por dispositivo (como dice el planteamiento) o global por producto (como está hoy)? → SPEC-005.
