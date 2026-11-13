# SPEC-013 — Panel de administración: rol, login, ventas y stock

| Campo | Valor |
|---|---|
| Estado | In Progress |
| Fase | 5 — Administración |
| Repos | app, backend |
| Depende de | SPEC-002, SPEC-003, SPEC-008, SPEC-011, SPEC-012 |
| Creada | 2026-11-12 |
| Actualizada | 2026-11-12 |

## 1. Contexto y problema
`PRODUCT.md` nombra al **supervisor / dueño** como usuario ("ver ventas consolidadas y no tener sobreventas"), pero hoy no tiene ninguna pantalla:

- **Ventas consolidadas.** Las ventas de todos los teléfonos llegan al servidor por sync (SPEC-008), pero solo se ven con SQL directo.
- **Stock.** Saber si el stock cuadra (central + prestado + informado = inicial) exige correr `report:stock` en la PC (SPEC-011).

Además, la app no distingue roles: cualquiera que la abra es vendedor. Las funciones de administración necesitan que solo entre quien tiene permiso.

Esta spec es la primera de dos. Pone la base (rol, login, panel) y las vistas de solo lectura. **SPEC-014** agrega las acciones: dispositivos y baja, conciliación y catálogo.

## 2. Objetivo
Que la app ofrezca, al abrirse, dos roles: **Vendedor**, que entra directo como hoy sin login, y **Administrador**, que entra con usuario y contraseña a un panel donde ve las ventas consolidadas de todos los teléfonos y el estado del stock.

## 3. Historias de usuario
- Como **vendedor**, quiero abrir la app y vender sin escribir contraseñas, para cobrar rápido como hasta ahora.
- Como **administrador**, quiero entrar con mi usuario y contraseña, para que nadie más vea la información del evento.
- Como **administrador**, quiero ver las ventas de todos los teléfonos juntas, por dispositivo, sesión, hora y método de pago, para saber cómo va el evento.
- Como **administrador**, quiero ver por producto el stock central, lo prestado y lo informado, y si cuadra, para detectar errores sin abrir la PC.

## 4. Requisitos funcionales

### Selección de rol
- **RF-1** Al abrir la app sin un rol elegido, se muestra una pantalla con dos opciones: **Vendedor** y **Administrador**.
- **RF-2** Al elegir **Vendedor**, la app entra a las pestañas actuales (Venta, Inventario, Dashboard, Ajustes) **sin pedir login**. El comportamiento del vendedor no cambia: identidad de dispositivo, sesión de vendedor, venta offline, préstamos y sync siguen igual (SPEC-003 a SPEC-010).
- **RF-3** Desde Ajustes del vendedor y desde el panel se puede **cambiar de rol**, lo que vuelve a la pantalla de RF-1. La app recuerda el último rol elegido y lo abre directo la próxima vez; si era Administrador y la sesión venció, pide login de nuevo.
- **RF-4** Con una **sesión de vendedor abierta** en el teléfono, no se puede cambiar a Administrador: la app pide cerrar antes la sesión de vendedor y no muestra el login.

### Login de administrador
- **RF-5** Al elegir **Administrador**, la app pide **usuario y contraseña** y los valida contra el servidor. Sin red, informa que el login necesita conexión.
- **RF-6** Con credenciales válidas, la app abre el panel. Con credenciales inválidas, muestra un error genérico, sin decir si falló el usuario o la contraseña.
- **RF-7** Tras **5 intentos fallidos** seguidos para un mismo usuario, el servidor bloquea ese usuario durante **15 minutos**, aunque luego llegue la contraseña correcta.
- **RF-8** La sesión de administrador **vence a las 8 horas**. Al vencer, o al tocar **Cerrar sesión**, la app vuelve al login.
- **RF-9** Las cuentas de administrador se crean y cambian de contraseña desde el servidor con un comando, no desde la app. No hay registro abierto.

### Ventas consolidadas
- **RF-10** El panel muestra, para un rango de tiempo (por defecto el día actual), el total vendido, el número de ventas y el ticket promedio de todos los dispositivos, con los datos que ya llegaron por sync.
- **RF-11** El panel desglosa esas ventas por **dispositivo**, por **sesión de vendedor**, por **hora** y por **método de pago**, y muestra los productos más vendidos.
- **RF-12** El panel muestra la hora de los datos y, por dispositivo, la última vez que contactó al servidor y la última sincronización, para que se sepa qué ventas podrían faltar todavía.

### Stock
- **RF-13** Por producto, el panel muestra stock central, stock prestado (en préstamos activos) y unidades informadas como vendidas, con los mismos números que el reporte de SPEC-011.
- **RF-14** El panel marca si el stock **cuadra** (central + prestado + informado = inicial) y resalta los productos que no cuadran.

