# ADR-0006 — Formato único de errores y runner de migraciones propio en el backend

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Spec relacionada:** SPEC-002

## Contexto
Cada ruta respondía errores a su manera (`{ error: "texto" }` o el 500 HTML de Express), y las migraciones solo se aplicaban al crear el volumen de Docker. SPEC-004, 005 y 008 añadirán rutas y migraciones; la app necesita decidir qué hacer ante un error (reintentar, descartar, avisar) sin leer textos.

## Decisión
1. Todo error HTTP responde `{ "error": { "code", "message", "details?" } }` con `code` estable en MAYÚSCULAS (`VALIDATION_ERROR`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `BAD_REQUEST`, `NOT_FOUND`, `DB_UNAVAILABLE`, `INTERNAL_ERROR`), producido por un único middleware (`src/http/errors.ts`). Las rutas validan la entrada con `zod` y lanzan; no construyen respuestas de error.
2. Las migraciones se aplican con `npm run db:migrate`: runner propio (`src/db/migrate.ts`) con tabla `schema_migrations` y una transacción por archivo. Docker solo crea las bases vacías (`posde`, `posde_test`).

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| `node-pg-migrate` / `knex` | Rollback, bloqueo, CLI hecha | Dependencia grande para 3 archivos SQL; otra sintaxis de migración |
| Docker aplica migraciones (como antes) | Cero código | No migra BD existentes; dos caminos distintos |
| Errores RFC 7807 (`application/problem+json`) | Estándar | Más campos de los que la app usa; ninguna librería cliente lo aprovecha aquí |
| Validación a mano | Sin dependencia | No es declarativa; crece mal con SPEC-008 |

## Consecuencias
- Nuevos códigos de error se añaden en `errors.ts` y se documentan en `ARCHITECTURE.md` §5.
- Una migración nueva = un archivo `db/migrations/NNNN_*.sql`; nunca se edita una ya aplicada.
- Sin rollback de esquema ni bloqueo entre ejecuciones concurrentes (atajo anotado en el código); revisar al haber despliegue.
- Volúmenes de Docker anteriores a SPEC-002: la primera ejecución registra 0001–0003 como aplicadas (línea base) y necesitan `createdb posde_test` una vez.
