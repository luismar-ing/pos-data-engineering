# SPEC-005 — Plan técnico

## 1. Enfoque

### Dos operaciones en el servidor: pedir y cerrar
- **Pedir** (`POST /prestamos/request`), para una lista de productos. Si el dispositivo ya tiene un préstamo activo de un producto, lo devuelve tal cual. Si no, lo emite. Pedir dos veces da el mismo resultado: si se pierde la respuesta, reintentar es seguro.
- **Cerrar** (`POST /prestamos/close`), con lo vendido de cada préstamo. Devuelve al stock central `quota_total - quota_used` y marca el préstamo `released`. Cerrar un préstamo ya cerrado no hace nada (RF-12).
- **Renovar = cerrar + pedir.** Con estas dos operaciones idempotentes no hace falta guardar qué préstamo reemplaza a cuál.
- **Liberar al cerrar la sesión = cerrar sin pedir** (RF-13).

### Congelado atómico (RF-3, TD-007)
- Cada pedido corre en una transacción y bloquea las filas de los productos con `select … for update`, en orden de id para evitar bloqueos mutuos.
- Con la fila bloqueada calcula la cuota, resta `central_stock` e inserta el préstamo. Dos dispositivos que piden a la vez se forman en fila sobre esa fila: el segundo ve el stock ya descontado (CA-1).
- Un índice único parcial impide dos préstamos activos del mismo dispositivo y producto (RF-5).
- Cerrar bloquea primero el producto y después el préstamo, en el mismo orden que pedir.

### Tasa por dispositivo (RF-2, P2)
- La tasa sale de los préstamos que **ese dispositivo** cerró en los últimos 5 min para ese producto:
  - unidades = suma de `quota_used`;
  - minutos = suma de `closed_at - issued_at`, medido con la hora del servidor (mínimo 1 min).
- cuota = `ceil(unidades / minutos × 3 × 1.2)`, con mínimo 5 y nunca más que `central_stock` (P7). Es la fórmula actual con otra fuente de datos.
- El cálculo es una función pura, `calculateLeaseQty`. La consulta va aparte.
- Ya no se leen `sales` ni `sale_items`: no dependemos de SPEC-008 ni del reloj del teléfono.

### Sin plazo de vencimiento (RF-14, RF-15)
- El servidor nunca devuelve stock por su cuenta. Solo lo hace al cerrar, con lo vendido que informa el dispositivo.
- `expires_at` (3 min) solo indica cuándo conviene renovar.

### App: un ciclo de préstamos de una sola ejecución a la vez
`leaseSync()` usa el mismo patrón que `syncCatalog`:
1. Sin conexión o sin `API_URL`: no hace nada.
2. En una transacción local pasa a `closing` los préstamos activos que toca cerrar (`isLeaseDue`) y guarda `quota_reported = quota_used`. Toca cerrar si:
   - ya pasó su hora de renovar;
   - le queda menos del 20 % (P4);
   - o no hay sesión abierta (RF-13).
3. Envía `close` con **todos** los préstamos en `closing`, también los de un intento anterior fallido, con su `quota_reported`. Si responde bien, los marca `released`.
4. Si hay sesión abierta, pide préstamo para los productos activos que no tienen uno activo (P1), en grupos de 200, y guarda lo recibido. Si el paso 3 falló, no pide.

**Por qué `closing`.** Si la app siguiera vendiendo del préstamo mientras se cierra y la respuesta se perdiera, al reintentar informaría más unidades de las que el servidor ya dio por buenas. Esas unidades se venderían dos veces. En `closing` el préstamo no vende y el reintento envía exactamente lo mismo.

El precio: durante una renovación, unos cientos de ms, el producto aparece agotado. Si la red cae justo durante el cierre, queda agotado hasta el siguiente reintento con red. Es seguro y poco frecuente.

### Cuándo corre el ciclo
- al abrir la sesión;
- al reconectar (`onReconnect` de SPEC-006);
- cada 30 s, para ver si algo venció;
- después de cada cobro (umbral del 20 %);
- al cerrar la sesión.

Todo en segundo plano (RNF-3).

### Hora de renovar
Se guarda como hora local: hora del teléfono al recibir el préstamo + (`expires_at - issued_at`) del servidor. Un reloj desfasado no adelanta ni atrasa la renovación.

### Cobro (RF-7)
- `createSale`, dentro de su transacción exclusiva, descuenta de cada línea con `update stock_leases set quota_used = quota_used + ? where product_id = ? and status = 'active' and quota_used + ? <= quota_total`.
- Si alguna no cambia filas, lanza `InsufficientQuotaError` y hace rollback: no se registra nada (CA-4).
- Ni una petición de red (RNF-2).

