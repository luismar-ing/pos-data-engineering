# Bitácora de desarrollo

Una entrada por sesión de trabajo, la más reciente arriba. Formato:

```
## AAAA-MM-DD — Título corto
**Spec:** SPEC-NNN (o "—")
**Hecho:** qué se completó
**Decisiones:** qué se decidió y por qué (enlazar ADR si aplica)
**Bloqueos / pendientes:** qué falta o qué impide avanzar
```

---

## 2026-11-05 — SPEC-010: Recibos QR offline
**Spec:** SPEC-010
**Hecho:** Spec, plan y tareas aprobados (P1–P6 según propuesta). App: `receipt.ts` puro (`buildReceiptText`, `truncateName`, `formatReceiptDate`, `utf8Bytes`; máximo 1 000 bytes, nombres a 24 caracteres, corte "… y N productos más" en una pasada); `receiptSql` (venta + vendedor, líneas en orden del carrito) y `receiptRepository.getReceiptText`, solo lectura; `ReceiptQr` con `react-native-qrcode-svg` 6.3.54 sobre `react-native-svg` 15.16.0 (ECC L, fondo blanco, margen); botones "Recibo QR" y "Volver" en la confirmación del cobro. Cierra R-03.
**Verificación:** app `npm test` 55/55; `tsc` ok; `expo export` Android ok; `expo-doctor` solo con TD-024. T5 en teléfono: CA-1..CA-7 ok según el usuario, con el máximo de 1 000 bytes.
**Decisiones:** texto plano en vez de comprimido (la cámara del cliente no descomprime; `GLOSSARY.md` corregido); un solo QR con corte de líneas en vez de varios; encabezado con el nombre del dispositivo hasta que exista un nombre de tienda; `allowImportingTsExtensions` en `tsconfig` para que un archivo puro importe otro con `.ts` y siga probándose con node.
**Bloqueos / pendientes:** ninguno nuevo. Fase 3 cerrada; sigue la fase 4 (pruebas con ≥ 2 dispositivos, TD-027).

## 2026-11-04 — SPEC-009: Edge Analytics
**Spec:** SPEC-009
**Hecho:** Spec, plan y tareas aprobados (P1–P7 según propuesta). App: migración v5 (índices `sales(created_at)`, `sales(session_id)`, `sale_items(sale_id)`); `analyticsSql` (sesión objetivo, ventas de la ventana, cuota disponible, totales, top) y `metrics` (`windowMinutes`, `burnRate`, `buildRunout`, `averageTicketCents`) puros; `getDashboard` solo lee SQLite; pestaña Dashboard con ritmo, "Se agota" (agotados primero, ámbar < 5 min, contador de préstamos sin ventas), totales y top 5 de la sesión (o de la última cerrada); refresco al enfocar, cada 15 s y con `leasesUpdatedAt`.
**Verificación:** app `npm test` 43/43; `tsc` ok. Con 2 000 productos y 10 000 ventas, las consultas del panel tardan < 200 ms en la PC (`node:sqlite`). T5 en teléfono: CA-1..CA-8 ok según el usuario.
**Hallazgo en T5 y cambio:** con una sesión vieja, 4 unidades en menos de 1 min daban 0,4 u/min (se dividía por 10). Para un vendedor de estadio, avisar tarde en un pico cuesta ventas; por decisión del usuario el ritmo cuenta siempre desde la primera venta del teléfono en la ventana (entre 1 y 10 min), sin importar la sesión, así tampoco se pierde en un cambio de turno. Cambian P1 y CA-1.
**Decisiones:** sin tabla de agregados ni worker: consultas directas con índices; solo lectura, sin cambios de backend.
**Bloqueos / pendientes:** ninguno nuevo. Sigue SPEC-010 (recibos QR).

