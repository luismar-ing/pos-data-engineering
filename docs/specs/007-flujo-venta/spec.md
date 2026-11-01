# SPEC-007 — Flujo de venta (carrito → cobro → registro local)

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 1 — Venta online básica |
| Repos | app |
| Depende de | SPEC-001, SPEC-003, SPEC-004 |
| Creada | 2026-11-01 |
| Actualizada | 2026-11-01 |

## 1. Contexto y problema
La app ya registra ventas de forma atómica y offline (SPEC-001), exige sesión abierta (SPEC-003) y tiene el catálogo local (SPEC-004). Pero el vendedor todavía no puede vender:

- La pantalla Venta solo tiene un botón de desarrollo, "Venta de prueba", que vende el primer producto del catálogo (TD-023).
- El carrito del store duplica la línea en vez de sumar cantidad (TD-016) y ninguna pantalla lo usa.
- No se elige método de pago ni se confirma el cobro.

Es la última pieza de la fase 1: con ella se vende de punta a punta.

## 2. Objetivo
Que el vendedor arme un carrito con productos del catálogo local, elija el método de pago y cobre, con o sin red, y que la venta quede registrada localmente en un solo paso.

## 3. Historias de usuario
- Como **vendedor**, quiero tocar un producto para agregarlo al carrito y ajustar cantidades, para armar el pedido rápido.
- Como **vendedor**, quiero buscar un producto por nombre, para encontrarlo en un catálogo grande.
- Como **vendedor**, quiero ver el total antes de cobrar y elegir cómo paga el cliente, para no equivocarme.
- Como **vendedor**, quiero saber cuánto cambio dar cuando pagan en efectivo.
- Como **vendedor**, quiero que el cobro funcione sin red y tarde menos de 3 s, para no hacer esperar al cliente.

## 4. Requisitos funcionales

### Carrito
- **RF-1** Con sesión abierta, Venta muestra los productos activos del catálogo local (nombre y precio) y un buscador por nombre.
- **RF-2** Tocar un producto lo agrega al carrito con cantidad 1. Si ya está, suma 1 (cierra TD-016).
- **RF-3** En el carrito se puede subir y bajar la cantidad de cada línea y quitarla. Bajar de 1 quita la línea. La cantidad máxima por línea es 999.
- **RF-4** El carrito muestra cada línea (nombre, cantidad, subtotal) y el total, siempre en centavos enteros y con el precio vigente del catálogo local.
- **RF-5** Se puede vaciar el carrito con confirmación.

### Cobro
- **RF-6** Cobrar exige un carrito no vacío y un método de pago.
- **RF-7** Al cobrar, la venta se registra con la operación atómica existente (venta, líneas y evento `sale_created` en una transacción) y el carrito se vacía. Funciona sin red.
- **RF-8** Un cobro produce exactamente una venta, aunque el botón se toque varias veces seguidas.
- **RF-9** Si el cobro falla (sin sesión, producto dado de baja, error de BD), no se registra nada, el carrito se conserva y se informa el motivo.
- **RF-10** Tras cobrar, se muestra una confirmación con total, método de pago y un identificador corto de la venta, hasta que el vendedor empiece la siguiente.

### Limpieza
- **RF-11** Se quita el botón "Venta de prueba" (cierra TD-023).

## 5. Requisitos no funcionales
- **RNF-1** Desde tocar "Cobrar" hasta ver la confirmación, menos de 3 s sin red (métrica de `PRODUCT.md`).
- **RNF-2** La lista y el buscador siguen fluidos con 2 000 productos.
- **RNF-3** Los botones tienen etiquetas accesibles y un área táctil de al menos 44 × 44 pt.
- **RNF-4** Pruebas automatizadas de la lógica del carrito (agregar, sumar, bajar, quitar, máximo, total) y del cálculo del cambio. `tsc --noEmit` sin errores.

## 6. Criterios de aceptación
- **CA-1** Dada una sesión abierta y el catálogo descargado, cuando toco "Agua" dos veces y "Papas" una, entonces el carrito tiene Agua × 2 y Papas × 1 y el total es la suma correcta.
- **CA-2** Cuando bajo Papas de 1, entonces la línea desaparece y el total se actualiza.
- **CA-3** Cuando escribo "cer" en el buscador, entonces solo veo los productos cuyo nombre contiene "cer", sin distinguir mayúsculas ni acentos.
- **CA-4** Sin red, cuando cobro en efectivo, entonces aparece la confirmación en menos de 3 s, el carrito queda vacío y en la BD hay una venta con sus líneas y un evento `sale_created`.
- **CA-5** Cuando toco "Cobrar" varias veces rápido, entonces se registra una sola venta.
- **CA-6** Dado un pago en efectivo de $100.00 por un total de $67.00, cuando escribo el monto recibido, entonces veo un cambio de $33.00. Con un monto menor al total, no puedo cobrar.
- **CA-7** Dado un producto en el carrito que se dio de baja en una actualización del catálogo, cuando cobro, entonces el cobro se rechaza con un aviso, no se registra nada y el carrito se conserva.
- **CA-8** El botón "Venta de prueba" ya no existe.

## 7. Fuera de alcance
- Descontar de la cuota del lease y bloquear productos sin cuota (SPEC-005). Hasta entonces la app no limita cantidades por stock.
- Enviar la venta al servidor (SPEC-008).
- Recibo QR (SPEC-010) e historial de ventas (SPEC-009).
- Descuentos, impuestos, propinas, anular o devolver una venta.
- Pagos integrados con tarjeta: solo se registra el método (`PRODUCT.md`).
- Códigos de barras.

## 8. Preguntas abiertas
- [x] **P1** Métodos de pago → Efectivo, Tarjeta y Transferencia (`cash`, `card`, `transfer`).
- [x] **P2** Cambio → campo opcional "monto recibido" solo en Efectivo; muestra el cambio, bloquea si es menor al total, no se guarda.
- [x] **P3** Carrito → solo en memoria; se pierde al cerrar la app.
- [x] **P4** Precio → el vigente en el catálogo local al cobrar; producto dado de baja hace fallar el cobro.
- [x] **P5** Pantalla → productos arriba y carrito abajo en Venta; método de pago en un paso de confirmación.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-01 | Creación (Draft) | — |
| 2026-11-01 | Resueltas P1–P5 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-11-01 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-11-01 | tasks.md aprobado → In Progress | Usuario |
| 2026-11-01 | T6: el modal de cobro sube con el teclado y el teclado se cierra al tocar fuera; un fallo de red se muestra como "Sin conexión con el servidor" | Hallado en la prueba en teléfono |
| 2026-11-01 | CA-1..CA-8 verificados → Done | Usuario |