### UI (RF-8)
- `getAvailableQuota()` da un `Map` de producto → unidades disponibles.
- Venta muestra "Quedan N" o "Agotado"; si está agotado, el producto no se puede tocar.
- El + del carrito se detiene en lo disponible: `addProduct` y `changeQuantity` reciben un tope.
- Inventario muestra la misma cifra.
- Al cambiar los préstamos, `leasesUpdatedAt` en el store hace recargar ambas pantallas, como `catalogSyncedAt`.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `routes/prestamos.ts` → `POST /request` | `{ product_ids }` (1–200) |
| RF-2 | `services/leaseService.ts` → `calculateLeaseQty`, `deviceRate` | Préstamos cerrados del dispositivo en 5 min; fórmula con mínimo y tope |
| RF-3 | `leaseService.ts` → `issueLease` | `for update` sobre `products`; resta e inserta en la misma transacción |
| RF-4 | `issueLease` | Cuota 0 o producto inactivo ⇒ va en `unavailable`, sin préstamo |
| RF-5 | Migración `0005`, índice único parcial | `(device_id, product_id) where status = 'active'` |
| RF-6 | App migración v3; `leaseRepository.ts` | `stock_leases` local con `quota_reported` y `renew_at` |
| RF-7 | `saleRepository.ts` → `createSale` | `CONSUME_QUOTA_SQL` por línea; `InsufficientQuotaError` |
| RF-8 | `SaleScreen.tsx`, `CartPanel.tsx`, `InventoryScreen.tsx`, `cart.ts` | `getAvailableQuota`; tope en `addProduct` y `changeQuantity` |
| RF-9 | `leaseSync.ts`; `OpenSessionForm.tsx`; `App.tsx` | Ciclo al abrir sesión y en `onReconnect` |
| RF-10 | `leasePolicy.ts` → `isLeaseDue`; `App.tsx` | Vencido o < 20 %; ciclo cada 30 s y tras cobrar |
| RF-11 | `leaseSync.ts` | Cerrar (devuelve lo no vendido) y después pedir (tasa nueva) |
| RF-12 | `closeLease`; estado `closing` | Cierre idempotente; el reintento envía el mismo `quota_reported` |
| RF-13 | `SettingsScreen.tsx` → `leaseSync()` tras `closeSession` | Sin sesión ⇒ todos los activos a `closing`, sin pedir nuevos |
| RF-14 | `createSale` | Solo mira la cuota, no la hora |
| RF-15 | `leaseService.ts` | Solo `closeLease` suma a `central_stock` |
| RNF-1 | Todo lo anterior | §6, CA-9 con dos dispositivos |
| RNF-2 | `createSale` | Descuento local en la misma transacción |
| RNF-3 | `leaseSync.ts` | `void`, una ejecución a la vez, fuera del render |
| RNF-4 | `test/lease.test.ts` | Pedidos concurrentes de dos dispositivos |
| RNF-5 | §6 | — |
| RNF-6 | `ARCHITECTURE.md` §5 | T1, antes del código |

