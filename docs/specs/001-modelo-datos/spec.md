# SPEC-001 — Modelo de datos unificado

| Campo | Valor |
|---|---|
| Estado | Approved |
| Fase | 0 — Cimientos |
| Repos | app, backend |
| Depende de | — |
| Creada | 2026-10-29 |
| Actualizada | 2026-10-30 |

## 1. Contexto y problema
El esquema SQLite de la app no se puede ejecutar (errores de sintaxis, TD-001..003) y tiene restricciones incorrectas (TD-004). Además, la app y el backend modelan la venta de forma distinta (TD-006): la app guarda venta + líneas y el backend recibe un evento por producto. Sin un modelo común, ninguna spec posterior (venta, leases, sync) puede definirse con seguridad.

## 2. Objetivo
Tener un modelo de datos único, documentado y versionado, que la app pueda crear sin errores y que el backend pueda recibir sin traducciones ambiguas.

## 3. Historias de usuario
- Como **desarrollador**, quiero que la BD local se cree sin errores al abrir la app, para poder construir las funcionalidades encima.
- Como **desarrollador**, quiero que una venta tenga la misma forma en app y backend, para que la sincronización sea una copia y no una traducción.
- Como **desarrollador**, quiero que los cambios de esquema futuros se apliquen a BD ya instaladas, para no tener que borrar datos de prueba.

## 4. Requisitos funcionales
- **RF-1** La BD local se crea sin errores en un dispositivo limpio.
- **RF-2** El esquema local tiene versión; al abrir la app se aplican las migraciones pendientes en orden.
- **RF-3** Una venta se compone de cabecera (id, dispositivo, total, método de pago, fecha) y líneas (producto, cantidad, precio unitario).
- **RF-4** Cada venta genera exactamente un evento en la bitácora cuyo `payload` contiene la venta completa (cabecera + líneas).
- **RF-5** El backend almacena la venta con la misma estructura (cabecera + líneas) y usa el id del evento/venta para la idempotencia.
- **RF-6** Los leases se identifican por dispositivo y producto en ambos lados.
- **RF-7** Los montos se almacenan sin errores de redondeo.

## 5. Requisitos no funcionales
- **RNF-1** Las migraciones son idempotentes: ejecutarlas dos veces no rompe la BD.
- **RNF-2** Todo acceso a BD en la app es asíncrono.
- **RNF-3** El modelo está documentado en `ARCHITECTURE.md` §4.

## 6. Criterios de aceptación
- **CA-1** Dado un dispositivo sin la app, cuando se instala y abre, entonces la BD se crea con todas las tablas y no hay errores en consola.
- **CA-2** Dada una BD en versión N, cuando se abre una app con migración N+1, entonces la BD queda en N+1 y los datos previos se conservan.
- **CA-3** Dados dos productos con el mismo stock, cuando se insertan, entonces ambos se guardan.
- **CA-4** Dada una venta de 3 líneas, cuando se registra, entonces existen 1 `sale`, 3 `sale_items` y 1 evento cuyo payload reproduce la venta completa.
- **CA-5** Dado un mismo evento de venta enviado dos veces al backend, entonces queda una sola venta con sus líneas.
- **CA-6** Dada una venta de 3 × $0.10, entonces el total guardado es exactamente $0.30.

## 7. Fuera de alcance
- Lógica de cálculo y congelado de leases (SPEC-005).
- Pipeline de sincronización y reintentos (SPEC-008).
- Pantallas de venta (SPEC-007).

## 8. Preguntas abiertas
- [x] **P1** ¿Evento por venta (con líneas en el payload) o evento por línea? *Recomendación: por venta (RF-4), más simple de hacer idempotente y atómico.*
- [x] **P2** ¿Montos en centavos enteros en la app? *Recomendación: sí (`integer`), convertir solo en la UI.*
- [x] **P3** ¿`stock_leases` local se liga a `device_id` (fijo) o a `session_id` (por turno)? *Recomendación: `device_id` + `lease_id` emitido por el servidor; la sesión se define en SPEC-003.*
- [x] **P4** ¿Se elimina la tabla `sale_events` del backend o se mantiene como vista/derivada para el promedio móvil? *Recomendación: reemplazar por `sales` + `sale_items`, y el promedio móvil consulta `sale_items`.*

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-10-29 | Creación | Revisión inicial del proyecto |
| 2026-10-30 | Approved: P1–P4 aceptadas según recomendación | Decisión del usuario |
