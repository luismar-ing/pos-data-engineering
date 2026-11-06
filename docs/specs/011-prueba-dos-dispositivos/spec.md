# SPEC-011 — Corte de red con dos dispositivos y reintentos de sync

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 4 — Endurecimiento y demo |
| Repos | backend, app, docs |
| Depende de | SPEC-005, SPEC-006, SPEC-008 |
| Creada | 2026-11-05 |
| Actualizada | 2026-11-06 |

## 1. Contexto y problema
`PRODUCT.md` mide el éxito del proyecto con dos números:
- **0 sobreventas** en pruebas de corte de red con 2 o más dispositivos a la vez;
- **0 eventos duplicados o perdidos** tras reintentos de sincronización.

Hoy ninguno de los dos está probado de punta a punta:

- **Sobreventa.** CA-9 de SPEC-005 (dos teléfonos sin red no venden más que el stock) nunca se probó con dos dispositivos reales (TD-027). Está cubierto por partes: los pedidos simultáneos de préstamo en el servidor, y el descuento de cuota en un solo teléfono.
- **Reintentos.** Las pruebas de SPEC-008 cubren reenviar un lote completo y el rechazo de un evento dentro de un lote. Faltan tres casos: un lote que se corta con una parte ya guardada, el mismo lote enviado dos veces al mismo tiempo, y una respuesta que se pierde antes de llegar al teléfono.
- **Falta una forma de comprobar que el stock cuadra.** No hay manera rápida de ver, en el servidor, que lo que hay en el stock central, lo prestado y lo vendido suman lo que había al empezar.

Ahora hay un emulador Android en la PC (2026-11-05), así que se pueden correr dos dispositivos reales contra el backend local.

## 2. Objetivo
Dejar evidencia repetible de que, con dos dispositivos que pierden la red y venden el mismo producto, no hay sobreventa, y de que los reintentos de sync no duplican ni pierden eventos. Para eso hacen falta un procedimiento de prueba, pruebas automatizadas nuevas y un reporte de consistencia del stock en el servidor.

## 3. Historias de usuario
- Como **dueño**, quiero ver que dos vendedores sin red nunca venden más de lo que había, para confiar en el sistema en un evento real.
- Como **desarrollador**, quiero un reporte que me diga si el stock del servidor cuadra, para detectar un error de préstamos o de sync en segundos.
- Como **desarrollador**, quiero repetir la prueba de dos dispositivos siempre igual, para usarla antes de cada entrega y en la demo.

## 4. Requisitos funcionales

### Escenario de dos dispositivos
- **RF-1** Hay un procedimiento escrito y repetible para correr dos dispositivos contra el backend local. Cubre preparar el escenario, cortar la red de cada uno, vender, reconectar y verificar (ver P1).
- **RF-2** Se puede dejar el backend en un estado inicial conocido para la prueba: catálogo de desarrollo con un stock fijo y sin préstamos ni ventas de pruebas anteriores. Solo en desarrollo, nunca contra producción (ver P2).
- **RF-3** Se puede cortar y devolver la red de cada dispositivo por separado sin cortar la de la PC, para que el otro dispositivo y el backend sigan conectados (ver P3).

### Reporte de consistencia
- **RF-4** El servidor da un reporte por producto con:
  - stock central;
  - cuota prestada en préstamos activos;
  - lo vendido que los dispositivos informaron al cerrar préstamos;
  - las unidades vendidas que llegaron por sync;
  - el total que debería mantenerse constante.
- **RF-5** El reporte compara contra el estado inicial del escenario y marca el producto como **inconsistente** en dos casos:
  - stock central + cuota activa + vendido informado ≠ stock inicial;
  - unidades vendidas por sync > stock inicial.
- **RF-6** El reporte solo lee la base de datos y se puede correr en cualquier momento, también con dispositivos sin red.

### Reintentos de sync (pruebas automatizadas)
- **RF-7** **Lote cortado.** Si el servidor guardó parte de un lote y la respuesta no llegó, al reenviar el lote completo lo ya guardado responde `duplicate`, lo demás `inserted`, y cada venta queda una sola vez.
- **RF-8** **Envíos simultáneos.** El mismo lote enviado dos veces al mismo tiempo deja cada evento una sola vez. Cada evento responde `inserted` en un envío y `duplicate` en el otro, sin errores 500.
- **RF-9** **Respuesta perdida en el teléfono.** Si el envío falla después de llegar al servidor, los eventos siguen `pending` en el teléfono. El siguiente envío los marca `synced` y no los duplica en el servidor.

