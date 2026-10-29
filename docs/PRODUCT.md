# Visión del producto

## Problema

En entornos de alta densidad o con conectividad inestable (festivales, transporte, tiendas con picos de demanda), varios vendedores venden el mismo inventario a la vez. Si la red cae, un POS tradicional o deja de vender o vende sin control y provoca **sobreventas** (vender stock que ya no existe).

## Solución

POS móvil híbrido que sigue vendiendo sin red **sin sobrevender**, gracias a tres piezas:

1. **Stock Leasing (arrendamiento dinámico de inventario).** Mientras hay red, el backend calcula la tasa de consumo de cada dispositivo (promedio móvil) y le asigna una cuota de inventario que queda congelada en el servidor. Sin red, el dispositivo solo puede vender lo que tiene arrendado; si la cuota llega a cero, bloquea la venta de ese producto.
2. **Edge Analytics.** Consultas de agregación (OLAP) sobre la base SQLite local, fuera del hilo de UI, que alimentan un panel con Burn Rate, Runout Time y ranking de productos.
3. **Batch ETL.** Cada venta offline se guarda como evento inmutable con UUID en una bitácora append-only. Al volver la red, un pipeline extrae, transforma (metadatos de sync) y carga los eventos al servidor de forma idempotente.

Complemento: **recibos QR offline** con el recibo completo comprimido en el código, legible desde la pantalla del cliente.

## Usuarios

| Rol | Necesidad |
|---|---|
| Vendedor | Cobrar rápido, con o sin red, sin preocuparse por el stock |
| Supervisor / dueño | Ver ventas consolidadas y no tener sobreventas |
| Cliente final | Recibir un comprobante aunque no haya red |

## Escenarios de uso

- Eventos masivos y festivales.
- Venta en servicios de transporte (sin red o con cortes).
- Puntos de cobro móviles en tiendas con alta demanda.

## Alcance

### Dentro (MVP)
- Catálogo descargado del servidor.
- Venta online y offline con descuento contra cuota arrendada.
- Bitácora append-only + sincronización por lotes idempotente.
- Solicitud y renovación de leases por producto.
- Panel local: Burn Rate, Runout Time, top productos.
- Recibo QR offline.

### Fuera (por ahora)
- Pagos con tarjeta integrados (solo se registra el método de pago).
- Facturación fiscal.
- Multi-tienda / multi-tenant.
- Panel web de administración (se evaluará después del MVP).

## Métricas de éxito

- 0 sobreventas en pruebas de corte de red con ≥ 2 dispositivos concurrentes.
- 0 eventos duplicados o perdidos tras reintentos de sincronización.
- Cobro completo en < 3 s en modo offline.
- El panel de analítica no bloquea la UI (sin frames perdidos al refrescar).
