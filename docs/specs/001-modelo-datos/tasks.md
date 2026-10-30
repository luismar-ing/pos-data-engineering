# SPEC-001 — Tareas

Rama: `spec/001-modelo-datos` (monorepo).

### pos-app
- [x] **T1** [app] Limpiar imports sin uso de `App.tsx` (el cambio de `index.ts` ya se commiteó en `be8a1c8`) — *Verificación:* `tsc --noEmit` ok
- [x] **T2** [app] Crear `core/db/migrations.ts` con la migración 1 del plan — *Verificación:* `tsc --noEmit` ok
- [x] **T3** [app] Reescribir `database.ts`: `foreign_keys = ON`, aplicar migraciones por `user_version` en transacción; borrar `schema.ts` (depende de T2) — *Verificación:* CA-1, CA-2 ✅ con `node:sqlite` partiendo del esquema viejo
- [x] **T4** [app] Actualizar `productRepository.ts` a APIs async y `unit_price_cents` (depende de T3) — *Verificación:* CA-3 ✅
- [x] **T5** [app] Instalar generador de UUID compatible con Expo 57 y crear `features/sales/data/saleRepository.ts` con `createSale` atómico (depende de T3) — *Verificación:* CA-4, CA-6 ✅ (SQL y reglas; falta probar en dispositivo, ver T11)

### pos-backend
- [x] **T6** [backend] Crear `db/migrations/0001..0003` y aplicarlos en la BD de Docker — *Verificación:* ✅ el contenedor `pos-de-db` (compose.yaml en la raíz) los aplica al crearse; tablas y 5 productos semilla presentes
- [x] **T7** [backend] Adaptar `rollingAverage.ts` a `sale_items` + `sales` — *Verificación:* ✅ `POST /prestamos/request` devuelve `qty_total: 5`
- [x] **T8** [backend] Adaptar `sync.ts` a la nueva forma de evento, insertando venta + líneas en una transacción — *Verificación:* ✅ CA-5: 1er envío `inserted: 1`, 2º `duplicated: 1`; quedan 1 venta, 3 líneas, total 30; body inválido ⇒ 400
- [x] **T9** [backend] Eliminar `db/schema.sql` (depende de T6)

### Cierre
- [x] **T10** [docs] Actualizar `ARCHITECTURE.md` §4–5, `TECH_DEBT.md`, `PROGRESS.md` y `DEVLOG.md` (estado → Done)
- [x] **T11** [app] Abrir la app en emulador/dispositivo y confirmar que no hay errores de BD en consola — *Verificación:* ✅ abre en teléfono con Expo Go (SDK 58): 4 pestañas, sin errores de BD (2026-10-30)
