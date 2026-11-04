# SPEC-006 — Monitor de conectividad y modo offline

| Campo | Valor |
|---|---|
| Estado | Done |
| Fase | 2 — Offline + Stock Leasing |
| Repos | app |
| Depende de | SPEC-001 |
| Creada | 2026-11-03 |
| Actualizada | 2026-11-03 |

## 1. Contexto y problema
La app ya cobra sin red (SPEC-007), pero no sabe si tiene conexión:

- El estado `isOnline` del store vale siempre "en línea"; nada lo actualiza (TD-016).
- Si el registro del dispositivo falla por falta de red, solo se reintenta al abrir la app o desde Ajustes, no cuando vuelve la red (TD-022).
- El vendedor no ve si está trabajando sin conexión.

Las siguientes specs de la fase 2 dependen de esto: SPEC-005 pide leases solo con red y SPEC-008 envía la bitácora al recuperarla. Ambas necesitan un estado de conexión fiable y un aviso de "volvió la red".

## 2. Objetivo
Que la app sepa en todo momento si puede hablar con el servidor, lo muestre al vendedor y avise al resto de la app cuando la conexión se pierde o vuelve, sin afectar nunca al cobro.

## 3. Historias de usuario
- Como **vendedor**, quiero ver cuándo estoy sin conexión, para saber que las ventas se enviarán más tarde.
- Como **vendedor**, quiero que la app se ponga al día sola al volver la red, sin tener que tocar nada.
- Como **desarrollador** de SPEC-005 y SPEC-008, quiero un estado de conexión único y un aviso al reconectar, para pedir leases y sincronizar sin reinventar la detección.

## 4. Requisitos funcionales

### Estado de conexión
- **RF-1** La app mantiene un único estado de conexión: **en línea** o **sin conexión**. "En línea" significa que el servidor responde, no solo que el teléfono tiene red (ver P1).
- **RF-2** El estado se recalcula al arrancar, al cambiar la red del teléfono (Wi-Fi, datos, modo avión) y al volver la app a primer plano.
- **RF-3** Mientras está sin conexión, la app vuelve a comprobar el servidor periódicamente (ver P2). En línea no comprueba de forma periódica.
- **RF-4** Si una petición al servidor falla por red, el estado pasa a sin conexión sin esperar a la siguiente comprobación.
- **RF-5** Sin URL del servidor configurada, el estado es siempre sin conexión.

### Aviso al vendedor
- **RF-6** Sin conexión, todas las pestañas muestran un aviso visible "Sin conexión". En línea no se muestra nada (ver P3).

### Reconexión
- **RF-7** Al pasar de sin conexión a en línea, la app avisa a los módulos interesados. Hoy reaccionan:
  - el registro del dispositivo, si estaba pendiente (cierra TD-022);
  - la descarga del catálogo (ver P4).
- **RF-8** Las acciones de reconexión no se disparan más de una vez por reconexión, aunque la red oscile.

### Cobro
- **RF-9** El estado de conexión nunca bloquea ni retrasa un cobro.

## 5. Requisitos no funcionales
- **RNF-1** Un cambio real de red se refleja en el estado en menos de 5 s.
- **RNF-2** Las comprobaciones no bloquean la UI ni el arranque de la app.
- **RNF-3** Cada comprobación tiene un tiempo máximo de espera (ver P2), para que una red lenta no deje el estado en duda.
- **RNF-4** Sin comprobaciones periódicas mientras está en línea, para ahorrar batería y datos.
- **RNF-5** El aviso de RF-6 es legible por lectores de pantalla.
- **RNF-6** Pruebas automatizadas de la lógica de transición (en línea ↔ sin conexión, aviso de reconexión una sola vez). `tsc --noEmit` sin errores.

## 6. Criterios de aceptación
- **CA-1** Dada la app abierta en línea, cuando corto la red (Wi-Fi y datos apagados), entonces en menos de 5 s veo "Sin conexión" en todas las pestañas.
- **CA-2** Dado el aviso "Sin conexión", cuando vuelvo a encender la red, entonces el aviso desaparece en menos de 5 s.
- **CA-3** Dado el teléfono con Wi-Fi y el backend detenido, cuando abro la app, entonces veo "Sin conexión". Cuando arranco el backend, entonces el aviso desaparece sin tocar nada.
- **CA-4** Dado un dispositivo que se abrió sin red y no está registrado, cuando vuelve la red, entonces queda registrado en el servidor sin abrir Ajustes.
- **CA-5** Dada una red que se corta y vuelve tres veces en un minuto, entonces cada reconexión dispara sus acciones una sola vez, nunca en paralelo.
- **CA-6** Sin conexión, cuando cobro, entonces el cobro se completa igual que en línea y en menos de 3 s.
- **CA-7** Dada la app en segundo plano mientras la red cambió, cuando vuelve a primer plano, entonces el aviso muestra el estado correcto.

## 7. Fuera de alcance
- Pedir, renovar o liberar leases al reconectar (SPEC-005).
- Enviar la bitácora al servidor (SPEC-008). Esta spec solo ofrece el aviso de reconexión.
- Contador de ventas pendientes de enviar o "última sincronización" en pantalla (SPEC-008).
- Detectar calidad de red (lenta, inestable) o tipo de red.
- Cambios en el backend: se usa `GET /health`, que ya existe.

## 8. Preguntas abiertas
- [x] **P1** ¿Qué cuenta como "en línea"? Propuesta: el servidor responde a `GET /health` con 200. Un Wi-Fi sin internet o un backend caído cuentan como sin conexión. Alternativa: confiar solo en el estado de red del sistema (más simple, pero da falsos "en línea").
- [x] **P2** ¿Cada cuánto se comprueba sin conexión y con qué tiempo máximo? Propuesta: cada 15 s, con 3 s de espera máxima por comprobación.
- [x] **P3** ¿Cómo se ve el aviso? Propuesta: una franja fija arriba de todas las pestañas, "Sin conexión — las ventas se guardan en el teléfono". Nada cuando hay conexión.
- [x] **P4** ¿Se vuelve a descargar el catálogo en cada reconexión? Propuesta: sí, si la última descarga correcta tiene más de 5 min. Así una red que oscila no descarga el catálogo una y otra vez.
- [x] **P5** ¿Un 503 de `/health` (backend arriba, Postgres caído) cuenta como sin conexión? Propuesta: sí, porque ninguna operación con el servidor funcionaría.

## 9. Cambios
| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-11-03 | Creación (Draft) | — |
| 2026-11-03 | Resueltas P1–P5 según propuesta; spec.md aprobada, plan.md en revisión | Usuario |
| 2026-11-03 | plan.md aprobado, tasks.md en revisión | Usuario |
| 2026-11-03 | tasks.md aprobado → In Progress | Usuario |
| 2026-11-03 | plan: sin `markOffline`; `apiFetch` cambia `isOnline` en el store y el monitor reacciona a la transición | Implementación T2–T3 |
| 2026-11-03 | CA-1/CA-2: "cortar la red" en vez de "modo avión" | En el teléfono de prueba el modo avión deja el Wi-Fi activo y el servidor sigue respondiendo |
| 2026-11-03 | CA-1..CA-7 verificados → Done | Usuario |
