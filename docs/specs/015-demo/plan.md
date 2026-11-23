# SPEC-015 — Plan

## 1. Trazabilidad

| RF | Componente |
|---|---|
| RF-1 | `DEMO_PRODUCTS` en `pos-backend/src/dev/demo.ts` |
| RF-2, RF-3 | `resetDemo(pool)` en `src/dev/demo.ts`; comando `demo-reset` en `src/db/cli.ts`; script `npm run demo:reset` |
| RF-4 | `demoHistory(now)` en `src/dev/demo.ts` (datos fijos, horas relativas a `now`) |
| RF-5 | Prueba `test/demo.test.ts` con `stockReport` y `reconciliation` |
| RF-6, RF-7 | `docs/demo/guion.md` |
| RNF-1 | Reutiliza `assertDevDatabase` de `src/dev/scenario.ts` |

## 2. Diseño

### Catálogo (P1)
20 productos con ids fijos. Los 5 del seed actual conservan id, nombre y precio. "Hot dog" en 10; el resto entre 40 y 300. El historial no vende "Hot dog", así que los dos teléfonos de la demo se reparten las 10.

### `resetDemo(pool)` (una transacción)
1. `seed(pool)` antes, como `resetScenario` (asegura el seed de desarrollo).
2. `delete` de `sync_events`, `sale_items`, `sales`, `sessions`, `stock_leases`, `admin_audit`. No toca `admins` ni `admin_sessions` (RF-3: el administrador sigue con su sesión).
3. Upsert de `DEMO_PRODUCTS`: `on conflict (id) do update` de nombre, categoría, precio, `central_stock = initial_stock = stock`, `active = true`.
4. Productos fuera de la demo: `active = false`, `initial_stock = central_stock`. Sin préstamos ni ventas, eso los deja `ok` en el reporte (RF-5).
5. `update devices set revoked_at = null` (RF-2). Se borran los teléfonos sin contacto en 24 h (salvo el de demo); si uno vuelve, `POST /devices/register` lo crea de nuevo (`on conflict do nothing`).
6. Upsert del teléfono de demo `demo-caja-2`, "Caja 2 (demo)", `token_hash` nulo (no puede autenticarse), `last_seen_at` = hace 20 min.
7. Historial (P3): una sesión cerrada "Ana (demo)" y 30 ventas en 3 ventanas de 40 min (hace 120 a 20 min). Cada venta tiene 1 o 2 líneas de una lista fija y rota entre `cash`, `card` y `transfer`. Por cada ventana y producto vendido hay un préstamo `released`: `quota_used` = unidades vendidas y `quota_total` = `quota_used` + 3. La línea de venta guarda el préstamo de su ventana.
8. Stock central del producto = stock − unidades vendidas en el historial. Así el total cuadra: central + 0 prestado + informado = inicial.

Los ids de ventas, líneas y préstamos son `randomUUID()`. Correr el comando dos veces da los mismos conteos, sumas y estados (CA-3).

### Rango del panel
Ventas y Conciliar muestran el día de hoy. El historial cae en las 2 h anteriores a `now`, así que `demo:reset` se corre justo antes de la demo (está en la lista de preparación del guion).

## 3. Archivos

| Repo | Archivo | Cambio |
|---|---|---|
| backend | `src/dev/demo.ts` | Nuevo: `DEMO_PRODUCTS`, `DEMO_DEVICE_ID`, `demoHistory`, `resetDemo` |
| backend | `src/db/cli.ts` | Comando `demo-reset` |
| backend | `package.json` | Script `demo:reset` |
| backend | `test/demo.test.ts` | Nuevo: CA-1..CA-4 |
| docs | `docs/demo/guion.md` | Nuevo |
| docs | `ROADMAP.md`, `PROGRESS.md`, `DEVLOG.md`, `TECH_DEBT.md`, `specs/README.md` | Cierre |

Sin cambios de esquema, de contratos HTTP ni en la app.

## 4. Pruebas
- **Automáticas** (`test/demo.test.ts`, contra `posde_test`):
  - CA-1: base sucia (préstamo activo, venta, teléfono dado de baja, producto extra, fila en `admin_audit`), luego `resetDemo` y comprobar el estado;
  - CA-2: `stockReport` todo `ok` y `reconciliation` del teléfono de demo todo `cuadra`;
  - CA-3: dos corridas con el mismo resultado;
  - CA-4: `assertDevDatabase` ya probado en `scenario.test.ts`; aquí se prueba que el comando lo llama.
- **A mano**: CA-5 y CA-6 en el emulador siguiendo el guion.

## 5. Constitución
No cambia reglas de venta, préstamo ni sync. El historial respeta "nunca sobrevender": cada venta está dentro de un préstamo cerrado y el reporte cuadra. Sin ADR.
