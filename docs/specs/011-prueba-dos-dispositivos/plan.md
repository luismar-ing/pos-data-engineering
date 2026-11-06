# SPEC-011 — Plan técnico

## 1. Enfoque

### Lo que no cambia
- No cambian las reglas de préstamo ni de sync, ni el esquema, ni los contratos HTTP.
- Lo nuevo son dos comandos de desarrollo en el backend, pruebas automatizadas y un procedimiento escrito.
- Si una prueba encuentra un error, se corrige aquí y se anota en Cambios de la spec.

### La cuenta que debe cuadrar
Todo lo que entra o sale del stock central pasa por los préstamos (SPEC-005):
- pedir un préstamo resta `quota_total` del stock central;
- cerrarlo devuelve `quota_total − quota_used`.

Las ventas que llegan por sync no tocan el stock (SPEC-008 RF-11). Por lo tanto, para cada producto:

```
stock central + Σ quota_total (préstamos active) + Σ quota_used (préstamos released) = stock inicial
```

Hay sobreventa si las unidades de `sale_items` del producto superan el stock inicial (RF-5).

### Escenario y reporte (backend)
`src/dev/scenario.ts`, sin Express:
- **`SCENARIO_STOCK`**: el stock inicial de los cinco productos de desarrollo. Son los del seed, pero "Hot dog" queda en 10 (P2).
- **`assertDevDatabase(dbUrl)`**: lanza un error si el nombre de la base no es `posde` ni `posde_test` (RNF-3, CA-9).
- **`resetScenario(pool)`**, en una transacción:
  1. `delete` de `sync_events`, `sale_items`, `sales`, `sessions` y `stock_leases`;
  2. corre el seed (`on conflict do nothing`), para que existan los productos;
  3. `update products set central_stock = …, active = true` según `SCENARIO_STOCK`.

  No borra `devices`: un teléfono ya registrado no se vuelve a registrar solo y quedaría con 401.
- **`STOCK_REPORT_SQL`**: por producto, stock central, cuota activa (`sum … filter (where status = 'active')`), vendido informado (`… status = 'released'`) y unidades por sync (subconsulta sobre `sale_items`).
- **`checkStock(rows)`**: función pura. Agrega a cada fila `initial`, `balance` (central + activa + informado) y `status`:
  - `ok`;
  - `inconsistente: el total no cuadra`;
  - `inconsistente: sync vende más que el stock`;
  - `sin escenario`, para un producto que no está en `SCENARIO_STOCK`.

`src/db/cli.ts` suma dos comandos, y `package.json` dos scripts:
- `npm run scenario:reset` → `cli.ts reset-scenario`. Primero llama a `assertDevDatabase(config.dbUrl)`.
- `npm run report:stock` → `cli.ts report`. Imprime la tabla con `console.table` y termina con código 1 si algún producto sale inconsistente, así sirve en un script.

### Reintentos de sync
- **RF-7, RF-8 (backend):** dos pruebas nuevas en `test/sync.test.ts` contra `posde_test`, con el servidor real:
  - **lote cortado:** se envían los 2 primeros de 4 eventos y luego el lote completo. Esperado: `duplicate, duplicate, inserted, inserted`, 4 ventas y 4 filas en `sync_events`;
  - **envíos simultáneos:** `Promise.all` de dos `POST` con el mismo lote de 5 eventos. Esperado: los dos responden 200, cada evento sale `inserted` en un envío y `duplicate` en el otro, y hay 5 ventas.

  El servidor ya debería cumplir las dos: `insert … on conflict do nothing` en la transacción de cada evento hace que la segunda espere a la primera. Si falla, se corrige `syncService`.
- **RF-9 (app):** se saca de `applyResults` la decisión de qué SQL corre según el resultado, a una función pura `markStatement(result, nowIso)` en `syncSql.ts`. `applyResults` la usa y `test/sync.test.mjs` también, con `node:sqlite`. La prueba sigue este orden:
  1. se envía el lote y la respuesta no llega: no se aplica nada y el evento sigue `pending`;
  2. se reenvía y el servidor responde `duplicate`: el evento pasa a `synced` y su contenido no cambia.

### Dos emuladores (P1, P3)
- **Segundo AVD:** `pos_pixel_2`, con la misma imagen (Android 16, Google Play, x86_64).
- **Pantalla:** los dos se abren en la mitad derecha, uno al lado del otro. Las ventanas se mueven con `SetWindowPos` (PowerShell + `user32.dll`) según el área de trabajo de la pantalla.
- **App:** se instala Expo Go en el segundo emulador y los dos abren `exp://<IP de la PC>:8081` con `adb -s <serial> shell am start -a android.intent.action.VIEW -d …`. Para empezar limpio: `adb -s <serial> shell pm clear host.exp.exponent`.
- **Corte de red:** `adb -s <serial> shell cmd connectivity airplane-mode enable|disable`. La app pasa a "Sin conexión" cuando `/health` deja de responder (SPEC-006).
- **Procedimiento:** queda en `docs/testing/dos-dispositivos.md` (P5): preparar, vender sin red, reconectar, cerrar sesión y el reporte en cada paso, con una tabla de resultados por corrida.

