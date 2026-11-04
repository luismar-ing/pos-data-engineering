# SPEC-005 — Tareas

Rama: `spec/005-stock-leasing` (monorepo). `pos-backend` y `pos-app`.

### Contratos
- [x] **T1** [docs] Copiar los contratos de plan §5 (`POST /prestamos/request`, `POST /prestamos/close`, `INVALID_QUOTA_USED`, `LEASE_NOT_FOUND`) a `ARCHITECTURE.md` §5, antes del código (constitución, principio 7) — *Verificación:* la tabla de rutas y la de códigos de error los incluyen

### pos-backend
- [x] **T2** [backend] Migración `0005_lease_lifecycle.sql` (plan §4) — *Verificación:* `npm run db:migrate` la aplica en `posde`; `npm test` sigue verde (`migrate.test.ts`)
- [x] **T3** [backend] `services/leaseService.ts`: `LEASE_PARAMS`, `calculateLeaseQty` pura, `issueLease`, `closeLease`; borrar `rollingAverage.ts` (depende de T2) — *Verificación:* pruebas unitarias de `calculateLeaseQty` verdes (RF-2); `typecheck` ok
- [x] **T4** [backend] `routes/prestamos.ts`: `POST /request` y `POST /close` con `zod`, una transacción por petición y productos en orden de id; reescribir `test/lease.test.ts` con los casos de plan §6 (depende de T3) — *Verificación:* `npm test` verde, incluida la prueba concurrente (CA-1, CA-2, CA-5, CA-6, CA-8, CA-10, P6); `typecheck` ok

### pos-app
- [x] **T5** [app] Migración local v3 (plan §4) + `features/leases/domain/leasePolicy.ts` (`isLeaseDue`, `chunk`) + `features/leases/data/leaseRepository.ts` con su SQL exportado; `test/leases.test.mjs` — *Verificación:* `npm test` verde: v3, un activo por producto, `closing` no vende, `isLeaseDue` (RF-6, RF-10, RF-13)
- [x] **T6** [app] `createSale` descuenta cuota con `CONSUME_QUOTA_SQL` y lanza `InsufficientQuotaError`; `cart.ts` con tope por disponible (depende de T5) — *Verificación:* `npm test` verde: descuento sin pasar del total y tope del carrito (RF-7, RF-8, CA-3, CA-4); `tsc` ok
- [x] **T7** [app] `features/leases/data/leaseSync.ts` (ciclo de plan §1) + `leasesUpdatedAt` en el store; disparos en `App.tsx` (`onReconnect`, cada 30 s), `OpenSessionForm`, `SettingsScreen` y tras cobrar (depende de T4, T5) — *Verificación:* `tsc` ok; `npm test` sigue verde
- [x] **T8** [app] UI: "Quedan N" / "Agotado" en Venta, + del carrito hasta lo disponible, mensaje de `InsufficientQuotaError` en el cobro, columna "Disponible" en Inventario (depende de T6, T7) — *Verificación:* `tsc` ok; `npx expo-doctor` sin errores nuevos

### Verificación en dispositivo
- [x] **T9** [app] Probar en el teléfono con Expo Go y el backend arrancado (depende de T4, T8) — *Verificación:* CA-3, CA-4, CA-7 y CA-8 con Wi-Fi y datos apagados; en `posde`, `central_stock` y `stock_leases` cuadran tras renovar y cerrar sesión (CA-5, CA-7)
- [ ] ~~**T10**~~ *Omitida por decisión del usuario (2026-11-03); pendiente en TD-027, fase 4.* [app] Probar con dos dispositivos (teléfono + emulador u otro teléfono) (depende de T9) — *Verificación:* CA-9: los dos sin red venden todo lo que pueden; la suma vendida localmente no supera el stock central inicial

### Cierre
- [x] **T11** [docs] `ARCHITECTURE.md` (flujos 3.1, 3.2 y 3.4, modelo de datos); `GLOSSARY.md` (`rollingAverage` → `leaseService`); `TECH_DEBT.md` (TD-007 y TD-008 resueltos; TD-009: el sync no descuenta stock; R-01 y R-02 resueltos; nueva deuda: cuota congelada de un teléfono perdido); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-10 revisados; `tsc --noEmit` sin errores y `npm test` verde en los dos repos
