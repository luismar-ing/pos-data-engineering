# SPEC-008 — Plan técnico

## 1. Enfoque

### Servidor: una tabla de eventos recibidos para todos los tipos
Hoy la idempotencia depende de cada tipo: la venta usa su propio id. Con sesiones eso se complica, porque abrir y cerrar son dos eventos de la misma sesión. Por eso se agrega `sync_events` (`event_id` como clave primaria, `device_id`, `event_type`, `batch_id`, `received_at`). Por cada evento, el servidor:
1. valida su forma con `safeParse` según el tipo. Si es inválido o de otro dispositivo, queda `rejected` con un motivo;
2. abre una transacción e inserta en `sync_events … on conflict do nothing`. 0 filas ⇒ `duplicate`, sin tocar nada más (RF-7);
3. aplica el evento: venta y líneas, o la sesión. Si Postgres rechaza una restricción (código `23…`, p. ej. un producto inexistente), hace rollback y el evento queda `rejected` (RF-8, RF-9);
4. hace commit ⇒ `inserted`.

Cada evento tiene su propia transacción: un rechazo no deshace los demás. Recibir ventas no toca `central_stock` (RF-11).

### Sesiones en el servidor (P1)
La tabla `sessions` guarda `id`, `device_id`, `seller_name`, `opened_at`, `closed_at` y `received_at`.
- `session_opened` hace `insert … on conflict (id) do nothing`.
- `session_closed` hace un upsert que fija `closed_at` sin pisar un valor anterior. Así funciona aunque la apertura llegue después o la hayan rechazado.
- `sales.session_id` sigue sin FK, porque la sesión puede llegar en otro lote.

### Validación completa (TD-009)
Además de la forma actual, se valida:
- `quantity > 0` y `unit_price_cents ≥ 0` en cada línea;
- `total_cents` igual a la suma de las líneas;
- en las sesiones, `seller_name` no vacío y `closed_at` presente en `session_closed`;
- `device_id` del evento igual al del payload y al del dispositivo autenticado.

### App: extraer → transformar → cargar
`syncEvents()` (`core/sync/syncWorker.ts`) usa el mismo patrón que `leaseSync`: una ejecución a la vez y, si la llaman mientras corre, vuelve a correr al terminar (RF-5). Mientras haya pendientes:
1. **Extract:** hasta 50 eventos `pending` en orden `created_at, id` (P3).
2. **Transform:** `fitBatch` recorta el lote para que pese menos de 80 kB; siempre queda al menos uno. `toWireEvent` arma `{ event_id, event_type, device_id, created_at, payload }` a partir de `payload_json`, sin cambiarlo. El lote lleva `batch_id` (UUID nuevo) y `sent_at` (RF-3).
3. **Load:** `POST /sync/events`. Con la respuesta, en una transacción local:
   - `inserted` o `duplicate` pasan a `synced` con `synced_at`;
   - `rejected` pasa a `failed` con `sync_error`.

   Solo se actualizan eventos todavía `pending`, y solo esas columnas (RF-12, RF-13, RF-15).
4. Si hay un error de red o de servidor, el ciclo se corta y los eventos siguen `pending` (RF-14).

Al terminar con éxito se guarda `events_synced_at` en `settings` y en el store, para que Ajustes se actualice.

### Disparos (P2)
- tras cobrar;
- al abrir y cerrar sesión, porque cada una crea un evento;
- al reconectar (`onReconnect`);
- en el temporizador de 30 s que ya tiene `App.tsx`, junto a `leaseSync`;
- desde Ajustes, con el botón "Sincronizar ahora".

