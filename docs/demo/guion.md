# Guion de demo (SPEC-015)

Demo de unos 12 minutos que muestra las tres piezas del producto y el panel de administración:

- venta sin red sin sobreventa (Stock Leasing);
- sync idempotente (Batch ETL);
- analítica local (Edge Analytics);
- recibo QR sin red;
- panel de administración.

**Dispositivos:**
- **A** = emulador `pos_pixel` en la PC, proyectado;
- **B** = iPhone con Expo Go.

Los comandos `npm` se corren en la raíz del repo con `--prefix pos-backend`.

## 0. Preparación (10 min antes)

| # | Acción | Comprobación |
|---|---|---|
| 1 | `docker start pos-de-db` | `docker ps` muestra `pos-de-db` healthy |
| 2 | `.env.local` de `pos-app`: activar la línea con la IP de la PC en la red del lugar (B no llega a `10.0.2.2`) | — |
| 3 | Backend (`npm run dev` en `pos-backend`) y Metro (`npx expo start` en `pos-app`) | `http://localhost:3000/health` responde 200 |
| 4 | Emulador: `emulator -avd pos_pixel -no-boot-anim -no-audio -gpu host`. Luego la zona horaria local: `adb shell cmd alarm set-timezone America/Tijuana`. Sin esto el emulador queda en UTC y "Hoy" del panel corta el historial | `adb shell date` muestra la hora de la PC |
| 5 | Cuenta de administrador, solo la primera vez. La contraseña va por variable de entorno y no queda en ningún archivo: `$env:ADMIN_PASSWORD = '<contraseña>'; npm --prefix pos-backend run admin:set demo; Remove-Item Env:ADMIN_PASSWORD` | `admin: creado "demo"` (o `contraseña cambiada` si ya existía) |
| 6 | **Justo antes de empezar:** `npm --prefix pos-backend run demo:reset`. Borra préstamos, ventas, sesiones, cambios del panel y los teléfonos sin contacto en 24 h; conserva la cuenta y la sesión del administrador | `demo: lista en … ms (20 productos, Hot dog en 10 …)` |
| 7 | Borrar los datos locales de la app en A y B (sus préstamos guardados ya no existen en el servidor): A con `adb -s emulator-5554 shell pm clear host.exp.exponent`; B borrando y reinstalando Expo Go. Si la app ya estaba abierta, cerrarla del todo | — |
| 8 | Abrir la app: A con `adb shell am start -a android.intent.action.VIEW -d exp://<IP>:8081`, B escaneando el QR de Metro | "¿Quién usa la app?" en los dos |
| 9 | En los dos: **Vendedor** → nombre (A "Luis", B "Marta") → Abrir sesión | Venta muestra "Hot dog · Quedan 5" en cada uno |
| 10 | `npm --prefix pos-backend run report:stock` | 20 productos `ok`; Hot dog: central 0, prestado 10 |

## 1. Vender con red y recibo QR (2 min)

Muestra que el cobro es rápido y que el cliente recibe un comprobante sin depender de la red.

| # | Dónde | Acción | Debe verse |
|---|---|---|---|
| 1 | A | Buscar "cer", agregar 2 Cerveza 355 ml y 1 Nachos con queso | Total $140.00 |
| 2 | A | Cobrar → Efectivo → Monto recibido 200 | Cambio $60.00 |
| 3 | A | Confirmar | Código QR del recibo |
| 4 | B | Abrir la cámara del iPhone y apuntar al QR de A | El recibo en texto: productos, total y método de pago |

**Plan B:** si la cámara no lee el QR proyectado, acercar el iPhone a la pantalla de la PC o subir el brillo. El recibo es texto plano y no necesita app. No usar "Atrás" para ocultar el teclado en el cobro: cierra la hoja y hay que volver a tocar Cobrar (el carrito se conserva).

## 2. Corte de red con dos dispositivos (4 min)

Muestra la pieza central: sin red, cada teléfono vende solo su cuota y nunca hay sobreventa.

| # | Dónde | Acción | Debe verse |
|---|---|---|---|
| 1 | A | Modo avión: `adb -s emulator-5554 shell cmd connectivity airplane-mode enable` | Franja "Sin conexión" en ≤ 25 s |
| 2 | A | Vender 2 Hot dog (dos cobros de 1) | Cobra sin red; "Quedan 3" |
| 3 | B (con red) | Vender 5 Hot dog | Tras la quinta, "Agotado": pide más y no recibe nada, porque las 3 de A siguen congeladas en el servidor |
| 4 | B | Activar modo avión | "Sin conexión" |
| 5 | A | Vender 3 Hot dog e intentar una cuarta | "Agotado": no deja agregar más |
| 6 | PC | `npm --prefix pos-backend run report:stock` | Hot dog `ok`: el servidor aún no sabe de las ventas sin red, pero la cuota sigue prestada |

