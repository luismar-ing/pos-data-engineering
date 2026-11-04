# SPEC-006 — Plan técnico

## 1. Enfoque
- **La red del teléfono solo dispara la comprobación; la verdad la da el servidor (P1).** `expo-network` (SDK 58, incluido en Expo Go) avisa de los cambios de red con `addNetworkStateListener`. Si dice que no hay red (`isConnected === false`), el estado pasa a sin conexión de inmediato, sin petición. Si dice que hay red, se comprueba `GET /health`: solo un 200 cuenta como en línea (P1, P5).
- **Un único estado: `isOnline` del store de Zustand** (ya existe, hoy fijo en `true`). Todo el que necesite saber si hay conexión lo lee de ahí. Al arrancar sigue en `true` para que el aviso no parpadee; la primera comprobación lo corrige.
- **Las transiciones las vigila el monitor, no quien cambia el estado.** El monitor se suscribe al store:
  - `true → false`: arranca la comprobación cada 15 s (P2);
  - `false → true`: para la comprobación y avisa una vez a los suscriptores de reconexión (RF-7, RF-8).
  Así `apiFetch` solo tiene que poner `isOnline = false` cuando `fetch` falla por red (RF-4), y el monitor hace el resto.
- **Comprobación con tiempo máximo de 3 s** (`AbortController`) y **una sola a la vez**: si llega otro disparo mientras hay una en curso, comparte la promesa (mismo patrón que `ensureRegistered` y `syncCatalog`).
- **Lógica pura y probada** en `core/network/connectivity.ts`, sin imports de Expo ni React Native: recibe la función de comprobación y los temporizadores como parámetros. El pegamento con `expo-network`, `AppState` y el store va en `core/network/monitor.ts`.
- **Acciones de reconexión** registradas en `App.tsx`:
  - `ensureRegistered()`: ya no hace nada si el dispositivo está registrado (cierra TD-022);
  - `syncCatalog()` solo si la última descarga correcta tiene más de 5 min (P4), con la función pura `isCatalogStale`.
  Las dos ya son de una sola ejecución a la vez, así que una red que oscila no las lanza en paralelo (CA-5).
- **Aviso** `OfflineBanner` dentro del `screenLayout` del navegador de pestañas: queda bajo la cabecera y sobre el contenido de cada pestaña, sin pelear con el área segura (P3).

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `sessionStore.ts` → `isOnline`; `connectivity.ts` → `probeServer` | En línea solo si `/health` responde 200 |
| RF-2 | `monitor.ts` | Comprueba al arrancar, en `addNetworkStateListener` y en `AppState` → `active` |
| RF-3 | `connectivity.ts` | Intervalo de 15 s solo mientras `isOnline === false`; se para al volver |
| RF-4 | `core/api/client.ts` | En el `catch` de `fetch`: `setOnlineStatus(false)` antes de lanzar `NETWORK_ERROR` |
| RF-5 | `connectivity.ts` → `probeServer` | Sin `API_URL` devuelve `false` sin petición |
| RF-6 | `shared/ui/OfflineBanner.tsx`, `RootNavigator.tsx` | Franja "Sin conexión — las ventas se guardan en el teléfono" cuando `isOnline === false` |
| RF-7 | `connectivity.ts` → `onReconnect`; `App.tsx` | Suscriptores llamados en la transición `false → true` |
| RF-8 | `connectivity.ts`; `ensureRegistered` / `syncCatalog` | Un aviso por transición; las acciones ya comparten la ejecución en curso |
| RF-9 | — | Ni `createSale` ni la pantalla de Venta leen `isOnline`; el monitor corre fuera del render |
| RNF-1 | `monitor.ts` | Evento de red → comprobación inmediata; `isConnected === false` → sin conexión sin petición |
| RNF-2 | `monitor.ts`, `App.tsx` | El monitor arranca después de abrir la BD, sin `await` en el arranque |
| RNF-3 | `connectivity.ts` → `probeServer` | `AbortController` a 3 s |
| RNF-4 | `connectivity.ts` | Sin intervalo mientras está en línea |
| RNF-5 | `OfflineBanner.tsx` | `accessibilityRole="alert"` y `accessibilityLiveRegion="polite"` |
| RNF-6 | `test/connectivity.test.mjs` | §6 |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `package.json` | Modificar | `npx expo install expo-network` (~58.0.4) |
| `src/core/network/connectivity.ts` | Crear | `PROBE_INTERVAL_MS = 15_000`, `PROBE_TIMEOUT_MS = 3_000`, `CATALOG_STALE_MS = 300_000`; `probeServer(apiUrl, fetchFn)`; `createConnectivity({ probe, setOnline, timers })` con `check()`, `handleChange(prev, next)`, `onReconnect(fn)`; `isCatalogStale(syncedAt, now)` |
| `src/core/network/monitor.ts` | Crear | `startConnectivityMonitor()`: crea la instancia con `fetch`, el store y los temporizadores reales; suscribe `addNetworkStateListener`, `AppState` y `useSessionStore.subscribe`; primera `check()`. Reexporta `onReconnect` |
| `src/core/api/client.ts` | Modificar | `setOnlineStatus(false)` en el `catch` de `fetch` |
| `src/shared/ui/OfflineBanner.tsx` | Crear | Lee `isOnline`; `null` si hay conexión |
| `src/navigation/RootNavigator.tsx` | Modificar | `screenLayout` del `Tab.Navigator` con `OfflineBanner` sobre `children` |
| `src/App.tsx` | Modificar | Tras abrir la BD: `onReconnect` con `ensureRegistered` y `syncCatalog` si `isCatalogStale`; `startConnectivityMonitor()` |
| `src/core/device/registration.ts` | Modificar | Quitar el comentario `shortcut:` (TD-022 resuelto) |
| `src/features/inventory/data/catalogSync.ts` | Modificar | Quitar el comentario `shortcut:` |
| `test/connectivity.test.mjs` | Crear | §6 |