Con el mínimo de préstamo de 5 (`LEASE_PARAMS`), cada emulador recibe 5 de los 10 hot dogs y el stock central queda en 0:
- **CA-1:** cada emulador vende 5 sin red y la app lo bloquea en la sexta.
- **CA-3:** con uno sin red y su cuota sin vender, el otro pide préstamo y recibe `unavailable`.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | `docs/testing/dos-dispositivos.md` | Pasos y tabla de resultados |
| RF-2 | `scenario.ts` → `resetScenario`; `npm run scenario:reset` | Borra préstamos, ventas, eventos y sesiones; stock fijo |
| RF-3 | Procedimiento: `adb … airplane-mode` | Corte por emulador, sin tocar la PC |
| RF-4 | `STOCK_REPORT_SQL`; `npm run report:stock` | Tabla por producto |
| RF-5 | `checkStock` | Cuenta de §1 y unidades por sync ≤ inicial |
| RF-6 | `STOCK_REPORT_SQL` | Solo `select` |
| RF-7, RF-8 | `test/sync.test.ts` | Lote cortado y `Promise.all` |
| RF-9 | `syncSql.ts` → `markStatement`; `test/sync.test.mjs` | Sin respuesta ⇒ `pending`; `duplicate` ⇒ `synced` |
| RNF-1 | Dos AVD, mitad derecha | §1 |
| RNF-2 | Una consulta agregada | Se mide al correr el reporte |
| RNF-3 | `assertDevDatabase` | Solo `posde` / `posde_test` |
| RNF-4 | — | `tsc` y `npm test` en los dos repos |

## 3. Cambios por repo

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `src/dev/scenario.ts` | Crear | `SCENARIO_STOCK`, `assertDevDatabase`, `resetScenario`, `STOCK_REPORT_SQL`, `checkStock`, `stockReport(pool)` |
| `src/db/cli.ts` | Modificar | Comandos `reset-scenario` y `report` |
| `package.json` | Modificar | `scenario:reset`, `report:stock` |
| `test/scenario.test.ts` | Crear | §6 |
| `test/sync.test.ts` | Modificar | Lote cortado y envíos simultáneos |

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/core/sync/syncSql.ts` | Modificar | `markStatement(result, nowIso)` |
| `src/core/sync/syncRepository.ts` | Modificar | `applyResults` usa `markStatement`; el tipo `EventResult` pasa a `syncSql.ts` y se reexporta |
| `test/sync.test.mjs` | Modificar | Prueba de RF-9 |

### docs
| Archivo | Detalle |
|---|---|
| `docs/testing/dos-dispositivos.md` | Crear: procedimiento y tabla de corridas |
| `ARCHITECTURE.md` | Comandos `scenario:reset` y `report:stock`; la cuenta de §1 |
| `TECH_DEBT.md` | TD-027 a resueltos |
| `PROGRESS.md`, `DEVLOG.md`, `ROADMAP.md`, README de specs | Cierre |

## 4. Modelo de datos y migraciones
Sin cambios. El "stock inicial" es `SCENARIO_STOCK` en el código: el reinicio fija esos valores y el reporte compara contra ellos. Con datos que no salen de un reinicio, el reporte puede marcar inconsistencias; el procedimiento lo aclara.

## 5. Contratos HTTP
Ninguno nuevo.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria | `assertDevDatabase` acepta `posde` y `posde_test`, y rechaza `posde_prod`, `postgres` y una URL inválida | CA-9 |
| Unitaria | `checkStock`: ok, total que no cuadra, sync que vende más que el stock, producto sin escenario | CA-8 |
| Integración (`posde_test`) | `resetScenario` deja "Hot dog" en 10 y sin préstamos ni ventas; luego dos dispositivos piden préstamo, uno vende y cierra, y el reporte da `ok`; después, alterando `central_stock` o metiendo ventas de más, sale inconsistente | CA-2, CA-4, CA-8 |
| Integración (`posde_test`) | Lote cortado | CA-5 |
| Integración (`posde_test`) | Envíos simultáneos | CA-6 |
| Unitaria (`node:sqlite`) | Respuesta perdida, luego `duplicate` ⇒ `synced` sin cambiar el evento | CA-7 |
| Manual (2 emuladores) | Procedimiento completo: CA-1..CA-4, con capturas y el reporte en cada paso | CA-1..CA-4 |

## 7. Riesgos y alternativas descartadas
- **Dos emuladores ponen la PC lenta** (15.7 GB de RAM): se usa `-no-snapshot-save` y `-gpu auto`. Si no alcanza, el teléfono reemplaza al segundo emulador (P1).
- **La red del emulador no se corta del todo con modo avión:** la alternativa es `adb emu network` o quitar el wifi con `svc wifi disable`. Se anota en el procedimiento.
- **Descartado: una tabla de línea base en Postgres.** Agrega una tabla al esquema de producción solo para pruebas; la constante alcanza.
- **Descartado: una ruta `GET /admin/stock`.** Pide autenticación de administrador y contrato; un comando de terminal alcanza (P4).
- **Descartado: un script que maneje los dos emuladores solo.** Es frágil (coordenadas, tiempos) y queda fuera de alcance.

## 8. Chequeo de constitución
- [x] Nunca sobrevender: es lo que se prueba; no cambian las reglas.
- [x] Offline-first: sin cambios.
- [x] Eventos inmutables: `markStatement` solo cambia metadatos de sync; la prueba lo verifica.
- [x] Idempotencia: lote cortado y envíos simultáneos.
- [x] UI fluida: sin cambios de UI.
- [x] Contratos documentados: no hay rutas nuevas; los comandos van a `ARCHITECTURE.md`.
