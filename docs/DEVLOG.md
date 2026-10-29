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
