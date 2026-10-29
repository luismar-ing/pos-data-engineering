# ADR-0002 — Stack tecnológico

- **Estado:** Aceptado (registro retroactivo de decisiones ya tomadas)
- **Fecha:** 2026-10-29

## Contexto
Se necesita una app móvil multiplataforma con BD relacional embebida y un backend con BD central transaccional.

## Decisión
- **App:** Expo SDK 57 + React Native + TypeScript estricto; `expo-sqlite` como BD embebida; Zustand para estado; React Navigation 7.
- **Backend:** Node + Express 5 + TypeScript (ESM); PostgreSQL 16 vía Docker en desarrollo; driver `pg` sin ORM.

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| Flutter + Drift | Rendimiento, SQLite tipado | Otro lenguaje (Dart) |
| WatermelonDB / Realm | Sync incorporado | Oculta el pipeline ETL que es parte del objetivo del proyecto |
| ORM (Prisma/Drizzle) en backend | Tipos y migraciones | Menos control sobre `on conflict` y bloqueos de fila para leases |

## Consecuencias
El SQL se escribe a mano en ambos lados: hace falta un sistema de migraciones propio (SPEC-001 / SPEC-002). Postgres permite `select … for update` y transacciones para congelar stock sin carreras.
