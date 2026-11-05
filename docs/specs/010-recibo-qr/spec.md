# SPEC-010 — Recibos QR offline

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 3 — Valor agregado |
| Repos | app |
| Depende de | SPEC-007 |
| Creada | 2026-11-05 |
| Actualizada | 2026-11-05 |

## 1. Contexto y problema
Tras cobrar, la app muestra una confirmación con total, método de pago y un identificador corto (SPEC-007 RF-10), pero el cliente se va sin nada. `PRODUCT.md` pide que el **cliente final reciba un comprobante aunque no haya red**: no hay impresora, y sin red no se puede mandar un correo ni un enlace.

La idea es que el recibo completo viaje dentro de un código QR que la app dibuja en pantalla: el cliente lo escanea con la cámara de su teléfono y lo lee ahí mismo, sin que ninguno de los dos teléfonos tenga red.

El riesgo conocido es R-03 (`TECH_DEBT.md`): un QR tiene capacidad limitada y un carrito grande no cabe. Esta spec define qué lleva el recibo y qué pasa cuando no entra.

## 2. Objetivo
Que, después de cada cobro y con o sin red, el vendedor pueda mostrar un QR que el cliente escanee con la cámara de su teléfono y vea el recibo de su compra como texto legible, sin instalar nada.

## 3. Historias de usuario
- Como **cliente final**, quiero escanear un QR con la cámara de mi teléfono y ver qué compré, cuánto pagué y cuándo, para tener un comprobante aunque no haya red.
- Como **vendedor**, quiero mostrar ese QR con un toque desde la confirmación del cobro, para no hacer esperar a la fila.
- Como **vendedor**, quiero que el QR se lea a la primera aunque el carrito sea grande, para no tener que repetir.
- Como **supervisor**, quiero que el recibo lleve el identificador completo de la venta, para encontrarla después en el servidor si hay un reclamo.

## 4. Requisitos funcionales

### Contenido del recibo
- **RF-1** El recibo se arma solo con datos guardados en el teléfono (venta, líneas, catálogo local, sesión y dispositivo). No usa la red.
- **RF-2** El recibo incluye, en este orden:
  1. Encabezado con el nombre del punto de venta (ver P3).
  2. Fecha y hora local del cobro.
  3. Identificador completo de la venta y su identificador corto (el mismo de la confirmación).
  4. Nombre del vendedor de la sesión.
  5. Una línea por producto: cantidad, nombre y subtotal.
  6. Total y método de pago.
- **RF-3** Los montos usan el mismo formato de dinero que el resto de la app y salen de los centavos guardados en la venta, nunca de un recálculo con el precio actual del catálogo.
- **RF-4** El recibo es texto plano legible: al escanearlo, la cámara del cliente lo muestra tal cual, sin pasar por una app, una página o una descompresión (ver P1).

### Tamaño
- **RF-5** El recibo nunca supera un tamaño máximo que garantice que el QR se lee desde la pantalla de un teléfono (ver P2).
- **RF-6** Si no caben todas las líneas, el recibo muestra las primeras que caben y cierra con una línea "… y N productos más" con la suma de sus subtotales. El total sigue siendo el de la venta completa (ver P2).
- **RF-7** Los nombres de producto largos se recortan a un largo fijo para que una línea no ocupe el espacio de varias.

### Mostrar el QR
- **RF-8** La confirmación del cobro tiene un botón "Recibo QR" que muestra el QR en grande, sobre fondo blanco y con margen, junto con el total y el identificador corto para que el vendedor confirme que es la venta correcta.
- **RF-9** El QR se genera en el teléfono, sin red, en menos de lo que tarda el vendedor en girar la pantalla hacia el cliente (ver RNF-1).
- **RF-10** Cerrar el QR vuelve a la confirmación; empezar la siguiente venta lo descarta igual que hoy.
- **RF-11** Generar o mostrar el recibo no modifica la venta, sus líneas ni la bitácora (`CONSTITUTION.md` principio 3).

