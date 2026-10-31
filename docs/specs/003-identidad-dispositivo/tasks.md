# SPEC-003 — Tareas

Rama: `spec/003-identidad-dispositivo` (monorepo).

### pos-backend
- [x] **T1** [backend] Migración `0004_devices_auth.sql` (`token_hash`, FK `sales.device_id`, `sales.session_id`) — *Verificación:* `npm run db:migrate` en `posde` y `posde_test`; la 2.ª vez "nada pendiente"; insertar una venta con dispositivo inexistente falla por FK (CA-9)
- [x] **T2** [backend] `src/http/auth.ts` (`hashSecret`, `requireDevice`) y `POST /devices/register` (depende de T1) — *Verificación:* `test/devices.test.ts` verde: 201, reintento 200 sin duplicar, otro secreto 409, entrada inválida 400 (CA-3)
- [x] **T3** [backend] `requireDevice` en `/prestamos` y `/sync`; chequeo de `device_id` en sync; `session_id` en el esquema e `insert` de sync; ajustar `test/helpers.ts`, `errors.test.ts`, `sync.test.ts` (depende de T2) — *Verificación:* `npm test` verde con los casos 401 (CA-4) y 403 (CA-5); idempotencia (CA-9 de SPEC-002) sigue verde

### pos-app
- [x] **T4** [app] `npx expo install expo-secure-store expo-device`; `.env.example`; `src/core/config.ts` — *Verificación:* `npx tsc --noEmit` ok; `npx expo-doctor` sin errores nuevos
- [x] **T5** [app] Migración v2 (`settings`, `sessions`, `sales.session_id`) + `test/migrations.test.mjs` con `node:sqlite` (depende de T4) — *Verificación:* `npm test` verde: v1→v2 con una venta previa, segunda sesión abierta rechazada, reabrir tras cerrar
- [x] **T6** [app] `core/device/deviceIdentity.ts`, `core/api/client.ts`, `core/device/registration.ts` (depende de T5) — *Verificación:* `tsc` ok
- [x] **T7** [app] `sessionRepository.ts` (+ eventos `session_opened` / `session_closed`); `createSale` con dispositivo y sesión; `currentSession` en el store (depende de T6) — *Verificación:* `tsc` ok
- [x] **T8** [app] `SaleScreen` (+ botón "Venta de prueba" solo en `__DEV__`), `OpenSessionForm`, `SettingsScreen`; `RootNavigator` y `App.tsx` (depende de T7) — *Verificación:* `tsc` ok; la app abre en Expo Go sin errores

### Verificación en dispositivo
- [x] **T9** [app] Probar en el teléfono con Expo Go y el backend en la PC (depende de T3, T8) — *Verificación:* CA-1, CA-2, CA-6, CA-7, CA-8 y CA-10 uno por uno, incluido el caso sin red (modo avión)

### Cierre
- [x] **T10** [docs] `ARCHITECTURE.md` (`/devices/register`, autenticación, códigos 401/403/409, eventos de sesión, tablas nuevas); `TECH_DEBT.md` (TD-019 resuelto; anotar el botón de venta de prueba y la falta de reintento al recuperar red); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-10 revisados; `tsc --noEmit` sin errores en ambos repos
