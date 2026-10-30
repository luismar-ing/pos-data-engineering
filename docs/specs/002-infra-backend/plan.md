# SPEC-002 — Plan técnico

## 1. Enfoque
- **Mínimo de dependencias.** Una sola nueva: `zod` (validación declarada). Pruebas con el runner nativo de Node (`node:test` vía `tsx --test`) y `fetch` contra el servidor levantado en un puerto libre; sin Jest ni supertest. Se quita `ts-node-dev` (duplica a `tsx`).
- **App separada del arranque.** `src/app.ts` construye la app Express (rutas + manejo de errores) sin escuchar; `src/index.ts` solo escucha. Las pruebas importan `createApp()`.
- **Configuración en un punto.** `src/config.ts` carga `.env`, exige `DB_URL` y da `PORT=3000` por defecto. `pool.ts` lo usa.
- **Errores con forma única** `{ error: { code, message, details? } }`, producidos por un solo middleware al final de la cadena. Express 5 ya pasa al middleware los rechazos de handlers `async`.
- **Runner de migraciones propio** (≈40 líneas): tabla `schema_migrations`, una transacción por archivo. Postgres hace el DDL transaccional, así que un fallo no deja nada a medias.
- **Docker solo crea bases vacías** (`posde` y `posde_test`). Migraciones y semilla, siempre con `npm run db:migrate` / `npm run db:seed`.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `package.json` | Scripts `dev`, `build`, `start`, `typecheck`, `test`, `db:migrate`, `db:seed` (§3) |
| RF-2 | `src/config.ts` | Sin `DB_URL` → `console.error('Falta la variable de entorno DB_URL')` + `process.exit(1)`; `PORT` por defecto 3000 |
| RF-3 | `src/db/migrate.ts` → `migrate()` | Lee `db/migrations/*.sql` en orden; aplica las que no están en `schema_migrations`, cada una con su `insert` en la misma transacción |
| RF-4 | `migrate()` (línea base) + `db/docker-init/` | BD previa sin `schema_migrations` pero con `products` → registra 0001–0003 sin ejecutarlas. BD nueva → las ejecuta. Ambas terminan iguales |
| RF-5 | `src/routes/health.ts` | `select 1` en carrera con un timeout de 800 ms → 200 o 503 `DB_UNAVAILABLE` |
| RF-6 | `src/http/errors.ts` | `HttpError` + `errorHandler` + `notFound` |
| RF-7 | `src/routes/prestamos.ts`, `src/routes/sync.ts` | Esquemas `zod`; `schema.parse(req.body)` antes de tocar la BD; `ZodError` → 400 `VALIDATION_ERROR` |
| RF-8 | `errorHandler` | `err.type === 'entity.parse.failed'` → 400 `INVALID_JSON`; sin ruta → 404 `NOT_FOUND`; resto → 500 `INTERNAL_ERROR` (se registra en consola, no se envía) |
| RF-9 | `src/db/pool.ts` | `pool.on('error', …)` registra `err.message` y no relanza |
| RF-10 | `test/*.test.ts` | §6 |
| RF-11 | `config.ts`, `migrate.ts`, borrar `test-db.ts` | Los logs nombran variables y archivos, nunca valores de conexión |
| RNF-1 | rutas | Respuestas 200 sin cambios; solo cambia el cuerpo de los errores |
| RNF-2 | `test/env.ts`, `test/helpers.ts` | `DB_URL ← TEST_DB_URL`; antes de cada archivo: `migrate()` + `truncate` + `seed()` |
| RNF-3 | `health.ts` | Timeout de 800 ms independiente del pool |
| RNF-4 | `tsconfig.json` | `npm run typecheck` cubre `src/` y `test/` |

## 3. Cambios por repo

