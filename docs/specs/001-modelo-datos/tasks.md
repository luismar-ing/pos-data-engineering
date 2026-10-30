# SPEC-001 — Tareas

Rama: `spec/001-modelo-datos` (monorepo).

### pos-app
- [x] **T1** [app] Limpiar imports sin uso de `App.tsx` (el cambio de `index.ts` ya se commiteó en `be8a1c8`) — *Verificación:* `tsc --noEmit` ok
- [x] **T2** [app] Crear `core/db/migrations.ts` con la migración 1 del plan — *Verificación:* `tsc --noEmit` ok
- [x] **T3** [app] Reescribir `database.ts`: `foreign_keys = ON`, aplicar migraciones por `user_version` en transacción; borrar `schema.ts` (depende de T2) — *Verificación:* CA-1, CA-2 ✅ con `node:sqlite` partiendo del esquema viejo
- [x] **T4** [app] Actualizar `productRepository.ts` a APIs async y `unit_price_cents` (depende de T3) — *Verificación:* CA-3 ✅
- [x] **T5** [app] Instalar generador de UUID compatible con Expo 57 y crear `features/sales/data/saleRepository.ts` con `createSale` atómico (depende de T3) — *Verificación:* CA-4, CA-6 ✅ (SQL y reglas; falta probar en dispositivo, ver T11)

### pos-backend
- [ ] **T6** [backend] Crear `db/migrations/0001..0003` según el plan ✅ y aplicarlos en la BD de Docker ⏳ — *Verificación:* `\dt` muestra las tablas
- [ ] **T7** [backend] Adaptar `rollingAverage.ts` a `sale_items` + `sales` (código ✅, prueba ⏳) — *Verificación:* `POST /prestamos/request` responde con datos semilla
- [ ] **T8** [backend] Adaptar `sync.ts` a la nueva forma de evento, insertando venta + líneas en una transacción (código ✅, prueba ⏳) — *Verificación:* CA-5 con `curl` ×2
- [x] **T9** [backend] Eliminar `db/schema.sql` (depende de T6)

### Cierre
- [ ] **T10** [docs] Actualizar `ARCHITECTURE.md` §4–5 ✅, `TECH_DEBT.md` ✅, `PROGRESS.md` y `DEVLOG.md`, estado → Done
- [ ] **T11** [app] Abrir la app en emulador/dispositivo y confirmar que no hay errores de BD en consola (CA-1 en dispositivo real)
