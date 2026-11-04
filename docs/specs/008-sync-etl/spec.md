# SPEC-008 — Bitácora + Batch Sync ETL idempotente

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 2 — Offline + Stock Leasing |
| Repos | app, backend |
| Depende de | SPEC-001, SPEC-003, SPEC-005, SPEC-006, SPEC-007 |
| Creada | 2026-11-03 |
| Actualizada | 2026-11-03 |

## 1. Contexto y problema
Cada cobro y cada apertura o cierre de sesión se guarda como evento en la bitácora local (`event_log`), con estado `pending`. Pero **ningún evento sale del teléfono**:

- El servidor ya acepta ventas en `POST /sync/events` y no las duplica (SPEC-001), pero la app nunca lo llama.
- El servidor no recibe aperturas ni cierres de sesión.
- Faltan piezas en la recepción: lotes de verdad, validación completa y un resultado por evento (TD-009). Hoy un evento inválido rechaza el lote entero.
- El dueño no ve las ventas en el servidor, y no hay forma de comparar lo que cada teléfono dijo vender al cerrar sus préstamos con las ventas reales.

Es la última pieza de la fase 2. La meta de `PRODUCT.md` es 0 eventos duplicados o perdidos tras reintentos.

## 2. Objetivo
Que todo evento de la bitácora llegue al servidor una sola vez, en lotes, en cuanto haya red, sin bloquear el cobro y sin modificar nunca su contenido.

## 3. Historias de usuario
- Como **dueño**, quiero que las ventas de todos los teléfonos lleguen al servidor solas, para ver las ventas consolidadas.
- Como **dueño**, quiero que una venta nunca se cuente dos veces aunque el teléfono la reenvíe, para que los totales sean confiables.
- Como **vendedor**, quiero que el envío ocurra solo al volver la red, sin tocar nada y sin que el cobro se haga más lento.
- Como **vendedor**, quiero ver cuántas ventas faltan por enviar y forzar el envío, para saber si puedo apagar el teléfono.
- Como **desarrollador**, quiero que un evento defectuoso no frene a los demás y quede a la vista, para corregirlo sin perder datos.

## 4. Requisitos funcionales

### Extracción y envío (app)
- **RF-1** Con red, la app envía los eventos `pending` en orden de creación, en lotes de tamaño máximo fijo (ver P3).
- **RF-2** Se envían todos los tipos de evento de la bitácora: `sale_created`, `session_opened` y `session_closed` (ver P1).
- **RF-3** Cada lote lleva un identificador de lote y la hora de envío, además de los eventos tal como están guardados.
- **RF-4** El envío se dispara después de cada cobro, al reconectar (aviso de SPEC-006), de forma periódica mientras queden pendientes, y a mano desde Ajustes (ver P2, P7).
- **RF-5** Solo un envío a la vez. Si se dispara durante otro, se vuelve a ejecutar al terminar.

### Recepción (servidor)
- **RF-6** El servidor acepta un lote de eventos de un dispositivo autenticado y responde **un resultado por evento**: `inserted`, `duplicate` o `rejected` con el motivo.
- **RF-7** Un evento ya recibido (mismo id) responde `duplicate` y no cambia nada (idempotencia).
- **RF-8** Un evento inválido o de otro dispositivo responde `rejected` y no impide guardar los demás eventos del lote (cambia el comportamiento actual, que rechaza todo).
- **RF-9** Cada evento se guarda de forma atómica: una venta queda con todas sus líneas o no queda.
- **RF-10** El servidor guarda las aperturas y cierres de sesión (ver P1).
- **RF-11** Recibir ventas **no** vuelve a descontar stock: ya salió al prestarse (SPEC-005, TD-009).

### Carga y marcado (app)
- **RF-12** Los eventos con resultado `inserted` o `duplicate` pasan a `synced` con la hora de confirmación.
- **RF-13** Los eventos `rejected` pasan a `failed` con el motivo y no se reenvían solos (ver P4).
- **RF-14** Si el lote falla por red o por un error del servidor, sus eventos siguen `pending` y se reintentan en el siguiente disparo.
- **RF-15** El contenido de un evento nunca cambia; solo cambian sus datos de sincronización (constitución, principio 3).

### Visibilidad
- **RF-16** Ajustes muestra cuántos eventos están pendientes, cuántos fallaron y la hora del último envío correcto, con un botón "Sincronizar ahora".