## 5. Requisitos no funcionales
- **RNF-1 Seguridad: contraseñas.** El servidor guarda solo un hash lento con sal de cada contraseña, nunca la contraseña. La contraseña no aparece en logs ni en respuestas.
- **RNF-2 Seguridad: credenciales separadas.** La credencial de administrador y la del dispositivo (SPEC-003) son distintas: la del dispositivo no da acceso al panel y la del administrador no sirve para pedir préstamos ni sincronizar.
- **RNF-3 Seguridad: almacenamiento.** En el teléfono, la credencial de la sesión de administrador se guarda en el almacén seguro, igual que el secreto del dispositivo.
- **RNF-4 Offline-first del vendedor.** Nada de esta spec puede bloquear ni retrasar una venta. El rol Vendedor funciona sin red como hoy.
- **RNF-5 El panel necesita red.** El panel solo funciona con conexión. Sin red, muestra "Sin conexión" y los últimos datos no se guardan en el teléfono.
- **RNF-6 Rendimiento.** Cada vista del panel carga en menos de 2 s con 10 dispositivos, 2 000 productos y 10 000 ventas en el servidor.
- **RNF-7 Diseño.** El panel usa los componentes y colores del rediseño de SPEC-012.

## 6. Criterios de aceptación
- **CA-1** Dado que abro la app por primera vez, cuando elijo Vendedor, entonces llego a la pestaña Venta sin que me pida contraseña.
- **CA-2** Dado que elegí Vendedor antes, cuando vuelvo a abrir la app, entonces entra directo como Vendedor.
- **CA-3** Dado que tengo una sesión de vendedor abierta, cuando intento cambiar a Administrador, entonces la app me pide cerrar la sesión de vendedor y no muestra el login.
- **CA-4** Dado que elijo Administrador, cuando escribo un usuario y contraseña válidos con red, entonces veo el panel.
- **CA-5** Dado que escribo una contraseña incorrecta 5 veces seguidas, cuando intento la sexta (incluso con la correcta), entonces el servidor la rechaza hasta que pasen 15 minutos.
- **CA-6** Dado que soy administrador sin red, cuando intento entrar, entonces la app me dice que el login necesita conexión.
- **CA-7** Dado que la sesión de administrador cumplió 8 horas, cuando hago cualquier acción en el panel, entonces vuelvo al login.
- **CA-8** Dado un dispositivo con su credencial de vendedor, cuando llama a una ruta del panel, entonces el servidor la rechaza; y dada la credencial de administrador, cuando se usa para pedir un préstamo o sincronizar, también se rechaza.
- **CA-9** Dados dos teléfonos que vendieron y sincronizaron, cuando abro Ventas en el panel, entonces los totales por dispositivo suman el total general y coinciden con lo guardado en el servidor.
- **CA-10** Dado el escenario de SPEC-011, cuando abro Stock en el panel, entonces los números coinciden con `report:stock` y el panel marca "cuadra".
- **CA-11** Dado que un vendedor cobra sin red en un teléfono, cuando otro teléfono usa el panel, entonces la venta se cobra sin cambios en tiempo ni comportamiento.

## 7. Fuera de alcance
- Dispositivos y baja, conciliación de préstamos y administración del catálogo: van en **SPEC-014**.
- Panel web (el panel vive en la app móvil).
- Gestión de cuentas de administrador desde la app (alta, baja, cambio de contraseña).
- Recuperación de contraseña por correo.
- Roles con permisos distintos entre administradores (todos pueden todo).
- Login o identificación personal del vendedor.
- Panel sin red o con datos guardados en el teléfono.
- Exportar reportes (CSV, PDF).
- Multi-tienda o multi-evento.

## 8. Preguntas abiertas
Ninguna. Respuestas del 2026-11-12:
- [x] **P1 — Dónde vive el panel.** En la app móvil, con selección de rol al abrir.
- [x] **P2 — Mismo teléfono, dos roles.** No se permite cambiar a Administrador con una sesión de vendedor abierta (RF-4).
- [x] **P6 — Tamaño.** Se divide en dos specs: esta (rol, login, ventas, stock) y SPEC-014 (dispositivos, conciliación, catálogo).
- [x] **P7 — Tiempos.** Sesión de 8 h, bloqueo tras 5 intentos fallidos, bloqueo de 15 min (RF-7, RF-8).

P3, P4 y P5 pasaron a SPEC-014.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-12 | Creación (Draft) | Pedido del usuario: panel de admin con login solo para el rol Administrador |
| 2026-11-12 | Respuestas P1, P2, P6, P7; dispositivos, conciliación y catálogo pasan a SPEC-014 | Revisión con el usuario |
| 2026-11-12 | Approved (spec, plan y tareas) | Aprobada por el usuario |
| 2026-11-12 | In Progress (T1: ADR-0007) | Inicio de la implementación |
