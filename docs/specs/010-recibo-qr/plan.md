# SPEC-010 — Plan técnico

## 1. Enfoque

### Solo app, solo lectura
El recibo se arma con tablas que ya existen: `sales`, `sale_items`, `products`, `sessions` y `settings`. No cambia el esquema ni el backend, y no se escribe ningún dato (RF-11). No hay contratos HTTP nuevos.

### Dos dependencias nuevas
- `react-native-svg`: incluida en Expo Go SDK 58 (doc v58: `inExpoGo: true`, versión recomendada 15.16.0). Se instala con `npx expo install react-native-svg`.
- `react-native-qrcode-svg` 6.3.54: un componente `<QRCode>` que dibuja el código con SVG. Depende de `qrcode` 1.5, que codifica el texto en modo byte como UTF-8 (P5). Trae sus tipos (`index.d.ts`).

El QR se genera en el teléfono, sin red (RF-9). Se usa corrección de errores **L**: la pantalla no tiene manchas ni roturas, y L da los módulos más grandes para el mismo texto. Con 1 000 bytes el código queda cerca de la versión 22 (105 × 105 módulos). En 320 pt de ancho son unos 3 pt por módulo. RNF-2 lo confirma en el teléfono (P2).

### Armado del recibo en TypeScript puro
`features/sales/domain/receipt.ts`, sin imports de Expo, para probarlo con `node --test` como el carrito:

- `RECEIPT_MAX_BYTES = 1000` (P2), `RECEIPT_NAME_MAX = 24` (P4).
- `truncateName(name)`: hasta 24 caracteres; si se recorta, el 24.º es "…". Cuenta caracteres con `Array.from`, para no partir una tilde ni un emoji.
- `formatReceiptDate(iso)`: `dd/mm/aaaa hh:mm` en hora local, con getters de `Date` (sin `Intl`).
- `utf8Bytes(text)`: `new TextEncoder().encode(text).length`. Hay `TextEncoder` en Hermes y en Node.
- `buildReceiptText(data)` arma el texto en el orden de RF-2:

```
POS-DE · Caja 3
05/11/2026 14:32
Venta 1a2b3c4d
1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d
Vendedor: Ana
------------------------
2 x Agua $30.00
1 x Papas $25.00
… y 3 productos más $90.00
------------------------
TOTAL $145.00
Efectivo
```

Reglas de `buildReceiptText`:
- **Montos:** salen de `formatCents`. El subtotal es `quantity × unit_price_cents` guardado y el total es `sales.total_cents` (RF-3).
- **Método de pago:** se muestra con la etiqueta de `PAYMENT_METHODS`. Si el valor no está en la lista, va el valor tal cual.
- **Recorte de nombres:** el nombre del dispositivo y el del vendedor también pasan por `truncateName`, así ninguno de los dos puede comerse el espacio de las líneas.
- **Corte por tamaño (RF-5, RF-6):** las líneas entran en el orden del carrito. Antes de añadir la línea *i*, se mide encabezado + líneas 0..*i* + línea "… y N productos más" por lo que sobra + pie. Si se pasa de 1 000 bytes, se para ahí y se pone la línea "… y N" con la suma de los subtotales que faltan. Si todas caben, no lleva esa línea. Es un solo recorrido, O(n).
- **Plural:** con N = 1 dice "… y 1 producto más".

### Lectura de datos
`features/sales/data/receiptSql.ts`, sin imports, probado con `node:sqlite`:
- `RECEIPT_SALE_SQL`: venta + `seller_name` de su sesión (`left join sessions`), por id.
- `RECEIPT_ITEMS_SQL`: `quantity`, `unit_price_cents` y `products.name` de sus líneas, `order by sale_items.rowid` (orden del carrito: se insertan en ese orden).

`features/sales/data/receiptRepository.ts` → `getReceiptText(saleId)`:
- corre las dos consultas;
- toma el nombre del dispositivo de `getDeviceIdentity()`;
- llama a `buildReceiptText`;
- en `__DEV__` deja en el log los ms y bytes (CA-6).

Una venta anterior a SPEC-003 no tiene sesión. En ese caso el vendedor sale como "—".

### Pantalla
`features/sales/ui/ReceiptQr.tsx` muestra el QR y, encima, el total y el identificador corto (RF-8):
- `<QRCode value={text} ecl="L" size={…} quietZone={16} backgroundColor="#fff" color="#000">`;
- el tamaño es el ancho de la pantalla − 48, con un tope de 360;
- tiene `accessibilityLabel` "Código QR del recibo de la venta 1a2b3c4d" (RNF-4).