## 2026-11-03 — SPEC-008: Bitácora + Batch Sync ETL
**Spec:** SPEC-008
**Hecho:** Spec, plan y tareas aprobados (P1–P7 según propuesta). Backend: migración `0006` (`sync_events` para la idempotencia de todos los tipos, con las ventas previas cargadas; `sessions`); `syncService` valida cada evento por tipo (total = Σ líneas, cantidad > 0, dispositivo), lo guarda en su propia transacción y responde `inserted`/`duplicate`/`rejected` con motivo; sesiones con upsert que acepta el cierre antes que la apertura; sobre con `batch_id`, `sent_at` y 1–50 eventos. App: migración v4 (`event_log.sync_error`); `syncSql` y `syncBatch` (`toWireEvent`, `fitBatch` < 80 kB) puros; `syncWorker.syncEvents` en bucle hasta vaciar la cola, una ejecución a la vez; disparos tras cobrar, al abrir/cerrar sesión, al reconectar, cada 30 s y desde Ajustes ("Pendientes · Fallidos · Último envío" y "Sincronizar ahora"). Cierra TD-009.
**Verificación:** backend `npm test` 43/43; app `npm test` 34/34; `tsc` ok en ambos. CA-9 en el servidor: 500 eventos en 10 lotes en 4,0 s contra `posde_test` (meta < 30 s). T7 en teléfono: CA-1, CA-4, CA-5, CA-6 y CA-7 ok según el usuario.
**Decisiones:** idempotencia con una tabla de eventos recibidos (no por id de entidad); una transacción por evento en vez de savepoints en una sola; un rechazo por evento ya no tumba el lote (se quita el 403 de lote y el código `FORBIDDEN`); el lote se recorta en la app en vez de subir el límite de 100 kB.
**Bloqueos / pendientes:** TD-028 (conciliar préstamos con ventas), TD-029 (evento de más de 80 kB), TD-027 (prueba con dos dispositivos). Fase 2 cerrada; sigue la fase 3 (SPEC-009).

## 2026-11-03 — SPEC-005: Stock Leasing
**Spec:** SPEC-005
**Hecho:** Spec, plan y tareas aprobados (P1–P7 según propuesta; tasa por dispositivo). Backend: migración `0005` (FK a `devices`, `closed_at`, un préstamo activo por dispositivo y producto); `leaseService` reemplaza a `rollingAverage` (`calculateLeaseQty` pura con la tasa de los préstamos cerrados del dispositivo; `requestLeases` congela con `select … for update` en orden de id; `closeLeases` devuelve lo no vendido); rutas `POST /prestamos/request` y `/close`, una transacción por petición. App: migración v3 (`stock_leases` con `closing`, `quota_reported`, `renew_at`); `createSale` descuenta cuota en su transacción (`InsufficientQuotaError`); `leaseSync` (cerrar `closing` → pedir) al arrancar, al reconectar, cada 30 s, al abrir y cerrar sesión y tras cobrar; Venta con "Quedan N" / "Agotado" y tope del carrito; Inventario con "Disponible N". Cierra TD-007, TD-008, R-01 y R-02.
**Verificación:** backend `npm test` 40/40 (8 dispositivos piden a la vez 23 unidades ⇒ se reparten exactamente 23); app `npm test` 30/30; `tsc` ok en ambos. T9 en teléfono: CA-3, CA-4, CA-5, CA-7 y CA-8 ok según el usuario. T10 (CA-9 con dos dispositivos) omitida por decisión del usuario ⇒ TD-027.
**Decisiones:** (1) El servidor nunca devuelve stock sin informe del dispositivo: el plazo de 2 h 15 min de la propuesta original podía sobrevender (principio 1); cambian RF-14, RF-15, CA-8 y se quita RF-16. (2) Renovar = cerrar + pedir, ambos idempotentes; sin `renewed_from`. (3) Estado local `closing`: el préstamo deja de vender mientras se cierra, así el reintento informa lo mismo. (4) La tasa sale de lo informado en `close`, no de las ventas sincronizadas (aún no existen).
**Bloqueos / pendientes:** TD-025 (cuota congelada de un teléfono perdido), TD-026 (reintentos de productos sin stock cada 30 s), TD-027 (prueba con dos dispositivos), TD-009 (SPEC-008 no debe volver a descontar stock).

## 2026-11-03 — SPEC-006: monitor de conectividad
**Spec:** SPEC-006
**Hecho:** Spec, plan y tareas aprobados (P1–P5 según propuesta). App: `expo-network` ~58.0.4; `core/network/connectivity.ts` (lógica pura: `probeServer` con `GET /health` y 3 s máx., `createConnectivity` con una comprobación a la vez, reintento cada 15 s solo sin conexión y `onReconnect` una vez por transición, `isCatalogStale` de 5 min); `core/network/monitor.ts` (cambios de red, `AppState` y suscripción al store); `apiFetch` marca sin conexión al fallar la red; `OfflineBanner` en el `screenLayout` de las pestañas; `App.tsx` reintenta registro y catálogo al reconectar. Cierra TD-016 y TD-022.
**Verificación:** app `npm test` 22/22; `tsc` ok. T6 en teléfono: CA-1..CA-7 ok según el usuario. CA-3 se vio también con Postgres detenido (503 ⇒ sin conexión).
**Hallazgos en T6:** (1) la franja salía al abrir con red: `.env.local` apuntaba a la IP vieja de la PC; la franja tenía razón. (2) En el teléfono de prueba el modo avión deja el Wi-Fi activo, así que no corta la red: CA-1/CA-2 se reescribieron como "Wi-Fi y datos apagados".
**Decisiones:** "en línea" = el servidor responde 200, no el estado de red del sistema; sin `markOffline`: `apiFetch` cambia el store y el monitor reacciona a la transición. Sin cambios de backend, esquema ni contratos.
**Bloqueos / pendientes:** TD-024 (ahora también `react-native-safe-area-context` 5.11.1). SPEC-005 necesita decidir si la tasa de consumo es por dispositivo o global.