## 3. Cambios por repo

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `db/migrations/0005_lease_lifecycle.sql` | Crear | §4 |
| `src/services/rollingAverage.ts` | Borrar | Se reemplaza por `leaseService.ts` |
| `src/services/leaseService.ts` | Crear | `LEASE_PARAMS` (ventana 5, préstamo 3, margen 1.2, mínimo 5); `calculateLeaseQty({ units, minutes, centralStock })` pura; `issueLease(client, deviceId, productId)`; `closeLease(client, deviceId, leaseId, quotaUsed)` |
| `src/routes/prestamos.ts` | Reescribir | `POST /request` y `POST /close` con `zod`; una transacción por petición; productos en orden de id |
| `test/lease.test.ts` | Reescribir | §6 |
| `test/helpers.ts` | Modificar | `resetDb` ya trunca `stock_leases`; agregar `requestLeases` y `closeLeases` |

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/core/db/migrations.ts` | Modificar | v3 (§4) |
| `src/features/leases/domain/leasePolicy.ts` | Crear | `RENEW_THRESHOLD = 0.2`, `isLeaseDue(lease, nowMs, sessionOpen)`, `chunk(ids, 200)` |
| `src/features/leases/data/leaseRepository.ts` | Crear | `getAvailableQuota()`, `markDueAsClosing()`, `getClosing()`, `markReleased(ids)`, `saveLeases(leases, receivedAtMs)`, `productsWithoutLease()`; constantes SQL exportadas para probarlas |
| `src/features/leases/data/leaseSync.ts` | Crear | `leaseSync()` (§1); al terminar, `setLeasesUpdatedAt` |
| `src/features/sales/data/saleRepository.ts` | Modificar | `CONSUME_QUOTA_SQL` por línea; `InsufficientQuotaError` |
| `src/features/sales/domain/cart.ts` | Modificar | `addProduct(cart, id, max)` y `changeQuantity(cart, id, delta, max)` con `max ≤ MAX_QUANTITY` |
| `src/shared/store/sessionStore.ts` | Modificar | `leasesUpdatedAt`; `addToCart` y `changeCartQuantity` reciben el tope |
| `src/features/sales/ui/SaleScreen.tsx` | Modificar | "Quedan N" / "Agotado"; recarga con `leasesUpdatedAt`; `leaseSync()` tras cobrar |
| `src/features/sales/ui/CartPanel.tsx` | Modificar | + hasta lo disponible |
| `src/features/sales/ui/CheckoutModal.tsx` | Modificar | Mensaje de `InsufficientQuotaError` |
| `src/features/inventory/ui/InventoryScreen.tsx` | Modificar | Columna "Disponible" |
| `src/features/session/ui/OpenSessionForm.tsx` | Modificar | `leaseSync()` tras abrir |
| `src/features/settings/ui/SettingsScreen.tsx` | Modificar | `leaseSync()` tras cerrar sesión |
| `src/App.tsx` | Modificar | `onReconnect(leaseSync)`; `setInterval(leaseSync, 30_000)` |
| `test/leases.test.mjs` | Crear | §6 |
| `test/cart.test.mjs` | Modificar | Tope por disponible |

## 4. Modelo de datos y migraciones

### PostgreSQL — `0005_lease_lifecycle.sql`
```sql
-- SPEC-005: ciclo de vida del préstamo. Hasta ahora no se guardaba ningún préstamo.
delete from stock_leases;
alter table stock_leases
  add constraint stock_leases_device_fk foreign key (device_id) references devices(id),
  add column closed_at timestamptz,
  add constraint stock_leases_closed check ((status = 'active') = (closed_at is null));
create unique index idx_stock_leases_one_active on stock_leases(device_id, product_id) where status = 'active';
create index idx_stock_leases_rate on stock_leases(device_id, product_id, closed_at);
```
`expired` sigue permitido en el `check` de `status`, pero no se usa.

### SQLite — v3
SQLite no puede cambiar un `check`, así que se rehace la tabla. Los préstamos locales están vacíos: nunca se recibió ninguno.
```sql
drop table stock_leases;
create table stock_leases (
  id text primary key,
  product_id text not null references products(id),
  quota_total integer not null check (quota_total >= 0),
  quota_used integer not null default 0 check (quota_used >= 0 and quota_used <= quota_total),
  quota_reported integer,                -- lo informado al cerrar; fijo durante el reintento
  status text not null default 'active' check (status in ('active', 'closing', 'released')),
  issued_at text not null,               -- hora del servidor
  renew_at text not null                 -- hora local: recibido + (expires_at - issued_at)
);
create unique index idx_stock_leases_one_active on stock_leases(product_id) where status = 'active';
```
Se quita `device_id`: es siempre el de este teléfono.

## 5. Contratos HTTP
Reemplazan a `POST /prestamos/request` en `ARCHITECTURE.md` (T1). Los dos exigen `Authorization: Bearer <secreto>`.

```
POST /prestamos/request
Request:  { "product_ids": ["<uuid>", …] }            // 1–200, sin repetidos
Response: { "leases": [Lease, …], "unavailable": ["<uuid>", …] }
          // leases: el activo de cada producto (existente o nuevo); unavailable: sin stock, inactivo o inexistente
Errores:  400 VALIDATION_ERROR, 401 UNAUTHORIZED

POST /prestamos/close
Request:  { "leases": [{ "lease_id": "<uuid>", "quota_used": 3 }, …] }   // 1–200
Response: { "closed": ["<uuid>", …] }                 // incluye los que ya estaban cerrados
Errores:  400 VALIDATION_ERROR, 400 INVALID_QUOTA_USED (quota_used > quota_total, menor que lo ya informado o, si ya estaba cerrado, distinto),
          404 LEASE_NOT_FOUND (no existe o es de otro dispositivo), 401 UNAUTHORIZED

