# Índice de specs

Guía: [SPEC_GUIDE.md](SPEC_GUIDE.md) · Plantillas: [_template/](_template/)

| ID | Título | Fase | Repos | Depende de | Estado |
|---|---|---|---|---|---|
| [SPEC-001](001-modelo-datos/spec.md) | Modelo de datos unificado | 0 | app, backend | — | 🏁 Done |
| [SPEC-002](002-infra-backend/spec.md) | Infraestructura backend (scripts, migraciones, validación, errores, healthcheck, tests) | 0 | backend | — | 🏁 Done |
| [SPEC-003](003-identidad-dispositivo/spec.md) | Identidad de dispositivo y sesión | 1 | app, backend | 001, 002 | 🏁 Done |
| [SPEC-004](004-catalogo/spec.md) | Catálogo: descarga y caché local | 1 | app, backend | 001, 002 | 🏁 Done |
| [SPEC-005](005-stock-leasing/spec.md) | Stock Leasing (cálculo, congelado, renovación, liberación) | 2 | backend, app | 001, 002, 003, 006 | 🏁 Done |
| [SPEC-006](006-conectividad/spec.md) | Monitor de conectividad y modo offline | 2 | app | 001 | 🏁 Done |
| [SPEC-007](007-flujo-venta/spec.md) | Flujo de venta (carrito → cobro → registro local) | 1 | app | 001, 003, 004 | 🏁 Done |
| [SPEC-008](008-sync-etl/spec.md) | Bitácora + Batch Sync ETL idempotente | 2 | app, backend | 001, 003, 005, 006, 007 | 🏁 Done |
| SPEC-009 | Edge Analytics (Burn Rate, Runout Time, top productos) | 3 | app | 007 | ⬜ Por redactar |
| SPEC-010 | Recibos QR offline | 3 | app | 007 | ⬜ Por redactar |

Estados: 📝 Draft · ✅ Approved · 🚧 In Progress · ⛔ Blocked · 🏁 Done · ❌ Rejected · ⬜ Por redactar

Orden sugerido: 001 → 002 → 003 → 004 → 007 → 006 → 005 → 008 → 009 → 010.
