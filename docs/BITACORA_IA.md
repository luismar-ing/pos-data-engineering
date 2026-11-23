# Bitácora de uso de IA

Registro de cómo se usó la inteligencia artificial en POS-DE: qué se le pidió, qué produjo, qué revisó o decidió la persona, y qué errores de la IA se encontraron y corrigieron. Las decisiones del proyecto están en [DIARIO_DECISIONES.md](DIARIO_DECISIONES.md); el detalle de cada sesión, en [DEVLOG.md](DEVLOG.md).

## Herramienta y forma de trabajo

- **Herramienta:** Claude Code (Anthropic), en la terminal y en la app de escritorio, con acceso al repositorio, a la terminal, a Docker, al emulador Android (`adb`) y a `gh`.
- **Desde cuándo:** 29 de octubre de 2026, cuando se adoptó Spec-Driven Development (ADR-0001). Los commits de septiembre (estructura base de la app, primer backend, primer `calculateLeaseQty`) no tienen registro de uso de IA.
- **Reglas que se le dieron a la IA** (`CLAUDE.md`, `docs/CONSTITUTION.md`, `docs/specs/SPEC_GUIDE.md`):
  - no escribir código de una funcionalidad sin `spec.md` aprobada;
  - cada fase (`spec.md`, `plan.md`, `tasks.md`) la aprueba la persona antes de pasar a la siguiente;
  - todo lo dudoso va a "Preguntas abiertas" con una respuesta propuesta, y la persona decide;
  - verificar antes de cerrar: `tsc`, `npm test` y prueba en el emulador o en el teléfono, incluido el caso sin red;
  - nunca commitear `.env`, ni contraseñas, ni trailers de coautoría de IA en los commits.
- **Reparto del trabajo:**

  | La IA | La persona |
  |---|---|
  | Redactar specs, planes, tareas, ADR y documentación | Aprobar o cambiar cada fase y cada pregunta abierta |
  | Escribir código, migraciones y pruebas automatizadas | Decidir las reglas de negocio (tasa por dispositivo, tope de 30 min, ritmo de venta, nube) |
  | Correr `tsc`, pruebas, Docker y el emulador; reportar resultados | Probar en el teléfono físico (iPhone) y confirmar los criterios de aceptación |
  | Proponer alternativas y recomendar una | Elegir entre alternativas; dar el visto bueno a commits, PR y fusiones |

## Registro por etapa

