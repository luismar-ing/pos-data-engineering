# Índice de specs

Guía: [SPEC_GUIDE.md](SPEC_GUIDE.md) · Plantillas: [_template/](_template/)

| ID | Título | Fase | Repos | Depende de | Estado |
|---|---|---|---|---|---|
| [SPEC-001](001-modelo-datos/spec.md) | Modelo de datos unificado | 0 | app, backend | — | 🏁 Done |
| [SPEC-002](002-infra-backend/spec.md) | Infraestructura backend (scripts, migraciones, validación, errores, healthcheck, tests) | 0 | backend | — | 🏁 Done |
| [SPEC-003](003-identidad-dispositivo/spec.md) | Identidad de dispositivo y sesión | 1 | app, backend | 001, 002 | 🏁 Done |
| SPEC-004 | Catálogo: descarga y caché local | 1 | app, backend | 001, 002 | ⬜ Por redactar |
| SPEC-005 | Stock Leasing (cálculo, congelado, renovación, liberación) | 2 | backend, app | 001, 002, 003 | ⬜ Por redactar |
| SPEC-006 | Monitor de conectividad y modo offline | 2 | app | 001 | ⬜ Por redactar |
| SPEC-007 | Flujo de venta (carrito → cobro → registro local) | 1 | app | 001, 004 | ⬜ Por redactar |
| SPEC-008 | Bitácora + Batch Sync ETL idempotente | 2 | app, backend | 001, 003, 007 | ⬜ Por redactar |
| SPEC-009 | Edge Analytics (Burn Rate, Runout Time, top productos) | 3 | app | 007 | ⬜ Por redactar |
| SPEC-010 | Recibos QR offline | 3 | app | 007 | ⬜ Por redactar |

Estados: 📝 Draft · ✅ Approved · 🚧 In Progress · ⛔ Blocked · 🏁 Done · ❌ Rejected · ⬜ Por redactar

Orden sugerido: 001 → 002 → 003 → 004 → 007 → 006 → 005 → 008 → 009 → 010.
