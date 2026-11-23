# SPEC-015 — Datos semilla y guion de demo

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 4 — Endurecimiento y demo |
| Repos | backend, docs |
| Depende de | SPEC-011, SPEC-013, SPEC-014 |
| Creada | 2026-11-22 |
| Actualizada | 2026-11-22 |

## 1. Contexto y problema
Las 14 specs están cerradas, pero el roadmap deja abierto el último punto de la fase 4: **datos semilla y guion de demo**. Hoy, preparar una presentación tiene tres problemas:

- **Catálogo pobre.** El seed de desarrollo tiene 5 productos. Un puesto de feria real tiene más, y con 5 el buscador, el top de productos y el panel de stock no lucen.
- **Estado sucio.** Tras días de pruebas la base tiene préstamos, ventas, teléfonos dados de baja, productos creados a mano y cambios del panel. `scenario:reset` limpia préstamos y ventas, pero no reactiva teléfonos, no oculta productos de prueba ni borra el registro de cambios.
- **Panel vacío al empezar.** El administrador entra y no ve nada hasta que alguien vende. La parte de ventas por teléfono y conciliación no se puede mostrar sin vender antes durante varios minutos.
- **Sin guion.** No hay un orden escrito de qué mostrar, qué se espera ver en cada paso ni qué hacer si algo falla.

## 2. Objetivo
Con un solo comando, dejar el backend listo para una demo con un catálogo de feria creíble y algo de historial. Con un guion escrito, mostrar en unos 12 minutos las tres piezas del producto (venta sin red sin sobreventa, sync idempotente y analítica local) y el panel de administración.

## 3. Historias de usuario
- Como **presentador**, quiero dejar el sistema en un estado conocido con un comando, para empezar cada demo o ensayo igual.
- Como **presentador**, quiero un guion paso a paso con lo que debe verse, para no improvisar y detectar enseguida si algo falló.
- Como **administrador** en la demo, quiero ver ventas y conciliación desde el primer minuto, para mostrar el panel sin esperar.

## 4. Requisitos funcionales

### Datos de demo
- **RF-1** Hay un catálogo de demo de unos 20 productos de feria en varias categorías, con precios y stock creíbles. Un producto tiene stock escaso para mostrar el bloqueo por cuota agotada (ver P1).
- **RF-2** Un comando deja el backend en el estado inicial de la demo:
  - sin préstamos, ventas, eventos recibidos, sesiones de vendedor ni registro de cambios del panel;
  - con todos los teléfonos registrados activos (los dados de baja vuelven a estar activos);
  - sin los teléfonos que no tuvieron contacto en las últimas 24 h (registros viejos de pruebas);
  - con el catálogo de demo activo y su stock como stock central e inicial;
  - con los productos que no son de la demo inactivos (no salen en el catálogo).
- **RF-3** Los teléfonos con contacto en las últimas 24 h y las cuentas de administrador se conservan: esos teléfonos no tienen que registrarse de nuevo y el administrador entra con su contraseña de siempre. Un teléfono borrado se registra solo al abrir la app.
- **RF-4** El comando agrega un historial corto de un teléfono de demo que ya vendió esa tarde: préstamos cerrados y ventas con su préstamo, para que el panel muestre ventas, stock y conciliación desde el inicio (ver P3).
- **RF-5** Tras el comando, el reporte de stock sale `ok` en todos los productos y la conciliación del teléfono de demo sale sin diferencias.

### Guion
- **RF-6** Hay un guion de demo escrito con:
  - preparación (lista de comprobación);
  - actos en orden, cada uno con pasos, lo que debe verse y qué pieza del producto demuestra;
  - un plan B por acto si algo falla;
  - una tabla de ensayos.
- **RF-7** El guion cubre: venta con red y recibo QR; corte de red con dos dispositivos y bloqueo sin sobreventa; reconexión y sync; Dashboard; panel de administración (ventas, stock que cuadra, conciliación, baja de un teléfono y alta de un producto).

## 5. Requisitos no funcionales
- **RNF-1** El comando se niega a correr si la base no es la de desarrollo o la de pruebas, igual que `scenario:reset`.
- **RNF-2** El comando tarda menos de 5 s y se puede correr varias veces seguidas con el mismo resultado.
- **RNF-3** Ninguna contraseña queda en el repositorio: el guion indica cómo fijarla por variable de entorno con el comando que ya existe.
- **RNF-4** La demo completa dura unos 12 minutos, sin contar la preparación.
- **RNF-5** `tsc --noEmit` sin errores y `npm test` en verde en el backend.