### pos-app
Sin cambios.

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `package.json` | Modificar | Scripts (abajo); `+zod`; `-ts-node-dev` |
| `tsconfig.json` | Modificar | `include: ["src", "test"]`, `noEmit`; quitar `jsx`, `declaration*` |
| `tsconfig.build.json` | Crear | Extiende el anterior: `include: ["src"]`, `rootDir: "src"`, `outDir: "dist"`, `noEmit: false` |
| `.env.example` | Modificar | `+TEST_DB_URL=postgres://postgres:postgres@localhost:5434/posde_test` |
| `src/config.ts` | Crear | `import 'dotenv/config'`; exporta `{ dbUrl, port }` |
| `src/app.ts` | Crear | `createApp()`: `express.json()`, rutas, `/health`, `notFound`, `errorHandler` |
| `src/index.ts` | Modificar | `createApp().listen(config.port, …)` |
| `src/http/errors.ts` | Crear | `HttpError`, `notFound`, `errorHandler` |
| `src/routes/health.ts` | Crear | `GET /health` |
| `src/routes/prestamos.ts` | Modificar | Esquema `{ product_id: uuid }` |
| `src/routes/sync.ts` | Modificar | Esquema `zod` en lugar de `isSaleCreatedEvent`; tipos con `z.infer` (se borran las interfaces) |
| `src/db/pool.ts` | Modificar | Usa `config.dbUrl`; `pool.on('error')` |
| `src/db/migrate.ts` | Crear | `migrate(pool)`, `seed(pool)` |
| `src/db/cli.ts` | Crear | `tsx src/db/cli.ts migrate\|seed`; cierra el pool al terminar; código de salida 1 si falla |
| `db/init.sh` | Eliminar | Lo reemplaza el comando |
| `db/docker-init/00-test-db.sql` | Crear | `create database posde_test;` |
| `db/seed/0001_dev_products.sql` | Modificar | `on conflict (id) do nothing` para poder repetirla |
| `test-db.ts` | Eliminar | P4 |
| `test/env.ts`, `test/helpers.ts`, `test/*.test.ts` | Crear | §6 |

Scripts:
```json
"dev": "tsx watch src/index.ts",
"build": "tsc -p tsconfig.build.json",
"start": "node dist/index.js",
"typecheck": "tsc",
"test": "tsx --test --test-concurrency=1 --import ./test/env.ts \"test/**/*.test.ts\"",
"db:migrate": "tsx src/db/cli.ts migrate",
"db:seed": "tsx src/db/cli.ts seed"
```

### Raíz
| Archivo | Acción | Detalle |
|---|---|---|
| `compose.yaml` | Modificar | Quitar montajes de `init.sh`, `migrations`, `seed`; montar `./pos-backend/db/docker-init:/docker-entrypoint-initdb.d:ro` |

## 4. Modelo de datos y migraciones
Tabla de control (la crea `migrate()` con `create table if not exists`, no es un archivo de migración):
```sql
create table if not exists schema_migrations (
    version text primary key,          -- nombre del archivo sin .sql, p. ej. '0002_sales'
    applied_at timestamptz not null default now()
);
```

Algoritmo de `migrate()`:
1. Si `schema_migrations` no existe y `to_regclass('public.products')` no es nulo → BD creada por el `init.sh` anterior: insertar `0001_init`, `0002_sales`, `0003_stock_leases` sin ejecutarlas. (`shortcut: línea base fija; borrarla cuando no queden BD de desarrollo anteriores a SPEC-002`.)
2. Crear `schema_migrations` si no existe.
3. Por cada archivo de `db/migrations/` ordenado por nombre y no registrado: `begin` → SQL del archivo → `insert into schema_migrations` → `commit`; si falla, `rollback`, log del archivo y error.
4. Sin pendientes → log `nada pendiente`.

`seed()`: ejecuta cada `db/seed/*.sql` en orden dentro de una transacción. Los archivos semilla deben ser repetibles (`on conflict do nothing`).

Volúmenes existentes: no tienen `posde_test`. Paso manual, una vez (va en DEVLOG):
```
docker exec pos-de-db createdb -U postgres posde_test
```

## 5. Contratos HTTP
Forma de error (todas las rutas):
```
{ "error": { "code": "VALIDATION_ERROR", "message": "Datos de entrada inválidos",
             "details": [ { "path": "product_id", "message": "Invalid UUID" } ] } }
```
| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Cuerpo no cumple el esquema (`details` = campos que fallaron) |
| `INVALID_JSON` | 400 | JSON mal formado |
| `NOT_FOUND` | 404 | Ruta inexistente |
| `DB_UNAVAILABLE` | 503 | `/health` sin BD |
| `INTERNAL_ERROR` | 500 | Cualquier otro error (sin SQL ni trazas en la respuesta) |

