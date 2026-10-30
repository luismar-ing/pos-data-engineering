# SPEC-002 — Tareas

Rama: `spec/002-infra-backend` (monorepo). Todo en `pos-backend/` salvo `compose.yaml` y docs.

### Cimientos
- [x] **T1** [backend] Scripts, `tsconfig.json` + `tsconfig.build.json`, `+zod`, `-ts-node-dev`; `TEST_DB_URL` en `.env.example` — *Verificación:* `npm run typecheck` y `npm run build` ok; `npm run dev` arranca (CA-1); una prueba vacía corre con `npm test` (confirma `tsx --test --import` en Windows)
- [x] **T2** [backend] `src/config.ts`; `pool.ts` usa `config.dbUrl` y añade `pool.on('error')` (depende de T1) — *Verificación:* sin `DB_URL` → mensaje con el nombre de la variable, salida 1 (CA-2); `PORT` ausente → 3000

### Migraciones y Docker
- [x] **T3** [backend] `src/db/migrate.ts` (`migrate`, `seed`, línea base) + `src/db/cli.ts`; semilla con `on conflict (id) do nothing` (depende de T2) — *Verificación:* sobre la BD actual de Docker, `db:migrate` registra 0001–0003 sin ejecutarlas y la 2.ª vez dice `nada pendiente` (CA-3); `db:seed` dos veces sin error
- [x] **T4** [backend] `compose.yaml` monta solo `db/docker-init/`; crear `00-test-db.sql`; borrar `db/init.sh` (depende de T3) — *Verificación:* `docker compose down -v && docker compose up -d`, luego `db:migrate` + `db:seed` → existen `posde` y `posde_test`, `GET /catalogo` con productos (CA-11). ✅ verificado en un Postgres temporal (puerto 5499) para no borrar la BD de desarrollo; `compose.yaml` validado con `docker compose config`

### HTTP
- [x] **T5** [backend] `src/http/errors.ts`, `src/app.ts` (`createApp`), `index.ts` solo escucha (depende de T2) — *Verificación:* JSON mal formado → 400 `INVALID_JSON`; ruta inexistente → 404 `NOT_FOUND` (CA-7)
- [x] **T6** [backend] `GET /health` con timeout de 800 ms (depende de T5) — *Verificación:* 200 con BD; `docker stop pos-de-db` → 503 `DB_UNAVAILABLE` en < 1 s (CA-5); `docker start` → `/catalogo` 200 sin reiniciar el backend (CA-8)
- [x] **T7** [backend] Esquemas `zod` en `prestamos.ts` y `sync.ts`; borrar interfaces e `isSaleCreatedEvent` (depende de T5) — *Verificación:* `POST /prestamos/request` sin `product_id` o con `"abc"` → 400 `VALIDATION_ERROR` con `path: product_id` (CA-6); respuestas 200 iguales que antes (RNF-1)

### Pruebas
- [x] **T8** [backend] `test/env.ts`, `test/helpers.ts` (servidor en puerto libre, `resetDb`) y pruebas de errores, health, sync y migraciones (depende de T3, T6, T7) — *Verificación:* `npm test` verde, incluida la de lote repetido (CA-9) y la de migración rota (CA-4)
- [x] **T9** [backend] `test/lease.test.ts` para `calculateLeaseQty` (depende de T8) — *Verificación:* `npm test` verde
- [x] **T10** [backend] Borrar `test-db.ts`; revisar la salida de todos los scripts (depende de T8) — *Verificación:* ninguna salida contiene la contraseña (CA-10)

### Cierre
- [x] **T11** [docs] ADR-0006 (formato de errores + runner de migraciones); `ARCHITECTURE.md` (forma de error, `/health`, comandos); `TECH_DEBT.md` (TD-011, 012, 013 backend, 014, 018, 020 → resueltas); `PROGRESS.md`, `DEVLOG.md` (incluye `createdb posde_test` para volúmenes existentes, si T4 no se aplicó); README de specs → Done — *Verificación:* CA-1..CA-11 revisados uno por uno; `npm run typecheck` sin errores (RNF-4)
