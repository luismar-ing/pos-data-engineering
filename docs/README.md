# Documentación POS-DE

Sistema POS móvil offline-first con **Stock Leasing**, **Edge Analytics** y **Batch ETL**.

## Mapa de documentos

| Documento | Para qué sirve | Se actualiza |
|---|---|---|
| [PRODUCT.md](PRODUCT.md) | Visión, problema, alcance, casos de uso | Rara vez |
| [CONSTITUTION.md](CONSTITUTION.md) | Principios no negociables y quality gates | Rara vez (vía ADR) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Componentes, flujos, modelo de datos, contratos | Al cerrar cada spec |
| [GLOSSARY.md](GLOSSARY.md) | Vocabulario del dominio (ES ↔ código) | Cuando aparece un término |
| [CONVENTIONS.md](CONVENTIONS.md) | Estilo de código, ramas, commits, estructura | Rara vez |
| [ROADMAP.md](ROADMAP.md) | Fases e hitos | Al cerrar una fase |
| [PROGRESS.md](PROGRESS.md) | Estado actual por módulo y spec | **Cada sesión de trabajo** |
| [DEVLOG.md](DEVLOG.md) | Bitácora cronológica de sesiones | **Cada sesión de trabajo** |
| [TECH_DEBT.md](TECH_DEBT.md) | Bugs, deuda técnica y riesgos detectados | Cuando se detectan / resuelven |
| [specs/](specs/README.md) | Índice de specs + guía + plantillas | Por spec |
| [adr/](adr/README.md) | Registro de decisiones de arquitectura | Por decisión |

## Ciclo SDD en una línea

`Idea → spec.md (qué) → plan.md (cómo) → tasks.md (pasos) → código + pruebas → PROGRESS/DEVLOG/ADR`

Detalle completo en [specs/SPEC_GUIDE.md](specs/SPEC_GUIDE.md).