## 5. Requisitos no funcionales
- **RNF-1** 0 eventos duplicados o perdidos tras reintentos (`PRODUCT.md`), probado con reenvíos del mismo lote y cortes a mitad de envío.
- **RNF-2** El envío corre en segundo plano y no hace más lento el cobro (sigue por debajo de 3 s sin red).
- **RNF-3** 500 eventos pendientes se envían en menos de 30 s con red local.
- **RNF-4** Un lote no supera el límite de tamaño del servidor.
- **RNF-5** Pruebas automatizadas de: resultado por evento, idempotencia, rechazo parcial, marcado local y orden de extracción. `tsc --noEmit` sin errores en ambos repos.
- **RNF-6** Contrato de `POST /sync/events` actualizado en `ARCHITECTURE.md` antes de implementarlo.

## 6. Criterios de aceptación
- **CA-1** Dadas 3 ventas hechas sin red, cuando vuelve la red, entonces en menos de 30 s las 3 están en el servidor y en el teléfono aparecen como `synced`.
- **CA-2** Cuando el mismo lote se envía dos veces, entonces el servidor tiene cada venta una sola vez y la segunda respuesta es `duplicate` para todos.
- **CA-3** Dado un lote con un evento inválido entre dos válidos, cuando se envía, entonces se guardan los dos válidos, el inválido queda `rejected` y en el teléfono pasa a `failed`.
- **CA-4** Dado un envío que se corta antes de recibir la respuesta, cuando se reintenta, entonces no hay ventas duplicadas ni perdidas.
- **CA-5** Dada una apertura y un cierre de sesión, cuando se sincronizan, entonces el servidor tiene la sesión con vendedor, hora de apertura y de cierre.
- **CA-6** Con red, cuando cobro, entonces la venta llega al servidor sin acción adicional y el cobro no tarda más que sin red.
- **CA-7** Ajustes muestra el número de pendientes y fallidos; "Sincronizar ahora" envía los pendientes.
- **CA-8** Cuando se sincroniza una venta, entonces `central_stock` no cambia.
- **CA-9** Con 500 eventos pendientes, cuando vuelve la red, entonces todos quedan `synced` en menos de 30 s.

## 7. Fuera de alcance
- Panel o API de consulta de ventas consolidadas para el dueño.
- Conciliar en el servidor lo informado al cerrar préstamos con las ventas recibidas (ver P6).
- Reintentar o corregir eventos `failed` desde la app.
- Borrar o archivar eventos ya sincronizados de la bitácora local.
- Sincronizar del servidor al teléfono (más allá del catálogo y los préstamos ya existentes).
- Compresión o cifrado extra del lote (ya viaja autenticado).

## 8. Preguntas abiertas
- [x] **P1** ¿Se envían las aperturas y cierres de sesión? Propuesta: sí, y el servidor las guarda en una tabla de sesiones (vendedor, apertura, cierre, dispositivo), para saber quién vendió qué. Alternativa: dejarlas solo en el teléfono y marcarlas como no sincronizables; quedarían fuera del ETL.
- [x] **P2** ¿Cada cuánto se reintenta? Propuesta: tras cada cobro, al reconectar y cada 30 s mientras haya pendientes (el mismo ritmo que los préstamos). Sin pendientes no se hace ninguna petición.
- [x] **P3** ¿Cuántos eventos por lote? Propuesta: 50. Una venta típica pesa menos de 2 kB, así que un lote cabe holgado en los 100 kB del servidor.
- [x] **P4** ¿Qué pasa con un evento `rejected`? Propuesta: queda `failed` con el motivo, no se reenvía solo y se cuenta en Ajustes. Reenviarlo siempre daría el mismo rechazo y gastaría red.
- [x] **P5** ¿Se sigue aceptando el formato actual de respuesta (`received`, `inserted`, `duplicated`)? Propuesta: no; la app aún no lo usa, así que se reemplaza por la lista de resultados por evento, con los totales como resumen.
- [x] **P6** ¿Se concilia lo vendido con lo informado al cerrar préstamos? Propuesta: no en esta spec. Las líneas de venta no dicen de qué préstamo salieron, y conciliar por dispositivo y producto pide reglas de ventanas de tiempo. Queda como deuda para una spec de administración.
- [x] **P7** ¿Qué muestra Ajustes? Propuesta: "Pendientes N · Fallidos N · Último envío HH:MM" y el botón "Sincronizar ahora", deshabilitado sin conexión.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-03 | Creación (Draft) | — |
| 2026-11-03 | Resueltas P1–P7 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-11-03 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-11-03 | tasks.md aprobado → In Progress | Usuario |
| 2026-11-03 | CA-1..CA-9 verificados (CA-9 en el servidor: 500 eventos en 4,0 s contra `posde_test`) → Done | Usuario |