| Fecha | Etapa | Qué se pidió a la IA | Qué produjo | Qué revisó o decidió la persona | Errores de la IA encontrados |
|---|---|---|---|---|---|
| 2026-10-29 | Revisión y SDD | Revisar `pos-app` y `pos-backend` contra el planteamiento | Estructura `docs/` (constitución, glosario, arquitectura, plantillas), 18 hallazgos en `TECH_DEBT.md`, SPEC-001, ADR-0001..0003 | Adoptar SDD; centralizar docs en la raíz | — |
| 2026-10-29 | Monorepo | Unir app y backend conservando historial | `git subtree add` de los dos repos, ADR-0004 | Monorepo sin workspaces; crear el repo nuevo en GitHub | — |
| 2026-10-30 | SPEC-001 | Unificar el modelo de datos | Migraciones SQLite y Postgres, montos en centavos, venta atómica con evento, `compose.yaml` | Aprobó P1–P4; probó la app en el teléfono | Encontró TD-020 (el backend se caía si Postgres cortaba una conexión) |
| 2026-10-30 | Expo SDK 58 | Poder abrir la app en Expo Go actual | Actualización de SDK 57 a 58, ADR-0005 | Aprobó el ADR | — |
| 2026-10-30 | SPEC-002 | Infraestructura del backend | Scripts, runner de migraciones, errores con forma única, `/health`, 21 pruebas | Aprobó P1–P5 | Una revisión con un subagente revisor encontró fallos del propio código: 413/415 devolvían 500, rutas de migraciones relativas al cwd, Postgres publicado en todas las interfaces. Se corrigieron antes de cerrar |
| 2026-10-30 | SPEC-003, SPEC-004 | Identidad de dispositivo, sesión y catálogo | Registro con secreto en SecureStore (solo el hash en el servidor), autenticación, catálogo con reemplazo atómico | Probó CA en el teléfono, también sin red | — |
| 2026-11-01 | SPEC-007 | Flujo de venta | Carrito, cobro con métodos de pago y cambio, precio leído al cobrar | Probó en el teléfono: 34 ms por cobro sin red | El teclado tapaba el modal de cobro y RN 0.88 no lanzaba `TypeError` al fallar la red; los encontró la prueba en el teléfono y la IA los corrigió |
| 2026-11-03 | SPEC-006 | Saber si hay servidor | Monitor con `GET /health`, franja "Sin conexión", reintentos al reconectar | Probó en el teléfono | CA-1/CA-2 suponían que el modo avión corta el Wi-Fi; en el teléfono de prueba no, y se reescribieron |
| 2026-11-03 | SPEC-005 | Stock Leasing (núcleo) | Préstamos congelados con `for update`, cuota por ritmo del dispositivo, cierre idempotente | **Decidió la tasa por dispositivo** en vez de global | La propuesta original de la IA devolvía stock a las 2 h 15 min sin informe del teléfono, lo que podía sobrevender. Se cambió a "el servidor nunca devuelve stock sin informe" |
| 2026-11-03 | SPEC-008 | Sync por lotes idempotente | Tabla `sync_events`, resultado por evento, lotes < 80 kB, worker en la app | Probó CA en el teléfono | — |
| 2026-11-04 | SPEC-009 | Edge Analytics | Burn Rate, Runout Time y top 5 sobre SQLite local | **Decidió** que el ritmo cuente desde la primera venta | La fórmula de la IA dividía siempre entre 10 min y daba 0,4 u/min con 4 ventas en 1 min; lo detectó la prueba en el teléfono |
| 2026-11-05 | SPEC-010 | Recibo QR sin red | Texto plano ≤ 1 000 bytes, corte "… y N productos más" | Probó la lectura con la cámara | El glosario decía "comprimido", pero la cámara del cliente no descomprime; se corrigió a texto plano |
| 2026-11-06 | SPEC-011 | Prueba con dos dispositivos | Reporte de consistencia del stock, pruebas de reintentos, procedimiento escrito | Corrió la prueba con su iPhone: 10 de 10, sin duplicados | La IA propuso dos emuladores y la PC se quedó sin RAM; se cambió a un emulador más el iPhone |
| 2026-11-10 a 2026-11-13 | SPEC-012 | Rediseño visual | Tema, componentes compartidos, pantallas nuevas | Eligió la propuesta "Señalética de feria" | — |
| 2026-11-13 a 2026-11-17 | SPEC-013, SPEC-014 | Panel de administración | Login con scrypt (ADR-0007), ventas, stock, baja de teléfonos, conciliación, catálogo, ADR-0008 | **Decidió el tope sin red de 30 min** | — |
| 2026-11-22 | SPEC-015 | Datos y guion de demo | `npm run demo:reset`, historial de demo, guion ensayado en el emulador | Aprobó spec y plan; pidió cerrar el día | El ensayo mostró que el emulador en UTC cortaba "Hoy" y que había 6 teléfonos viejos en el panel; se corrigió. Un commit falló por las comillas en PowerShell y quedó todo en uno (se fusionó con squash) |
| 2026-11-22 | SPEC-016 | Entrega: liga de la app, bitácora y diario | ADR-0009 (Render + APK), `render.yaml`, arranque de demo, esta bitácora y el diario | Eligió APK + Release y backend en la nube; creó la cuenta de Render | — |

## Verificación del trabajo de la IA

- **Pruebas automatizadas:** el backend termina con 100 pruebas y la app con 70 (`node:test` contra Postgres y `node:sqlite`).
- **Emulador:** la IA manejó el emulador Android por `adb` (capturas, toques, modo avión) para probar cada avance antes de reportarlo.
- **Teléfono real:** las pruebas en el iPhone las hizo la persona. Los criterios marcados "según el usuario" en el DEVLOG son esos.
- **Revisión de código:** subagentes revisores en algunas specs (SPEC-002) y revisión de la persona en cada PR.

## Límites y riesgos observados

- La IA propone con seguridad cosas que fallan en el dispositivo real (teclado, red, modo avión, zona horaria). Por eso cada spec se cierra con prueba en emulador o teléfono.
- En reglas de negocio con riesgo de sobreventa, la primera propuesta de la IA no siempre respetó el principio 1. La constitución y la revisión de la persona lo atraparon (SPEC-005).
- La IA no maneja credenciales: las contraseñas de administrador y las cuentas de servicios (GitHub, Render) las escribió la persona.