## 5. Requisitos no funcionales
- **RNF-1** Desde tocar "Recibo QR" hasta ver el código, menos de 500 ms sin red en el teléfono de prueba.
- **RNF-2** Un recibo del tamaño máximo se lee a la primera con la cámara nativa de Android y de iOS, a unos 30 cm, desde la pantalla del vendedor con brillo normal.
- **RNF-3** Tildes, ñ y el signo de moneda se ven bien en los lectores de RNF-2 (ver P5).
- **RNF-4** El botón y la vista del QR tienen etiquetas accesibles y un área táctil de al menos 44 × 44 pt.
- **RNF-5** Pruebas automatizadas del armado del recibo: contenido y orden, formato de montos, recorte de nombres, corte por tamaño con "… y N productos más" y que nunca se pase del máximo. `tsc --noEmit` sin errores.

## 6. Criterios de aceptación
- **CA-1** Dada una venta de Agua × 2 y Papas × 1 cobrada en efectivo sin red, cuando toco "Recibo QR" y la escaneo con la cámara de otro teléfono también sin red, entonces veo el encabezado, fecha y hora, identificadores, vendedor, las dos líneas con sus subtotales, el total y "Efectivo".
- **CA-2** Dado ese mismo recibo, entonces su total y sus subtotales coinciden al centavo con lo guardado en la venta.
- **CA-3** Dada una venta con más líneas de las que caben, cuando muestro el QR, entonces se lee a la primera, muestra las primeras líneas, cierra con "… y N productos más" por el monto correcto y el total es el de la venta completa.
- **CA-4** Dado un producto con nombre muy largo, entonces su línea aparece recortada y el resto del recibo no cambia.
- **CA-5** Dado un producto con tildes o ñ en el nombre, cuando escaneo el QR en Android y en iOS, entonces el nombre se ve correcto.
- **CA-6** Cuando toco "Recibo QR", entonces el código aparece en menos de 500 ms y la bitácora no tiene eventos nuevos.
- **CA-7** Cuando cierro el QR, vuelvo a la confirmación; cuando empiezo la siguiente venta, la confirmación y el QR desaparecen.

## 7. Fuera de alcance
- Recibo fiscal o factura (`PRODUCT.md`).
- Firma o sello que pruebe que el recibo no fue alterado.
- Volver a mostrar el recibo de una venta anterior (historial de ventas).
- Imprimir, compartir como imagen, enviar por correo o mensaje, o un enlace a una página del recibo.
- Dividir un recibo grande en varios QR.
- Subir el brillo de la pantalla automáticamente al mostrar el QR.
- Mostrar el monto recibido y el cambio: no se guardan (SPEC-007 P2).
- Cambios en el backend.

## 8. Preguntas abiertas
- [x] **P1** Formato → texto plano compacto (RF-4), sin compresión: la cámara del cliente no descomprime. `GLOSSARY.md` pasa a "recibo completo en texto dentro de un código QR".
- [x] **P2** Tamaño máximo → 1 000 bytes (~25 líneas), confirmado con la prueba de RNF-2 en teléfono; si falla, se baja. Corte con "… y N productos más" (RF-6), sin varios QR.
- [x] **P3** Encabezado → "POS-DE" y el nombre del dispositivo de Ajustes (SPEC-003). Un nombre de tienda configurable queda para la spec de administración.
- [x] **P4** Recorte de nombres → 24 caracteres; si se recorta, el último es "…".
- [x] **P5** Codificación → UTF-8, verificada en CA-5. Si un lector falla con tildes o "$", se anota en `TECH_DEBT.md`; no se quitan las tildes.
- [x] **P6** Botón → solo en la confirmación del cobro (RF-8). Volver a mostrar un recibo viejo queda fuera de alcance.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-05 | Creación (Draft) | — |
| 2026-11-05 | Resueltas P1–P6 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-11-05 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-11-05 | tasks.md aprobado → In Progress | Usuario |
| 2026-11-05 | T1: `tsconfig` con `allowImportingTsExtensions` para que `receipt.ts` importe `formatCents` y `PAYMENT_METHODS` con `.ts` y node lo pruebe sin bundler | Implementación |
| 2026-11-05 | CA-1..CA-7 verificados en teléfono; el máximo de 1 000 bytes se mantiene → Done | Usuario |
