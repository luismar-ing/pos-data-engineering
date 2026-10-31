# SPEC-004 — Catálogo: descarga y caché local

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 1 — Datos y catálogo |
| Repos | app, backend |
| Depende de | SPEC-001, SPEC-002 |
| Creada | 2026-10-30 |
| Actualizada | 2026-10-30 |

## 1. Contexto y problema
Para cobrar, el vendedor elige productos y la venta guarda su precio. Hoy:

- El backend ya expone el catálogo (productos activos con nombre, categoría y precio), pero nadie lo llama y no tiene pruebas.
- La app tiene una tabla local de productos que solo se llena a mano: el botón de desarrollo "Venta de prueba" inserta un producto fijo (TD-023).
- La pestaña Inventario está vacía.
- Si un producto cambia de precio o se da de baja en el servidor, el teléfono no se entera.

El flujo de venta (SPEC-007) y los leases (SPEC-005) necesitan que el teléfono tenga el catálogo, también sin red.

## 2. Objetivo
Que la app descargue el catálogo del servidor cuando tenga red, lo guarde localmente y lo muestre en Inventario, de modo que esté disponible sin red y refleje los cambios de precio y las bajas en la siguiente descarga.

## 3. Historias de usuario
- Como **vendedor**, quiero ver los productos y sus precios aunque no haya red, para poder atender.
- Como **vendedor**, quiero actualizar el catálogo cuando quiera, para tener los precios del día.
- Como **vendedor**, quiero saber cuándo se actualizó el catálogo por última vez, para saber si puedo confiar en los precios.
- Como **supervisor**, quiero que un producto dado de baja deje de ofrecerse en los teléfonos, para que nadie lo venda.

## 4. Requisitos funcionales
- **RF-1** La app descarga el catálogo del servidor al abrirse, si hay red, sin bloquear la UI ni el arranque. Si falla, sigue con el catálogo guardado.
- **RF-2** Inventario tiene una acción para actualizar el catálogo a mano, que indica si está en curso y si falló.
- **RF-3** La descarga reemplaza el catálogo local de forma atómica: o se aplica completa o no cambia nada. Un catálogo a medias nunca queda guardado.
- **RF-4** Los productos nuevos se agregan y los existentes actualizan nombre, categoría y precio.
- **RF-5** Un producto que ya no viene en el catálogo del servidor queda inactivo en el teléfono: no se borra (ventas y leases lo referencian), pero no se muestra ni se puede vender. Si vuelve a venir en una descarga posterior, se reactiva con los datos nuevos.
- **RF-6** Cambiar el precio de un producto no altera las ventas ya registradas: cada venta conserva el precio con que se cobró.
- **RF-7** La app valida la respuesta del servidor antes de guardarla. Si un solo producto no cumple la forma esperada, se descarta la descarga entera y se informa el error.
- **RF-8** La app guarda la fecha y hora de la última descarga correcta.
- **RF-9** Inventario muestra los productos activos ordenados por nombre (nombre, categoría y precio) y la fecha de la última actualización. Sin catálogo aún, indica que hay que actualizar con red.
- **RF-10** El catálogo sigue siendo público en el servidor (SPEC-003/RF-5) y solo devuelve productos activos.

## 5. Requisitos no funcionales
- **RNF-1** La descarga y el guardado no bloquean el render (Constitución §5). Con 2 000 productos, guardar el catálogo tarda menos de 1 s en un teléfono de gama media.
- **RNF-2** Precios en centavos enteros en todo el recorrido (SPEC-001).
- **RNF-3** Pruebas automatizadas: la ruta del catálogo en el backend (solo activos, orden, forma) y el reemplazo local (altas, cambios, bajas, respuesta inválida sin cambios).
- **RNF-4** `tsc --noEmit` sin errores en ambos repos.

## 6. Criterios de aceptación
- **CA-1** Dado el teléfono con red y el backend con la semilla, cuando abro la app, entonces Inventario muestra los 5 productos con su precio y la hora de actualización.
- **CA-2** Dado el catálogo descargado, cuando pongo el teléfono en modo avión y reinicio la app, entonces Inventario muestra los mismos productos.
- **CA-3** Dado un cambio de precio en el servidor, cuando actualizo el catálogo, entonces Inventario muestra el precio nuevo y una venta anterior conserva el precio viejo.
- **CA-4** Dado un producto desactivado en el servidor, cuando actualizo, entonces desaparece de Inventario y sus ventas previas siguen intactas.
- **CA-5** Sin red, cuando toco actualizar, entonces veo un aviso de error y el catálogo guardado no cambia.
- **CA-6** Dada una respuesta del servidor con un producto inválido (p. ej. precio negativo), cuando se procesa, entonces no cambia nada en la BD local.
- **CA-7** `GET /catalogo` no devuelve productos inactivos, viene ordenado por nombre y no exige credencial.

## 7. Fuera de alcance
- Stock por producto en el teléfono: el stock vendible offline son los leases (SPEC-005).
- Elegir productos para cobrar, carrito y búsqueda (SPEC-007).
- Descargas incrementales (solo cambios), caché HTTP y paginación: el catálogo se baja completo.
- Actualizar automáticamente al recuperar la red (SPEC-006, como TD-022).
- Imágenes, códigos de barras y variantes de producto.
- Editar el catálogo desde la app o un panel de administración.

## 8. Preguntas abiertas
- [x] **P1** Cuándo se descarga → al abrir la app y con el botón de Inventario.
- [x] **P2** "Venta de prueba" → usa el primer producto activo del catálogo descargado; sin catálogo avisa que hay que actualizar. TD-023 queda solo por el botón.
- [x] **P3** Producto que vuelve tras una baja → se reactiva con los datos nuevos.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-30 | Creación (Draft) | — |
| 2026-10-30 | Resueltas P1–P3 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-10-30 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-10-30 | tasks.md aprobado → In Progress | Usuario |
| 2026-10-30 | CA-1..CA-7 verificados (T6 en teléfono) → Done | Usuario |
