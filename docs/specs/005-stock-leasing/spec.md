# SPEC-005 — Stock Leasing (cálculo, congelado, renovación, liberación)

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 2 — Offline + Stock Leasing |
| Repos | backend, app |
| Depende de | SPEC-001, SPEC-002, SPEC-003, SPEC-006 |
| Creada | 2026-11-03 |
| Actualizada | 2026-11-03 |

## 1. Contexto y problema
Es el núcleo del proyecto (`PRODUCT.md`): vender sin red **sin sobrevender**. Hoy no se cumple:

- El servidor calcula cuánto prestar, pero **no congela** el stock ni guarda el préstamo. Dos teléfonos pueden recibir las mismas unidades (TD-007).
- La tasa de consumo es global por producto, no por dispositivo, y se lee el stock sin bloqueo, así que dos pedidos simultáneos pueden repartirse el mismo stock (TD-008).
- La app no pide préstamos, no descuenta cuota al cobrar y no bloquea nada: puede vender más de lo que existe.

Con SPEC-006 la app ya sabe cuándo hay conexión y cuándo vuelve. Falta la pieza que reparte el stock.

## 2. Objetivo
Que cada teléfono venda solo lo que el servidor le prestó y congeló, con o sin red. Que la cuota se ajuste sola al ritmo de venta de cada teléfono, y que lo no vendido vuelva al stock central.

## 3. Historias de usuario
- Como **vendedor**, quiero que la app tenga stock prestado antes de quedarme sin red, para seguir cobrando sin conexión.
- Como **vendedor**, quiero ver cuántas unidades me quedan de cada producto y que la app no me deje vender más, para no prometer lo que no hay.
- Como **vendedor** que vende mucho, quiero recibir más cuota que un compañero que vende poco, para no quedarme sin producto.
- Como **dueño**, quiero que nunca se venda más stock del que existe, aunque varios teléfonos pierdan la red a la vez.
- Como **dueño**, quiero que el stock que un teléfono no vendió vuelva al stock central, para que otro lo pueda vender.

## 4. Requisitos funcionales

### Emisión (servidor)
- **RF-1** Un dispositivo registrado puede pedir préstamo de stock para uno o varios productos.
- **RF-2** La cantidad prestada se calcula con la tasa de consumo **de ese dispositivo** para ese producto (decidido: por dispositivo, cierra TD-008 en ese punto):
  - tasa = unidades por minuto que vendió ese dispositivo en la ventana reciente (ver P2);
  - cuota = tasa × duración del préstamo × margen, con un mínimo para dispositivos sin historial (ver P7);
  - nunca más que el stock central disponible.
- **RF-3** Al emitir, el servidor **congela** la cuota: la resta del stock central y guarda el préstamo, en una sola operación atómica. Dos pedidos simultáneos nunca reciben las mismas unidades (cierra TD-007).
- **RF-4** Sin stock central para un producto, no se emite préstamo y la respuesta lo indica.
- **RF-5** Un dispositivo tiene como máximo un préstamo activo por producto.

### Uso (app)
- **RF-6** La app guarda localmente los préstamos recibidos: producto, cuota total, cuota usada y hasta cuándo puede vender con él.
- **RF-7** Todo cobro, con o sin red, descuenta de la cuota del préstamo de cada producto, en la misma operación atómica que registra la venta. Si alguna línea supera lo disponible, el cobro se rechaza, no se registra nada y el carrito se conserva.
- **RF-8** Venta e Inventario muestran las unidades disponibles de cada producto. Sin cuota, el producto aparece como agotado y no se puede agregar al carrito ni subir su cantidad por encima de lo disponible.
- **RF-9** La app pide préstamos al abrir una sesión con red y al reconectar (aviso de SPEC-006), para los productos que indique P1.

### Renovación
- **RF-10** Con red, la app renueva cada préstamo antes de que venza y cuando le queda poca cuota (ver P4). En la renovación informa cuánto vendió del préstamo anterior.
- **RF-11** Al renovar, el servidor cierra el préstamo anterior, devuelve al stock central lo no vendido y emite uno nuevo con la tasa actualizada, todo en una operación atómica.
- **RF-12** Repetir una renovación (reintento por red caída) no devuelve stock dos veces ni emite dos préstamos.

### Liberación y vencimiento
- **RF-13** Al cerrar la sesión con red, la app libera sus préstamos: el servidor devuelve lo no vendido al stock central (ver P5).
- **RF-14** Sin red, la app sigue vendiendo la cuota que le queda, sin límite de tiempo: esas unidades están congeladas para ella.
- **RF-15** El servidor devuelve al stock central la cuota no vendida de un préstamo **solo** cuando el dispositivo informa cuánto vendió (al renovar o liberar). Un préstamo sin informe queda congelado, aunque el dispositivo lleve mucho tiempo sin red. Así nunca se presta dos veces una unidad que un teléfono sin red pudo vender (R-01).

## 5. Requisitos no funcionales
- **RNF-1** 0 sobreventas en pruebas de corte de red con 2 o más dispositivos concurrentes (`PRODUCT.md`).
- **RNF-2** El cobro sin red sigue por debajo de 3 s; el descuento de cuota no agrega peticiones de red.
- **RNF-3** Pedir y renovar préstamos corre en segundo plano y nunca bloquea la UI ni el cobro.
- **RNF-4** La emisión soporta pedidos simultáneos de varios dispositivos sin repartir el mismo stock (prueba automatizada con pedidos concurrentes).
- **RNF-5** Pruebas automatizadas de: cálculo de cuota, congelado atómico, renovación idempotente, recuperación tras el plazo y descuento de cuota en la app. `tsc --noEmit` sin errores en ambos repos.
- **RNF-6** Contratos HTTP nuevos o cambiados documentados en `ARCHITECTURE.md` antes de implementarlos.