Sin pendientes no hay petición: la consulta local devuelve vacío y el ciclo termina.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `syncSql.ts` → `PENDING_BATCH_SQL`; `syncWorker.ts` | `order by created_at, id limit 50`, en bucle hasta vaciar |
| RF-2 | `syncWorker.ts`; `routes/sync.ts` | Se envían los tres tipos; el servidor los acepta en una unión discriminada |
| RF-3 | `syncBatch.ts` → `toWireEvent`; `syncWorker.ts` | `batch_id` y `sent_at` en el lote |
| RF-4 | `App.tsx`, `CheckoutModal.tsx`, `OpenSessionForm.tsx`, `SettingsScreen.tsx` | Mismos puntos que `leaseSync`, más el botón |
| RF-5 | `syncWorker.ts` | Banderas `running` / `again` |
| RF-6 | `routes/sync.ts` | `results[]` con `status` y `reason` |
| RF-7 | `syncService.ts` → `sync_events` | `on conflict do nothing` ⇒ `duplicate` |
| RF-8 | `syncService.ts` | `safeParse` y error `23…` por evento ⇒ `rejected`; los demás siguen |
| RF-9 | `syncService.ts` | Una transacción por evento |
| RF-10 | Migración `0006`; `syncService.ts` | Tabla `sessions` con insert o upsert |
| RF-11 | `syncService.ts` | No hay `update products` |
| RF-12, RF-13 | `syncSql.ts` → `MARK_SYNCED_SQL`, `MARK_FAILED_SQL` | `where sync_status = 'pending'` |
| RF-14 | `syncWorker.ts` | Una excepción corta el ciclo antes de marcar |
| RF-15 | `syncSql.ts` | Solo `sync_status`, `synced_at` y `sync_error` |
| RF-16 | `SettingsScreen.tsx`; `syncRepository.ts` → `getSyncSummary` | Pendientes, fallidos, último envío; botón deshabilitado sin red |
| RNF-1 | §6 | Reenvío del mismo lote y corte antes de la respuesta |
| RNF-2 | `syncWorker.ts` | En segundo plano, fuera de la transacción del cobro |
| RNF-3 | `syncService.ts` | 50 eventos por lote, una transacción corta por evento; se mide en la prueba manual |
| RNF-4 | `syncBatch.ts` → `fitBatch` | Lote menor de 80 kB (límite del servidor: 100 kB) |
| RNF-5 | `test/sync.test.ts`, `test/sync.test.mjs` | §6 |
| RNF-6 | `ARCHITECTURE.md` §5 | T1, antes del código |

## 3. Cambios por repo

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `db/migrations/0006_sync_events_sessions.sql` | Crear | §4 |
| `src/services/syncService.ts` | Crear | Esquemas `zod` por tipo; `applyEvent(client, deviceId, batchId, raw) → Result`; `syncBatch(deviceId, batch)` con una transacción por evento |
| `src/routes/sync.ts` | Reescribir | Valida el sobre (`batch_id`, `sent_at`, `events` 1–50 con `event_id` UUID) y delega en `syncService` |
| `test/sync.test.ts` | Reescribir | §6; las pruebas de 400 y 403 de todo el lote pasan a ser `rejected` por evento |

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/core/db/migrations.ts` | Modificar | v4: `alter table event_log add column sync_error text` |
| `src/core/sync/syncSql.ts` | Crear | `PENDING_BATCH_SQL`, `MARK_SYNCED_SQL`, `MARK_FAILED_SQL`, `SYNC_COUNTS_SQL`, `SET_EVENTS_SYNCED_AT_SQL`, `GET_EVENTS_SYNCED_AT_SQL` |
| `src/core/sync/syncBatch.ts` | Crear | `BATCH_SIZE = 50`, `MAX_BATCH_BYTES = 80_000`; `toWireEvent(row, deviceId)`, `fitBatch(events, maxBytes)` puras |
| `src/core/sync/syncRepository.ts` | Crear | `getPendingBatch()`, `applyResults(results, now)`, `getSyncSummary()` |
| `src/core/sync/syncWorker.ts` | Crear | `syncEvents()` (§1) |
| `src/shared/store/sessionStore.ts` | Modificar | `eventsSyncedAt` y su setter |
| `src/App.tsx` | Modificar | `onReconnect` y el temporizador de 30 s también llaman a `syncEvents` |
| `src/features/sales/ui/CheckoutModal.tsx` | Modificar | `void syncEvents()` tras cobrar |
| `src/features/session/ui/OpenSessionForm.tsx` | Modificar | `void syncEvents()` tras abrir |
| `src/features/settings/ui/SettingsScreen.tsx` | Modificar | Resumen y botón "Sincronizar ahora" (P7); `void syncEvents()` tras cerrar sesión |
| `test/sync.test.mjs` | Crear | §6 |

## 4. Modelo de datos y migraciones

### PostgreSQL — `0006_sync_events_sessions.sql`
```sql
-- SPEC-008: idempotencia de todos los eventos y sesiones de vendedor.
create table sync_events (
    event_id uuid primary key,
    device_id text not null references devices(id),
    event_type text not null,
    batch_id uuid not null,
    received_at timestamptz not null default now()
);

-- Las ventas recibidas antes de esta spec ya son eventos sale_created recibidos.
insert into sync_events (event_id, device_id, event_type, batch_id, received_at)
select id, device_id, 'sale_created', '00000000-0000-0000-0000-000000000000', received_at from sales;

