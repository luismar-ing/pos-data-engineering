# SPEC-007 — Tareas

Rama: `spec/007-flujo-venta` (monorepo). Solo `pos-app`.

### pos-app
- [x] **T1** [app] `shared/utils/money.ts` (`formatCents`, `parseMoneyToCents`, `computeChangeCents`); Inventario usa `formatCents` — *Verificación:* `npm test` verde con los casos de dinero de plan §6 (CA-6); `tsc` ok
- [x] **T2** [app] `features/sales/domain/cart.ts` (`addProduct`, `changeQuantity`, `removeLine`, `priceCart`, `matchesSearch`, `PAYMENT_METHODS`) + `test/cart.test.mjs` — *Verificación:* `npm test` verde: sumar, tope 999, bajar a 0 quita, total, no disponibles, búsqueda sin acentos (CA-1..CA-3)
- [x] **T3** [app] Carrito en `sessionStore` con `cart.ts` (cierra TD-016 en lo del carrito) (depende de T2) — *Verificación:* `tsc` ok
- [x] **T4** [app] `createSale` con líneas `{ productId, quantity }`, precio y `active` leídos en la transacción, `ProductUnavailableError` (depende de T2) — *Verificación:* `tsc` ok; `npm test` sigue verde
- [x] **T5** [app] `SaleScreen` (buscador + lista), `CartPanel`, `CheckoutModal` (método, cambio, confirmación, un cobro = una venta); quitar "Venta de prueba" (depende de T1, T3, T4) — *Verificación:* `tsc` ok; `npx expo-doctor` sin errores nuevos

### Verificación en dispositivo
- [x] **T6** [app] Probar en el teléfono con Expo Go (depende de T5) — *Verificación:* CA-1..CA-8 uno por uno; CA-4 en modo avión con el tiempo del log (< 3 s); CA-7 con el backend arrancado, desactivando un producto en `posde` y actualizando el catálogo

### Cierre
- [x] **T7** [docs] `ARCHITECTURE.md` (flujo 3.1 con carrito y precio al cobrar); `TECH_DEBT.md` (TD-023 resuelto; TD-016 queda solo por `isOnline`); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-8 revisados; `tsc --noEmit` sin errores
