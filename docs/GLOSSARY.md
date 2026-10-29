# Glosario

| Término (ES) | En código | Definición |
|---|---|---|
| Arrendamiento de stock / préstamo | `lease`, `stock_lease`, ruta `/prestamos` | Cuota de inventario que el servidor congela y asigna a un dispositivo para vender sin red |
| Cuota | `quota_total`, `quota_used` | Unidades arrendadas y unidades ya vendidas de un lease |
| Stock central | `central_stock` | Inventario en el servidor no arrendado a ningún dispositivo |
| Promedio móvil | `rollingAverage` | Unidades vendidas por minuto en una ventana reciente (`SESSION_MINUTES`) |
| Margen de lease | `LEASE_MARGIN` | Factor de seguridad sobre la demanda estimada (hoy 1.2) |
| Bitácora | `event_log` | Registro append-only de eventos de venta pendientes de sincronizar |
| Evento | `event`, `event_id` (UUID) | Hecho inmutable (p. ej. venta) generado en el dispositivo |
| Sincronización por lotes | `sync`, Batch ETL | Envío de eventos pendientes al servidor al recuperar red |
| Idempotente | `on conflict do nothing` | Reenviar un evento no lo duplica |
| Burn Rate | `burnRate` | Velocidad de venta local (unidades/min) |
| Runout Time | `runoutTime` | Tiempo estimado hasta agotar la cuota local |
| Recibo QR | `receiptQr` | Recibo completo comprimido dentro de un código QR |
| Dispositivo | `device_id` | Identificador estable del teléfono/terminal POS |
| Sesión | `session_id` | Periodo de trabajo de un vendedor en un dispositivo |