create table sessions (
    id uuid primary key,
    device_id text not null references devices(id),
    seller_name text not null check (length(trim(seller_name)) > 0),
    opened_at timestamptz,          -- nulo si el cierre llegó antes que la apertura
    closed_at timestamptz,
    received_at timestamptz not null default now()
);
```

### SQLite — v4
```sql
alter table event_log add column sync_error text;
```

## 5. Contratos HTTP
`POST /sync/events` 🔒 reemplaza el contrato actual en `ARCHITECTURE.md` (T1):
```
Request:  { "batch_id": "<uuid>", "sent_at": "ISO-8601", "events": [Event, …] }   // 1–50
Event:    { "event_id": "<uuid>", "event_type": "sale_created" | "session_opened" | "session_closed",
            "device_id": "…", "created_at": "ISO-8601", "payload": … }
          sale_created   → payload = { sale, items }   (igual que hoy; sale.id = event_id)
          session_opened → payload = { session: { id, device_id, seller_name, opened_at, closed_at: null } }
          session_closed → payload = { session: { id, device_id, seller_name, opened_at, closed_at } }
Response: { "batch_id", "results": [{ "event_id", "status": "inserted" | "duplicate" | "rejected", "reason"? }, …],
            "inserted": n, "duplicated": n, "rejected": n }
Errores:  400 VALIDATION_ERROR (sobre inválido: falta batch_id, events vacío o > 50, un event_id no es UUID o está repetido),
          401 UNAUTHORIZED, 413 PAYLOAD_TOO_LARGE
```
Un evento inválido, de otro dispositivo o que viola una restricción **no** da 400 ni 403: va como `rejected` con `reason`.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Integración backend | Lote con venta, apertura y cierre ⇒ los tres `inserted`; venta con líneas y sesión con vendedor y horas | CA-5, RF-2, RF-10 |
| Integración backend | Mismo lote dos veces ⇒ la segunda vez todos `duplicate`; nada se repite en `sales`, `sale_items` ni `sessions` | CA-2, RF-7 |
| Integración backend | Válido + inválido + válido ⇒ `inserted`, `rejected` (con `reason`), `inserted` | CA-3, RF-8 |
| Integración backend | Total distinto de la suma, cantidad 0, producto inexistente (FK), evento de otro dispositivo ⇒ `rejected`; nada a medias | RF-8, RF-9 |
| Integración backend | Cierre antes que la apertura ⇒ la sesión queda completa al llegar los dos | RF-10 |
| Integración backend | `central_stock` igual antes y después de sincronizar ventas | CA-8, RF-11 |
| Integración backend | Sobre inválido (sin `batch_id`, 51 eventos, `event_id` repetido) ⇒ 400 | §5 |
| Unitaria app (`node:sqlite`) | v4; `PENDING_BATCH_SQL` en orden y con límite; `MARK_*` solo tocan `pending` y no cambian `payload_json` | RF-1, RF-12, RF-13, RF-15 |
| Unitaria app | `toWireEvent` conserva el payload; `fitBatch` respeta el peso máximo y deja al menos uno | RF-3, RNF-4 |
| Manual (teléfono) | CA-1 (3 ventas sin red, luego red), CA-4 (detener el backend durante el envío), CA-6 (cobrar con red), CA-7 (Ajustes y botón) | CA-1, CA-4, CA-6, CA-7 |
| Manual | CA-9: 500 eventos generados con un script en la BD local de desarrollo, o cobros repetidos; medir el tiempo en el log | CA-9 |

`syncWorker` y la UI usan expo-sqlite y la red; se cubren a mano. El SQL que usan se prueba con `node:sqlite`.

## 7. Riesgos y alternativas descartadas
- **Un evento de más de 80 kB** (una venta con cientos de líneas) va solo en su lote y podría pasar del límite del servidor (413). El lote fallaría siempre y frenaría los siguientes. Hoy no es realista; se anota como deuda.
- **Un error del servidor que se repite** (p. ej. un 500 por un bug) frena la cola en el mismo evento. Se reintenta cada 30 s y se ve en Ajustes como pendientes que no bajan.
- **Un `savepoint` por evento dentro de una sola transacción** quedó descartado: es más rápido, pero un error de conexión a mitad deja todo el lote sin confirmar. Una transacción por evento es más simple y aguanta los cortes.
- **Idempotencia solo por el id de cada entidad** (como hoy) quedó descartada: no sirve para dos eventos (abrir y cerrar) que tocan la misma sesión.
- **Subir el límite de `express.json`** quedó descartado: `fitBatch` del lado de la app basta y mantiene la protección de 100 kB.

## 8. Chequeo de constitución
- [x] Nunca sobrevender — el sync no toca stock (RF-11)
- [x] Offline-first — el cobro no espera el envío
- [x] Eventos inmutables — solo cambian `sync_status`, `synced_at` y `sync_error`
- [x] Idempotencia — `sync_events.event_id`; reenviar no cambia nada
- [x] UI fluida — envío en segundo plano, una ejecución a la vez
- [x] Contratos documentados — §5 se copia a `ARCHITECTURE.md` en T1, antes del código
