# SPEC-009 — Plan técnico

## 1. Enfoque

### Solo app, solo lectura
Todo sale de tablas que ya existen: `sales`, `sale_items`, `products`, `sessions` y `stock_leases`. No hay cambios de backend ni de contratos, y no se escribe ningún dato. Lo único que cambia en el esquema son índices nuevos para que las consultas aguanten 10 000 ventas (RNF-2).

### Consultas de agregación en SQLite, fórmulas en TypeScript puro
- **El SQL** va en `features/analytics/data/analyticsSql.ts`, sin imports, para probarlo con `node:sqlite` como en las specs anteriores:
  - `TARGET_SESSION_SQL`: la sesión abierta o, si no hay, la última cerrada (RF-9);
  - `WINDOW_SALES_SQL`: unidades por producto desde el inicio de la ventana, con nombre y hora de la primera venta (RF-1, RF-2);
  - `SESSION_TOTALS_SQL`: ventas e ingreso de la sesión, desde `sales`;
  - `SESSION_UNITS_SQL`: unidades de la sesión, desde `sale_items` (va aparte para no duplicar el ingreso al hacer el join);
  - `TOP_PRODUCTS_SQL`: los 5 más vendidos de la sesión, por unidades, con su ingreso (RF-7, P4);
  - lo disponible de cada producto sale del `AVAILABLE_SQL` de SPEC-005, que ya existe.
- **Las fórmulas** van en `features/analytics/domain/metrics.ts`, puras y probadas:
- `windowMinutes(nowMs, firstSaleMs)`: minutos desde la primera venta del teléfono dentro de la ventana de 10 min, sin importar la sesión, entre 1 y 10 (P1). Sin ventas, 10 (el ritmo es 0 de todos modos).
  - `burnRate(units, minutes)` = unidades ÷ minutos.
  - `buildRunout(windowRows, available, minutes)` arma la lista de Runout Time (P7):
    - entra todo producto con ventas en la ventana: disponible ÷ ritmo, o "Agotado" si no le queda cuota o no tiene préstamo;
    - entra todo préstamo activo con 0 disponible: "Agotado";
    - el resultado va ordenado del que se agota antes al que se agota después, con los agotados primero, y marca `low` si se agota en menos de 5 min (RF-5, RF-6, P5);
    - también devuelve cuántos préstamos con cuota no tienen ventas en la ventana (RF-4).
  - `averageTicketCents(revenue, sales)`: redondeado a centavos enteros; 0 si no hay ventas (P6, RNF-3).
- **El repositorio** `analyticsRepository.ts` → `getDashboard(nowMs)` corre las consultas una tras otra, sin bloquear el render (RNF-1). Arma el resultado con las fórmulas y, en `__DEV__`, deja en el log cuánto tardó (CA-7).

### Pantalla Dashboard
`features/analytics/ui/DashboardScreen.tsx` reemplaza el texto de relleno de `RootNavigator`. Tiene cuatro secciones:
1. **Ritmo:** unidades por minuto en total.
2. **Se agota:** la lista de Runout Time, con los que se agotan pronto en ámbar, más "N productos con préstamo sin ventas recientes".
3. **Más vendidos:** el top 5 con unidades e ingreso.
4. **Sesión:** ventas, unidades, ingreso y ticket promedio. Arriba dice "Sesión de Ana (abierta)" o "Última sesión: Ana, 10:00–18:00".

Cuándo recalcula (RF-10, P3):
- al enfocar la pestaña (`useFocusEffect`);
- cada 15 s mientras está enfocada, y el intervalo se detiene al salir;
- cuando cambia `leasesUpdatedAt`. Ese valor ya cambia tras cada cobro (SPEC-005) y cuando cambian los préstamos, así que sirve para los dos casos.

