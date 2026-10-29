# POS-DE — Instrucciones para agentes

Monorepo (un solo repo git en esta carpeta, ver `docs/adr/0004-monorepo.md`):

| Carpeta | Qué es |
|---|---|
| `pos-app/` | App móvil (Expo 57 + React Native + expo-sqlite + Zustand) |
| `pos-backend/` | API central (Node + Express 5 + PostgreSQL 16) |
| `docs/` | Documentación SDD (visión, arquitectura, specs, progreso) |

Cada subproyecto tiene su propio `package.json` y `node_modules`: ejecutar `npm` dentro de su carpeta, no en la raíz.

## Flujo de trabajo: Spec-Driven Development (SDD)

**No se escribe código de una funcionalidad sin una spec aprobada.** Orden obligatorio:

1. Leer `docs/CONSTITUTION.md` (principios no negociables).
2. Ubicar la spec en `docs/specs/README.md`. Si no existe, crearla desde `docs/specs/_template/` siguiendo `docs/specs/SPEC_GUIDE.md`.
3. `spec.md` (qué y por qué) → `plan.md` (cómo) → `tasks.md` (pasos). Cada fase la aprueba el usuario antes de pasar a la siguiente.
4. Implementar tarea por tarea, marcando `tasks.md`.
5. Al cerrar: actualizar `docs/PROGRESS.md`, añadir entrada en `docs/DEVLOG.md`, mover hallazgos a `docs/TECH_DEBT.md`, y crear un ADR en `docs/adr/` si se tomó una decisión de arquitectura.

## Reglas rápidas

- Antes de tocar la app, leer la doc versionada de Expo v57 (ver `pos-app/AGENTS.md`).
- Los términos del dominio están en `docs/GLOSSARY.md`; úsalos tal cual en código y docs.
- Convenciones de código, ramas y commits: `docs/CONVENTIONS.md`.
- Nunca commitear `.env`.