`CheckoutModal`, cuando la venta ya está registrada (`done`), cambia así:
- nuevo botón "Recibo QR" junto a "Nueva venta";
- al tocarlo llama a `getReceiptText(done.sale.id)` y guarda el texto en el estado `receipt`. Mientras lo arma, el botón muestra "Generando…";
- con `receipt`, la hoja muestra `ReceiptQr` y un botón "Volver", que pone `receipt = null` y vuelve a la confirmación (RF-10);
- `close()` también limpia `receipt`, así la siguiente venta empieza sin QR (CA-7);
- si `getReceiptText` falla, aparece `Alert` "No se pudo generar el recibo" y la venta no se toca.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `receiptSql.ts`, `receiptRepository.ts` | Solo SQLite local y `getDeviceIdentity` |
| RF-2 | `receipt.ts` → `buildReceiptText` | Orden fijo de §1 |
| RF-3 | `buildReceiptText`, `formatCents` | `unit_price_cents` y `total_cents` guardados |
| RF-4 | `buildReceiptText` | Texto plano UTF-8, sin compresión (P1) |
| RF-5, RF-6 | `buildReceiptText` | Corte a `RECEIPT_MAX_BYTES` con "… y N productos más" |
| RF-7 | `truncateName` | 24 caracteres con "…" |
| RF-8 | `ReceiptQr.tsx`, `CheckoutModal` | Botón "Recibo QR", QR grande, fondo blanco, margen, total e id corto |
| RF-9 | `react-native-qrcode-svg` | Generado en el teléfono |
| RF-10 | `CheckoutModal` | "Volver" y `close()` limpian `receipt` |
| RF-11 | `receiptRepository.ts` | Solo `select` |
| RNF-1 | `receiptRepository.ts` (log `__DEV__`) | Medido en teléfono |
| RNF-2, RNF-3 | ECC L, `quietZone`, UTF-8 | Prueba manual con Android e iOS |
| RNF-4 | `ReceiptQr.tsx`, `CheckoutModal` | `accessibilityLabel`, botones de 48 pt |
| RNF-5 | `test/receipt.test.mjs` | §6 |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `package.json` | Modificar | `react-native-svg` (con `npx expo install`), `react-native-qrcode-svg` |
| `src/features/sales/domain/receipt.ts` | Crear | Constantes, `truncateName`, `formatReceiptDate`, `utf8Bytes`, `buildReceiptText` |
| `src/features/sales/data/receiptSql.ts` | Crear | `RECEIPT_SALE_SQL`, `RECEIPT_ITEMS_SQL` |
| `src/features/sales/data/receiptRepository.ts` | Crear | `getReceiptText(saleId)` |
| `src/features/sales/ui/ReceiptQr.tsx` | Crear | Vista del QR |
| `src/features/sales/ui/CheckoutModal.tsx` | Modificar | Botón "Recibo QR", estado `receipt`, "Volver" |
| `test/receipt.test.mjs` | Crear | §6 |

### pos-backend
Sin cambios.

### docs (al cerrar)
| Archivo | Detalle |
|---|---|
| `TECH_DEBT.md` | R-03 a resueltos (máximo de 1 000 bytes y corte por líneas) |
| `ARCHITECTURE.md` | Recibo QR en la capa de dominio de la app; sin contratos nuevos |
| `PROGRESS.md`, `DEVLOG.md` | Cierre |

## 4. Modelo de datos y migraciones
Sin cambios. Sin migración nueva.

## 5. Contratos HTTP
Ninguno.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria | El texto tiene encabezado, fecha, id corto y completo, vendedor, líneas, total y método, en ese orden | CA-1 |
| Unitaria | Subtotales y total salen de los centavos guardados, aunque el precio del catálogo cambie después | CA-2 |
| Unitaria | 200 líneas: no pasa de 1 000 bytes, cierra con "… y N productos más" por la suma exacta de lo que falta, el total es el de la venta y "1 producto más" en singular | CA-3 |
| Unitaria | Nombres con tildes, ñ y emoji, en 30, 24 y 10 caracteres: se recortan a 24 con "…" sin partir caracteres; el recibo nunca pasa de 1 000 bytes contando UTF-8 | CA-4, CA-5 |
| Unitaria (`node:sqlite`) | `RECEIPT_*_SQL` con las migraciones reales: líneas en orden de inserción con su nombre, vendedor de la sesión, venta sin sesión; la bitácora no cambia | CA-1, CA-6 |
| Manual (teléfono) | Venta sin red, QR leído con la cámara nativa de otro teléfono Android y uno iOS, también sin red; recibo de máximo tamaño a ~30 cm; tildes; < 500 ms en el log; "Volver" y "Nueva venta" | CA-1, CA-3, CA-5, CA-6, CA-7 |

`tsc --noEmit` sin errores y `npm test` en verde.

## 7. Riesgos y alternativas descartadas
- **Un QR de 1 000 bytes no se lee desde la pantalla:** se baja `RECEIPT_MAX_BYTES` (una constante) según la prueba en teléfono, y se anota en la sección Cambios de la spec.
- **Una cámara no decodifica UTF-8:** se anota en `TECH_DEBT.md` (P5).
- **Descartado: `qrcode` más un `<Path>` propio.** Ahorra una dependencia chica, pero hay que escribir y mantener el dibujo de la matriz; `react-native-qrcode-svg` ya lo hace.
- **Descartado: texto comprimido (deflate + base64).** Entra más, pero la cámara del cliente no lo lee (P1).
- **Descartado: QR dibujado con `View` por módulo.** ~11 000 vistas para la versión 22: lento de montar.
- **Descartado: guardar el texto del recibo en la BD.** Se arma de nuevo de datos inmutables; guardarlo duplica datos sin beneficio.

## 8. Chequeo de constitución
- [x] Nunca sobrevender: no toca cuota ni préstamos.
- [x] Offline-first: todo sale de SQLite local; el QR se genera en el teléfono.
- [x] Eventos inmutables: solo lectura; no escribe en `event_log`.
- [x] Idempotencia: no genera eventos.
- [x] UI fluida: consultas `async`, fuera del render; un QR por toque.
- [x] Contratos documentados: no hay rutas HTTP nuevas.
