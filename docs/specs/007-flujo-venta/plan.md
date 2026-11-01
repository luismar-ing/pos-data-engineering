# SPEC-007 — Plan técnico

## 1. Enfoque
- **Sin cambios de esquema ni de contrato.** Las ventas ya se guardan con `createSale` (SPEC-001/003). `payment_method` ya es texto libre en ambos lados; la app solo envía `cash`, `card` o `transfer`.
- **El carrito guarda solo `{ productId, quantity }`** (P4). El precio y el nombre se toman del catálogo local cada vez que se pinta. Así el carrito siempre muestra el precio vigente y no hay copias que se desfasen.
- **`createSale` toma el precio de la BD dentro de su transacción.** Ya no lo recibe de la pantalla. En la misma transacción que lee la sesión abierta, consulta `products` por los ids del carrito. Si alguno no existe o está inactivo, lanza `ProductUnavailableError` y no escribe nada (RF-9, CA-7). Esto cierra la carrera entre "actualizar catálogo" y "cobrar": la transacción exclusiva las serializa (SPEC-004 §7).
- **Lógica pura y probada** en `features/sales/domain/cart.ts`:
  - `addProduct`, `changeQuantity` y `removeLine` sobre el arreglo de líneas;
  - `priceCart(lines, productsById)`, que da las líneas con nombre y subtotal, el total y los ids no disponibles;
  - `matchesSearch(name, query)`, que no distingue mayúsculas ni acentos (`normalize('NFD')` y quitar `[̀-ͯ]`).
- **Dinero en `shared/utils/money.ts`:**
  - `formatCents(cents)`, que ya usaba Inventario y se mueve aquí;
  - `parseMoneyToCents(text)`, que acepta "100", "100.5" y "100,50"; con texto inválido devuelve `null`;
  - `computeChangeCents(total, received)`.
- **Un cobro, una venta (RF-8).** Un `useRef` marca el cobro en curso: el estado de React es asíncrono y no frena dos toques en el mismo frame. Además el botón se deshabilita mientras dura.
- **Pantalla Venta**, en tres piezas dentro de `features/sales/ui/`:
  - `SaleScreen`: sesión, buscador y `FlatList` de productos;
  - `CartPanel`: líneas con − / +, total, "Vaciar" y "Cobrar";
  - `CheckoutModal`: método de pago, monto recibido y cambio si es efectivo, "Confirmar". Tras cobrar muestra la confirmación con "Nueva venta".
