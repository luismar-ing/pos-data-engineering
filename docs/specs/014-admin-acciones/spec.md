# SPEC-014 — Panel de administración: dispositivos, conciliación y catálogo

| Campo | Valor |
|---|---|
| Estado | Draft (sin preguntas abiertas; falta plan.md y tasks.md) |
| Fase | 5 — Administración |
| Repos | app, backend |
| Depende de | SPEC-013, SPEC-004, SPEC-005, SPEC-007, SPEC-008 |
| Creada | 2026-11-12 |
| Actualizada | 2026-11-12 |

## 1. Contexto y problema
SPEC-013 deja un panel de administración con login y vistas de solo lectura (ventas y stock). Quedan tres problemas que hoy se resuelven a mano en el servidor:

- **Teléfono perdido.** La cuota de un teléfono perdido o desinstalado queda congelada para siempre: el servidor solo la devuelve cuando el teléfono cierra su préstamo (TD-025).
- **Conciliación.** No se compara lo que cada teléfono informó al cerrar un préstamo con las ventas que llegaron por sync, porque las líneas de venta no dicen de qué préstamo salieron (TD-028).
- **Catálogo.** Dar de alta productos, cambiar precios o cargar stock central solo se hace con la semilla o con SQL.

## 2. Objetivo
Que el administrador, desde el panel de SPEC-013, pueda dar de baja y reactivar dispositivos sin arriesgar sobreventas, ver qué préstamos no cuadran con las ventas sincronizadas, y administrar productos, precios y stock central.

## 3. Historias de usuario
- Como **administrador**, quiero ver los dispositivos y sus préstamos, para saber quién tiene stock.
- Como **administrador**, quiero dar de baja un teléfono perdido, para que su stock vuelva a venderse sin provocar sobreventas.
- Como **administrador**, quiero ver qué préstamos no coinciden con las ventas sincronizadas, para encontrar ventas perdidas o mal informadas.
- Como **administrador**, quiero crear productos, cambiar precios y cargar stock central desde el teléfono, para no depender de la PC durante el evento.

## 4. Requisitos funcionales

### Dispositivos
- **RF-1** El panel lista los dispositivos registrados con: estado (activo o dado de baja), último contacto con el servidor, última sincronización, sesión de vendedor abierta (si hay) y préstamos activos con su cuota.

### Baja y reactivación
- **RF-2** El administrador puede **dar de baja** un dispositivo, con confirmación explícita. Desde ese momento el dispositivo **no recibe préstamos nuevos**.
- **RF-3** Los préstamos activos del dispositivo dado de baja **no se devuelven al instante**: siguen contando como prestados hasta que pasa su **tope sin red** (RF-4) **más 2 minutos de margen**. Así, si el teléfono "perdido" sigue vendiendo sin red, deja de hacerlo por su cuenta antes de que ese stock pueda prestarse a otro.
- **RF-4** **Tope sin red (cambia SPEC-005 P3).** En todos los teléfonos, un préstamo que pasó su plazo y además lleva **30 minutos** vencido sin poder cerrarse deja de vender ese producto, como si estuviera agotado, hasta que vuelva la red y se renueve. El teléfono mide ese tiempo desde que recibió el préstamo, igual que hoy calcula cuándo renovarlo, para que un reloj desfasado no lo mueva. Hoy un préstamo vencido sigue vendiendo sin límite de tiempo.
- **RF-5** Pasado el plazo de RF-3, el servidor cierra esos préstamos y devuelve al stock central la cuota que no tiene ventas sincronizadas. Si antes el teléfono vuelve y cierra sus préstamos de forma normal, vale ese cierre.
- **RF-6** Las ventas de un dispositivo dado de baja que lleguen por sync **se siguen aceptando** (los eventos son inmutables). Las que corresponden a un préstamo que el servidor cerró por la baja se marcan en la conciliación como **posteriores a la baja**, con las unidades que se devolvieron de más al stock central.
- **RF-7** Un dispositivo dado de baja puede **reactivarse** desde el panel; vuelve a pedir préstamos con normalidad.

