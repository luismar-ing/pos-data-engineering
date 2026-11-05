# SPEC-010 — Tareas

Rama: `spec/010-recibo-qr` (monorepo). Solo `pos-app`.

### pos-app
- [x] **T1** [app] `features/sales/domain/receipt.ts` (`RECEIPT_MAX_BYTES`, `RECEIPT_NAME_MAX`, `truncateName`, `formatReceiptDate`, `utf8Bytes`, `buildReceiptText`) + `test/receipt.test.mjs` — *Verificación:* `npm test` verde con los casos unitarios de plan §6 (CA-1..CA-5): orden, montos guardados, corte con "… y N productos más" (singular y plural), recorte sin partir caracteres, nunca más de 1 000 bytes
- [x] **T2** [app] `features/sales/data/receiptSql.ts` (`RECEIPT_SALE_SQL`, `RECEIPT_ITEMS_SQL`) + casos `node:sqlite` en `test/receipt.test.mjs` — *Verificación:* `npm test` verde: líneas en orden de inserción con nombre, vendedor de la sesión, venta sin sesión, bitácora sin cambios (CA-1, CA-6)
- [x] **T3** [app] `features/sales/data/receiptRepository.ts` → `getReceiptText(saleId)`, con ms y bytes en el log en `__DEV__` (depende de T1, T2) — *Verificación:* `tsc` ok
- [x] **T4** [app] Instalar `react-native-svg` (`npx expo install`) y `react-native-qrcode-svg`; `ReceiptQr.tsx`; en `CheckoutModal`, botón "Recibo QR", estado `receipt`, "Volver" y limpieza en `close()`; etiquetas accesibles (depende de T3) — *Verificación:* `tsc` ok; `npx expo-doctor` sin errores nuevos

### Verificación en dispositivo
- [x] **T5** [app] Probar en el teléfono con Expo Go (depende de T4) — *Verificación:* CA-1..CA-7 sin red, leyendo el QR con la cámara nativa de un Android y un iOS; recibo de máximo tamaño a ~30 cm (si falla, bajar `RECEIPT_MAX_BYTES` y anotarlo en Cambios de la spec); < 500 ms en el log

### Cierre
- [x] **T6** [docs] `TECH_DEBT.md` (R-03 a resueltos; fallos de lectores, si hubo, como deuda); `ARCHITECTURE.md` (recibo QR en el dominio de la app, sin contratos nuevos); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-7 revisados; `tsc --noEmit` sin errores; `npm test` verde