- **Líneas no disponibles:** si un producto del carrito se da de baja al actualizar el catálogo, su línea muestra "No disponible" y "Cobrar" queda deshabilitado hasta quitarla. El chequeo en `createSale` cubre el caso de que la baja llegue durante el cobro.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `SaleScreen.tsx` | `getAllProducts()` al enfocar y cuando cambia `catalogSyncedAt` (igual que Inventario); `TextInput` + `matchesSearch` en un `useMemo` |
| RF-2 | `cart.ts` → `addProduct` | Si la línea existe, `quantity + 1` (máx. 999); si no, la agrega con 1. Cierra TD-016 |
| RF-3 | `cart.ts` → `changeQuantity`, `removeLine` | Cantidad acotada a [0, 999]; en 0 se quita la línea |
| RF-4 | `cart.ts` → `priceCart`; `CartPanel.tsx` | Subtotales y total en centavos enteros con el precio del catálogo local |
| RF-5 | `CartPanel.tsx` | "Vaciar" con `Alert` de confirmación → `clearCart()` |
| RF-6 | `CheckoutModal.tsx` | "Confirmar" deshabilitado sin método elegido o, en efectivo, con monto recibido < total |
| RF-7 | `saleRepository.ts` → `createSale` | Transacción existente; al terminar bien, `clearCart()` |
| RF-8 | `CheckoutModal.tsx` | `useRef` de cobro en curso + botón deshabilitado |
| RF-9 | `createSale` + `CheckoutModal.tsx` | Errores (`NoOpenSessionError`, `ProductUnavailableError`, BD) → `Alert`; la transacción hace rollback y el carrito no se toca |
| RF-10 | `CheckoutModal.tsx` | Vista de confirmación: total, método, `sale.id.slice(0, 8)`; "Nueva venta" cierra el modal |
| RF-11 | `SaleScreen.tsx` | Se quita "Venta de prueba" (TD-023) |
| RNF-1 | — | Cobro = una transacción local, sin red. Se mide a mano con un log en `__DEV__` |
| RNF-2 | `SaleScreen.tsx` | Nombres normalizados una vez por carga (`useMemo`), `FlatList` con `keyExtractor` |
| RNF-3 | UI | `accessibilityLabel` en − / + / quitar / cobrar; `minWidth`/`minHeight` 44 |
| RNF-4 | `test/cart.test.mjs` | §6 |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/features/sales/domain/cart.ts` | Crear | `CartLine`, `MAX_QUANTITY = 999`, `PAYMENT_METHODS`, `addProduct`, `changeQuantity`, `removeLine`, `priceCart`, `matchesSearch` |
| `src/shared/utils/money.ts` | Crear | `formatCents`, `parseMoneyToCents`, `computeChangeCents` |
| `src/shared/store/sessionStore.ts` | Modificar | `cart: CartLine[]`; `addToCart(productId)`, `changeCartQuantity(productId, delta)`, `removeFromCart(productId)`, `clearCart()` usando `cart.ts`. Se quita `CartItem` con `unitPrice` |
| `src/features/sales/data/saleRepository.ts` | Modificar | `CreateSaleInput.lines: { productId, quantity }[]`; dentro de la transacción lee precio y `active` de `products`; `ProductUnavailableError`. El cálculo de líneas y total pasa a hacerse ahí con `validateSaleLines` y `computeTotalCents` (sin cambios) |
| `src/features/sales/ui/SaleScreen.tsx` | Reescribir | Buscador + lista + `CartPanel`; sin "Venta de prueba" |
| `src/features/sales/ui/CartPanel.tsx` | Crear | Líneas, total, Vaciar, Cobrar |
| `src/features/sales/ui/CheckoutModal.tsx` | Crear | Método de pago, monto recibido y cambio, confirmación |
| `src/features/inventory/ui/InventoryScreen.tsx` | Modificar | Usa `formatCents` de `shared/utils/money.ts` |
| `test/cart.test.mjs` | Crear | §6 |

### pos-backend
Sin cambios.

## 4. Modelo de datos y migraciones
Sin cambios. Consulta nueva dentro de `createSale`, con un `?` por id del carrito:
```sql
select id, unit_price_cents, active from products where id in (?, ?, …)
```

## 5. Contratos HTTP
Sin cambios.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria (`node:test`) | `addProduct` agrega y suma; tope en 999 | RF-2, CA-1 |
| Unitaria | `changeQuantity` baja a 0 y quita; no pasa de 999; `removeLine` | RF-3, CA-2 |
| Unitaria | `priceCart`: subtotales, total entero, ids no disponibles fuera del total | RF-4, CA-1, CA-7 |
| Unitaria | `matchesSearch("Cerveza 355 ml", "cer")`, mayúsculas, acentos ("Café" ↔ "cafe"), consulta vacía | CA-3 |
| Unitaria | `parseMoneyToCents` ("100", "100.5", "100,50", "abc", "-1", "1.234") y `computeChangeCents(6700, 10000) = 3300` | CA-6 |
| Manual (teléfono) | CA-1..CA-8 uno por uno; CA-4 en modo avión con el tiempo del log; CA-5 tocando rápido; CA-7 desactivando un producto en `posde` con el backend arrancado | CA-1..CA-8 |
| Manual (BD local) | Tras CA-4: la venta tiene líneas con el precio del catálogo y un `sale_created` | CA-4 |

La lectura de precios dentro de `createSale` usa expo-sqlite y no se prueba con `node:sqlite`. Se cubre a mano con CA-7.

## 7. Riesgos y alternativas descartadas
- **Guardar el precio en el carrito al agregar:** descartado por P4. El carrito mostraría un precio y se cobraría otro.
- **Persistir el carrito en SQLite:** descartado por P3. Es más esquema y más código para un carrito que dura segundos.
- **Pantalla aparte para el carrito:** descartado por P5. El modal de cobro basta para confirmar.
- **Riesgo:** sin leases (SPEC-005) se puede vender más de lo que hay en stock. Es lo esperado en esta fase; SPEC-005 agrega el bloqueo por cuota.
- **Riesgo:** con muchas líneas, el `in (…)` puede crecer. El carrito real tiene decenas de líneas, lejos del límite de parámetros de SQLite.

## 8. Chequeo de constitución
- [x] Nunca sobrevender: aún no hay leases; el bloqueo por cuota es de SPEC-005 (anotado en fuera de alcance).
- [x] Offline-first: el cobro solo escribe en SQLite local.
- [x] Eventos inmutables: se reusa el `sale_created` existente, solo inserción.
- [x] Idempotencia: el id de la venta es el id del evento (sin cambios); un toque, una venta.
- [x] UI fluida: filtro memorizado, consultas async, cobro en una transacción.
- [x] Contratos documentados: sin rutas nuevas.