### Préstamo de cada venta
- **RF-8** Cada línea de venta indica **de qué préstamo salió**. El teléfono lo registra al cobrar, junto con el descuento de la cuota, y viaja en el evento de venta a la sync.
- **RF-9** El servidor sigue aceptando eventos de venta anteriores a este cambio, sin préstamo en sus líneas. En la conciliación esas líneas aparecen como **sin préstamo asignado**.

### Conciliación
- **RF-10** El panel lista los préstamos cerrados en un rango de tiempo (por defecto el día actual) y compara, para cada uno, las unidades **informadas** al cerrar con las unidades de las **ventas sincronizadas** de ese préstamo.
- **RF-11** Cada préstamo queda como **cuadra**, **faltan ventas** (se informó más de lo sincronizado) o **sobran ventas** (llegaron más ventas que lo informado). Arriba se muestran primero los que no cuadran.
- **RF-12** La conciliación muestra aparte las ventas posteriores a una baja (RF-6) y las líneas sin préstamo asignado (RF-9).

### Catálogo
- **RF-13** El administrador puede **crear** un producto con nombre, precio y stock central inicial.
- **RF-14** El administrador puede **editar** el nombre y el precio de un producto. Las ventas ya hechas conservan su precio (SPEC-007); los teléfonos toman el precio nuevo en la siguiente descarga del catálogo (SPEC-004).
- **RF-15** El administrador puede **ajustar el stock central** (sumar o restar unidades), también con préstamos activos del producto. El ajuste solo cambia el stock central: nunca lo deja por debajo de 0 y nunca toca lo prestado.
- **RF-16** El administrador puede **desactivar** y **reactivar** un producto. Un producto desactivado sale del catálogo de los teléfonos en la siguiente descarga (SPEC-004) y no recibe préstamos nuevos.
- **RF-17** Los ajustes de stock central de RF-13 y RF-15 se tienen en cuenta en el "stock inicial" del reporte de stock (SPEC-011 y SPEC-013), para que el stock siga cuadrando.

### Registro de cambios
- **RF-18** Cada baja o reactivación de dispositivo y cada cambio de catálogo o de stock queda registrado en el servidor con el administrador que lo hizo, la hora, el valor anterior y el nuevo. El panel muestra ese registro.

## 5. Requisitos no funcionales
- **RNF-1 Nunca sobrevender.** Ninguna acción del panel puede dejar que lo prestado supere lo que había (CONSTITUTION, principio 1). La baja respeta RF-3 y RF-4, y el ajuste de stock respeta RF-15.
- **RNF-2 Idempotencia.** Repetir una baja, una reactivación o un mismo ajuste por un reintento de red no aplica el cambio dos veces.
- **RNF-3 Concurrencia.** Un ajuste de stock central y un pedido de préstamo simultáneos del mismo producto no pueden dejar el stock central negativo.
- **RNF-4 Compatibilidad del evento.** Agregar el préstamo a las líneas de venta (RF-8) no rompe la sync de teléfonos con eventos ya guardados en su bitácora (CONSTITUTION, principios 3 y 4).
- **RNF-5 Offline-first del vendedor.** Nada de esta spec puede bloquear ni retrasar una venta, salvo el tope sin red de RF-4. Ese tope limita el principio 2 de la CONSTITUTION a favor del principio 1 (nunca sobrevender), así que el plan debe empezar con un ADR que lo registre y que reemplace la decisión de SPEC-005 P3.
- **RNF-6 Rendimiento.** Cada vista del panel carga en menos de 2 s con 10 dispositivos, 2 000 productos y 10 000 ventas en el servidor.