## 2026-11-01 — SPEC-007: flujo de venta
**Spec:** SPEC-007
**Hecho:** Spec, plan y tareas aprobados (P1–P5 según propuesta). App: `cart.ts` (agregar/sumar, −/+, tope 999, `priceCart`, búsqueda sin acentos, métodos de pago), `shared/utils/money.ts` (formato, monto recibido, cambio); carrito en el store solo con `{ productId, quantity }`; `createSale` lee precio y `active` dentro de su transacción (`ProductUnavailableError`); pantalla Venta con buscador, `CartPanel` y `CheckoutModal` (un cobro = una venta con `useRef`). Quitado "Venta de prueba" (TD-023); TD-016 queda solo por `isOnline`.
**Verificación:** app `npm test` 14/14; `tsc` ok. T6 en teléfono: CA-1..CA-8 ok; CA-4 en modo avión, 34 ms por cobro (meta < 3 s); CA-7 con un producto desactivado en `posde`.
**Hallazgos en T6 y arreglos:** (1) el teclado tapaba el modal de cobro: `KeyboardAvoidingView` con `behavior="padding"` en ambas plataformas (con edge-to-edge Android no redimensiona el modal) y cerrar el teclado al tocar fuera. (2) "fetch failed" al actualizar: la PC cambió de red y `.env.local` apuntaba a la IP vieja; además RN 0.88 no lanza `TypeError` al fallar la red, así que `apiFetch` ahora convierte cualquier fallo de red en `ApiError` `NETWORK_ERROR` ("Sin conexión con el servidor").
**Decisiones:** sin migración ni contrato nuevo; el precio se fija al cobrar, no al agregar.
**Bloqueos / pendientes:** TD-024 (parches de `expo` y `expo-sqlite`). Si cambia la red de la PC, actualizar `EXPO_PUBLIC_API_URL` en `.env.local` y reiniciar con `npx expo start --clear`.

## 2026-10-30 — SPEC-004: catálogo, descarga y caché local
**Spec:** SPEC-004
**Hecho:** Spec, plan y tareas aprobados (P1–P3 según propuesta). Backend: pruebas de `GET /catalogo` (público, solo activos, por nombre); sin cambios de código. App: `parseCatalog` (validación a mano, sin dependencias); `catalogRepository` (desactivar todo + upsert con sentencia preparada en una transacción exclusiva, `catalog_synced_at` en `settings`); `syncCatalog` (una descarga en vuelo) al abrir la app; `catalogSyncedAt` en el store; pantalla Inventario con botón Actualizar. La "Venta de prueba" usa el primer producto del catálogo; borrado `insertProduct`.
**Verificación:** backend `npm test` 35/35; app `npm test` 9/9 (SQL real con `node:sqlite`: alta, cambio de precio, baja, reactivación, rollback, idempotencia); `tsc` ok en ambos; `expo-doctor` 20/20. T6 en teléfono: CA-1..CA-5 ok (CA-2 y CA-5 en modo avión). RNF-1: 2 000 productos guardados en 105 ms (meta < 1 s); productos temporales borrados y semilla restaurada.
**Decisiones:** sin migración ni cambio de contrato. Las bajas quedan inactivas en vez de borrarse (FK de ventas y leases).
**Bloqueos / pendientes:** la descarga al recuperar red llega con SPEC-006 (igual que TD-022).

