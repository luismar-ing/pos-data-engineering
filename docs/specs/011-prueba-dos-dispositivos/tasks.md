# SPEC-011 — Tareas

Rama: `spec/011-prueba-dos-dispositivos` (monorepo).

### pos-backend
- [x] **T1** [backend] `src/dev/scenario.ts` (`SCENARIO_STOCK`, `assertDevDatabase`, `resetScenario`, `STOCK_REPORT_SQL`, `checkStock`, `stockReport`) + comandos `reset-scenario` y `report` en `cli.ts` + scripts `scenario:reset` y `report:stock` + `test/scenario.test.ts` — *Verificación:* `npm test` verde con los casos de plan §6 (CA-2, CA-4, CA-8, CA-9); `npm run report:stock` contra `posde` imprime la tabla
- [x] **T2** [backend] Pruebas de lote cortado y envíos simultáneos en `test/sync.test.ts`; si fallan, corregir `syncService` y anotarlo en Cambios de la spec — *Verificación:* `npm test` verde (CA-5, CA-6); `tsc` ok

### pos-app
- [x] **T3** [app] `markStatement` en `syncSql.ts`, usado por `applyResults`; prueba de respuesta perdida en `test/sync.test.mjs` — *Verificación:* `npm test` verde (CA-7); `tsc` ok

### Dos emuladores
- [x] **T4** [app] Emulador `pos_pixel` aligerado en la mitad derecha de la pantalla, con la app abierta contra el backend local (`10.0.2.2`); el segundo dispositivo es el teléfono (P1, ver Cambios) (depende de T1) — *Verificación:* captura del emulador con la app en Venta y toques < 1 s; el teléfono con la app conectada al mismo backend
- [x] **T5** [docs] `docs/testing/dos-dispositivos.md`: preparar, vender sin red, reconectar, cerrar sesión y reporte en cada paso, con tabla de corridas (depende de T1, T4)
- [x] **T6** [app, backend] Primera corrida del procedimiento con los dos emuladores (depende de T5) — *Verificación:* CA-1..CA-4 con capturas y `report:stock` en `ok` tras cada paso; resultados en la tabla de corridas

### Cierre
- [x] **T7** [docs] `ARCHITECTURE.md` (comandos y cuenta de stock); `TECH_DEBT.md` (TD-027 a resueltos); `PROGRESS.md`, `DEVLOG.md` (primera corrida), `ROADMAP.md`, README de specs → Done — *Verificación:* CA-1..CA-9 revisados; `tsc --noEmit` y `npm test` verdes en los dos repos
