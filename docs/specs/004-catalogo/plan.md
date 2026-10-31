# SPEC-004 — Plan técnico

## 1. Enfoque
- **Sin cambios de esquema ni de contrato.** `GET /catalogo` ya devuelve lo necesario y está documentado en `ARCHITECTURE.md`. La tabla local `products` ya tiene `active` y `updated_at`. La hora de la última descarga va en `settings` (clave `catalog_synced_at`), la tabla de SPEC-003.
- **Reemplazo en dos sentencias, dentro de una transacción exclusiva:**
  1. `update products set active = 0` (todo inactivo);
  2. por cada producto recibido, un upsert que lo deja con `active = 1` y datos nuevos.

  Lo que no vino queda inactivo (RF-5). Lo que vuelve se reactiva (P3). Si algo falla, el rollback deja todo como estaba (RF-3). No se borra nada, así que las FK de `sale_items` y `stock_leases` no se rompen.
- **Validar antes de abrir la transacción (RF-7).** `parseCatalog(json)` es una función pura que devuelve los productos o lanza un error. Se escribe a mano, sin agregar `zod` a la app. Se valida:
  - arreglo;
  - `id` en forma de UUID y no repetido;
  - `name` no vacío;
  - `category` string o null;
  - `unit_price_cents` entero ≥ 0.
- **Una sola descarga en vuelo**, como `ensureRegistered()`. `syncCatalog()` comparte la promesa entre el arranque y el botón de Inventario. A diferencia del registro, sí lanza el error, para que el botón lo muestre; el arranque lo ignora.
- **Avisar a la pantalla:** el store guarda `catalogSyncedAt`. Al terminar una descarga se actualiza, e Inventario recarga la lista. Así la descarga del arranque también se refleja si Inventario ya está abierta.
- **Rendimiento (RNF-1):** se prepara una sola sentencia de upsert (`prepareAsync`) y se ejecuta por producto dentro de la transacción. Antes de implementar se confirma la API en la doc de expo-sqlite v58.
- **Probar el SQL real con `node:sqlite`.** Las sentencias se exportan como constantes desde `catalogRepository.ts`. Las pruebas importan esas constantes y la función pura. Ese archivo no puede importar módulos de Expo; la conexión la recibe por parámetro.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | app `App.tsx` | Tras el registro: `void syncCatalog().catch(() => {})` |
| RF-2 | app `features/inventory/ui/InventoryScreen.tsx` | Botón "Actualizar" con indicador; un error muestra un aviso con el código |
| RF-3 | `catalogRepository.ts` → `applyCatalog()` | `withExclusiveTransactionAsync`: desactivar todo + upserts + `catalog_synced_at` |
| RF-4, RF-5, P3 | `catalogRepository.ts` | Upsert `on conflict(id) do update set name, category, unit_price_cents, active = 1, updated_at` tras el `update … active = 0` |
| RF-6 | — | Ya se cumple: `sale_items.unit_price_cents` guarda el precio cobrado (SPEC-001) |
| RF-7 | `features/inventory/domain/catalog.ts` → `parseCatalog()` | Se ejecuta antes de la transacción; si lanza, no se toca la BD |
| RF-8 | `applyCatalog()` | `insert or replace into settings ('catalog_synced_at', <ISO>)` en la misma transacción |
| RF-9 | `InventoryScreen.tsx` | `getAllProducts()` (solo activos, por nombre) + hora de `catalog_synced_at`; sin productos, un mensaje |
| RF-10 | backend `routes/catalogo.ts` | Ya se cumple; se agregan pruebas |
| P2 | `SaleScreen.tsx` | La venta de prueba usa `getAllProducts()[0]`; sin productos avisa. Se quita el `insert` fijo |
| RNF-1 | §1 | Sentencia preparada, todo async |
| RNF-3 | §6 | `test/catalog.test.mjs` (app), `test/catalogo.test.ts` (backend) |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/features/inventory/domain/catalog.ts` | Crear | `CatalogProduct`, `parseCatalog(json: unknown): CatalogProduct[]` |
| `src/features/inventory/data/catalogRepository.ts` | Crear | Constantes `DEACTIVATE_ALL_SQL`, `UPSERT_PRODUCT_SQL`; `applyCatalog(db, products, syncedAt)`; `getCatalogSyncedAt()` |
| `src/features/inventory/data/catalogSync.ts` | Crear | `syncCatalog()`: `apiFetch('/catalogo')` → `parseCatalog` → `applyCatalog` → `setCatalogSyncedAt`; una sola en vuelo |
| `src/features/inventory/ui/InventoryScreen.tsx` | Crear | Lista (`FlatList`), hora de actualización, botón Actualizar |
| `src/shared/store/sessionStore.ts` | Modificar | `catalogSyncedAt`, `setCatalogSyncedAt` |
| `src/navigation/RootNavigator.tsx` | Modificar | Usa `InventoryScreen` en lugar del placeholder |
| `src/App.tsx` | Modificar | Carga `catalogSyncedAt` al store; lanza `syncCatalog()` sin esperar |
| `src/features/sales/ui/SaleScreen.tsx` | Modificar | P2 |
| `test/catalog.test.mjs` | Crear | §6 |

`productRepository.ts` no cambia (`getAllProducts` ya filtra activos y ordena por nombre). `insertProduct` queda sin uso: se borra.

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `test/catalogo.test.ts` | Crear | §6 |
| `src/routes/catalogo.ts` | — | Sin cambios |

## 4. Modelo de datos y migraciones
Sin migraciones. Nueva clave en `settings` (app): `catalog_synced_at` (ISO-8601 de la última descarga correcta).

```sql
-- DEACTIVATE_ALL_SQL
update products set active = 0 where active = 1;
-- UPSERT_PRODUCT_SQL
insert into products (id, name, category, unit_price_cents, active, updated_at)
values (?, ?, ?, ?, 1, ?)
on conflict(id) do update set
  name = excluded.name, category = excluded.category,
  unit_price_cents = excluded.unit_price_cents, active = 1, updated_at = excluded.updated_at;
