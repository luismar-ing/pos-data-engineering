# SPEC-008 — Tareas

Rama: `spec/008-sync-etl` (monorepo). `pos-backend` y `pos-app`.

### Contratos
- [x] **T1** [docs] Copiar el contrato de plan §5 (`POST /sync/events` con `batch_id`, `sent_at`, tres tipos de evento y `results[]`) a `ARCHITECTURE.md` §5, antes del código (constitución, principio 7) — *Verificación:* la tabla de rutas y el bloque de request/response lo reflejan

### pos-backend
- [x] **T2** [backend] Migración `0006_sync_events_sessions.sql` (plan §4) — *Verificación:* `npm run db:migrate` la aplica en `posde`; las ventas existentes quedan en `sync_events`; `npm test` sigue verde
- [x] **T3** [backend] `services/syncService.ts` (esquemas por tipo, validación completa, una transacción por evento, `sync_events`, sesiones) + `routes/sync.ts` con el sobre nuevo; reescribir `test/sync.test.ts` con los casos de plan §6 (depende de T2) — *Verificación:* `npm test` verde (CA-2, CA-3, CA-5, CA-8, RF-8..RF-11); `typecheck` ok

### pos-app
- [x] **T4** [app] Migración local v4 + `core/sync/syncSql.ts` + `core/sync/syncBatch.ts` (`toWireEvent`, `fitBatch`); `test/sync.test.mjs` — *Verificación:* `npm test` verde: orden y límite de pendientes, marcado solo de `pending`, payload intacto, peso del lote (RF-1, RF-12, RF-13, RF-15, RNF-4)
- [x] **T5** [app] `core/sync/syncRepository.ts` + `core/sync/syncWorker.ts` (`syncEvents`) + `eventsSyncedAt` en el store; disparos en `App.tsx` (`onReconnect`, temporizador de 30 s), `CheckoutModal`, `OpenSessionForm` y cierre de sesión (depende de T3, T4) — *Verificación:* `tsc` ok; `npm test` sigue verde
- [x] **T6** [app] Ajustes: "Pendientes N · Fallidos N · Último envío HH:MM" y "Sincronizar ahora", deshabilitado sin conexión (depende de T5) — *Verificación:* `tsc` ok; `npx expo-doctor` sin errores nuevos

### Verificación en dispositivo
- [x] **T7** [app] Probar en el teléfono con Expo Go y el backend arrancado (depende de T3, T6) — *Verificación:* CA-1 (3 ventas sin red, luego red, < 30 s); CA-4 (detener el backend durante el envío y reintentar: sin duplicados en `posde`); CA-6 (cobrar con red); CA-7 (Ajustes y botón); CA-9 (500 eventos, < 30 s en el log)

### Cierre
- [x] **T8** [docs] `ARCHITECTURE.md` (flujo 3.3, modelo de datos: `sync_events`, `sessions`, `event_log.sync_error`); `TECH_DEBT.md` (TD-009 resuelto; nueva deuda: conciliación de préstamos con ventas, evento de más de 80 kB); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-9 revisados; `tsc --noEmit` sin errores y `npm test` verde en los dos repos