## 6. Criterios de aceptación
- **CA-1** Dado un producto con stock central 10 y dos dispositivos sin historial, cuando ambos piden préstamo a la vez, entonces la suma de sus cuotas es como máximo 10 y el stock central baja exactamente esa suma.
- **CA-2** Dado un dispositivo que vendió 10 unidades de un producto en la ventana y otro que vendió 0, cuando ambos renuevan, entonces el primero recibe más cuota que el segundo.
- **CA-3** Dado un préstamo de 5 unidades, sin red, cuando cobro 5, entonces el producto aparece agotado y no puedo agregar una sexta.
- **CA-4** Dado un carrito con 3 unidades y una cuota disponible de 2, cuando cobro, entonces el cobro se rechaza con un aviso, no se registra nada y el carrito se conserva.
- **CA-5** Dado un préstamo de 8 con 3 vendidas, cuando renuevo con red, entonces el stock central recupera 5 antes de restar la cuota nueva.
- **CA-6** Cuando la misma renovación se envía dos veces, entonces el stock central y los préstamos quedan igual que si se hubiera enviado una vez.
- **CA-7** Dado un préstamo con cuota libre, cuando cierro la sesión con red, entonces lo no vendido vuelve al stock central.
- **CA-8** Dado un préstamo de 8, cuando el dispositivo vende 5 sin red y pasa horas sin conexión, entonces el servidor sigue sin devolver esas 8 al stock central. Cuando el dispositivo vuelve y renueva, entonces el stock central recupera 3.
- **CA-9** Dados dos teléfonos con préstamos del mismo producto, cuando ambos pierden la red y venden todo lo que pueden, entonces el total vendido no supera el stock central inicial.
- **CA-10** Dado un producto sin stock central, cuando el dispositivo pide préstamo, entonces no recibe cuota y el producto aparece agotado.

## 7. Fuera de alcance
- Enviar las ventas al servidor y la bitácora por lotes (SPEC-008). El stock central se descuenta al prestar, no al sincronizar ventas.
- Conciliar en el servidor la cuota informada con las ventas sincronizadas (SPEC-008).
- Pantalla o API para cargar o ajustar el stock central: se usa la semilla de desarrollo.
- Panel de Burn Rate y Runout Time (SPEC-009).
- Préstamos entre dispositivos o reparto manual de stock.
- Reservas de stock para pedidos futuros.
- Liberar a mano la cuota congelada de un teléfono perdido o desinstalado.

## 8. Preguntas abiertas
- [x] **P1** ¿Para qué productos se pide préstamo? Propuesta: para todos los productos activos con stock, en un solo pedido, al abrir sesión y al reconectar. Pedirlos solo al agregarlos al carrito no sirve si la red ya cayó. Alternativa: solo los vendidos en los últimos N minutos más los que el vendedor marque.
- [x] **P2** ¿De dónde sale la tasa de cada dispositivo? Las ventas aún no llegan al servidor (eso es SPEC-008). Propuesta: de lo que el dispositivo informa como vendido en cada renovación, dividido por el tiempo que duró el préstamo medido con la hora del servidor. Así no depende de SPEC-008 ni del reloj del teléfono. Alternativa: de las ventas sincronizadas, que hoy no existen y daría siempre el mínimo.
- [x] **P3** ~~¿Cuánto tiempo puede seguir vendiendo sin red un préstamo vencido?~~ Reemplazada: sin límite de tiempo, y el servidor no devuelve nada sin informe del dispositivo (RF-14, RF-15). Liberar a mano la cuota de un teléfono perdido queda fuera de alcance.
- [x] **P4** ¿Cuándo se renueva? Propuesta: al vencer el préstamo (3 min, como hoy), cuando quede menos del 20 % de la cuota, y al reconectar.
- [x] **P5** ¿Se liberan los préstamos al cerrar la sesión? Propuesta: sí, con red. Sin red quedan hasta renovarse al volver.
- [x] **P6** ¿Se confía en la cantidad vendida que informa el dispositivo? Propuesta: sí, porque está autenticado (SPEC-003); se rechaza si informa más que la cuota total o menos que en un informe anterior.
- [x] **P7** ¿Se mantienen los parámetros actuales? Ventana 5 min, préstamo 3 min, margen 1.2 y mínimo 5 unidades. Propuesta: sí, como configuración del servidor.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-03 | Creación (Draft). Tasa de consumo por dispositivo | Decisión del usuario |
| 2026-11-03 | Resueltas P1–P7 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-11-03 | P3 reemplazada: sin plazo de 2 h; el servidor solo devuelve stock con informe del dispositivo. Cambian RF-14, RF-15 y CA-8; se quita RF-16 | Devolver la cuota completa a las 2 h 15 min podía sobrevender (principio 1). Decisión del usuario |
| 2026-11-03 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-11-03 | tasks.md aprobado → In Progress | Usuario |
| 2026-11-03 | `close` rechaza (`INVALID_QUOTA_USED`) un préstamo ya cerrado con otro valor | Implementación T3: un reintento distinto indicaría unidades perdidas |
| 2026-11-03 | CA-1..CA-8 y CA-10 verificados (CA-1, CA-2, CA-5, CA-6, CA-8, CA-10 también con pruebas automáticas). CA-9 sin prueba con dos dispositivos: se omite por decisión del usuario y queda en TD-027 → Done | Usuario |