## 6. Criterios de aceptación
- **CA-1** (automatizado) Dada una base con préstamos, ventas, un teléfono dado de baja, un producto de prueba y cambios del panel, cuando corro el comando, entonces solo quedan los préstamos, ventas, eventos y la sesión cerrada del historial de demo, y no quedan préstamos activos ni cambios del panel; el teléfono está activo; un teléfono sin contacto en 24 h ya no está y puede registrarse de nuevo; el producto de prueba está inactivo; y el catálogo de demo está activo con su stock.
- **CA-2** (automatizado) Dado CA-1, el reporte de stock sale `ok` en todos los productos y la conciliación del teléfono de demo no tiene diferencias.
- **CA-3** (automatizado) Correr el comando dos veces deja el mismo estado que correrlo una vez.
- **CA-4** (automatizado) Con una base que no es la de desarrollo ni la de pruebas, el comando no hace nada y avisa.
- **CA-5** Dado el comando recién corrido, cuando abro la app en el emulador, entonces Inventario muestra el catálogo de demo y, como administrador, Ventas y Conciliar muestran el historial del teléfono de demo.
- **CA-6** El guion se ensaya completo en el emulador y queda una fila en su tabla de ensayos. El paso con el segundo dispositivo se ensaya con el procedimiento de SPEC-011 (ver P5).

## 7. Fuera de alcance
- Cambios en la app (pantallas, reglas de venta, préstamos o sync).
- Historial en el teléfono: el Dashboard muestra lo que se vende durante la demo, porque lee la base local del teléfono.
- Automatizar la demo con scripts que manejen los dispositivos.
- HTTPS para el panel (TD-032): la demo corre en la red local.
- Datos para pruebas de carga (eso ya lo cubren las pruebas de rendimiento de SPEC-009, SPEC-013 y SPEC-014).

## 8. Preguntas abiertas
- [x] **P1** Catálogo → 20 productos en 5 categorías (Bebidas, Comida, Snacks, Dulces, Recuerdos). Se conservan los 5 del seed actual con sus ids. "Hot dog" queda en 10 para mostrar el bloqueo, igual que en SPEC-011; el resto entre 40 y 300.
- [x] **P2** Comando → `npm run demo:reset` en el backend, nuevo. `scenario:reset` se queda como está porque lo usa el procedimiento de SPEC-011.
- [x] **P3** Historial → un teléfono "Caja 2 (demo)" con préstamos cerrados en 3 tandas en las últimas 2 h y 30 ventas con su préstamo, en efectivo, tarjeta y transferencia. El stock central baja lo vendido para que el reporte cuadre. No tiene secreto válido: no puede conectarse, solo aporta datos.
- [x] **P4** Administrador → el guion usa el comando existente (`ADMIN_PASSWORD=… npm run admin:set demo`). El comando de demo no toca cuentas.
- [x] **P5** Dispositivos → emulador `pos_pixel` + iPhone, como en SPEC-011. El ensayo de hoy cubre todo en el emulador; el acto de dos dispositivos se ensaya con el iPhone siguiendo `docs/testing/dos-dispositivos.md`.
- [x] **P6** Guion → `docs/demo/guion.md`.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-22 | Creación (Draft) | — |
| 2026-11-22 | Resueltas P1–P6 según propuesta; spec.md aprobada, plan.md y tasks.md en revisión | Usuario |
| 2026-11-22 | plan.md y tasks.md aprobados → In Progress | Usuario |
| 2026-11-22 | RF-2, RF-3: `demo:reset` también borra los teléfonos sin contacto en 24 h | Hallado en el ensayo (T5): 6 registros viejos llenaban "Por teléfono" |
| 2026-11-22 | Guion: paso para poner el emulador en la zona horaria local | Hallado en el ensayo: en UTC, "Hoy" mostraba 16 de 30 ventas |
| 2026-11-22 | Ensayo en el emulador: actos 1–5 ok, sin los pasos del iPhone. CA-1..CA-5 verificados; CA-6 con el emulador (el acto de dos dispositivos ya se corrió en SPEC-011) → Done | Usuario |
