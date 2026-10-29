# Progreso

> Última revisión: **2026-10-29** · Fase actual: **0 — Cimientos** · Próximo paso: aprobar y ejecutar SPEC-001.

Leyenda: ✅ hecho · 🟡 parcial / con problemas · 🔴 roto · ⬜ no iniciado

## Resumen

El proyecto tiene el esqueleto de ambos repos, conexión a bases de datos y un primer esbozo de las rutas del backend. Aún no hay ninguna funcionalidad usable de punta a punta. **El esquema SQLite de la app tiene errores de sintaxis que hacen fallar la apertura de la BD** (TD-001 a TD-003), y el endpoint de leases calcula la cuota pero no congela stock, que es el núcleo del proyecto (TD-007).

## Repositorio

Monorepo en `POS_DE_APP/` desde 2026-10-29 (ADR-0004), con el historial de ambos repos anteriores. ⬜ Pendiente: conectarlo a un repo nuevo en GitHub y archivar `POS-DE-app` y `pos-de-backend`.

## pos-app

| Módulo | Estado | Notas |
|---|---|---|
| Proyecto Expo 57 + TS estricto | ✅ | Dependencias base instaladas |
| Navegación (4 tabs) | 🟡 | Venta, Inventario, Dashboard, Ajustes como placeholders |
| Conexión SQLite (`database.ts`) | ✅ | Singleton `getDatabase()` |
| Esquema SQLite (`schema.ts`) | 🔴 | Errores de sintaxis y `unique` incorrecto en `stock` (TD-001..004) |
| Repositorio de productos | 🟡 | `getAll`, `getById`, `insert`; usa API síncrona (TD-005) |
| Store de sesión (Zustand) | 🟡 | Carrito y `isOnline`; sin conexión real a la red (TD-016) |
| Monitor de red | ⬜ | Falta dependencia (NetInfo) |
| Generación de UUID | ⬜ | Falta (p. ej. `expo-crypto` `randomUUID`) |
| Pantallas de venta / inventario / dashboard | ⬜ | |
| Sync worker | ⬜ | |
| Recibo QR | ⬜ | |
| Tests | ⬜ | |

## pos-backend

| Módulo | Estado | Notas |
|---|---|---|
| Express 5 + TS (ESM) | 🟡 | Sin scripts `dev`/`build`/`start` (TD-011) |
| Postgres 16 en Docker | ✅ | Puerto 5433 |
| Esquema (`db/schema.sql`) | 🟡 | Sin tabla de leases; `device_sessions` dudosa (TD-010); sin migraciones (TD-014) |
| `GET /catalogo` | ✅ | |
| `POST /prestamos/request` | 🟡 | Calcula con promedio móvil, **no congela ni persiste** (TD-007, TD-008) |
| `POST /sync/events` | 🟡 | Idempotente por `event_id`; sin validación ni transacción, no descuenta stock (TD-009) |
| `rollingAverage` | 🟡 | Ventana 5 min, lease 3 min, margen 1.2, mínimo 5 |
| Tests | ⬜ | |

## Specs

| Spec | Estado |
|---|---|
| SPEC-001 Modelo de datos unificado | 📝 Draft (spec + plan + tasks listos para revisión) |
| SPEC-002 … SPEC-010 | ⬜ Sin redactar (ver `specs/README.md`) |

## Decisiones pendientes del usuario

1. Preguntas abiertas de SPEC-001 (evento por venta vs. por línea; dinero en centavos).
2. ¿La tasa de consumo para el lease es por dispositivo (como dice el planteamiento) o global por producto (como está hoy)? → SPEC-005.
