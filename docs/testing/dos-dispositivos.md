# Prueba: corte de red con dos dispositivos (SPEC-011)

Comprueba que dos dispositivos que pierden la red no venden más que el stock, y que al volver la red todo sincroniza una sola vez. Dispositivos: el emulador `pos_pixel` y un teléfono con Expo Go (SPEC-011 P1).

Resultado esperado al final: **"Hot dog" vendido 10 de 10, sin ventas duplicadas, y `report:stock` en `ok` después de cada paso.**

## 1. Preparar

1. Postgres: `docker start pos-de-db`.
2. `.env.local` de `pos-app`: activar la línea con la IP de la PC en la red actual (la de UABC o la de casa). El teléfono no llega a `10.0.2.2`.
3. Backend y Metro: `npm run dev` en `pos-backend` y `npx expo start` en `pos-app` (o `backend` y `metro` de `.claude/launch.json`).
4. Emulador: `emulator -avd pos_pixel -no-boot-anim -no-audio -gpu host`.
5. Reiniciar el escenario (borra préstamos, ventas, eventos y sesiones de la base de desarrollo; deja "Hot dog" en 10):

   ```bash
   npm --prefix pos-backend run scenario:reset
   ```

6. Borrar los datos locales de la app en los dos dispositivos. Los préstamos guardados en el teléfono ya no existen en el servidor.
   - Emulador: `adb -s emulator-5554 shell pm clear host.exp.exponent`
   - Teléfono Android: Ajustes → Apps → Expo Go → Almacenamiento → Borrar datos.
   - iPhone: borrar Expo Go y volver a instalarlo (iOS no tiene "Borrar datos").
7. Abrir la app en los dos: `exp://<IP>:8081` (emulador: `adb shell am start -a android.intent.action.VIEW -d exp://<IP>:8081`; teléfono: escanear el QR de Metro).

Comprobar el estado en cualquier momento:

```bash
npm --prefix pos-backend run report:stock
```

Termina con código 1 si un producto sale inconsistente. Los productos que no son "Hot dog" también deben salir `ok`.

## 2. Pasos

| # | Dónde | Acción | Esperado | Cubre |
|---|---|---|---|---|
| 1 | Los dos | Abrir sesión (emulador "A", teléfono "B") | Venta muestra "Hot dog · Quedan 5" en cada uno. Reporte: central 0, prestado 10, `ok` | — |
| 2 | Emulador | Modo avión: `adb -s emulator-5554 shell cmd connectivity airplane-mode enable` | Franja "Sin conexión" en ≤ 25 s (sondeo cada 15 s + 3 s de espera) | — |
| 3 | Emulador | Vender 2 Hot dog (dos cobros de 1) | "Quedan 3"; los cobros funcionan sin red | — |
| 4 | Teléfono (con red) | Vender 5 Hot dog | Tras la quinta, "Agotado": pide más préstamo y no recibe nada, porque las 3 del emulador siguen congeladas. Si el préstamo se renueva antes (dura 3 min), aparece uno cerrado con 0 vendidas: es normal y la cuenta sigue cuadrando | CA-3 |
| 5 | Teléfono | Modo avión | "Sin conexión" | — |
| 6 | Emulador | Vender 3 Hot dog e intentar una cuarta | "Agotado"; no deja agregar la sexta unidad de su préstamo | CA-1 |
| 7 | Los dos | Quitar modo avión (`… airplane-mode disable`) | En ≤ 30 s, Ajustes: Pendientes 0. Reporte: vendido sync 10, `ok` | CA-1, CA-2 |
| 8 | Los dos | Cerrar sesión con red | Reporte: prestado 0, informado 10, vendido sync 10, `ok` | CA-4 |

Si el modo avión no corta la red del emulador, usar `adb -s emulator-5554 shell svc wifi disable` y `svc data disable` (y `enable` para volver).

## 3. Corridas

| Fecha | Dispositivos | Pasos ok | Vendido sync / stock | Reporte final | Notas |
|---|---|---|---|---|---|
| 2026-11-06 | Emulador `pos_pixel` (Android 16) + iPhone 14 Pro | 8/8 | 10 / 10 (6 ventas, sin duplicados) | 5 productos `ok`, 0 préstamos activos | "Sin conexión" en 21 s; el emulador sincronizó 20 s después de volver la red; el teléfono renovó su préstamo una vez antes de vender |
