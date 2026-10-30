# Constitución del proyecto

Principios no negociables. Toda spec y todo plan debe cumplirlos; si una spec necesita romper uno, primero se escribe un ADR que lo cambie.

## Principios

1. **Nunca sobrevender.** Sin red, un dispositivo solo descuenta de su cuota arrendada (lease). Cuota en 0 ⇒ venta bloqueada para ese producto. El servidor es la única fuente de verdad del stock central.
2. **Offline-first.** Toda venta se escribe primero en SQLite local. La red es una optimización, no un requisito para cobrar.
3. **Eventos inmutables.** La bitácora (`event_log`) es append-only: no se hace `UPDATE` del contenido ni `DELETE` de eventos. Solo cambian metadatos de sincronización (`sync_status`, `synced_at`).
4. **Idempotencia.** Todo evento lleva un UUID generado en el dispositivo. Enviar el mismo lote N veces produce el mismo resultado que enviarlo una vez.
5. **UI fluida.** Las consultas analíticas y la sincronización no corren en el render ni bloquean interacciones. Las operaciones de BD son asíncronas.
6. **Spec primero.** Ninguna funcionalidad se implementa sin `spec.md` aprobada (ver `specs/SPEC_GUIDE.md`).
7. **Contratos explícitos.** Toda ruta HTTP entre app y backend está documentada en `ARCHITECTURE.md` (request, response, errores) antes de implementarse.

## Stack fijado

| Capa | Tecnología | Cambiar requiere ADR |
|---|---|---|
| App | Expo SDK 58, React Native 0.88, React 19.3, TypeScript estricto (ver ADR-0005) | Sí |
| Estado app | Zustand | Sí |
| BD local | expo-sqlite | Sí |
| Navegación | React Navigation 7 (bottom tabs) | No |
| Backend | Node + Express 5, TypeScript (ESM) | Sí |
| BD central | PostgreSQL 16 (Docker en dev) | Sí |

## Quality gates (para marcar una spec como Done)

- [ ] Todos los criterios de aceptación de la spec verificados.
- [ ] `tsc --noEmit` sin errores en el/los repos tocados.
- [ ] Pruebas automatizadas para la lógica de dominio (cálculo de lease, descuento de cuota, idempotencia de sync).
- [ ] Probado manualmente en dispositivo/emulador cuando hay UI, incluido el caso sin red.
- [ ] `PROGRESS.md` y `DEVLOG.md` actualizados.
