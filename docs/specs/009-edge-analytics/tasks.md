# SPEC-009 — Tareas

Rama: `spec/009-edge-analytics` (monorepo). Solo `pos-app`.

### pos-app
- [x] **T1** [app] Migración local v5 (índices de plan §4) + `features/analytics/data/analyticsSql.ts` (cinco consultas) — *Verificación:* `npm test` verde: top, totales, sesión objetivo y ventana con `node:sqlite` (CA-5, CA-8, RF-1, RF-9)
- [x] **T2** [app] `features/analytics/domain/metrics.ts` (`windowMinutes`, `burnRate`, `buildRunout`, `averageTicketCents`) + `test/analytics.test.mjs` — *Verificación:* `npm test` verde con los casos de plan §6 (CA-1..CA-4, P1, P7); incluye la prueba de tiempo con 2 000 productos y 10 000 ventas (< 200 ms en la PC)
- [x] **T3** [app] `features/analytics/data/analyticsRepository.ts` → `getDashboard(nowMs)`, con el tiempo en el log en `__DEV__` (depende de T1, T2) — *Verificación:* `tsc` ok
- [x] **T4** [app] `DashboardScreen` (ritmo, se agota, más vendidos, sesión) en `RootNavigator`; refresco al enfocar, cada 15 s y con `leasesUpdatedAt`; etiquetas accesibles (depende de T3) — *Verificación:* `tsc` ok; `npx expo-doctor` sin errores nuevos

### Verificación en dispositivo
- [x] **T5** [app] Probar en el teléfono con Expo Go (depende de T4) — *Verificación:* CA-1..CA-6 y CA-8 cobrando con y sin red; CA-7 con el tiempo del log usando los datos del teléfono

### Cierre
- [x] **T6** [docs] `ARCHITECTURE.md` (estructura `features/analytics`, flujo del panel, índices v5); `GLOSSARY.md` (`burnRate`, `runoutTime` apuntando a `metrics.ts`); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-8 revisados; `tsc --noEmit` sin errores; `npm test` verde