```

## 5. Contratos HTTP
Sin cambios. `GET /catalogo` (público) → `200 [{ id, name, category, unit_price_cents, active }]`, solo activos, por nombre. La app ignora `active` (todos vienen activos) y cualquier campo extra.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria app (`node:test`) | `parseCatalog`: acepta la forma válida; rechaza no-arreglo, precio negativo o decimal, nombre vacío, id repetido | RF-7, CA-6 |
| Unitaria app (`node:sqlite`) | Con el SQL real: alta, cambio de precio, baja (queda `active = 0`), reactivación; un `sale_items` previo conserva su precio | RF-3..RF-6, CA-3, CA-4 |
| Unitaria app (`node:sqlite`) | Si un upsert falla a mitad de la transacción, rollback: nada cambia | RF-3 |
| Integración backend | `GET /catalogo`: 200 sin credencial, ordenado por nombre, un producto desactivado no aparece, `unit_price_cents` entero | RF-10, CA-7 |
| Manual (teléfono) | CA-1, CA-2 (modo avión), CA-3 y CA-4 (cambiando precio y `active` en `posde`), CA-5 (modo avión + Actualizar) | CA-1..CA-5 |
| Manual (teléfono) | 2 000 productos temporales en `posde`. Se mide el tiempo de `applyCatalog` con un log en `__DEV__` (< 1 s). Después se borran | RNF-1 |

## 7. Riesgos y alternativas descartadas
- **`delete` de los que no vienen:** descartado, rompe las FK de ventas y leases.
- **`where id not in (…)` para desactivar:** descartado. Con miles de ids se acerca al límite de parámetros de SQLite; "desactivar todo y luego upsert" da el mismo resultado dentro de la transacción.
- **`zod` en la app:** descartado. Son cinco campos, y una función a mano con pruebas evita una dependencia nueva.
- **Riesgo:** una descarga correcta pero vacía (servidor sin productos activos) deja el catálogo local vacío. Es el comportamiento correcto según RF-5: el servidor es la fuente de verdad.
- **Riesgo:** una venta en curso durante la descarga. La transacción exclusiva serializa `createSale` y `applyCatalog`, así que la venta usa el precio de antes o el de después, nunca uno a medias. El carrito de SPEC-007 decidirá qué hacer con un precio que cambió.

## 8. Chequeo de constitución
- [x] Nunca sobrevender: no toca stock ni leases.
- [x] Offline-first: sin red se usa el catálogo guardado; cobrar no depende de la descarga.
- [x] Eventos inmutables: la descarga del catálogo no escribe en `event_log`.
- [x] Idempotencia: aplicar el mismo catálogo dos veces deja el mismo estado.
- [x] UI fluida: descarga y guardado async, sin esperar en el render.
- [x] Contratos documentados: `GET /catalogo` ya está en `ARCHITECTURE.md`; sin cambios.
