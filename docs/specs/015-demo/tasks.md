# SPEC-015 — Tareas

- [x] **T1** [backend] `src/dev/demo.ts`: catálogo de 20 productos, historial fijo y `resetDemo` (RF-1..RF-5).
- [x] **T2** [backend] Comando `demo-reset` en `src/db/cli.ts` y script `npm run demo:reset`, con `assertDevDatabase` (RNF-1). (depende de T1)
- [x] **T3** [backend] `test/demo.test.ts`: CA-1..CA-4; `tsc` y `npm test` en verde. (depende de T1, T2)
- [x] **T4** [docs] `docs/demo/guion.md`: preparación, actos, plan B y tabla de ensayos (RF-6, RF-7).
- [x] **T5** [backend, app] Ensayo en el emulador: `demo:reset`, el guion completo salvo el segundo dispositivo, y una fila en la tabla de ensayos (CA-5, CA-6). (depende de T2, T4)
- [x] **T6** [docs] Cerrar: spec en Done; `specs/README.md`, `ROADMAP.md` (fases 4 y 5 cerradas), `PROGRESS.md` (incluida la rama), `DEVLOG.md` y `TECH_DEBT.md`.
