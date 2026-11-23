# Diario de decisiones

Las decisiones del proyecto en orden cronológico. Cada una enlaza su detalle: un ADR (decisión de arquitectura), una spec (pregunta abierta resuelta o "Cambios") o el [DEVLOG](DEVLOG.md). El uso de IA está en [BITACORA_IA.md](BITACORA_IA.md).

| Fecha | Decisión | Por qué | Alternativas descartadas | Detalle |
|---|---|---|---|---|
| 2026-09 (registrada el 2026-10-29) | Expo + React Native, expo-sqlite y Zustand en la app; Express + PostgreSQL en el backend | SQLite local para vender sin red y control directo del SQL para préstamos y sync | Flutter + Drift; WatermelonDB/Realm; ORM (Prisma/Drizzle) | [ADR-0002](adr/0002-stack-tecnologico.md) |
| 2026-09 (registrada el 2026-10-29) | Stock Leasing con bitácora append-only y eventos con UUID | Vender sin red sin sobrevender y sincronizar sin duplicar | Bloquear la venta sin red; vender libremente y reconciliar; CRDTs | [ADR-0003](adr/0003-stock-leasing-y-event-log.md) |
| 2026-10-29 | Adoptar Spec-Driven Development, con docs en la raíz | El proyecto creció sin especificación; las specs cruzan app y backend | Seguir sin specs; docs dentro de cada repo | [ADR-0001](adr/0001-adoptar-sdd.md) |
| 2026-10-29 | Monorepo sin npm workspaces | Las specs tocan los dos lados; un solo PR por funcionalidad | Dos repos con docs en un tercero; monorepo con npm workspaces | [ADR-0004](adr/0004-monorepo.md) |
| 2026-10-30 | Venta = cabecera + líneas, montos en centavos enteros, migraciones versionadas en los dos lados | El modelo de app y backend no coincidía; los `real` pierden centavos | Mantener `sale_events`; montos decimales | [SPEC-001](specs/001-modelo-datos/spec.md) |
| 2026-10-30 | Postgres propio del proyecto en Docker (puerto 5434) | No tocar la BD vieja `posapp` | Migrar la BD vieja | [DEVLOG](DEVLOG.md) |
| 2026-10-30 | Expo SDK 58 | Expo Go actual ya no abría SDK 57 | Development build | [ADR-0005](adr/0005-expo-sdk-58.md) |
| 2026-10-30 | Errores con forma única y runner de migraciones propio | Respuestas predecibles para la app; sin dependencias pesadas | `node-pg-migrate`/`knex`; migraciones aplicadas por Docker; errores RFC 7807 | [ADR-0006](adr/0006-errores-y-migraciones-backend.md) |
| 2026-10-30 | El teléfono genera su identificador y su credencial, guardada en Keychain/Keystore; el servidor guarda solo el hash; el vendedor solo escribe su nombre | Registro sin cuentas de usuario y sin exponer el secreto | Credencial en SQLite; vendedor con contraseña o PIN | [SPEC-003](specs/003-identidad-dispositivo/spec.md) |
| 2026-10-30 | Los productos dados de baja quedan inactivos, no se borran | Las ventas y los préstamos los referencian | Borrado físico | [SPEC-004](specs/004-catalogo/spec.md) |
| 2026-11-01 | El precio se fija al cobrar, no al agregar al carrito | Un cambio de precio aplica en el siguiente cobro | Precio congelado al agregar | [SPEC-007](specs/007-flujo-venta/spec.md) |
| 2026-11-03 | "En línea" = el servidor responde `/health`, no el estado de red del sistema | Un Wi-Fi sin internet o un servidor caído también son "sin conexión" | Usar solo el estado de red | [SPEC-006](specs/006-conectividad/spec.md) |
| 2026-11-03 | Tasa de consumo por dispositivo | Cada vendedor tiene su ritmo; uno lento no debe acaparar | Tasa global por producto | [SPEC-005](specs/005-stock-leasing/spec.md) |
| 2026-11-03 | El servidor nunca devuelve stock sin informe del teléfono | Devolverlo por plazo podía sobrevender (principio 1) | Devolver a las 2 h 15 min | [SPEC-005](specs/005-stock-leasing/spec.md), luego [ADR-0008](adr/0008-tope-sin-red-y-baja-de-dispositivo.md) |
| 2026-11-03 | Idempotencia de sync con una tabla de eventos recibidos y una transacción por evento | Un evento malo no tumba el lote; reenviar es seguro | Idempotencia por id de entidad; un savepoint por lote | [SPEC-008](specs/008-sync-etl/spec.md) |
| 2026-11-04 | Analítica con consultas directas sobre SQLite, sin agregados precalculados | Con índices tarda < 200 ms con 10 000 ventas | Tabla de agregados y worker | [SPEC-009](specs/009-edge-analytics/spec.md) |
| 2026-11-04 | El ritmo de venta cuenta desde la primera venta del teléfono en la ventana | Avisar tarde en un pico cuesta ventas | Dividir siempre entre 10 min | [SPEC-009](specs/009-edge-analytics/spec.md) |
| 2026-11-05 | Recibo QR en texto plano de máximo 1 000 bytes | La cámara del cliente lo lee sin app ni red | Recibo comprimido; varios QR | [SPEC-010](specs/010-recibo-qr/spec.md) |
| 2026-11-06 | Prueba de dos dispositivos con un emulador y el iPhone | Dos emuladores dejaban la PC sin RAM | Dos emuladores | [SPEC-011](specs/011-prueba-dos-dispositivos/spec.md) |
| 2026-11-13 | Rediseño "Señalética de feria" | Legible con sol, prisa y una mano ocupada | Otras dos propuestas de diseño | [SPEC-012](specs/012-rediseno-visual/spec.md) |
| 2026-11-13 | Panel de administración dentro de la app, con token opaco y scrypt | Un solo producto; sin dependencias nativas | Panel web; JWT firmado; bcrypt/argon2; reutilizar `devices` con un rol | [ADR-0007](adr/0007-autenticacion-administrador.md) |
| 2026-11-17 | Tope sin red de 30 min y devolución de la cuota de un teléfono dado de baja | Recuperar la cuota de un teléfono perdido sin sobrevender | Sin tope; devolver al instante; tope de 2 h | [ADR-0008](adr/0008-tope-sin-red-y-baja-de-dispositivo.md) |
| 2026-11-22 | Comando `demo:reset` con catálogo de feria e historial de un teléfono de demo | Empezar cada demo igual y con el panel con datos | Datos a mano antes de cada demo | [SPEC-015](specs/015-demo/spec.md) |
| 2026-11-22 | Backend de demo en Render y APK compilado en local, publicado como Release de GitHub | Que el profesor pruebe la app sin la PC del alumno | Backend en la PC; Neon; EAS Build; Snack | [ADR-0009](adr/0009-despliegue-render-y-apk.md) |
