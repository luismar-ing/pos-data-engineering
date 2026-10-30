# Deuda técnica, bugs y riesgos

Severidad: 🔴 bloqueante · 🟠 alta · 🟡 media · ⚪ baja. Al resolver un ítem, moverlo a "Resueltos" con la spec/commit que lo cerró.

## Abiertos

| ID | Sev. | Repo | Ubicación | Problema | Se resuelve en |
|---|---|---|---|---|---|
| TD-007 | 🔴 | backend | `routes/prestamos.ts` | El lease se calcula pero **no se congela** en `central_stock` ni se persiste: dos dispositivos pueden recibir el mismo stock ⇒ sobreventa | SPEC-005 |
| TD-008 | 🟠 | backend | `services/rollingAverage.ts` | Tasa de consumo global por producto, no por dispositivo (el planteamiento pide por dispositivo). Lectura de stock y cálculo sin bloqueo ⇒ condición de carrera | SPEC-005 |
| TD-009 | 🟡 | backend | `routes/sync.ts` | Ya valida la forma y usa una transacción por evento (SPEC-001). Falta: validación completa de tipos, inserción por lotes, descontar stock/lease, respuesta por evento | SPEC-008 |
| TD-013 | 🟡 | app | — | No hay pruebas automatizadas en la app (backend: resuelto en SPEC-002) | cada spec de app |
| TD-016 | ⚪ | app | `sessionStore.ts` | `addToCart` duplica la línea en vez de sumar cantidad; `isOnline` no está conectado al estado real de red | SPEC-006 / SPEC-007 |
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
| TD-011 | Sin scripts `dev`/`build`/`start`; deps duplicadas; `tsconfig` sin `outDir` | SPEC-002 | 2026-10-30 |
| TD-012 | `PORT` sin defecto; sin manejo de errores ni `/health` | SPEC-002 (`config.ts`, `errors.ts`, `/health`) | 2026-10-30 |
| TD-013 (backend) | Sin pruebas automatizadas | SPEC-002 (`npm test`, 21 pruebas) | 2026-10-30 |
| TD-014 (backend) | Migraciones aplicadas a mano | SPEC-002 (`npm run db:migrate`, ADR-0006) | 2026-10-30 |
| TD-018 | `test-db.ts` imprimía la contraseña | SPEC-002 (archivo eliminado) | 2026-10-30 |
| TD-020 | El proceso se caía si Postgres cortaba una conexión | SPEC-002 (`pool.on('error')`) | 2026-10-30 |
| TD-021 | `npm audit`: `body-parser` < 2.4 (alta) y `qs` < 6.17 (moderada) | SPEC-002 (`npm audit fix`: body-parser 2.4.0, qs 6.17.1) | 2026-10-30 |