Lease = { "id", "product_id", "quota_total", "quota_used", "issued_at", "expires_at" }
```
Si un elemento falla, la petición entera hace rollback: no se aplica nada.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria backend | `calculateLeaseQty`: sin historial ⇒ 5; 10 unidades en 3 min ⇒ `ceil(10/3·3·1.2) = 12`; nunca más que el stock; stock 0 ⇒ 0 | RF-2 |
| Integración backend | Pedir resta `central_stock` y guarda el préstamo; pedir otra vez devuelve el mismo sin restar | RF-3, RF-5 |
| Integración backend | Dos dispositivos piden a la vez un producto con stock 7 ⇒ suman 7 y el stock queda en 0 | CA-1, RNF-4 |
| Integración backend | Dispositivo A cierra un préstamo con 10 vendidas; B con 0 ⇒ A recibe más al volver a pedir | CA-2 |
| Integración backend | Cerrar 8 con 3 vendidas ⇒ +5 al stock; cerrar otra vez ⇒ sin cambios | CA-5, CA-6 |
| Integración backend | `quota_used` > total o menor que lo informado ⇒ 400; préstamo de otro dispositivo ⇒ 404; nada se aplica | P6 |
| Integración backend | Stock 0 o producto inactivo ⇒ `unavailable` | CA-10 |
| Integración backend | Un préstamo sin cerrar no vuelve nunca al stock | CA-8 |
| Unitaria app (`node:sqlite`) | Migración v3; `CONSUME_QUOTA_SQL` descuenta y no pasa del total; `closing` no vende; un solo activo por producto | RF-6, RF-7, CA-3, CA-4 |
| Unitaria app | `isLeaseDue`: vencido, < 20 %, sin sesión, no toca; `chunk` | RF-10, RF-13 |
| Unitaria app | `addProduct` y `changeQuantity` con tope por disponible | RF-8 |
| Manual (teléfono) | CA-3, CA-4, CA-7 y CA-8 con Wi-Fi y datos apagados; ver "Quedan N" y "Agotado" | CA-3..CA-8 |
| Manual (2 dispositivos) | Teléfono + emulador o segundo teléfono: los dos sin red venden todo lo que pueden; luego sincronizar no es posible aún (SPEC-008), así que se compara lo vendido localmente con el stock inicial | CA-9 |

`leaseSync`, `createSale` y la UI usan expo-sqlite y la red; se cubren a mano. El SQL que usan se prueba con `node:sqlite`.

## 7. Riesgos y alternativas descartadas
- **Cuota congelada en un teléfono perdido** (RF-15): no vuelve nunca. Se acepta para no sobrevender; liberarla a mano queda fuera de alcance. Se anota como deuda al cerrar.
- **Producto agotado unos instantes al renovar** (estado `closing`): se acepta por seguridad. Si la red cae durante el cierre, queda agotado hasta el siguiente reintento con red.
- **Stock congelado con muchos productos:** el mínimo de 5 por producto y dispositivo puede inmovilizar mucho stock con catálogos grandes. Se acepta (P1); se vuelve a liberar cada 3 min.
- **Renovar "ajustando" la cuota del mismo préstamo** (subir o bajar `quota_total`): descartado. Al bajarla, la app puede haber vendido más que el nuevo total mientras viajaba la respuesta.
- **Guardar qué préstamo reemplaza a cuál** (`renewed_from`): descartado. Con pedir y cerrar idempotentes no hace falta.
- **Tasa desde `sales`**: descartada (P2). Las ventas no llegan al servidor hasta SPEC-008.
- **Confiar en `quota_used` del dispositivo** (P6): un dispositivo autenticado con errores podría informar de menos. El servidor rechaza informes que bajan, pero no puede detectar uno que se queda corto desde el principio. La conciliación con ventas sincronizadas es de SPEC-008.
- **Al sincronizar ventas (SPEC-008) no se vuelve a descontar stock:** ya salió al prestarse. Se anota en TD-009.

## 8. Chequeo de constitución
- [x] Nunca sobrevender — congelado atómico, descuento local en la transacción de la venta y devolución solo con informe
- [x] Offline-first — el cobro solo usa la cuota local
- [x] Eventos inmutables — no toca `event_log`; la cuota es estado, no evento
- [x] Idempotencia — pedir y cerrar son idempotentes; `closing` hace que el reintento envíe lo mismo
- [x] UI fluida — el ciclo corre en segundo plano, una ejecución a la vez
- [x] Contratos documentados — §5 se copia a `ARCHITECTURE.md` en T1, antes del código
