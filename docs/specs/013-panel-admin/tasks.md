# SPEC-013 — Tareas

Rama: `spec/013-panel-admin`

- [x] **T1** [docs] ADR-0007 "Autenticación de administrador": `scrypt` con sal, token opaco con SHA-256 y 8 h, credenciales separadas de las del dispositivo, bloqueo por usuario; alternativas JWT y bcrypt/argon2 — *Verificación:* `docs/adr/0007-*.md` y fila en `adr/README.md`
- [x] **T2** [docs] Copiar los contratos de plan §5 a `ARCHITECTURE.md` §5 (rutas 🔑, `INVALID_CREDENTIALS`) y el modelo de §4 a §4.2 — *Verificación:* las cuatro rutas `/admin/*` están en la tabla con estado "⬜ por implementar"
- [x] **T3** [backend] Migración `0007_admin.sql` y `initial_stock` en el seed — *Verificación:* `npm run db:migrate` sobre una base con préstamos; prueba de migración: `initial_stock` deja todo cuadrando (depende de T2)
- [x] **T4** [backend] `stockService.ts` con `initial_stock` (movido desde `dev/scenario.ts`); `resetScenario` fija `initial_stock`; `report:stock` sigue igual — *Verificación:* `npm test` (incluido `scenario.test.ts`) en verde (depende de T3)
- [x] **T5** [backend] `adminAuthService.ts`: `hashPassword`, `verifyPassword`, `setAdmin`; comando `npm run admin:set -- <usuario>` con `ADMIN_PASSWORD` — *Verificación:* pruebas unitarias del hash; crear un admin y ver en Postgres solo el hash (depende de T3)
- [x] **T6** [backend] `requireAdmin`; `requireDevice` actualiza `last_seen_at`; rutas `POST /admin/login` y `POST /admin/logout` con bloqueo `for update` y 401 genérico — *Verificación:* pruebas de login, fallos, bloqueo, bloqueo simultáneo, vencimiento, logout y credenciales cruzadas (CA-4, CA-5, CA-7, CA-8) (depende de T5)
- [x] **T7** [backend] `adminSalesService.ts` y `GET /admin/sales` — *Verificación:* prueba con dos dispositivos: cada desglose suma los totales (CA-9); validación de rango (depende de T6)
- [ ] **T8** [backend] `GET /admin/stock` sobre `stockService` — *Verificación:* tras el escenario de SPEC-011, coincide con `stockReport` y marca `ok` (CA-10) (depende de T4, T6)
- [ ] **T9** [backend] Prueba de rendimiento: 10 dispositivos, 2 000 productos, 10 000 ventas; `/admin/sales` y `/admin/stock` < 2 s — *Verificación:* `npm test` en verde y tiempos en el DEVLOG (RNF-6) (depende de T7, T8)
- [ ] **T10** [app] `admin/domain/role.ts` y `session.ts` con `test/admin.test.mjs` — *Verificación:* `npm test` en verde
- [ ] **T11** [app] `roleRepository.ts`, `adminSession.ts` (SecureStore), store (`role`, `adminSession`) y lectura al arrancar en `App.tsx` — *Verificación:* `npx tsc --noEmit`; al reabrir, el rol guardado se respeta (depende de T10)
- [ ] **T12** [app] `RoleSelectScreen` y `RootNavigator` por rol; "Cambiar de rol" en Ajustes, deshabilitado con sesión de vendedor abierta — *Verificación:* en el emulador, CA-1, CA-2 y CA-3 (depende de T11)
- [ ] **T13** [app] `adminApi.ts` y `AdminLoginScreen`: error genérico, deshabilitado sin red, un 401 vuelve al login — *Verificación:* en el emulador contra el backend local, CA-4 y CA-6 (depende de T6, T12)
- [ ] **T14** [app] Pestañas del panel: `AdminSalesScreen`, `AdminStockScreen`, `AdminAccountScreen` (cerrar sesión y cambiar de rol) con `shared/ui` — *Verificación:* en el emulador, Ventas y Stock con datos reales; Stock igual a `npm run report:stock` (CA-9, CA-10) (depende de T7, T8, T13)
- [ ] **T15** [app] Prueba con dos dispositivos: el iPhone cobra sin red mientras el emulador usa el panel; sesión de admin vencida a mano vuelve al login — *Verificación:* CA-7 y CA-11, anotados en el DEVLOG (depende de T14)
- [ ] **T16** [docs] Cerrar spec: criterios CA-1 a CA-11 verificados; `ARCHITECTURE.md` (rutas a "✅ implementado", flujo 3.8), `PROGRESS.md`, `DEVLOG.md`, `GLOSSARY.md`; en `TECH_DEBT.md`, HTTP sin cifrar y bloqueo solo por usuario; quality gates de `CONSTITUTION.md`
