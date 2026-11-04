# SPEC-009 — Edge Analytics (Burn Rate, Runout Time, top productos)

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 3 — Valor agregado |
| Repos | app |
| Depende de | SPEC-005, SPEC-007 |
| Creada | 2026-11-03 |
| Actualizada | 2026-11-04 |

## 1. Contexto y problema
El teléfono ya guarda cada venta y sabe cuánta cuota le queda de cada producto (SPEC-005, SPEC-007). Pero el vendedor no ve nada de eso junto:

- No sabe a qué ritmo está vendiendo, ni cuánto le falta para agotar un producto sin red.
- No sabe qué productos se mueven más ni cuánto lleva vendido en su turno.
- La pestaña Dashboard es un texto de relleno.

`PRODUCT.md` pide un panel local con **Burn Rate**, **Runout Time** y ranking de productos, calculado con consultas de agregación sobre la base del teléfono, que funcione sin red y no trabe la UI.

## 2. Objetivo
Que el vendedor vea en la pestaña Dashboard, con o sin red, cuánto vende por minuto, cuándo se le acabará cada producto prestado y qué productos y cuánto dinero lleva en su sesión, sin que el panel haga más lenta la app.

## 3. Historias de usuario
- Como **vendedor**, quiero saber cuántas unidades por minuto estoy vendiendo, para anticipar la demanda.
- Como **vendedor** sin red, quiero saber en cuánto tiempo se me acaba cada producto prestado, para avisar o reorganizarme antes de quedarme sin stock.
- Como **vendedor**, quiero ver los productos más vendidos y el total de mi sesión, para cerrar el turno con claridad.
- Como **vendedor**, quiero que el panel se actualice solo después de cada cobro, sin que la app se trabe.

## 4. Requisitos funcionales

### Burn Rate
- **RF-1** Por producto: unidades vendidas por minuto en este teléfono durante la ventana reciente (ver P1).
- **RF-2** Total: unidades por minuto de todos los productos en la misma ventana.

### Runout Time
- **RF-3** Por producto con préstamo activo: tiempo estimado hasta agotar la cuota disponible, igual a disponible ÷ Burn Rate.
- **RF-4** Un producto sin ventas en la ventana no tiene estimación: no se muestra como infinito ni cero, sino como "sin ventas recientes" (ver P7 para cómo se lista). Con cuota 0 se muestra "Agotado".
- **RF-5** Los productos cuyo Runout Time es menor que un umbral se resaltan (ver P5).
- **RF-6** La lista de Runout Time se ordena del que se agota antes al que se agota después.

### Ranking y totales
- **RF-7** Top de productos de la sesión actual por unidades vendidas, con unidades e ingreso de cada uno (ver P2, P4).
- **RF-8** Totales de la sesión: número de ventas, unidades, ingreso y ticket promedio (ver P6).
- **RF-9** Sin sesión abierta, el panel muestra los datos de la última sesión cerrada, indicándolo. Sin ninguna sesión, un mensaje vacío.

### Actualización
- **RF-10** El panel se recalcula al abrir la pestaña, después de cada cobro, cuando cambian los préstamos y de forma periódica mientras está visible (ver P3).
- **RF-11** Todo se calcula con los datos del teléfono; funciona igual sin red.

## 5. Requisitos no funcionales
- **RNF-1** Las consultas son asíncronas y no corren en el render (constitución, principio 5). Cambiar de pestaña o cobrar mientras el panel se recalcula no se traba.
- **RNF-2** Con 2 000 productos y 10 000 ventas locales, recalcular el panel completo tarda menos de 200 ms en el teléfono.
- **RNF-3** Montos en centavos enteros, mostrados con el formato de dinero existente.
- **RNF-4** Textos y cifras legibles por lectores de pantalla.
- **RNF-5** Pruebas automatizadas de las fórmulas (Burn Rate, Runout Time, ticket promedio) y de las consultas de agregación. `tsc --noEmit` sin errores.

