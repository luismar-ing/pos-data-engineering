# Deuda técnica, bugs y riesgos

Severidad: 🔴 bloqueante · 🟠 alta · 🟡 media · ⚪ baja. Al resolver un ítem, moverlo a "Resueltos" con la spec/commit que lo cerró.

## Abiertos

| ID | Sev. | Repo | Ubicación | Problema | Se resuelve en |
|---|---|---|---|---|---|
| TD-001 | 🔴 | app | `src/core/db/schema.ts` | `create table if not exist` (falta la "s") en `sales`, `sale_items` y `event_log`: error de sintaxis al abrir la BD | SPEC-001 |
| TD-002 | 🔴 | app | `schema.ts` → `sales` | Falta coma después de `total_amount real not null` | SPEC-001 |
| TD-003 | 🔴 | app | `schema.ts` → `event_log` | Falta coma después de `created_at ...` (antes de `synced_at`) | SPEC-001 |
| TD-004 | 🟠 | app | `schema.ts` → `products` | `stock integer unique not null`: `unique` impide que dos productos tengan el mismo stock | SPEC-001 |
| TD-005 | 🟡 | app | `productRepository.ts` | `getAllProducts` usa `getAllSync` dentro de función async: bloquea el hilo JS | SPEC-001 |
| TD-006 | 🟠 | ambos | esquemas | Modelo de venta distinto: app `sales`+`sale_items`, backend `sale_events` por producto; `stock_leases` usa `session_id` que el backend no conoce | SPEC-001 |
| TD-007 | 🔴 | backend | `routes/prestamos.ts` | El lease se calcula pero **no se congela** en `central_stock` ni se persiste: dos dispositivos pueden recibir el mismo stock ⇒ sobreventa | SPEC-005 |
| TD-008 | 🟠 | backend | `services/rollingAverage.ts` | Tasa de consumo global por producto, no por dispositivo (el planteamiento pide por dispositivo). Lectura de stock y cálculo sin bloqueo ⇒ condición de carrera | SPEC-005 |
| TD-009 | 🟠 | backend | `routes/sync.ts` | Sin validación (`events` ausente ⇒ 500), insert fila por fila sin transacción, no descuenta stock ni lease | SPEC-008 |
| TD-010 | ⚪ | backend | `db/schema.sql` | `device_sessions.event_id` sin propósito claro ni FK | SPEC-003 |
| TD-011 | 🟡 | backend | `package.json`, `tsconfig.json` | Sin scripts `dev`/`build`/`start`; `ts-node-dev` y `tsx` duplicados; sin `rootDir`/`outDir`; opción `jsx` innecesaria | SPEC-002 |
| TD-012 | ⚪ | backend | `src/index.ts` | `PORT` sin valor por defecto; sin manejador de errores ni `/health` | SPEC-002 |
| TD-013 | 🟡 | ambos | — | No hay pruebas automatizadas | SPEC-002 / cada spec |
| TD-014 | 🟡 | ambos | esquemas | Sin migraciones: `create if not exists` no aplica cambios a BD existentes (app: usar `PRAGMA user_version`; backend: migraciones SQL numeradas) | SPEC-001 / SPEC-002 |
| TD-015 | ⚪ | app | `App.tsx`, `index.ts` | Imports sin uso; cambio sin commitear en `index.ts` | SPEC-001 |
| TD-016 | ⚪ | app | `sessionStore.ts` | `addToCart` duplica la línea en vez de sumar cantidad; `isOnline` no está conectado al estado real de red | SPEC-006 / SPEC-007 |
| TD-017 | 🟡 | app | `schema.ts` | Montos como `real` (coma flotante) | SPEC-001 |
| TD-018 | ⚪ | backend | `test-db.ts` | Imprime `DB_URL` completa (incluye contraseña) en consola | SPEC-002 |

## Riesgos de diseño

| ID | Riesgo | Mitigación propuesta |
|---|---|---|
| R-01 | Un lease expira mientras el dispositivo sigue offline vendiendo | El servidor no libera la cuota de un lease hasta recibir sync o pasar un tiempo de gracia largo; definir en SPEC-005 |
| R-02 | Reloj del dispositivo desfasado altera `created_at` y el promedio móvil | Guardar también `received_at` del servidor; usarlo para analítica central |
| R-03 | Payload de recibo QR excede la capacidad del código | Definir formato compacto y límite de líneas en SPEC-010 |

## Resueltos

| ID | Resuelto en | Fecha |
|---|---|---|
| — | — | — |