## 6. Criterios de aceptación
- **CA-1** Dado un teléfono con préstamo activo de 10 unidades, cuando lo doy de baja, entonces no recibe préstamos nuevos y las 10 unidades siguen como prestadas hasta que pasan el plazo del préstamo, los 30 minutos del tope sin red y 2 minutos de margen.
- **CA-2** Dado ese mismo teléfono sin ventas sincronizadas, cuando pasa el plazo de CA-1, entonces el servidor cierra el préstamo y el stock central sube 10.
- **CA-3** Dado un teléfono dado de baja que vendió 3 unidades sin red antes de llegar al tope sin red, cuando esas ventas llegan por sync después del cierre, entonces el servidor las acepta y la conciliación las muestra como posteriores a la baja, con 3 unidades devueltas de más.
- **CA-3b** Dado un teléfono sin red con un préstamo vencido hace 30 minutos, cuando intento vender ese producto, entonces la app lo muestra agotado y no deja cobrarlo; al volver la red y renovarse el préstamo, vuelve a venderse.
- **CA-4** Dado un teléfono dado de baja que vuelve antes del plazo y cierra su préstamo informando 4 vendidas, cuando se procesa el cierre, entonces vale ese cierre y vuelven 6 al stock central.
- **CA-5** Dado un dispositivo dado de baja, cuando lo reactivo, entonces vuelve a recibir préstamos.
- **CA-6** Dado un cobro nuevo, cuando la venta llega al servidor, entonces cada línea indica el préstamo del que salió.
- **CA-7** Dado un teléfono con eventos de venta guardados antes de este cambio, cuando sincroniza, entonces el servidor los acepta y aparecen como sin préstamo asignado.
- **CA-8** Dado un préstamo cerrado que informó 8 vendidas y del que solo llegaron 6 por sync, cuando abro Conciliación, entonces aparece como "faltan ventas".
- **CA-9** Dado que cambio el precio de un producto, cuando un teléfono actualiza el catálogo, entonces cobra el precio nuevo y las ventas anteriores conservan el viejo.
- **CA-10** Dado un producto con 3 unidades de stock central y 10 prestadas, cuando intento restar 5, entonces el panel lo rechaza y el stock central queda en 3; y cuando resto 3, queda en 0 y lo prestado sigue en 10.
- **CA-11** Dado que sumo 20 unidades de stock central a un producto, cuando abro Stock, entonces el producto sigue marcando "cuadra".
- **CA-12** Dado que doy de baja un dispositivo, cuando abro el registro de cambios, entonces veo la baja con mi usuario y la hora.

## 7. Fuera de alcance
- Borrar productos o dispositivos (solo se desactivan o dan de baja).
- Corregir ventas desde el panel o anularlas.
- Ajustar automáticamente el stock central por las ventas posteriores a una baja: el administrador lo hace a mano con RF-15.
- Cambiar los parámetros del préstamo (ventana, margen, mínimo) desde el panel.
- Todo lo que SPEC-013 deja fuera de alcance.

## 8. Preguntas abiertas
Ninguna. Respuestas del 2026-11-12 (venían de SPEC-013):
- [x] **P3 — Riesgo al dar de baja.** Primera respuesta: esperar a que venza el préstamo. Se corrigió porque, según SPEC-005 P3, un préstamo vencido sigue vendiendo sin red sin límite, así que esperar no bastaba. Respuesta final: tope sin red de 30 min en todos los teléfonos (RF-4) y la cuota vuelve tras ese tope más 2 min (RF-3, RF-5).
- [x] **P4 — Precisión de la conciliación.** Exacta por préstamo: cada línea de venta guarda de qué préstamo salió (RF-8, RF-9).
- [x] **P5 — Ajuste con préstamos activos.** Se permite; solo cambia el stock central y nunca baja de 0 (RF-15).

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-12 | Creación (Draft), separada de SPEC-013 | Respuesta P6: dividir el panel en dos specs |
| 2026-11-12 | P3 corregida: tope sin red de 30 min (RF-4) | El código de SPEC-005 no deja de vender préstamos vencidos sin red |