## 6. Criterios de aceptación
- **CA-1** Dadas 10 unidades de Agua vendidas en este teléfono desde una primera venta hace 10 min, entonces el Burn Rate de Agua es 1,0 u/min. Dadas 4 unidades vendidas en menos de 1 min, entonces el Burn Rate es 4,0 u/min, aunque la sesión lleve horas abierta.
- **CA-2** Dado ese Burn Rate y 20 unidades disponibles de Agua, entonces su Runout Time es 20 min.
- **CA-3** Dado un producto con cuota pero sin ventas en la ventana, entonces no tiene Runout Time estimado y se cuenta como "sin ventas recientes".
- **CA-4** Dado un producto con Runout Time menor que el umbral, entonces aparece resaltado y primero en la lista.
- **CA-5** Dadas 3 ventas en la sesión (Agua × 2, Papas × 1; Agua × 1), entonces el top muestra Agua (3 u) y Papas (1 u), y los totales muestran 3 ventas, 4 unidades, el ingreso y el ticket promedio correctos.
- **CA-6** Sin red, cuando cobro con el panel abierto o vuelvo a él, entonces las cifras se actualizan.
- **CA-7** Con 2 000 productos y 10 000 ventas, cuando abro el panel, entonces se recalcula en menos de 200 ms (medido en el log) y la app sigue respondiendo.
- **CA-8** Sin sesión abierta, entonces el panel muestra los datos de la última sesión cerrada con su nombre y horario.

## 7. Fuera de alcance
- Analítica consolidada de todos los teléfonos en el servidor.
- Gráficos históricos, exportar reportes o elegir rangos de fechas.
- Notificaciones push o sonidos por Runout Time bajo.
- Pedir más préstamo desde el panel (el ciclo de SPEC-005 lo hace solo).
- Predicciones más allá del promedio de la ventana reciente.

## 8. Preguntas abiertas
- [x] **P1** ¿Qué ventana usa el Burn Rate? ~~Propuesta original: 10 min, contando desde la primera venta solo si la sesión empezó dentro de la ventana.~~ Decidido: las ventas de **este teléfono** (de cualquier sesión) en los últimos 10 min, divididas por el tiempo desde la primera de ellas, entre 1 y 10 min. Así un pico (p. ej. el medio tiempo en un estadio) se nota de inmediato y el ritmo no se pierde en un cambio de turno.
- [x] **P2** ¿De qué periodo son el top y los totales? Propuesta: de la sesión actual. Alternativa: del día.
- [x] **P3** ¿Cada cuánto se refresca mientras está visible? Propuesta: cada 15 s, además de al abrir, tras cobrar y al cambiar los préstamos.
- [x] **P4** ¿Cuántos productos en el top y por qué criterio? Propuesta: 5, por unidades, mostrando también el ingreso.
- [x] **P5** ¿Qué umbral resalta un Runout Time bajo? Propuesta: menos de 5 min, en ámbar. Coincide con el orden de magnitud del préstamo (3 min) y deja tiempo para reconectar.
- [x] **P6** ¿Qué totales se muestran? Propuesta: ventas, unidades, ingreso y ticket promedio (ingreso ÷ ventas). El desglose por método de pago queda fuera.
- [x] **P7** ¿El Runout Time lista todos los productos con préstamo o solo los que se venden? Propuesta: solo los que tienen ventas en la ventana o cuota 0, para que con 2 000 productos la lista no se llene de "sin ventas recientes". Un contador indica cuántos productos con préstamo no tienen ventas.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-03 | Creación (Draft) | — |
| 2026-11-03 | Resueltas P1–P7 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-11-03 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-11-03 | tasks.md aprobado → In Progress | Usuario |
| 2026-11-04 | P1 y CA-1: el ritmo cuenta siempre desde la primera venta del teléfono en la ventana (entre 1 y 10 min), no solo con sesión nueva | Hallado en T5: 4 u en menos de 1 min daban 0,4 u/min y avisaban tarde en un pico. Decisión del usuario |
| 2026-11-04 | CA-1..CA-8 verificados (CA-7: < 200 ms con 2 000 productos y 10 000 ventas en la PC; en el teléfono, con sus datos) → Done | Usuario |
