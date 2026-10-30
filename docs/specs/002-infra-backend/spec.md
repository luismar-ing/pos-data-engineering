# SPEC-002 — Infraestructura backend

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 0 — Cimientos |
| Repos | backend |
| Depende de | — |
| Creada | 2026-10-30 |
| Actualizada | 2026-10-30 |

## 1. Contexto y problema
El backend funciona solo si se arranca a mano y nada falla. Hoy:

- No hay forma estándar de arrancarlo en desarrollo, compilarlo ni ejecutarlo compilado (TD-011).
- Si falta `PORT`, el servidor no arranca en un puerto conocido; no hay ruta para saber si está vivo ni manejo central de errores (TD-012).
- Si Postgres corta una conexión inactiva, el proceso entero se cae (TD-020).
- Las migraciones solo se aplican al crear el volumen de Docker por primera vez; una BD ya existente no recibe migraciones nuevas sin hacerlo a mano (TD-014).
- Cada ruta valida su entrada a su manera y los errores tienen formatos distintos (`{ error }` con textos sueltos, o un 500 genérico de Express).
- No hay pruebas automatizadas (TD-013), y un script de prueba imprime la contraseña de la BD (TD-018).

SPEC-004, SPEC-005 y SPEC-008 añadirán rutas y migraciones. Sin esta base, cada una repetiría el mismo trabajo o heredaría los mismos fallos.

## 2. Objetivo
Que el backend arranque, se pruebe y se actualice con comandos estándar, que no se caiga por fallos de la BD, y que todas las rutas validen la entrada y respondan errores con un formato único.

## 3. Historias de usuario
- Como **desarrollador**, quiero arrancar, compilar y probar el backend con un comando cada uno, para no recordar pasos a mano.
- Como **desarrollador**, quiero que las migraciones nuevas se apliquen solas a mi BD existente, para no borrar datos de prueba en cada cambio de esquema.
- Como **app (cliente)**, quiero que todos los errores tengan la misma forma y un código estable, para decidir qué hacer (reintentar, descartar, avisar) sin leer textos.
- Como **app (cliente)**, quiero consultar si el backend y su BD están disponibles, para que el monitor de conectividad (SPEC-006) distinga "sin red" de "servidor caído".
- Como **desarrollador**, quiero pruebas automatizadas que corran en un comando, para que cada spec siguiente cumpla el quality gate de pruebas.

## 4. Requisitos funcionales
- **RF-1** Existen comandos para: arrancar en desarrollo con recarga automática, compilar, ejecutar lo compilado, verificar tipos, ejecutar pruebas, aplicar migraciones y cargar la semilla.
- **RF-2** La configuración se lee del entorno al arrancar. Si falta un valor obligatorio (la conexión a la BD), el proceso termina con un mensaje claro; los opcionales tienen valor por defecto (puerto 3000).
- **RF-3** Un comando aplica, en orden, las migraciones pendientes y registra cuáles se aplicaron. Ejecutarlo dos veces seguidas no cambia nada la segunda vez. Si una migración falla, no queda aplicada a medias y el comando termina con error.
- **RF-4** Docker solo crea las bases vacías (`posde` y `posde_test`); ya no aplica migraciones ni semilla. Una BD nueva migrada con el comando de RF-3 y una BD existente creada por Docker antes de esta spec quedan con el mismo esquema y el mismo registro de migraciones aplicadas.
- **RF-5** Existe una ruta de salud `GET /health` que responde si el servidor está vivo y si la BD responde. Si la BD no responde, la ruta lo indica con un código de error, sin colgarse.
- **RF-6** Toda respuesta de error usa una forma única con un código estable legible por máquina, un mensaje en español y, en errores de validación, el detalle de qué campo falló.
- **RF-7** La entrada de las rutas existentes (`POST /prestamos/request`, `POST /sync/events`) se valida contra un esquema declarado. Una entrada inválida devuelve 400 con la forma de RF-6 y no toca la BD.
- **RF-8** Un JSON mal formado devuelve 400; una ruta inexistente devuelve 404; un error no previsto devuelve 500. Los tres con la forma de RF-6 y sin exponer detalles internos (SQL, trazas).
- **RF-9** Si la BD corta una conexión inactiva, el servidor registra el error y sigue atendiendo; las peticiones siguientes vuelven a funcionar cuando la BD vuelve.
- **RF-10** Hay pruebas automatizadas de: validación de entrada, formato de errores, ruta de salud, idempotencia de `POST /sync/events` y el cálculo del lease actual.
- **RF-11** Ningún log ni script imprime credenciales. `test-db.ts` se elimina (lo reemplazan la ruta de salud y las pruebas).

