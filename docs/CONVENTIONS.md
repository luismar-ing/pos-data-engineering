# Convenciones

## Idioma
- Docs y mensajes de UI: español.
- Código (variables, funciones, tipos, tablas): inglés, usando los términos de `GLOSSARY.md`.
- ⚠️ Hoy hay mezcla (`/prestamos`, `catalogoRouter`, `insertado`, `ProximoEvento`). Las rutas públicas ya existentes se mantienen hasta que una spec las cambie; el código nuevo va en inglés.

## TypeScript
- `strict` siempre. Sin `any` salvo justificación en comentario.
- Funciones de dominio puras en `domain/` para poder probarlas sin BD ni red.
- Acceso a BD solo desde `data/` (app) o `services/` + `routes/` (backend).
- App: usar APIs **async** de expo-sqlite (`getAllAsync`, `runAsync`, `withTransactionAsync`), no las `*Sync`.

## SQL
- Tablas y columnas en `snake_case`, tablas en plural.
- IDs: UUID v4 en texto (app) / `uuid` (Postgres).
- Fechas: ISO-8601 UTC (`text` en SQLite, `timestamptz` en Postgres).
- Dinero: `numeric(10,2)` en Postgres; en la app guardar en **centavos enteros** para evitar errores de coma flotante (a confirmar en SPEC-001).

## Git (monorepo, ver ADR-0004)
- Un solo repo para `pos-app/`, `pos-backend/` y `docs/`.
- Rama principal: `main`. Trabajo en ramas `spec/NNN-slug` (p. ej. `spec/001-modelo-datos`), aunque la spec toque app y backend.
- Commits en español, imperativo, con referencia a la spec y, si aplica, el área: `SPEC-001(app): corrige sintaxis del esquema local`, `SPEC-001(backend): migración de ventas`.
- Un PR por spec (o por fase grande de una spec). La descripción enlaza la spec.
- Comandos `npm` siempre dentro de `pos-app/` o `pos-backend/`.

## Estructura de una funcionalidad (app)
```
features/<feature>/
  data/      # repositorios
  domain/    # reglas puras + tests
  ui/        # pantallas y componentes
```
