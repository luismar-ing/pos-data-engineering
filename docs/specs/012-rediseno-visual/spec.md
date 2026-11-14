# SPEC-012 — Rediseño visual "Señalética de feria"

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 4 |
| Repos | app |
| Depende de | SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-010 |
| Creada | 2026-11-09 |
| Actualizada | 2026-11-13 |

## 1. Contexto y problema

La app cumple todas sus funciones, pero su interfaz es la de un prototipo: texto gris sobre blanco, filas planas, botones pequeños y sin jerarquía visual. Para un vendedor en una feria o en un transporte, con sol, prisa y una mano ocupada, esto tiene costo: cuesta encontrar un producto, leer cuánto queda o ver si hay red. Además, la demo de la fase 4 necesita una app que se vea terminada.

De tres propuestas de diseño, el usuario eligió la **Propuesta A, "Señalética de feria"** (canvas: <https://claude.ai/artifact/8p2v7hSgbp2o8j8NQK2v9b>, artboard "Propuesta A"). Esa propuesta es la referencia visual de esta spec.

## 2. Objetivo

Aplicar la Propuesta A a todas las pantallas de la app, con un sistema visual único (colores, tipografía, tamaños, componentes) y sin cambiar ninguna regla de negocio: se vende, se cobra, se presta stock y se sincroniza exactamente igual que hoy.

## 3. Historias de usuario

- Como **vendedor**, quiero ver los productos como botones grandes con precio y "Quedan N" bien visibles para agregar al carrito sin fallar, incluso con sol.
- Como **vendedor**, quiero ver siempre el total del carrito y un botón de cobro grande para cobrar con una sola mano.
- Como **vendedor**, quiero saber de un vistazo si estoy sin conexión y que eso no me impida vender.
- Como **vendedor**, quiero que lo agotado y lo que está por agotarse se distinga de lo demás por algo más que el color.
- Como **cliente final**, quiero un QR grande y claro para leer el recibo con la cámara.
- Como **supervisor / dueño**, quiero que la app se vea profesional en la demo.

## 4. Requisitos funcionales

### Sistema visual
- **RF-1** Toda la app usa una paleta única: fondo blanco, tinta azul marino para texto, azul fuerte como color de acción, amarillo de aviso para "sin conexión" y "por agotarse", rojo solo para "agotado" y acciones destructivas, y un gris azulado claro para superficies secundarias. Los valores exactos son los del artboard "Propuesta A".
- **RF-2** La app usa una tipografía condensada de estilo señalética para títulos, precios y cifras, y su versión normal para el texto corrido. Las cifras de dinero y cantidades usan números tabulares.
- **RF-3** La barra de pestañas (Venta, Inventario, Dashboard, Ajustes) lleva un icono de trazo y una etiqueta en cada pestaña; la activa se marca en azul.
- **RF-4** Los componentes repetidos (botón principal, botón secundario, botón destructivo, pastilla de estado, campo de texto, tarjeta de sección, aviso de red) tienen un solo aspecto en toda la app.

### Venta
- **RF-5** La cabecera muestra "Venta", el vendedor y la hora en que abrió la sesión, y una pastilla de estado de red ("En línea" / "Sin conexión").
- **RF-6** El buscador conserva su comportamiento actual (SPEC-007) con el nuevo aspecto.
- **RF-7** Debajo del buscador hay filtros por categoría: "Todo" más una opción por cada categoría presente en el catálogo local. El filtro se combina con la búsqueda. Los productos sin categoría solo salen en "Todo".
- **RF-8** Los productos se muestran en una cuadrícula de 2 columnas. Cada tarjeta muestra nombre, precio grande y una pastilla "Quedan N". Si el producto está en el carrito, la tarjeta lleva borde azul y un contador con las unidades.
- **RF-9** Un producto agotado se ve atenuado, con borde punteado y la pastilla "Agotado", y no se puede tocar (igual que hoy, SPEC-005).
- **RF-10** Un producto por agotarse (P2) muestra la pastilla en amarillo.
- **RF-11** Con el carrito no vacío, una barra fija sobre las pestañas muestra el número de artículos, el total y "Cobrar". Tocarla abre la hoja de cobro. Con el carrito vacío, la barra no aparece.

### Carrito y cobro
- **RF-12** La hoja de cobro reúne en una sola vista el total, las líneas del carrito con − / + y su subtotal, "Vaciar", los métodos de pago, el monto recibido en efectivo y el cambio. Las reglas de SPEC-007 no cambian: tope por lo disponible y 999, cambio solo en efectivo, "no alcanza" si el monto es menor, y confirmación de "Vaciar".
- **RF-13** Los métodos de pago son 3 botones del mismo tamaño; el elegido se rellena en azul marino.
- **RF-14** El cambio se muestra en un recuadro azul claro con cifra grande.
- **RF-15** Botones al pie: "Cancelar" (secundario) y "Confirmar cobro" (principal, el doble de ancho).

### Venta registrada y recibo QR
- **RF-16** Al confirmar, la hoja muestra la venta registrada: marca de éxito, total grande, método, cambio si lo hay e id corto de la venta.
- **RF-17** El recibo QR se ve grande, dentro de un marco, con una línea que explica que el cliente lo lee con su cámara y no necesita red. El contenido del QR no cambia (SPEC-010). Se muestra directo en la confirmación, sin botón intermedio (P3).
- **RF-18** El botón principal es "Nueva venta".

### Inventario
- **RF-19** Cabecera con "Inventario", la hora de la última actualización y el botón "Actualizar" con icono. Sin conexión, el botón se ve y queda deshabilitado (P5).
- **RF-20** Los productos se agrupan por categoría, con un título por grupo. Cada fila muestra nombre, precio y, a la derecha, el disponible en cifra grande con la etiqueta "disponibles" o "agotado". El disponible por agotarse va en amarillo oscuro y el agotado en rojo.

### Dashboard
- **RF-21** El ritmo de venta va en una tarjeta destacada en azul marino con la cifra grande y "unidades por minuto".
- **RF-22** "Se agota primero" muestra cada producto con su ritmo y una pastilla con el tiempo restante: amarilla si se agota pronto (umbral actual de SPEC-009), roja si está agotado.
- **RF-23** Los totales de la sesión se muestran en una cuadrícula de 2 × 2, y "Más vendidos" con el nuevo estilo de fila. Datos y reglas de cálculo sin cambios (SPEC-009).

### Ajustes
- **RF-24** Fondo gris azulado y tres tarjetas: "Este teléfono" (nombre, estado de registro, guardar), "Sesión" (vendedor, hora de apertura, "Cerrar sesión" como botón destructivo con borde rojo) y "Sincronización" (por enviar, con error, último envío, "Sincronizar ahora"). Las acciones hacen lo mismo que hoy (SPEC-003, SPEC-008).

### Abrir sesión y avisos
- **RF-25** La pantalla de abrir sesión (sin sesión, en Venta) usa el mismo sistema visual: título, campo del nombre del vendedor y botón principal.
- **RF-26** Sin conexión, la franja actual "Sin conexión" se convierte en una franja amarilla con icono y el texto "Sin conexión. Vendes con lo que tienes prestado.", visible en todas las pestañas (sigue SPEC-006).
- **RF-27** Los mensajes vacíos y de error existentes conservan su texto y adoptan el nuevo estilo.

## 5. Requisitos no funcionales

- **RNF-1 Sin cambios de negocio.** No cambian el esquema local, los contratos HTTP, la bitácora, los préstamos ni la sincronización. Las pruebas automatizadas actuales siguen pasando sin tocarlas, salvo las que prueben solo textos o estilos.
- **RNF-2 Rendimiento.** Cobrar sin red sigue tardando menos de 100 ms en teléfono (hoy 34 ms, SPEC-007). La cuadrícula de Venta se desplaza con fluidez con 2 000 productos.
- **RNF-3 Offline.** La tipografía y los iconos van dentro de la app: nada se descarga de la red para dibujar la interfaz.
- **RNF-4 Accesibilidad.** Contraste de texto de al menos 4.5:1 (3:1 en cifras de 24 px o más). Zonas táctiles de al menos 44 × 44 px. Los estados (agotado, por agotarse, sin conexión, en el carrito) se distinguen por texto o forma, no solo por color. Se mantienen las etiquetas de accesibilidad actuales.
- **RNF-5 Pantallas.** Se ve bien de 360 a 430 px de ancho, en Android e iOS, respetando las zonas seguras (muesca, barra de gestos) y con el teclado abierto en la hoja de cobro.
- **RNF-6 Tamaño de letra del sistema.** Con el tamaño de letra del sistema al 130 %, ningún texto queda cortado de forma que oculte un precio o una cantidad.

## 6. Criterios de aceptación

- **CA-1** Dado el catálogo de la semilla y una sesión abierta, cuando abro Venta, entonces veo una cuadrícula de 2 columnas con nombre, precio y "Quedan N" en cada tarjeta, y la pastilla de red en la cabecera.
- **CA-2** Dado un catálogo con las categorías Bebidas, Comida y Snacks, cuando toco "Bebidas" y escribo "ag" en el buscador, entonces solo veo "Agua 600 ml".
- **CA-3** Dado un producto sin préstamo disponible, cuando miro Venta, entonces su tarjeta dice "Agotado", tiene borde punteado y tocarla no agrega nada.
- **CA-4** Dado un carrito con 2 Hot dog, 1 Cerveza y 1 Agua, cuando miro Venta, entonces esas tarjetas tienen borde azul y contador, y la barra inferior dice "4 artículos", "$170.00" y "Cobrar".
- **CA-5** Dado ese carrito, cuando toco la barra, elijo Efectivo y escribo 200, entonces la hoja muestra las 3 líneas, el total $170.00 y el cambio $30.00; con 100, muestra "El monto no alcanza o no es válido." y no deja confirmar.
- **CA-6** Dada una venta confirmada, cuando veo la confirmación, entonces aparecen la marca de éxito, el total, el método, el cambio, el id corto y "Nueva venta"; el QR se lee con la cámara de otro teléfono y su texto es igual al de SPEC-010.
- **CA-7** Dado el teléfono sin red, cuando recorro las 4 pestañas, entonces la franja amarilla "Sin conexión…" se ve en todas, el botón "Actualizar" de Inventario está deshabilitado y puedo cobrar una venta.
- **CA-8** Dado un producto que se agota en menos de 5 min a su ritmo (P2), cuando miro Venta e Inventario, entonces su disponible se ve en amarillo; en Dashboard, la pastilla de "Se agota primero" se ve amarilla si se agota en menos del umbral de SPEC-009.
- **CA-9** Dado Ajustes, cuando lo abro, entonces veo las tres tarjetas y "Guardar nombre", "Cerrar sesión" y "Sincronizar ahora" funcionan como antes.
- **CA-10** Dado que no hay sesión, cuando abro Venta, entonces veo la pantalla de abrir sesión con el nuevo estilo y puedo abrir una.
- **CA-11** Dado `npm test` y `tsc --noEmit` en `pos-app`, cuando los corro, entonces pasan.
- **CA-12** Dado un teléfono físico sin red, cuando cobro, entonces el cobro tarda menos de 100 ms (RNF-2).
- **CA-13** Dado el tamaño de letra del sistema al 130 % en un teléfono de 360 px, cuando recorro las pantallas, entonces ningún precio ni cantidad queda oculto.

## 7. Fuera de alcance

- Las propuestas B y C, y el modo oscuro.
- Animaciones más allá de abrir y cerrar la hoja de cobro.
- Cambios de reglas de negocio, de datos, de backend o de contratos HTTP.
- Imágenes de producto.
- Pantallas nuevas que no existan hoy (por ejemplo, historial de ventas).
- Tablet y orientación horizontal.

## 8. Preguntas abiertas

Ninguna. Ver Decisiones.

### Decisiones (2026-11-09, aprobadas por el usuario)

- **P1 Carrito.** Se resume en una barra con artículos, total y "Cobrar"; las líneas con − / + se editan en la hoja de cobro.
- **P2 "Por agotarse".** En Venta e Inventario se usa la regla del Dashboard (SPEC-009): se agota en menos de 5 min a su ritmo. Sin ventas recientes solo cuenta "Agotado".
- **P3 Recibo QR.** Se muestra directo en la confirmación; desaparece el botón "Recibo QR".
- **P4 Filtros de categoría.** Se incluyen (RF-7).
- **P5 "Actualizar" sin red.** El botón se deshabilita mientras la app esté sin conexión (SPEC-006).

## 9. Cambios

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-09 | Creación | El usuario eligió la Propuesta A |
| 2026-11-09 | P1–P5 resueltas con las respuestas propuestas | Aprobación del usuario |
| 2026-11-09 | En la hoja de cobro, los botones ("Cancelar" / "Confirmar cobro" y "Nueva venta") quedan fijos al pie | Con 3 líneas o con el QR, el contenido no cabe y los botones quedaban fuera de la vista |
| 2026-11-09 | Inventario agrupa los productos sin categoría al final, en "Sin categoría" | RF-20 no decía dónde van |
| 2026-11-10 | CA-12 (cobro < 100 ms) se midió en el emulador `pos_pixel` en modo avión, no en teléfono físico: 76–104 ms, mediana 86 | Decisión del usuario. Queda TD-031 para confirmarlo en teléfono |
| 2026-11-10 | CA-6: el QR se decodificó desde capturas con `jsqr` en vez de con la cámara de otro teléfono (el emulador no tiene cámara) | Mismo texto que SPEC-010 (235 bytes) |
| 2026-11-13 | Done | CA-1..CA-13 verificados (T3–T12); CA-6 y CA-12 con las salvedades de arriba |
