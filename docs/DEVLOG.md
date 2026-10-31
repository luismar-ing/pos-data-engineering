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
