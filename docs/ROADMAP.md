# Roadmap

Cada fase se cierra cuando todas sus specs están en **Done** (ver quality gates en `CONSTITUTION.md`).

## Fase 0 — Cimientos  ✅ cerrada
Objetivo: esquemas correctos y alineados, backend con tooling mínimo.
- SPEC-001 Modelo de datos unificado (app + backend)
- SPEC-002 Infraestructura backend (scripts, migraciones, validación, errores, healthcheck, tests)

## Fase 1 — Venta online básica  ✅ cerrada
Objetivo: vender con red de punta a punta.
- SPEC-003 Identidad de dispositivo y sesión
- SPEC-004 Catálogo: descarga y caché local
- SPEC-007 Flujo de venta (carrito → cobro → registro local)

## Fase 2 — Offline + Stock Leasing  ⭐ núcleo del proyecto · ✅ cerrada (prueba con 2 dispositivos en fase 4, TD-027)
Objetivo: vender sin red sin sobrevender.
- SPEC-005 Stock Leasing (cálculo, congelado, renovación, liberación)
- SPEC-006 Monitor de conectividad y modo offline
- SPEC-008 Bitácora + Batch Sync ETL idempotente

## Fase 3 — Valor agregado  ✅ cerrada
- SPEC-009 Edge Analytics (Burn Rate, Runout Time, top productos)
- SPEC-010 Recibos QR offline

## Fase 4 — Endurecimiento y demo  ✅ cerrada
- SPEC-011 Corte de red con dos dispositivos y reintentos de sync ✅
- SPEC-012 Rediseño visual "Señalética de feria" ✅
- SPEC-015 Datos semilla y guion de demo ✅ (`npm run demo:reset`, `docs/demo/guion.md`)
- Pruebas de corte de red con ≥ 2 dispositivos y de reintentos de sync: en SPEC-011.

## Fase 5 — Administración  ✅ cerrada
Objetivo: que el administrador vea y controle el evento desde la app, con login.
- SPEC-013 Panel de administración: rol, login, ventas y stock ✅
- SPEC-014 Panel de administración: dispositivos, conciliación y catálogo ✅ (tope sin red de 30 min, ADR-0008)

## Después
Todas las fases cerradas (2026-11-22). Pendientes fuera de fase en `TECH_DEBT.md`: pruebas con el iPhone (TD-031, TD-034) y HTTPS antes de usar el panel fuera de la red local (TD-032).
