# Bitácora de desarrollo

Una entrada por sesión de trabajo, la más reciente arriba. Formato:

```
## AAAA-MM-DD — Título corto
**Spec:** SPEC-NNN (o "—")
**Hecho:** qué se completó
**Decisiones:** qué se decidió y por qué (enlazar ADR si aplica)
**Bloqueos / pendientes:** qué falta o qué impide avanzar
```

---

## 2026-10-30 — SPEC-001: modelo de datos unificado + Docker del proyecto
**Spec:** SPEC-001
**Hecho:** Aprobada con P1–P4 según recomendación. App: migraciones SQLite con `user_version`, montos en centavos, `createSale` atómico con evento `sale_created`, `expo-crypto` para UUID. Backend: migraciones `0001..0003` (`sales` + `sale_items` reemplazan `sale_events`), `/sync/events` con la venta completa e idempotente, `rollingAverage` sobre `sale_items`. Nuevo `compose.yaml` en la raíz (contenedor `pos-de-db`, puerto 5434, BD `posde`) que aplica migraciones y semilla al crearse; se retiró `pos-backend/docker-compose.yml`.
**Verificación:** CA-1..CA-4 y CA-6 con `node:sqlite` partiendo del esquema viejo roto; CA-5 con `curl` contra Postgres (2 envíos ⇒ 1 venta, 3 líneas, total 30). `tsc --noEmit` ok en ambos.
**Decisiones:** Commits sin trailer de coautoría de IA (CONVENTIONS). Docker propio del proyecto en lugar de migrar la BD vieja `posapp` (queda intacta en el contenedor `pos-backend-postgres-1`).
**Bloqueos / pendientes:** T11, abrir la app en emulador/dispositivo. Nuevo hallazgo TD-020: el backend se cae si Postgres corta una conexión.

## 2026-10-29 — Migración a monorepo
**Spec:** —
**Hecho:** App y backend unidos en un solo repo en `POS_DE_APP/` con `git subtree add`, conservando los 11 commits originales. Se commiteó antes el cambio pendiente de `pos-app/index.ts` (`be8a1c8`). `node_modules`, `.env` y `.expo` se trasladaron sin cambios; contenido verificado idéntico al original. Carpetas vacías de `pos-app/src` recreadas a mano (git no versiona carpetas vacías).
**Decisiones:** Monorepo sin npm workspaces (ADR-0004).
**Bloqueos / pendientes:** Crear el repo nuevo en GitHub, hacer push y archivar los dos repos anteriores. Borrar el respaldo `Aplicaciones_Moviles/_respaldo_repos_2026-10-29/` cuando se confirme que todo funciona.

## 2026-10-29 — Revisión de avances y adopción de SDD
**Spec:** —
**Hecho:** Revisión completa de `pos-app` y `pos-backend` contra el planteamiento. Creación de la estructura de documentación SDD (`docs/`), plantillas de spec y redacción de SPEC-001. Registro de 18 hallazgos en `TECH_DEBT.md`.
**Decisiones:** Adoptar Spec-Driven Development (ADR-0001). Documentación centralizada en la raíz `POS_DE_APP/docs/` porque las specs cruzan ambos repos.
**Bloqueos / pendientes:** Aprobar SPEC-001. Decidir dónde se versiona `docs/`.

## 2026-09-29 — Esquema local y optimización de leases
**Spec:** — (previo a SDD)
**Hecho:** Ajustes al esquema SQLite (`f1327f4`). Optimización de `calculateLeaseQty`: corta antes si no hay stock y limita el lease al stock restante (`1104806`).

## 2026-09-27 — Backend: Postgres y rutas
**Spec:** — (previo a SDD)
**Hecho:** Pool `pg`, rutas `/catalogo`, `/prestamos/request`, `/sync/events`, servicio de promedio móvil (`47ef567`).

## 2026-09-23 — Inicio del backend
**Spec:** — (previo a SDD)
**Hecho:** Repo `pos-de-backend`, Express + TS, `docker-compose` con Postgres 16, `schema.sql` inicial.

## 2026-09-18 — Esquema SQLite y conexión
**Spec:** — (previo a SDD)
**Hecho:** `database.ts` y primer `schema.ts`, repositorio de productos (`fc9b051`).

## 2026-09-12 — Estructura base de la app
**Spec:** — (previo a SDD)
**Hecho:** Dependencias (React Navigation, expo-sqlite, Zustand), tabs y store de sesión (`766095f`).