## 5. Requisitos no funcionales
- **RNF-1** La prueba de dos dispositivos se puede correr en esta PC, con dos emuladores a la vez o con un emulador y un teléfono (ver P1).
- **RNF-2** El reporte tarda menos de 1 s con el catálogo de desarrollo.
- **RNF-3** El reinicio del escenario se niega a correr si la base no es la de desarrollo o la de pruebas (ver P2).
- **RNF-4** `tsc --noEmit` sin errores y `npm test` en verde en los repos tocados.

## 6. Criterios de aceptación
- **CA-1** Dado un escenario con "Hot dog" en stock 10 y dos dispositivos con préstamo de ese producto, cuando los dos pierden la red y venden hasta que la app los bloquea, entonces cada uno vende como máximo su cuota y la suma no supera 10.
- **CA-2** Dado CA-1, cuando los dos recuperan la red, entonces todas sus ventas llegan al servidor una sola vez y el reporte muestra el producto consistente, con las unidades vendidas por sync ≤ 10.
- **CA-3** Dado un dispositivo sin red con cuota sin vender, cuando el otro pide más préstamo con red, entonces solo recibe lo que queda en el stock central: la cuota congelada del dispositivo sin red no se reparte.
- **CA-4** Dado CA-2, cuando los dos cierran sesión con red, entonces lo no vendido vuelve al stock central y el reporte sigue consistente.
- **CA-5** (automatizado) Lote cortado: RF-7.
- **CA-6** (automatizado) Envíos simultáneos: RF-8.
- **CA-7** (automatizado) Respuesta perdida en el teléfono: RF-9.
- **CA-8** (automatizado) Dado un producto con datos alterados a propósito (más ventas que stock, o un total que no cuadra), cuando corro el reporte, entonces ese producto sale inconsistente y los demás no.
- **CA-9** Con la base de producción configurada, el reinicio del escenario no hace nada y avisa.

## 7. Fuera de alcance
- Más de dos dispositivos o pruebas de carga.
- Liberar a mano la cuota de un teléfono perdido (TD-025) y conciliar por préstamo lo informado contra lo sincronizado (TD-028): quedan para la spec de administración.
- Un panel web o una pantalla en la app para el reporte.
- Automatizar de punta a punta la prueba de dos dispositivos con un script que maneje los emuladores.
- Cambios en las reglas de préstamo o de sync. Si la prueba encuentra un error, se corrige en esta spec y se anota en Cambios.

## 8. Preguntas abiertas
- [x] **P1** Dispositivos → dos emuladores en esta PC (`pos_pixel` y un segundo AVD), lado a lado en la mitad derecha de la pantalla. El teléfono queda como alternativa para la demo.
- [x] **P2** Reinicio → comando del backend que borra préstamos, ventas, eventos recibidos y sesiones, fija el stock de desarrollo ("Hot dog" en 10) y lo guarda como stock inicial del reporte. Solo corre con las bases `posde` o `posde_test`. En los dispositivos se borran los datos de Expo Go y la app se registra de nuevo.
- [x] **P3** Corte de red → modo avión del emulador por `adb`.
- [x] **P4** Reporte → comando del backend que imprime una tabla en la terminal; sin ruta HTTP nueva.
- [x] **P5** Procedimiento → `docs/testing/dos-dispositivos.md`, con pasos y tabla de resultados por corrida; la primera corrida va al DEVLOG.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-05 | Creación (Draft) | — |
| 2026-11-05 | Resueltas P1–P5 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-11-05 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-11-05 | tasks.md aprobado → In Progress | Usuario |
| 2026-11-06 | P1: los dos dispositivos son un emulador (`pos_pixel`, aligerado a 720×1600, 2 núcleos, 1.5 GB) y el teléfono. Con dos emuladores la PC se queda sin RAM y Android muestra "System UI isn't responding" | Hallado en T4; decisión del usuario |
| 2026-11-06 | Primera corrida (emulador + iPhone): 8/8 pasos, 10 vendidos de 10, sin duplicados, reporte `ok`. Sin cambios en `syncService`: lote cortado y envíos simultáneos ya eran idempotentes. CA-1..CA-9 verificados → Done | Usuario |
