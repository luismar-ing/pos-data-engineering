# SPEC-003 — Identidad de dispositivo y sesión

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 1 — Datos y catálogo |
| Repos | app, backend |
| Depende de | SPEC-001, SPEC-002 |
| Creada | 2026-10-30 |
| Actualizada | 2026-10-30 |

## 1. Contexto y problema
Todo el modelo gira alrededor del **dispositivo**: los leases se asignan por dispositivo (SPEC-005), las ventas y eventos llevan `device_id` (SPEC-001) y la sincronización los envía en su nombre (SPEC-008). Hoy:

- La app no tiene un identificador propio: `createSale` recibe un `deviceId`, pero nada lo genera ni lo guarda.
- El backend tiene una tabla de dispositivos que solo llena la semilla; nadie se registra y las ventas no están ligadas a un dispositivo conocido (TD-019).
- Cualquiera que alcance el servidor puede pedir leases o enviar ventas en nombre de cualquier dispositivo. Con leases que congelan stock (SPEC-005), eso permite vaciar el inventario o inventar ventas.
- No existe la **sesión**: no se sabe qué vendedor hizo qué venta ni cuándo empezó o terminó su turno.

## 2. Objetivo
Que cada dispositivo tenga una identidad estable, se registre en el servidor y se autentique en las rutas que actúan en su nombre; y que cada venta quede ligada a la sesión de trabajo de un vendedor, también sin red.

## 3. Historias de usuario
- Como **vendedor**, quiero abrir mi sesión con mi nombre al empezar el turno, aunque no haya red, para que mis ventas queden a mi nombre.
- Como **vendedor**, quiero cerrar mi sesión al terminar, para que el siguiente vendedor empiece la suya.
- Como **supervisor**, quiero que cada venta indique dispositivo y sesión, para saber quién vendió qué.
- Como **supervisor**, quiero que solo dispositivos registrados puedan pedir stock o enviar ventas, para que nadie vacíe el inventario desde fuera.
- Como **app**, quiero registrarme sola la primera vez que tenga red, sin pasos manuales, para no frenar el arranque.

## 4. Requisitos funcionales

### Dispositivo
- **RF-1** En el primer arranque la app genera un identificador de dispositivo y lo guarda localmente. Se mantiene entre reinicios y actualizaciones de la app. Funciona sin red.
- **RF-2** Cuando hay red y el dispositivo aún no está registrado, la app se registra en el servidor enviando su identificador y su nombre, sin intervención del usuario y sin bloquear la UI. Si falla, reintenta en el siguiente arranque o al recuperar red.
- **RF-3** El registro es idempotente: registrar dos veces el mismo identificador no crea dos dispositivos.
- **RF-4** Al registrarse, el dispositivo y el servidor quedan con una credencial secreta que solo conoce ese dispositivo: la genera el dispositivo y el servidor la acepta. La app la guarda localmente y el servidor no la guarda en claro.
- **RF-5** Las rutas que actúan en nombre de un dispositivo (pedir lease, enviar eventos) exigen la credencial. Sin credencial o con una inválida responden 401 con la forma de error de SPEC-002. El catálogo y la ruta de salud siguen públicos.
- **RF-6** El servidor rechaza con 403 un evento cuyo dispositivo no coincide con el dispositivo autenticado.
- **RF-7** En el servidor, toda venta referencia un dispositivo registrado (cierra TD-019).

### Sesión
- **RF-8** Para vender hace falta una sesión abierta. El vendedor la abre escribiendo su nombre; funciona sin red.
- **RF-9** Un dispositivo tiene como máximo una sesión abierta. Abrir otra exige cerrar la actual.
- **RF-10** La sesión abierta sobrevive a cerrar y reabrir la app.
- **RF-11** Cada venta registra la sesión en la que se hizo.
- **RF-12** Abrir y cerrar una sesión generan eventos en la bitácora, con UUID e inmutables. Su envío al servidor es de SPEC-008.
- **RF-13** Ajustes muestra: nombre (editable) e identificador del dispositivo, si está registrado, y la sesión abierta (vendedor y hora de inicio) con un botón para cerrarla.

## 5. Requisitos no funcionales
- **RNF-1** El registro y la lectura de la identidad no bloquean el render (Constitución §5).
- **RNF-2** La credencial no aparece en logs, ni en la app ni en el backend.
- **RNF-3** Comparar credenciales en el servidor no revela por tiempo de respuesta si una credencial es casi correcta.
- **RNF-4** `tsc --noEmit` sin errores en ambos repos; pruebas automatizadas del registro, la autenticación y la regla de una sola sesión abierta.

## 6. Criterios de aceptación
- **CA-1** Dada una instalación nueva sin red, cuando abro la app, entonces se genera un identificador y, tras reiniciar la app, es el mismo.
- **CA-2** Dado un dispositivo no registrado, cuando la app arranca con red, entonces queda registrado en el servidor sin que el usuario haga nada, y Ajustes lo muestra como registrado.
- **CA-3** Dado un dispositivo ya registrado, cuando envía de nuevo el registro con el mismo identificador, entonces el servidor no crea otro dispositivo.
- **CA-4** Cuando pido un lease o envío eventos sin credencial, o con una inválida, entonces recibo 401 `UNAUTHORIZED` y no se toca la BD.
- **CA-5** Dado el dispositivo A autenticado, cuando envía un evento con el `device_id` de B, entonces recibe 403 y el evento no se guarda.
- **CA-6** Dada la app sin sesión abierta, cuando entro a Venta, entonces no puedo cobrar y se me pide abrir sesión.
- **CA-7** Sin red, cuando abro sesión como "Ana" y cobro una venta, entonces la venta queda con esa sesión y en la bitácora hay un evento de apertura de sesión.
- **CA-8** Con una sesión abierta, cuando cierro y reabro la app, entonces la sesión sigue abierta; cuando la cierro desde Ajustes, entonces queda un evento de cierre y ya no puedo cobrar.
- **CA-9** En el servidor, una venta con un dispositivo no registrado se rechaza.
- **CA-10** Ninguna salida de la app ni del backend contiene la credencial.

## 7. Fuera de alcance
- Cuentas de usuario con contraseña, roles (vendedor / supervisor) o permisos.
- Revocar o dar de baja dispositivos (se hará cuando haya panel de administración).
- Enviar sesiones y sus eventos al servidor, y reportes por sesión (SPEC-008, SPEC-009).
- Lógica de leases por dispositivo (SPEC-005).
- Recuperar la identidad tras desinstalar la app: una reinstalación es un dispositivo nuevo.
- HTTPS / despliegue.

## 8. Preguntas abiertas
- [x] **P1** Identificador → lo genera la app (UUID local en el primer arranque).
- [x] **P2** Credencial → se exige ya (RF-4..RF-6).
- [x] **P3** Almacén de la credencial → almacén seguro del sistema operativo (Keychain / Keystore), no SQLite.
- [x] **P4** Nombre del dispositivo → por defecto el modelo del teléfono, editable en Ajustes.
- [x] **P5** Vendedor → solo escribe su nombre, sin contraseña ni PIN.
- [x] **P6** Ventas previas sin sesión → se dejan sin sesión; el campo solo es opcional para esos datos.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-30 | Creación (Draft) | — |
| 2026-10-30 | Resueltas P1–P6 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-10-30 | RF-4: la credencial la genera el dispositivo (registro idempotente); plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-10-30 | tasks.md aprobado → In Progress | Usuario |
