# ADR-0008 — Tope sin red de 30 min y devolución de la cuota al dar de baja un dispositivo

- **Estado:** Aceptado
- **Fecha:** 2026-11-17
- **Spec relacionada:** SPEC-014 (reemplaza la respuesta P3 de SPEC-005)

## Contexto
SPEC-005 P3 decidió que un préstamo vencido sigue vendiendo sin red **sin límite de tiempo**, y que el servidor solo devuelve stock cuando el dispositivo cierra su préstamo. Así nunca se sobrevende (CONSTITUTION, principio 1), pero la cuota de un teléfono perdido queda congelada para siempre (TD-025).

SPEC-014 quiere que el administrador pueda dar de baja ese teléfono y recuperar su cuota. Si el servidor devuelve la cuota mientras el teléfono, sin red, la sigue vendiendo, esas unidades se venden dos veces. Para que esto no pase, tiene que existir un momento en el que el servidor sepa con seguridad que el teléfono ya dejó de vender.

## Decisión
1. **Tope sin red en el teléfono.** Un préstamo activo vende solo mientras `ahora < renew_at + 30 min`. Pasado ese momento, la app trata el producto como agotado hasta que vuelva la red y se renueve el préstamo. La regla aplica a todos los teléfonos y a todos los préstamos, haya baja o no (SPEC-014 RF-4).
2. **El teléfono mide el tiempo con su propio reloj, desde que pidió el préstamo.** `renew_at` se calcula como *hora local de inicio de la petición* + (`expires_at − issued_at` del servidor). Hoy se usa la hora en que llegó la respuesta. Como la petición empieza antes de que el servidor emita el préstamo, el tope del teléfono siempre cae antes que el del servidor, sin importar cuánto tarde la red ni cuánto se desfase su reloj.
3. **El servidor devuelve la cuota de un dispositivo dado de baja a `expires_at + 30 min + 2 min`**, medido con su propio reloj (SPEC-014 RF-3, RF-5). Cierra el préstamo con estado `expired`, cuenta como vendido lo que ya llegó por sync y devuelve el resto al stock central. Los 2 minutos son margen para una sync que llegue tarde.
4. Si el teléfono cierra su préstamo de forma normal antes del plazo, vale ese cierre (SPEC-014 RF-5). Si lo cierra después, el servidor lo acepta sin mover el stock y guarda lo informado para la conciliación (SPEC-014 RF-6).

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| Mantener SPEC-005 P3 (sin tope) y no devolver nunca | Cero cambios en la venta | TD-025 sin resolver: la cuota de un teléfono perdido se pierde |
| Devolver la cuota al instante al dar de baja | Simple para el administrador | Sobreventa segura si el teléfono "perdido" sigue vendiendo sin red (principio 1) |
| Tope de 2 h (la primera versión de SPEC-005 P3) | Más tiempo vendiendo sin red | La cuota queda congelada 2 h tras una baja; el usuario prefirió 30 min |
| Tope medido con la hora del reloj del teléfono contra `expires_at` | Una sola hora para los dos lados | Un reloj desfasado mueve el tope y puede quedar después del plazo del servidor |
| Tope con reloj monótono (tiempo desde el arranque) | Inmune a cambios de hora manuales | Se pierde al reiniciar el teléfono o la app; no hay una API estable en Expo Go |

## Consecuencias
- **Cambia el principio 2 (offline-first) a favor del principio 1:** un vendedor sin red durante más de unos 33 minutos deja de vender los productos de los préstamos vencidos hasta recuperar la red. Con red, el préstamo se renueva cada pocos minutos y el tope nunca se alcanza.
- La app filtra por `renew_at` en el cálculo de lo disponible y en el descuento de la cuota al cobrar. El análisis del Dashboard también lo filtra, para que el Runout Time no cuente unidades que ya no se pueden vender.
- El backend necesita una tarea periódica (cada 60 s) que cierre los préstamos vencidos de dispositivos dados de baja.
- **Riesgo aceptado:** si alguien atrasa a mano el reloj del teléfono mientras está sin red, el tope se alarga y podría sobrevenderse lo que el servidor ya devolvió. Se acepta porque requiere una acción deliberada y la conciliación lo muestra como ventas posteriores a la baja.
- SPEC-005 P3 queda reemplazada por este ADR. Su spec y la de SPEC-014 enlazan aquí.
