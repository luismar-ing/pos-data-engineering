# SPEC-006 — Tareas

Rama: `spec/006-conectividad` (monorepo). Solo `pos-app`.

### pos-app
- [x] **T1** [app] `npx expo install expo-network` — *Verificación:* `package.json` con `expo-network` ~58.0.x; `npx expo-doctor` sin errores nuevos
- [x] **T2** [app] `core/network/connectivity.ts` (`probeServer`, `createConnectivity` con `check`/`handleChange`/`onReconnect`, `isCatalogStale`) + `test/connectivity.test.mjs` — *Verificación:* `npm test` verde con los casos de plan §6 (RF-1, RF-3, RF-5, RF-7, RF-8, CA-5, P4)
- [x] **T3** [app] `core/network/monitor.ts`: `expo-network`, `AppState` y suscripción al store; `apiFetch` marca sin conexión al fallar `fetch` (depende de T1, T2) — *Verificación:* `tsc` ok; `npm test` sigue verde
- [x] **T4** [app] `shared/ui/OfflineBanner.tsx` en el `screenLayout` de `RootNavigator` (depende de T3) — *Verificación:* `tsc` ok
- [x] **T5** [app] `App.tsx`: acciones de reconexión (`ensureRegistered`, `syncCatalog` si `isCatalogStale`) y `startConnectivityMonitor()`; quitar los `shortcut:` de `registration.ts` y `catalogSync.ts` (depende de T3) — *Verificación:* `tsc` ok

### Verificación en dispositivo
- [x] **T6** [app] Probar en el teléfono con Expo Go (depende de T4, T5) — *Verificación:* CA-1..CA-7 uno por uno; CA-1/CA-2 midiendo < 5 s; CA-3 deteniendo y arrancando el backend con Wi-Fi; CA-4 con un dispositivo sin registrar abierto sin red; CA-6 cobrando sin red (< 3 s en el log). "Sin red" = Wi-Fi y datos apagados: el modo avión puede dejar el Wi-Fi activo

### Cierre
- [x] **T7** [docs] `ARCHITECTURE.md` (monitor de conectividad: qué es "en línea", reconexión); `TECH_DEBT.md` (TD-016 y TD-022 resueltos); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-7 revisados; `tsc --noEmit` sin errores; `npm test` verde
