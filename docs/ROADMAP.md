# Roadmap

Cada fase se cierra cuando todas sus specs están en **Done** (ver quality gates en `CONSTITUTION.md`).

## Fase 0 — Cimientos  ⏳ en curso
Objetivo: esquemas correctos y alineados, backend con tooling mínimo.
- SPEC-001 Modelo de datos unificado (app + backend)
- SPEC-002 Infraestructura backend (scripts, migraciones, validación, errores, healthcheck, tests)

## Fase 1 — Venta online básica
Objetivo: vender con red de punta a punta.
- SPEC-003 Identidad de dispositivo y sesión
- SPEC-004 Catálogo: descarga y caché local
- SPEC-007 Flujo de venta (carrito → cobro → registro local)

## Fase 2 — Offline + Stock Leasing  ⭐ núcleo del proyecto
Objetivo: vender sin red sin sobrevender.
- SPEC-005 Stock Leasing (cálculo, congelado, renovación, liberación)
- SPEC-006 Monitor de conectividad y modo offline
- SPEC-008 Bitácora + Batch Sync ETL idempotente

## Fase 3 — Valor agregado
- SPEC-009 Edge Analytics (Burn Rate, Runout Time, top productos)
- SPEC-010 Recibos QR offline

## Fase 4 — Endurecimiento y demo
- Pruebas de corte de red con ≥ 2 dispositivos concurrentes.
- Pruebas de reintento de sync (duplicados, lotes parciales).
- Datos semilla y guion de demo.
