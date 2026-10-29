# SPEC-001 — Tareas

Ramas: `spec/001-modelo-datos` en ambos repos.

### pos-app
- [ ] **T1** [app] Commitear o descartar el cambio pendiente en `index.ts` y limpiar imports de `App.tsx` — *Verificación:* `git status` limpio
- [ ] **T2** [app] Crear `core/db/migrations.ts` con la migración 1 del plan — *Verificación:* `tsc --noEmit` ok
- [ ] **T3** [app] Reescribir `database.ts`: `foreign_keys = ON`, aplicar migraciones por `user_version` en transacción; borrar `schema.ts` (depende de T2) — *Verificación:* CA-1, CA-2
- [ ] **T4** [app] Actualizar `productRepository.ts` a APIs async y `unit_price_cents` (depende de T3) — *Verificación:* CA-3
- [ ] **T5** [app] Instalar generador de UUID compatible con Expo 57 y crear `features/sales/data/saleRepository.ts` con `createSale` atómico (depende de T3) — *Verificación:* CA-4, CA-6

### pos-backend
- [ ] **T6** [backend] Crear `db/migrations/0001..0003` según el plan y aplicarlos a mano en la BD de Docker — *Verificación:* `\dt` muestra las tablas
- [ ] **T7** [backend] Adaptar `rollingAverage.ts` a `sale_items` + `sales` (depende de T6) — *Verificación:* `POST /prestamos/request` responde igual que antes con datos semilla
- [ ] **T8** [backend] Adaptar `sync.ts` a la nueva forma de evento, insertando venta + líneas en una transacción (depende de T6) — *Verificación:* CA-5 con `curl` ×2
- [ ] **T9** [backend] Eliminar `db/schema.sql` (depende de T6)

### Cierre
- [ ] **T10** [docs] Actualizar `ARCHITECTURE.md` §4–5, mover TD-001..006, 014 (parcial), 015, 017 a Resueltos, actualizar `PROGRESS.md` y `DEVLOG.md`, estado → Done