## 5. Requisitos no funcionales
- **RNF-1** Los contratos de éxito actuales (`GET /catalogo`, `POST /prestamos/request`, `POST /sync/events`) no cambian. Solo cambia la forma de los errores (la app aún no los interpreta).
- **RNF-2** Las pruebas que necesitan BD usan la base `posde_test` en el mismo contenedor de Docker, separada de la de desarrollo, y se pueden repetir sin limpiar a mano.
- **RNF-3** La ruta de salud responde en menos de 1 s aunque la BD no responda.
- **RNF-4** `tsc --noEmit` sin errores.

## 6. Criterios de aceptación
- **CA-1** Dado un clon limpio con `.env` copiado del ejemplo, cuando ejecuto el comando de desarrollo, entonces el backend arranca en el puerto 3000 y se recarga al editar un archivo.
- **CA-2** Dado un `.env` sin la conexión a BD, cuando arranco, entonces el proceso termina con un mensaje que nombra la variable que falta.
- **CA-3** Dada una BD creada por Docker antes de esta spec, cuando ejecuto el comando de migraciones, entonces se registran las migraciones existentes como aplicadas sin volver a ejecutarlas, y una segunda ejecución informa "nada pendiente".
- **CA-4** Dada una migración nueva con un error de SQL, cuando ejecuto el comando de migraciones, entonces termina con error y el esquema queda como estaba.
- **CA-5** Con la BD arriba, cuando consulto la ruta de salud, entonces responde 200 e indica BD disponible. Con el contenedor de BD detenido, responde un error en menos de 1 s e indica BD no disponible.
- **CA-6** Cuando envío `POST /prestamos/request` sin `product_id` o con un valor que no es UUID, entonces recibo 400 con código de validación y el campo que falló.
- **CA-7** Cuando envío JSON mal formado a cualquier ruta, o pido una ruta que no existe, entonces recibo 400 o 404 con la forma de RF-6.
- **CA-8** Dado el servidor corriendo, cuando reinicio el contenedor de BD, entonces el proceso no se cae y `GET /catalogo` vuelve a responder 200 cuando la BD está arriba.
- **CA-9** Cuando ejecuto el comando de pruebas, entonces pasan todas, incluida la que envía el mismo lote a `POST /sync/events` dos veces y verifica que la segunda vez todo queda como duplicado.
- **CA-10** Ninguna salida de los comandos de RF-1 contiene la contraseña de la BD.
- **CA-11** Dado un volumen de Docker nuevo, cuando ejecuto el comando de migraciones y luego el de semilla, entonces `GET /catalogo` devuelve los productos de la semilla.

## 7. Fuera de alcance
- Autenticación de dispositivos (SPEC-003).
- Validación completa de los tipos de evento, lotes parciales y respuesta por evento en sync (SPEC-008). Aquí solo se mueve la validación actual a un esquema declarado.
- Congelar stock en leases (SPEC-005).
- Despliegue, CI, contenedor del backend, logs estructurados o métricas.
- Migraciones hacia atrás (rollback de esquema).
- Apagado ordenado del servidor (se retoma con el despliegue).
- Pruebas de la app (TD-013 en la parte app queda para cada spec de app).

## 8. Preguntas abiertas
- [x] **P1** BD de pruebas → base `posde_test` en el mismo contenedor de Docker.
- [x] **P2** Migraciones → solo el comando; Docker crea las bases vacías y la semilla se aplica con otro comando.
- [x] **P3** Ruta de salud → `GET /health` (inglés, según CONVENTIONS).
- [x] **P4** `test-db.ts` → se borra.
- [x] **P5** Apagado ordenado → se quita (fuera de alcance).

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-30 | Creación (Draft) | — |
| 2026-10-30 | Resueltas P1–P5; quitado apagado ordenado; añadido CA-11 | Respuestas del usuario |
| 2026-10-30 | spec.md aprobada; plan.md en revisión | Usuario |
| 2026-10-30 | plan.md aprobado (incluye `zod`); tasks.md en revisión | Usuario |
| 2026-10-30 | tasks.md aprobado → In Progress | Usuario |
| 2026-10-30 | CA-1..CA-11 verificados → Done | Usuario |
