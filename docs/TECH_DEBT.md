# Deuda técnica, bugs y riesgos

Severidad: 🔴 bloqueante · 🟠 alta · 🟡 media · ⚪ baja. Al resolver un ítem, moverlo a "Resueltos" con la spec/commit que lo cerró.

## Abiertos

| ID | Sev. | Repo | Ubicación | Problema | Se resuelve en |
|---|---|---|---|---|---|
| TD-007 | 🔴 | backend | `routes/prestamos.ts` | El lease se calcula pero **no se congela** en `central_stock` ni se persiste: dos dispositivos pueden recibir el mismo stock ⇒ sobreventa | SPEC-005 |
| TD-008 | 🟠 | backend | `services/rollingAverage.ts` | Tasa de consumo global por producto, no por dispositivo (el planteamiento pide por dispositivo). Lectura de stock y cálculo sin bloqueo ⇒ condición de carrera | SPEC-005 |
| TD-009 | 🟡 | backend | `routes/sync.ts` | Ya valida la forma y usa una transacción por evento (SPEC-001). Falta: validación completa de tipos, inserción por lotes, descontar stock/lease, respuesta por evento | SPEC-008 |
| TD-011 | 🟡 | backend | `package.json`, `tsconfig.json` | Sin scripts `dev`/`build`/`start`; `ts-node-dev` y `tsx` duplicados; sin `rootDir`/`outDir`; opción `jsx` innecesaria | SPEC-002 |
| TD-012 | ⚪ | backend | `src/index.ts` | `PORT` sin valor por defecto; sin manejador de errores ni `/health` | SPEC-002 |
| TD-013 | 🟡 | ambos | — | No hay pruebas automatizadas en los repos (SPEC-001 se verificó con scripts externos) | SPEC-002 / cada spec |
| TD-014 | 🟡 | backend | `db/migrations/` | Migraciones SQL numeradas pero se aplican a mano; falta runner con tabla `schema_migrations`. (App: resuelto con `PRAGMA user_version`) | SPEC-002 |
| TD-016 | ⚪ | app | `sessionStore.ts` | `addToCart` duplica la línea en vez de sumar cantidad; `isOnline` no está conectado al estado real de red | SPEC-006 / SPEC-007 |
| TD-018 | ⚪ | backend | `test-db.ts` | Imprime `DB_URL` completa (incluye contraseña) en consola | SPEC-002 |
| TD-019 | ⚪ | backend | `devices` / `sales.device_id` | `sales.device_id` no tiene FK a `devices` porque aún no hay registro de dispositivos | SPEC-003 |

## Riesgos de diseño

| ID | Riesgo | Mitigación propuesta |
|---|---|---|
| R-01 | Un lease expira mientras el dispositivo sigue offline vendiendo | El servidor no libera la cuota de un lease hasta recibir sync o pasar un tiempo de gracia largo; definir en SPEC-005 |
| R-02 | Reloj del dispositivo desfasado altera `created_at` y el promedio móvil | Ya se guarda `sales.received_at` en el servidor; decidir en SPEC-005 cuál usar para el promedio móvil |
| R-03 | Payload de recibo QR excede la capacidad del código | Definir formato compacto y límite de líneas en SPEC-010 |

## Resueltos

| ID | Problema | Resuelto en | Fecha |
|---|---|---|---|
| TD-001 | `create table if not exist` en el esquema SQLite | SPEC-001 (migración v1) | 2026-10-30 |
| TD-002 | Coma faltante en `sales` | SPEC-001 | 2026-10-30 |
| TD-003 | Coma faltante en `event_log` | SPEC-001 | 2026-10-30 |
| TD-004 | `unique` en `products.stock` | SPEC-001 (local ya no guarda stock) | 2026-10-30 |
| TD-005 | `getAllSync` dentro de función async | SPEC-001 | 2026-10-30 |
| TD-006 | Modelo de venta distinto entre app y backend | SPEC-001 (`sales` + `sale_items` en ambos) | 2026-10-30 |
| TD-010 | `device_sessions.event_id` sin propósito | SPEC-001 (reemplazada por `devices`) | 2026-10-30 |
| TD-014 (app) | Esquema local sin versionar | SPEC-001 (`PRAGMA user_version`) | 2026-10-30 |
| TD-015 | Imports sin uso / `index.ts` sin commitear | SPEC-001 / `be8a1c8` | 2026-10-30 |
| TD-017 | Montos como `real` | SPEC-001 (centavos enteros) | 2026-10-30 |