## 2026-10-30 — SPEC-003: identidad de dispositivo y sesión
**Spec:** SPEC-003
**Hecho:** Spec, plan y tareas aprobados (P1–P6 según recomendación). Backend: migración `0004_devices_auth.sql` (`devices.token_hash`, FK `sales.device_id → devices` con relleno de dispositivos previos, `sales.session_id`); `POST /devices/register` idempotente (201/200/409); `requireDevice` (Bearer, sha256) en `/prestamos` y `/sync`; sync rechaza con 403 eventos de otro dispositivo. App: `expo-secure-store` + `expo-device`; `EXPO_PUBLIC_API_URL`; migración v2 (`settings`, `sessions` con índice único parcial, `sales.session_id`); identidad y registro (`core/device/`); cliente HTTP (`core/api/client.ts`); `sessionRepository` con eventos `session_opened`/`session_closed`; `createSale` exige sesión; pantallas Venta (abrir sesión, venta de prueba en `__DEV__`) y Ajustes.
**Verificación:** backend `npm test` 34/34; app `npm test` 4/4 (migraciones con `node:sqlite`); `tsc` ok en ambos; `expo-doctor` 20/20; export Android ok. T9 en teléfono con Expo Go: CA-1 (id persiste tras reiniciar), CA-2 ("Registrado"), CA-6 (sin sesión no cobra), CA-7 (modo avión: abrir sesión y vender), CA-8 (la sesión persiste; al cerrarla no se cobra). CA-10: ningún log imprime el secreto.
**Decisiones:** el dispositivo genera su propia credencial y el servidor solo guarda el hash (sin ADR: no cambia la arquitectura base). Nuevas dependencias de app: `expo-secure-store`, `expo-device`.
**Bloqueos / pendientes:** TD-022 (reintento de registro al volver la red, SPEC-006); TD-023 (botón de venta de prueba, quitar en SPEC-007). En Android el secreto se borra al desinstalar: el teléfono se registra como dispositivo nuevo.

## 2026-10-30 — SPEC-002: infraestructura backend
**Spec:** SPEC-002
**Hecho:** Spec, plan y tareas aprobados (P1–P5 según recomendación). Backend: scripts `dev`/`build`/`start`/`typecheck`/`test`/`db:migrate`/`db:seed`; `config.ts` exige `DB_URL`; `pool.on('error')` (TD-020); runner de migraciones con `schema_migrations` y línea base para BD previas; semilla repetible; `createApp()` separado del arranque; errores `{ error: { code, message, details? } }`; `GET /health`; validación con `zod` en `/prestamos/request` y `/sync/events`; 21 pruebas con `node:test` sobre `posde_test`. Docker ya no aplica migraciones: solo crea `posde_test`. Borrados `db/init.sh` y `test-db.ts`.
**Verificación:** `npm test` 21/21 (varias veces seguidas); `typecheck` y `build` ok. Manual: CA-1 (`dev` recarga), CA-2 (sin `DB_URL` ⇒ mensaje y salida 1), CA-3 (BD vieja ⇒ registra 0001–0003, luego "nada pendiente"), CA-5 (`docker stop` ⇒ 503 en 152 ms), CA-8 (el pool registra el corte, `/catalogo` 200 tras `docker start`), CA-10 (logs sin contraseña), CA-11 en un Postgres temporal (puerto 5499) para no borrar la BD de desarrollo. RF-4: `pg_dump -s` de `posde` (vieja) y `posde_test` (nueva) idénticos.
**Revisión (cavecrew-reviewer):** corregido: 413/415 del parser daban 500 (ahora `PAYLOAD_TOO_LARGE`/`BAD_REQUEST`); guarda `headersSent`; tabla de control + línea base en una transacción; rutas de migraciones relativas al módulo, no al cwd; `connectionTimeoutMillis: 2000` en el pool; ids `z.uuid()` y fechas `z.iso.datetime()` en sync; `test/env.ts` exige BD `*_test`; Postgres publicado solo en `127.0.0.1`. Descartado: `refine` con payload incompleto (zod 4 no lo ejecuta si falla la base; probado).
**Decisiones:** ADR-0006 (formato de errores + runner propio). Nueva dependencia: `zod` 4; se quitó `ts-node-dev`.
**Pendientes resueltos al cierre:** contenedor recreado (`127.0.0.1:5434`, datos conservados); `posde_test` creada; `npm audit fix` (body-parser 2.4.0, qs 6.17.1, 0 vulnerabilidades, TD-021); 21/21 pruebas tras el cambio.
**Bloqueos / pendientes:** Otros volúmenes de Docker anteriores a SPEC-002 necesitan una vez `docker exec pos-de-db createdb -U postgres posde_test`.

## 2026-10-30 — Cierre de SPEC-001
**Spec:** SPEC-001
**Hecho:** T11: la app abre en el teléfono con Expo Go (SDK 58), muestra las 4 pestañas y no hay errores de BD. Todos los criterios CA-1..CA-6 verificados; spec en Done.
**Decisiones:** —
**Bloqueos / pendientes:** Fusionar el PR de `spec/001-modelo-datos`. Siguiente: redactar SPEC-002 (scripts, runner de migraciones, manejo de errores incl. TD-020, pruebas).