Resultado: 10 de 10 vendidos entre los dos, ni uno más.

**Plan B:** si el modo avión no corta la red de A, usar `adb -s emulator-5554 shell svc wifi disable` y `svc data disable`. Si B renueva su préstamo antes de vender (dura 3 min), aparece un préstamo cerrado con 0 vendidas: es normal y la cuenta sigue cuadrando.

## 3. Reconexión y sync (1.5 min)

Muestra que la bitácora viaja sola al volver la red, sin duplicados.

| # | Dónde | Acción | Debe verse |
|---|---|---|---|
| 1 | A y B | Quitar el modo avión (`… airplane-mode disable` en A) | En ≤ 30 s desaparece "Sin conexión" |
| 2 | A | Ajustes | Pendientes 0 |
| 3 | A | Sincronizar ahora (dos veces) | Pendientes 0; nada se repite |
| 4 | PC | `report:stock` | Hot dog: vendido sync 10, `ok` |

**Plan B:** si tarda, tocar "Sincronizar ahora" en Ajustes de cada dispositivo.

## 4. Dashboard (1.5 min)

Muestra la analítica que corre en el teléfono, sin red.

| # | Dónde | Acción | Debe verse |
|---|---|---|---|
| 1 | A | Pestaña Dashboard | Ritmo de venta (Burn Rate), qué se agota primero (Runout Time, en ámbar si < 5 min), totales y más vendidos de la sesión |
| 2 | A | Mencionar que con modo avión se ve igual: lee la base local | — |

## 5. Panel de administración (3 min)

Muestra que el dueño ve y controla el evento desde la app.

| # | Dónde | Acción | Debe verse |
|---|---|---|---|
| 1 | A | Ajustes → Cerrar sesión → Cambiar de rol → Administrador → usuario `demo` y su contraseña | Pestañas Ventas, Stock, Teléfonos, Conciliar y Cuenta |
| 2 | A | Ventas | Total del día con "Caja 2 (demo)", A y B; por vendedor (Ana, Luis, Marta), por hora, por método de pago y más vendidos |
| 3 | A | Stock | Todos los productos cuadran; Hot dog vendido 10 de 10 |
| 4 | A | Conciliar | "Ningún préstamo con diferencias": lo que cada teléfono informó coincide con sus ventas |
| 5 | A | Teléfonos → "Caja 2 (demo)" → Dar de baja (confirmar); luego Reactivar (confirmar) | "De baja desde …" y luego "Activo". El aviso explica que la cuota de un teléfono dado de baja vuelve al stock central 32 min después de vencer |
| 6 | A | Stock → Nuevo producto: "Agua mineral 1 L", Bebidas, $25.00, stock inicial 50 → Crear producto | Aparece en la lista |
| 7 | B | Inventario → Actualizar | "Agua mineral 1 L" disponible para vender |
| 8 | A | Cuenta → Registro de cambios | La baja, la reactivación y el alta, con hora y administrador |

**Plan B:** el panel necesita red. Si A no entra, comprobar `/health` y que B sigue vendiendo. Si se olvidó la contraseña, repetir el paso 5 de la preparación: cierra las sesiones de ese usuario.

## 6. Cierre (opcional)

`npm --prefix pos-backend run report:stock` en pantalla: todo `ok`. Para repetir la demo, volver a los pasos 6–9 de la preparación.

## Ensayos

| Fecha | Dispositivos | Actos ok | Notas |
|---|---|---|---|
| 2026-11-22 | Emulador `pos_pixel` (Android 16) solo; sin iPhone | 1–5, sin los pasos de B (2.3, 2.4, 1.4 y 5.7) | Cobro $140.00 con cambio $60.00 y QR; "Sin conexión" en 12 s; 5 Hot dog sin red y "Agotado" en el sexto; reconexión en 14 s, 0 por enviar, reporte `ok`; panel: 30 ventas de "Caja 2 (demo)" ($3020.00), "Todo cuadra", 37 préstamos sin diferencias, baja y reactivación, alta de producto y registro de cambios. Hallado: el emulador estaba en UTC y "Hoy" mostraba 16 de 30 ventas (paso 4 de preparación); quedaban 6 teléfonos viejos en "Por teléfono" (ahora `demo:reset` los borra) |