Si llega otro recálculo mientras uno sigue en curso, se ignora: una sola consulta a la vez.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1, RF-2 | `WINDOW_SALES_SQL`; `metrics.ts` → `windowMinutes`, `burnRate` | Unidades por producto y en total ÷ minutos de la ventana |
| RF-3 | `metrics.ts` → `buildRunout` | Disponible (`AVAILABLE_SQL`) ÷ ritmo |
| RF-4 | `buildRunout` | Sin ventas en la ventana ⇒ sin estimación; se cuentan aparte |
| RF-5 | `buildRunout` → `low`; `DashboardScreen` | Menos de 5 min ⇒ ámbar |
| RF-6 | `buildRunout` | Agotados primero, luego por minutos de menor a mayor |
| RF-7 | `TOP_PRODUCTS_SQL` | `order by units desc, revenue desc limit 5` |
| RF-8 | `SESSION_TOTALS_SQL`, `SESSION_UNITS_SQL`; `averageTicketCents` | Ventas, unidades, ingreso, ticket |
| RF-9 | `TARGET_SESSION_SQL` | `order by closed_at is not null, opened_at desc limit 1` |
| RF-10 | `DashboardScreen` | Foco, intervalo de 15 s, `leasesUpdatedAt` |
| RF-11 | — | Solo SQLite local |
| RNF-1 | `analyticsRepository.ts`; `DashboardScreen` | `await` fuera del render; una consulta a la vez |
| RNF-2 | Migración v5 (índices) | §4; prueba de tiempo con `node:sqlite` y medición en el teléfono |
| RNF-3 | `formatCents` | Formato de dinero existente |
| RNF-4 | `DashboardScreen` | `accessibilityLabel` en cada cifra, con unidades escritas |
| RNF-5 | `test/analytics.test.mjs` | §6 |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/core/db/migrations.ts` | Modificar | v5: índices (§4) |
| `src/features/analytics/data/analyticsSql.ts` | Crear | Las cinco consultas de §1 |
| `src/features/analytics/domain/metrics.ts` | Crear | `WINDOW_MINUTES = 10`, `LOW_RUNOUT_MINUTES = 5`, `TOP_LIMIT = 5`; `windowMinutes`, `burnRate`, `buildRunout`, `averageTicketCents` |
| `src/features/analytics/data/analyticsRepository.ts` | Crear | `getDashboard(nowMs)` |
| `src/features/analytics/ui/DashboardScreen.tsx` | Crear | §1 |
| `src/navigation/RootNavigator.tsx` | Modificar | `DashboardScreen` en vez del texto de relleno |
| `test/analytics.test.mjs` | Crear | §6 |

### pos-backend
Sin cambios.

## 4. Modelo de datos y migraciones
SQLite v5, solo índices. No se tocan datos:
```sql
create index idx_sales_created_at on sales(created_at);
create index idx_sales_session on sales(session_id);
create index idx_sale_items_sale on sale_items(sale_id);
```

## 5. Contratos HTTP
Sin cambios.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria | `windowMinutes`: primera venta hace 3 min ⇒ 3; hace 10 ⇒ 10; hace segundos ⇒ 1; sin ventas ⇒ 10. Pico: 4 u en menos de 1 min ⇒ 4,0 u/min con sesión vieja | P1, CA-1 |
| Unitaria | `burnRate(10, 10) = 1`; `buildRunout` con 20 disponibles ⇒ 20 min | CA-1, CA-2 |
| Unitaria | `buildRunout`: sin ventas ⇒ fuera de la lista y contado; cuota 0 ⇒ "Agotado" primero; menos de 5 min ⇒ `low`; orden | CA-3, CA-4, RF-6, P7 |
| Unitaria | `averageTicketCents`: redondeo y 0 sin ventas | RF-8 |
| SQL (`node:sqlite`) | Con las migraciones reales: 3 ventas (Agua × 2, Papas × 1; Agua × 1) ⇒ top Agua 3 u, Papas 1 u; totales 3 ventas, 4 u, ingreso correcto | CA-5 |
| SQL (`node:sqlite`) | `TARGET_SESSION_SQL`: la abierta gana; sin abierta, la última cerrada; sin sesiones, nada | RF-9, CA-8 |
| SQL (`node:sqlite`) | `WINDOW_SALES_SQL` ignora ventas anteriores a la ventana | RF-1 |
| SQL (`node:sqlite`) | 2 000 productos y 10 000 ventas: el conjunto de consultas tarda menos de 200 ms en la PC (referencia de RNF-2) | CA-7 |
| Manual (teléfono) | CA-1..CA-6 y CA-8 cobrando y mirando el panel, con y sin red; CA-7 con el tiempo del log usando los datos que haya en el teléfono | CA-1..CA-8 |

`getDashboard` y la pantalla usan expo-sqlite; se cubren a mano. El SQL y las fórmulas se prueban con `node:sqlite`.

## 7. Riesgos y alternativas descartadas
- **CA-7 en el teléfono depende de los datos que tenga.** Cargar 10 000 ventas en el teléfono pediría una herramienta de desarrollo que no está en el alcance. La medición con `node:sqlite` usa el mismo SQL e índices como referencia. En el teléfono se mide con los datos reales.
- **Una tabla de agregados que se actualiza en cada cobro** quedó descartada: sería más rápida de leer, pero agrega escrituras al cobro y estado que mantener. Con índices, las consultas directas bastan.
- **Calcular en un worker** quedó descartado: expo-sqlite ya ejecuta las consultas fuera del hilo de JS y devuelve promesas. El trabajo en JS es pequeño: como mucho, unas filas por producto.
- **Ritmo con media móvil ponderada o predicción:** fuera de alcance. La spec pide el promedio de la ventana.

## 8. Chequeo de constitución
- [x] Nunca sobrevender — solo lectura; no toca cuotas
- [x] Offline-first — solo datos locales
- [x] Eventos inmutables — no escribe en `event_log`
- [x] Idempotencia — no aplica (solo lectura)
- [x] UI fluida — consultas asíncronas con índices, una a la vez, fuera del render
- [x] Contratos documentados — sin cambios de HTTP