### pos-backend
Sin cambios.

## 4. Modelo de datos y migraciones
Sin cambios.

## 5. Contratos HTTP
Sin cambios. Se usa `GET /health` tal como está en `ARCHITECTURE.md`: 200 con BD, 503 `DB_UNAVAILABLE` sin ella.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria (`node:test`) | `probeServer`: 200 → `true`; 503, `fetch` que lanza y `fetch` que no responde en 3 s → `false`; sin `apiUrl` → `false` sin llamar a `fetch` | RF-1, RF-5, RNF-3 |
| Unitaria | `handleChange(true, false)` arranca el intervalo; `handleChange(false, true)` lo para y llama a cada suscriptor una vez; `true → true` no hace nada | RF-3, RF-7, RNF-4 |
| Unitaria | Tres cortes y vueltas seguidos → tres avisos, uno por vuelta | RF-8, CA-5 |
| Unitaria | Dos `check()` seguidos → una sola llamada a `probe` | RF-8 |
| Unitaria | `isCatalogStale`: `null` → `true`; hace 4 min → `false`; hace 6 min → `true` | P4 |
| Manual (teléfono) | CA-1, CA-2 y CA-7 con modo avión; CA-3 deteniendo y arrancando el backend con Wi-Fi activo; CA-4 abriendo la app sin red con un dispositivo nuevo; CA-6 cobrando en modo avión con el tiempo del log | CA-1..CA-7 |

`monitor.ts`, el aviso y `apiFetch` usan módulos nativos y no se prueban con `node:test`; se cubren a mano.

## 7. Riesgos y alternativas descartadas
- **`@react-native-community/netinfo` descartada:** `expo-network` ya cubre el aviso de cambio de red, es del SDK y viene en Expo Go.
- **Usar `isInternetReachable` de `expo-network` descartado:** en iOS es igual a `isConnected` y no dice nada de nuestro servidor (P1).
- **Estado inicial optimista (`true`):** si se abre sin red, durante la primera comprobación (≤ 3 s) no se ve el aviso. Se acepta para que no parpadee al abrir con red.
- **Comprobar `/health` cuando hay red pero el backend está lejos** consume una petición por cada cambio de red y una cada 15 s sin conexión. Es poco y `/health` no toca tablas grandes.
- **Una petición que falla por red marca sin conexión aunque sea un fallo aislado.** La siguiente comprobación (≤ 15 s) lo corrige y dispara la reconexión; las acciones son idempotentes.
- **`screenLayout` del navegador de pestañas:** existe en React Navigation 7 (tipos de `@react-navigation/core`). Si no se comporta bien con la cabecera, plan B: renderizar el aviso en cada pantalla.

## 8. Chequeo de constitución
- [x] Nunca sobrevender — sin cambios en ventas ni leases
- [x] Offline-first — el cobro no consulta el estado de red (RF-9)
- [x] Eventos inmutables — no toca `event_log`
- [x] Idempotencia — las acciones de reconexión ya son idempotentes
- [x] UI fluida — comprobaciones asíncronas fuera del render, con tiempo máximo
- [x] Contratos documentados — solo usa `GET /health`, ya documentado
