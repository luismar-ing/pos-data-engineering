# Progreso

> Última revisión: **2026-10-30** · Fase actual: **0 — Cimientos** · Próximo paso: redactar SPEC-002 (infraestructura backend).

Leyenda: ✅ hecho · 🟡 parcial / con problemas · 🔴 roto · ⬜ no iniciado

## Resumen

SPEC-001 está terminada y verificada, también en teléfono: app y backend comparten el modelo de venta (cabecera + líneas, montos en centavos), el esquema local tiene migraciones versionadas y el backend recibe ventas sin duplicarlas. Postgres corre en un contenedor propio del proyecto. El núcleo del proyecto (congelar stock en leases, TD-007) sigue pendiente para SPEC-005.

## Repositorio

Monorepo en `POS_DE_APP/` (ADR-0004), en GitHub como `luismar-ing/pos-data-engineering`. Rama de trabajo actual: `spec/001-modelo-datos`.

## pos-app

| Módulo | Estado | Notas |
|---|---|---|
| Proyecto Expo 58 + TS estricto | ✅ | Actualizado desde SDK 57 (ADR-0005) para usar Expo Go actual |
| Navegación (4 tabs) | 🟡 | Venta, Inventario, Dashboard, Ajustes como placeholders |
| BD local (`database.ts` + `migrations.ts`) | ✅ | Migraciones con `PRAGMA user_version`; la app espera a que la BD esté lista. Probado en teléfono (Expo Go SDK 58) |
| Repositorio de productos | ✅ | API async, `unit_price_cents` |
| Registro de venta (`saleRepository`) | ✅ | Venta + líneas + evento `sale_created` en una transacción |
| Generación de UUID | ✅ | `expo-crypto` |
| Store de sesión (Zustand) | 🟡 | Carrito y `isOnline`; sin conexión real a la red (TD-016) |
| Monitor de red | ⬜ | SPEC-006 |
| Pantallas de venta / inventario / dashboard | ⬜ | SPEC-007, SPEC-009 |
| Sync worker | ⬜ | SPEC-008 |
| Recibo QR | ⬜ | SPEC-010 |
| Tests automatizados | ⬜ | TD-013 |

## pos-backend

| Módulo | Estado | Notas |
|---|---|---|
| Express 5 + TS (ESM) | 🟡 | Sin scripts `dev`/`build`/`start` (TD-011); se cae si Postgres corta una conexión (TD-020) |
| Postgres 16 en Docker | ✅ | `compose.yaml` en la raíz (contenedor `pos-de-db`, puerto 5434, BD `posde`); migraciones y semilla automáticas al crear el volumen |
| Esquema (`db/migrations/`) | ✅ | `products`, `devices`, `sales`, `sale_items`, `stock_leases`. Falta runner para BD existentes (TD-014) |
| `GET /catalogo` | ✅ | Devuelve `unit_price_cents` |
| `POST /prestamos/request` | 🟡 | Calcula con promedio móvil, **no congela ni persiste** (TD-007, TD-008) |
| `POST /sync/events` | 🟡 | Recibe `sale_created`, idempotente, transacción por evento, 400 si la forma es inválida. Faltan lotes y descontar stock (TD-009) |
| `rollingAverage` | 🟡 | Usa `sale_items` + `sales`; ventana 5 min, lease 3 min, margen 1.2, mínimo 5 |
| Tests automatizados | ⬜ | TD-013 |

## Specs

| Spec | Estado |
|---|---|
| SPEC-001 Modelo de datos unificado | 🏁 Done (2026-10-30) |
| SPEC-002 … SPEC-010 | ⬜ Sin redactar (ver `specs/README.md`) |

## Decisiones pendientes del usuario

1. ¿La tasa de consumo para el lease es por dispositivo (como dice el planteamiento) o global por producto (como está hoy)? → SPEC-005.
