# ADR-0004 — Unificar app y backend en un monorepo

- **Estado:** Aceptado
- **Fecha:** 2026-10-29
- **Complementa:** ADR-0001 (resuelve que la documentación no estaba bajo git)

## Contexto
App y backend vivían en dos repos (`POS-DE-app`, `pos-de-backend`). Las specs cambian a la vez el esquema local, el esquema central y los contratos HTTP, lo que obligaba a coordinar ramas y PRs en dos repos. La carpeta `docs/` no estaba versionada.

## Decisión
Un único repo en `POS_DE_APP/` con `pos-app/`, `pos-backend/` y `docs/`. El historial de ambos repos se conserva con `git subtree add` (sin squash). Sin npm workspaces por ahora: cada subproyecto mantiene su `package.json` y `node_modules`.

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| Mantener dos repos + docs en un tercero | Sin migración | Tres repos a coordinar por spec |
| **Monorepo sin workspaces** | Un PR por spec, docs versionadas, Expo sin configuración extra | Historial mezclado; CI necesitará filtros por carpeta |
| Monorepo con npm workspaces | Tipos compartidos desde ya | Requiere ajustar Metro/Expo; prematuro |

## Consecuencias
- Una rama y un PR por spec, aunque toque ambos lados.
- Los repos anteriores se archivan en GitHub como respaldo de solo lectura.
- Cuando haga falta compartir tipos (p. ej. el evento `sale_created`), evaluar workspaces en un ADR nuevo.