```
GET /health
Response 200: { "status": "ok", "db": "up" }
Errores:      503 DB_UNAVAILABLE (en < 1 s)
```

`GET /catalogo`, `POST /prestamos/request`, `POST /sync/events`: respuestas 200 sin cambios. `POST /prestamos/request` ahora rechaza un `product_id` que no es UUID (antes devolvía 500 desde Postgres).

Al cerrar: copiar la forma de error y `/health` a `ARCHITECTURE.md`.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Integración (`test/errors.test.ts`) | JSON mal formado → 400 `INVALID_JSON`; ruta inexistente → 404; `POST /prestamos/request` sin `product_id` y con `"abc"` → 400 con `details[0].path === 'product_id'` | RF-6, RF-7, RF-8, CA-6, CA-7 |
| Integración (`test/health.test.ts`) | BD arriba → 200 `{ db: 'up' }` | RF-5, CA-5 (parte 1) |
| Integración (`test/sync.test.ts`) | Mismo lote dos veces → `inserted: 1` y luego `duplicated: 1`; evento con `sale.id ≠ event_id` → 400 y ninguna fila nueva | RF-7, CA-9 |
| Integración (`test/lease.test.ts`) | `calculateLeaseQty`: sin ventas → 5; ventas recientes → `ceil(u/5·3·1.2)`; tope en `central_stock`; stock 0 → 0 | RF-10 |
| Integración (`test/migrate.test.ts`) | `migrate()` dos veces → la segunda no aplica nada; migración con SQL roto en un directorio temporal → lanza error y la tabla de prueba no existe | RF-3, CA-3, CA-4 |
| Manual | `npm run dev` arranca en 3000 y recarga al editar | CA-1 |
| Manual | Sin `DB_URL` → mensaje con el nombre de la variable | CA-2 |
| Manual | BD creada por Docker antes de SPEC-002 → `db:migrate` registra 0001–0003, segunda vez "nada pendiente" | CA-3 |
| Manual | `docker stop pos-de-db` → `/health` 503 en < 1 s; `docker start` → `/catalogo` 200 sin reiniciar el backend | CA-5 (parte 2), CA-8 |
| Manual | Volumen nuevo → `db:migrate` + `db:seed` → `/catalogo` con productos | CA-11 |
| Manual | Revisar salida de todos los scripts: sin contraseña | CA-10 |

`migrate(pool, dir?)` acepta el directorio como parámetro (por defecto `db/migrations`) para poder probar CA-4 sin tocar las migraciones reales.

## 7. Riesgos y alternativas descartadas
- **Línea base fija (paso 1 de §4):** solo sirve para BD creadas con el `init.sh` de SPEC-001. Si una BD tiene 0001 pero no 0003, quedaría mal registrada. Riesgo bajo: solo hay BD de desarrollo y todas se crearon con las tres.
- **Sin bloqueo entre ejecuciones concurrentes de `db:migrate`.** `shortcut: sin pg_advisory_lock, añadirlo cuando haya despliegue con varias instancias`.
- **Descartado:** `node-pg-migrate` / `knex` (dependencia grande para tres archivos SQL); Jest/Vitest + supertest (el runner nativo y `fetch` alcanzan); validación a mano (no es un esquema declarado y crece con SPEC-008).
- **`zod` 4** es dependencia nueva: se pide aprobación con este plan.
- Las pruebas usan la BD `posde_test` real: requieren Docker arriba. Si no está, fallan con error de conexión claro.

## 8. Chequeo de constitución
- [x] Nunca sobrevender — no cambia el cálculo del lease; se le añaden pruebas.
- [x] Offline-first — sin cambios en la app.
- [x] Eventos inmutables — `POST /sync/events` sigue con `on conflict do nothing`.
- [x] Idempotencia — prueba automática de lote repetido (CA-9).
- [x] UI fluida — no aplica.
- [x] Contratos documentados — forma de error y `/health` en §5; se copian a `ARCHITECTURE.md` y se registra un ADR (formato de errores + runner de migraciones) al cerrar.
