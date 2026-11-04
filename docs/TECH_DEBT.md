# Deuda técnica, bugs y riesgos

Severidad: 🔴 bloqueante · 🟠 alta · 🟡 media · ⚪ baja. Al resolver un ítem, moverlo a "Resueltos" con la spec/commit que lo cerró.

## Abiertos

| ID | Sev. | Repo | Ubicación | Problema | Se resuelve en |
|---|---|---|---|---|---|
| TD-009 | 🟡 | backend | `routes/sync.ts` | Ya valida la forma y usa una transacción por evento (SPEC-001). Falta: validación completa de tipos, inserción por lotes, respuesta por evento, y conciliar lo informado en `close` con las ventas sincronizadas. **No** descontar stock al sincronizar: ya salió al prestarse (SPEC-005) | SPEC-008 |
| TD-025 | 🟡 | backend | `services/leaseService.ts` | La cuota de un teléfono perdido o desinstalado queda congelada para siempre: el servidor solo devuelve stock con `close` (SPEC-005 RF-15). Falta una forma de liberarla a mano | Spec de administración (por definir) |
| TD-026 | ⚪ | app | `features/leases/data/leaseSync.ts` | Cada ciclo (30 s) vuelve a pedir préstamo de todos los productos sin stock; con catálogos grandes son varias peticiones inútiles | Cuando el catálogo crezca |
| TD-027 | 🟡 | app, backend | — | CA-9 de SPEC-005 (dos dispositivos sin red no superan el stock) no se probó con dos dispositivos reales; está cubierto por partes: pedidos simultáneos en `lease.test.ts` y descuento local en `leases.test.mjs` | Fase 4 (pruebas con ≥ 2 dispositivos) |
| TD-013 | 🟡 | app | — | La app solo prueba migraciones (`npm test`, `node:sqlite`); faltan pruebas de repositorios y UI | cada spec de app |
| TD-024 | ⚪ | app | `package.json` | `expo-doctor` 19/20: salieron `expo` 58.0.23, `expo-sqlite` 58.0.15 y `react-native-safe-area-context` 5.11.1 (instalados 58.0.21 / 58.0.14 / 5.10.1) | `npx expo install --check` cuando se decida |

## Riesgos de diseño

| ID | Riesgo | Mitigación propuesta |
|---|---|---|
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
| TD-019 | `sales.device_id` sin FK a `devices` | SPEC-003 (migración 0004) | 2026-10-30 |
| TD-023 | Botón "Venta de prueba" en Venta | SPEC-007 (carrito y cobro) | 2026-11-01 |
| TD-021 | `npm audit`: `body-parser` < 2.4 (alta) y `qs` < 6.17 (moderada) | SPEC-002 (`npm audit fix`: body-parser 2.4.0, qs 6.17.1) | 2026-10-30 |
| TD-016 | `isOnline` sin conexión al estado real de red | SPEC-006 (monitor de conectividad) | 2026-11-03 |
| TD-022 | Registro sin reintento al volver la red | SPEC-006 (`onReconnect`) | 2026-11-03 |
| TD-007 | El lease no se congelaba ni se guardaba ⇒ sobreventa | SPEC-005 (`requestLeases` con `for update`) | 2026-11-03 |
| TD-008 | Tasa global por producto y lectura de stock sin bloqueo | SPEC-005 (tasa por dispositivo; fila de producto bloqueada) | 2026-11-03 |
| R-01 | Lease que expira con el dispositivo sin red vendiendo | SPEC-005 (el servidor nunca devuelve stock sin `close`) | 2026-11-03 |
| R-02 | Reloj del dispositivo desfasado en el promedio móvil | SPEC-005 (tasa con hora del servidor; renovación con duración relativa) | 2026-11-03 |