## 2026-10-30 — Actualización a Expo SDK 58
**Spec:** SPEC-001 (desbloquea T11)
**Hecho:** `pos-app` pasa de SDK 57 a 58 (React Native 0.88.1, React 19.3.0, expo-sqlite 58.0.14, expo-crypto 58.0.7). Sin cambios de código: las APIs usadas siguen iguales. `tsc` ok, `expo-doctor` 20/20, bundle de Android generado.
**Decisiones:** ADR-0005: mantener el SDK que soporte Expo Go mientras no haya development build.
**Bloqueos / pendientes:** T11, abrir la app en el teléfono con Expo Go.

## 2026-10-30 — SPEC-001: modelo de datos unificado + Docker del proyecto
**Spec:** SPEC-001
**Hecho:** Aprobada con P1–P4 según recomendación. App: migraciones SQLite con `user_version`, montos en centavos, `createSale` atómico con evento `sale_created`, `expo-crypto` para UUID. Backend: migraciones `0001..0003` (`sales` + `sale_items` reemplazan `sale_events`), `/sync/events` con la venta completa e idempotente, `rollingAverage` sobre `sale_items`. Nuevo `compose.yaml` en la raíz (contenedor `pos-de-db`, puerto 5434, BD `posde`) que aplica migraciones y semilla al crearse; se retiró `pos-backend/docker-compose.yml`.
**Verificación:** CA-1..CA-4 y CA-6 con `node:sqlite` partiendo del esquema viejo roto; CA-5 con `curl` contra Postgres (2 envíos ⇒ 1 venta, 3 líneas, total 30). `tsc --noEmit` ok en ambos.
**Decisiones:** Commits sin trailer de coautoría de IA (CONVENTIONS). Docker propio del proyecto en lugar de migrar la BD vieja `posapp` (queda intacta en el contenedor `pos-backend-postgres-1`).
**Bloqueos / pendientes:** T11, abrir la app en emulador/dispositivo. Nuevo hallazgo TD-020: el backend se cae si Postgres corta una conexión.

## 2026-10-29 — Migración a monorepo
**Spec:** —
**Hecho:** App y backend unidos en un solo repo en `POS_DE_APP/` con `git subtree add`, conservando los 11 commits originales. Se commiteó antes el cambio pendiente de `pos-app/index.ts` (`be8a1c8`). `node_modules`, `.env` y `.expo` se trasladaron sin cambios; contenido verificado idéntico al original. Carpetas vacías de `pos-app/src` recreadas a mano (git no versiona carpetas vacías).
**Decisiones:** Monorepo sin npm workspaces (ADR-0004).
**Bloqueos / pendientes:** Crear el repo nuevo en GitHub, hacer push y archivar los dos repos anteriores. Borrar el respaldo `Aplicaciones_Moviles/_respaldo_repos_2026-10-29/` cuando se confirme que todo funciona.

## 2026-10-29 — Revisión de avances y adopción de SDD
**Spec:** —
**Hecho:** Revisión completa de `pos-app` y `pos-backend` contra el planteamiento. Creación de la estructura de documentación SDD (`docs/`), plantillas de spec y redacción de SPEC-001. Registro de 18 hallazgos en `TECH_DEBT.md`.
**Decisiones:** Adoptar Spec-Driven Development (ADR-0001). Documentación centralizada en la raíz `POS_DE_APP/docs/` porque las specs cruzan ambos repos.
**Bloqueos / pendientes:** Aprobar SPEC-001. Decidir dónde se versiona `docs/`.

## 2026-09-29 — Esquema local y optimización de leases
**Spec:** — (previo a SDD)
**Hecho:** Ajustes al esquema SQLite (`f1327f4`). Optimización de `calculateLeaseQty`: corta antes si no hay stock y limita el lease al stock restante (`1104806`).

## 2026-09-27 — Backend: Postgres y rutas
**Spec:** — (previo a SDD)
**Hecho:** Pool `pg`, rutas `/catalogo`, `/prestamos/request`, `/sync/events`, servicio de promedio móvil (`47ef567`).

## 2026-09-23 — Inicio del backend
**Spec:** — (previo a SDD)
**Hecho:** Repo `pos-de-backend`, Express + TS, `docker-compose` con Postgres 16, `schema.sql` inicial.

## 2026-09-18 — Esquema SQLite y conexión
**Spec:** — (previo a SDD)
**Hecho:** `database.ts` y primer `schema.ts`, repositorio de productos (`fc9b051`).

## 2026-09-12 — Estructura base de la app
**Spec:** — (previo a SDD)
**Hecho:** Dependencias (React Navigation, expo-sqlite, Zustand), tabs y store de sesión (`766095f`).
