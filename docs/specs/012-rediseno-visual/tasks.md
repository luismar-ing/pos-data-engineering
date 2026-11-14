# SPEC-012 — Tareas

Rama: `spec/012-rediseno-visual`

- [x] **T1** [app] Instalar `expo-font`, `@expo-google-fonts/barlow` y `@expo-google-fonts/barlow-semi-condensed` con `npx expo install`; `App.tsx` espera fuentes y BD — *Verificación:* la app abre en el emulador sin red con Barlow visible; `tsc` sin errores
- [x] **T2** [app] `theme.ts`, `AppText`, `Button`, `Pill`, `TextField`, `Card`, `ScreenHeader`, `Icon` (depende de T1) — *Verificación:* `tsc` sin errores; cada componente usado en T3
- [x] **T3** [app] `RootNavigator` sin cabecera, con iconos, tema e insets; `OfflineBanner` amarillo (depende de T2) — *Verificación:* emulador: las 4 pestañas con icono y activa en azul; sin red la franja se ve en todas (CA-7, parte)
- [x] **T4** [app] `categoriesOf` y `filterProducts` en `cart.ts`, con pruebas en `test/cart.test.mjs` — *Verificación:* `npm test` pasa con los casos de CA-2
- [x] **T5** [app] Extraer `getRunout` y añadir `getLowStockIds` en `analyticsRepository.ts` — *Verificación:* `npm test` pasa; el Dashboard muestra lo mismo que antes en el emulador
- [x] **T6** [app] Venta: `ScreenHeader` con pastilla de red, buscador, `CategoryFilter`, cuadrícula de `ProductTile`, `CartBar` (depende de T2, T4, T5) — *Verificación:* emulador: CA-1, CA-2, CA-3, CA-4 y por agotarse en amarillo (CA-8, parte)
- [x] **T7** [app] Hoja de cobro con líneas, métodos, efectivo, cambio y confirmación con QR directo; `CartPanel` y `ReceiptQr` con nuevo estilo (depende de T6) — *Verificación:* emulador: CA-5 y CA-6; el QR se lee con la cámara de otro teléfono
- [x] **T8** [app] Inventario por categoría, cifras grandes, por agotarse y "Actualizar" deshabilitado sin red (depende de T2, T5) — *Verificación:* emulador: RF-19, RF-20 y CA-7 (Actualizar) y CA-8 (Inventario)
- [x] **T9** [app] Dashboard con el nuevo estilo (depende de T2) — *Verificación:* emulador: RF-21..RF-23 y CA-8 (Dashboard)
- [x] **T10** [app] Ajustes y Abrir sesión con el nuevo estilo (depende de T2) — *Verificación:* emulador: CA-9 y CA-10
- [x] **T11** [app] Pasada de calidad: letra al 130 %, pantalla de 360 px, zonas táctiles, etiquetas de accesibilidad y recorrido sin red completo (depende de T3–T10) — *Verificación:* CA-7 y CA-13 en emulador; `npm test` y `tsc --noEmit` pasan (CA-11)
- [x] **T12** [app] Prueba en teléfono físico: cobro sin red < 100 ms, recorrido de las pantallas y lectura del QR con la cámara de otro teléfono (depende de T11) — *Verificación:* CA-12 con el log `Cobro registrado en N ms`; CA-6 (QR)
  - *Resultado (2026-11-10, en el emulador `pos_pixel` por decisión del usuario, no en teléfono físico):* 7 cobros en modo avión en 76–104 ms (mediana 86). La versión previa al rediseño (`8a6e2ec`), medida en el mismo emulador, tardó 97–206 ms: el rediseño no hace más lento el cobro. Las primeras mediciones (356–639 ms) se tomaron con el emulador recién arrancado y se descartaron. Venta, Inventario, Dashboard y Ajustes se ven bien sin red. Confirmación completa (CA-6). El QR se decodificó desde capturas con `jsqr` (el emulador no tiene cámara): texto en formato SPEC-010, 235 bytes. Al volver la red se sincronizaron 12 ventas y `report:stock` dio `ok`.
- [x] **T13** [docs] Cerrar spec: criterios verificados, `PROGRESS.md`, `DEVLOG.md`, `TECH_DEBT.md` (si queda deuda) y estado Done en la spec, el índice y el ROADMAP
