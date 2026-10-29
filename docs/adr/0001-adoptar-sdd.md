# ADR-0001 — Adoptar Spec-Driven Development

- **Estado:** Aceptado
- **Fecha:** 2026-10-29

## Contexto
El proyecto tiene dos repos (app y backend) que deben mantener un modelo de datos y contratos coherentes. Hasta ahora se avanzó sin specs y ya aparecieron desalineaciones (modelo de venta, leases) y bugs de esquema.

## Decisión
Toda funcionalidad se define en una spec (`spec.md` → `plan.md` → `tasks.md`) antes de implementarse. La documentación vive en `POS_DE_APP/docs/`, común a ambos repos.

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| Seguir sin specs | Más rápido al inicio | Más retrabajo y desalineación entre repos |
| Docs dentro de cada repo | Versionado con el código | Las specs cruzan ambos repos; duplicación |
| **Docs centralizadas en la raíz** | Una sola fuente de verdad | La raíz aún no está bajo git (decisión pendiente) |

## Consecuencias
Cada sesión de trabajo actualiza `PROGRESS.md` y `DEVLOG.md`. Más tiempo de redacción al inicio de cada funcionalidad, menos retrabajo después.
