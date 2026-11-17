# Glosario

| Término (ES) | En código | Definición |
|---|---|---|
| Arrendamiento de stock / préstamo | `lease`, `stock_lease`, ruta `/prestamos` | Cuota de inventario que el servidor congela y asigna a un dispositivo para vender sin red |
| Cuota | `quota_total`, `quota_used` | Unidades arrendadas y unidades ya vendidas de un lease |
| Stock central | `central_stock` | Inventario en el servidor no arrendado a ningún dispositivo |
| Tasa de consumo | `calculateLeaseQty` (`leaseService`) | Unidades por minuto que vendió un dispositivo de un producto, según los préstamos que cerró en la ventana reciente (`LEASE_PARAMS.windowMinutes`) |
| Cerrar préstamo | `close`, estado `closing` | Informar lo vendido y devolver el resto al stock central; en `closing` el préstamo ya no vende |
| Margen de lease | `LEASE_PARAMS.margin` | Factor de seguridad sobre la demanda estimada (hoy 1.2) |
| Bitácora | `event_log` | Registro append-only de eventos de venta pendientes de sincronizar |
| Evento | `event`, `event_id` (UUID) | Hecho inmutable (p. ej. venta) generado en el dispositivo |
| Sincronización por lotes | `sync`, Batch ETL | Envío de eventos pendientes al servidor al recuperar red |
| Idempotente | `on conflict do nothing` | Reenviar un evento no lo duplica |
| Burn Rate | `burnRate` (`features/analytics/domain/metrics.ts`) | Velocidad de venta local: unidades del teléfono en los últimos 10 min ÷ minutos desde la primera de ellas (entre 1 y 10) |
| Runout Time | `buildRunout` (`metrics.ts`) | Tiempo estimado hasta agotar la cuota local: disponible ÷ Burn Rate |
| Recibo QR | `receiptQr` | Recibo completo en texto dentro de un código QR, legible con la cámara del cliente sin red (SPEC-010) |
| Dispositivo | `device_id` | Identificador estable del teléfono/terminal POS |
| Sesión | `session_id` | Periodo de trabajo de un vendedor en un dispositivo |
| Rol | `role` (`seller` / `admin`) | Modo en que se usa la app: Vendedor (sin login) o Administrador (con login) (SPEC-013) |
| Administrador | `admin` | Supervisor o dueño con cuenta y contraseña en el servidor; entra al panel de administración (SPEC-013) |
| Sesión de administrador | `admin_session` | Login vigente de un administrador; vence a las 8 h. Distinta de la sesión de vendedor (SPEC-013) |
| Baja de dispositivo | `revoke` | Acción del administrador: le impide pedir préstamos nuevos; la cuota vuelve al stock central tras el tope sin red más 2 min (SPEC-014) |
| Tope sin red | — | Tiempo (30 min) que un préstamo vencido puede seguir vendiendo sin red; pasado ese tiempo el producto queda agotado en el teléfono hasta renovar (SPEC-014) |
| Conciliación | `reconciliation` | Comparar lo que un dispositivo informó al cerrar un préstamo con las ventas que llegaron por sync de ese préstamo (SPEC-014) |
