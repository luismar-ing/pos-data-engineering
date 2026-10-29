# ADR-0003 — Stock Leasing + bitácora append-only idempotente

- **Estado:** Aceptado (registro retroactivo del planteamiento)
- **Fecha:** 2026-10-29
- **Specs relacionadas:** SPEC-005, SPEC-008

## Contexto
Varios dispositivos venden el mismo inventario y pueden perder la red. Hay que impedir sobreventas sin dejar de vender offline, y sincronizar después sin duplicar ni perder ventas.

## Decisión
1. El servidor reparte el stock en **leases** por dispositivo y producto, calculados con un promedio móvil de consumo. El stock arrendado se resta del stock central (congelado) hasta que el lease se consume o se libera.
2. Offline, el dispositivo solo vende contra su lease.
3. Cada venta genera un evento inmutable con UUID en una bitácora local append-only. La sincronización envía lotes y el servidor inserta con `on conflict (event_id) do nothing`.

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| Bloquear ventas sin red | Simple, consistente | Inaceptable para el caso de uso |
| Vender libremente y reconciliar | Nunca bloquea | Sobreventas garantizadas |
| CRDTs / sync automático | Consistencia eventual elegante | No impide sobreventa de un recurso escaso |
| **Leases + eventos idempotentes** | Sin sobreventa, offline real | Stock arrendado y no vendido queda inmovilizado temporalmente |

## Consecuencias
Hace falta definir expiración y liberación de leases (riesgo R-01 en `TECH_DEBT.md`), y que el tamaño del lease equilibre disponibilidad offline vs. stock inmovilizado.
