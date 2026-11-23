# SPEC-016 — Entrega: backend en la nube, APK, bitácora de IA y diario de decisiones

| Campo | Valor |
|---|---|
| Estado | In Progress |
| Fase | Entrega |
| Repos | backend, app, docs |
| Depende de | SPEC-015 |
| Creada | 2026-11-22 |
| Actualizada | 2026-11-22 |

## 1. Contexto y problema
Para la entrega, el profesor pide:
- una liga para abrir la app (Expo, Snack o APK);
- una bitácora de IA y un diario de decisiones dentro del repositorio.

Hoy la app solo se abre con Expo Go desde la PC del alumno, y el backend solo corre en esa PC. El repo tiene `DEVLOG.md` y los ADR, pero no hay un registro de cómo se usó la IA ni un diario de decisiones en un solo lugar.

## 2. Objetivo
Que el profesor instale la app desde una liga y la use contra un backend siempre disponible, y que el repo tenga la bitácora de IA y el diario de decisiones.

## 3. Historias de usuario
- Como **profesor**, quiero instalar la app desde una liga y probarla sin depender de la PC del alumno, para evaluarla cuando pueda.
- Como **profesor**, quiero leer cómo se usó la IA y qué decisiones se tomaron, para evaluar el proceso y no solo el resultado.

## 4. Requisitos funcionales
- **RF-1** El backend corre en un servicio en la nube con HTTPS y su propia base de datos (ADR-0009).
- **RF-2** Al arrancar en la nube, el backend aplica las migraciones. Si la base no tiene productos, carga los datos de demo de SPEC-015.
- **RF-3** Al arrancar en la nube, si se configuró una cuenta de administrador por variables de entorno y esa cuenta no existe, la crea. Nunca cambia la contraseña de una cuenta que ya existe.
- **RF-4** Hay un APK de Android que apunta a ese backend, publicado en una liga pública del repositorio.
- **RF-5** `docs/BITACORA_IA.md` registra por etapa:
  - qué herramienta de IA se usó y para qué;
  - qué produjo;
  - qué revisó, corrigió o decidió la persona;
  - qué errores de la IA se encontraron.
- **RF-6** `docs/DIARIO_DECISIONES.md` lista en orden cronológico las decisiones del proyecto: qué se decidió, por qué, qué alternativas había y dónde está el detalle (ADR, spec o DEVLOG).
- **RF-7** El README de la raíz enlaza el APK, el backend, la bitácora y el diario, y explica cómo probar la app.

## 5. Requisitos no funcionales
- **RNF-1** Ninguna contraseña ni URL con contraseña queda en el repositorio.
- **RNF-2** El APK se instala en Android 10 o superior sin Expo Go.
- **RNF-3** `tsc` y `npm test` en verde en el backend.

## 6. Criterios de aceptación
- **CA-1** (automatizado) Con una base vacía, el arranque de demo carga el catálogo de demo y crea al administrador. Con una base que ya tiene productos y administrador, no cambia nada.
- **CA-2** Dado el servicio desplegado, `GET /health` responde 200 por HTTPS y `GET /catalogo` devuelve los 20 productos.
- **CA-3** Dado el APK instalado en el emulador con su red normal, cuando abro la app como vendedor, entonces se registra, descarga el catálogo, recibe préstamos y cobra. Como administrador, entra y ve las ventas.
- **CA-4** La liga del Release descarga el APK.
- **CA-5** La bitácora y el diario existen, están enlazados desde el README y cubren el proyecto desde su inicio hasta SPEC-016.

## 7. Fuera de alcance
- Publicar en Google Play o la App Store, o compilar para iOS.
- Un dominio propio o un plan de pago.
- Un ambiente de producción real (el de Render es de demo, ADR-0009).

## 8. Preguntas abiertas
- [x] **P1** Nube → Render con un Blueprint: servicio web gratuito y Postgres 16 gratuito (vence a los 30 días). Tú creas la cuenta y el Blueprint; yo no manejo contraseñas.
- [x] **P2** Administrador en la nube → usuario `demo`. La contraseña la escribes tú en la variable `ADMIN_PASSWORD` del panel de Render y se la das al profesor por fuera del repo.
- [x] **P3** Id del paquete Android → `com.luismaring.posde`; nombre visible "POS-DE".
- [x] **P4** Liga → Release `v1.0.0` del repo en GitHub con el archivo `pos-de-v1.0.0.apk`.
- [x] **P5** Bitácora de IA → reconstruida de `DEVLOG.md`, el historial de git, los "Cambios" de cada spec y las sesiones de Claude Code. Los commits de septiembre (antes de adoptar SDD) quedan como "sin registro de uso de IA" salvo que me digas otra cosa.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-22 | Creación (Draft) | — |
| 2026-11-22 | Resueltas P1–P5 según propuesta; spec, plan, tareas y ADR-0009 aprobados → In Progress | Usuario |
