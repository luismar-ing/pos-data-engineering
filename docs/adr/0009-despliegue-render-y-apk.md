# ADR-0009 — Backend de demo en Render y APK compilado en local

- **Estado:** Aceptado
- **Fecha:** 2026-11-22
- **Spec relacionada:** SPEC-016

## Contexto
Para la entrega, el profesor pide una liga para abrir la app (Expo, Snack o APK). La app no sirve sola: necesita el backend para registrarse y recibir el catálogo y los préstamos. Sin eso, todos los productos salen "Agotado". Hoy el backend y Postgres corren solo en la PC del alumno (Docker), así que nadie fuera de esa red puede probarla.

El usuario eligió dos cosas:
- un APK compilado en su PC y publicado como Release de GitHub;
- un backend en la nube, para que el profesor la pruebe cuando quiera.

## Decisión
1. **Backend y Postgres 16 en Render, con un Blueprint (`render.yaml` en la raíz):**
   - un servicio web gratuito con raíz en `pos-backend`;
   - una base Postgres gratuita llamada `posde`.

   Render da HTTPS sin configuración extra. Con eso, TD-032 queda resuelto para este servidor.
2. **El servidor de Render es un ambiente de demo, no de producción.**
   - La base se llama `posde`, así que `demo:reset` y el arranque de demo pueden correr ahí.
   - Al arrancar, el servicio aplica las migraciones.
   - Si la base no tiene productos, carga los datos de demo (SPEC-015).
   - Si no existe la cuenta, crea al administrador con usuario y contraseña tomados de variables de entorno. La contraseña se escribe solo en el panel de Render, nunca en el repo.
3. **APK de release compilado en la PC** con `expo prebuild` y Gradle. Se firma con la llave de depuración de la plantilla de Expo, que basta para instalarlo a mano. La URL del backend queda fija en el APK al compilar (`EXPO_PUBLIC_API_URL`). La carpeta `android/` se genera y no se versiona.
4. **El APK se publica como Release `v1.0.0` del repo en GitHub.** La liga de la entrega es la de ese Release.

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| Backend en la PC del alumno | Sin cuentas ni costo | Solo funciona durante la presentación y en la misma red |
| Render web + Neon Postgres | La base gratuita de Neon no vence | Dos cuentas, y la URL con contraseña tendría que copiarse a mano entre ellas |
| Railway o Fly.io | Sin dormir el servicio | Créditos de prueba o tarjeta obligatoria |
| EAS Build o EAS Update (liga de expo.dev) | Liga directa, compilación en la nube | Cuenta de Expo y `eas login`; el usuario prefirió el APK local |
| Snack | Corre en el navegador | No soporta este proyecto (monorepo, `expo-sqlite`, `expo-secure-store`) |

## Consecuencias
- **Arranque en frío:** el plan gratuito duerme el servicio tras 15 min sin tráfico. El primer pedido tarda cerca de 1 min. Mientras tanto la app muestra "Sin conexión" y reintenta cada 15 s, así que conecta sola.
- **La base gratuita de Render vence a los 30 días.** Pasado ese plazo hay que recrearla (el Blueprint lo hace) o pasar a un plan de pago.
- La tarea periódica de devolución de cuotas (ADR-0008) no corre mientras el servicio duerme. Al despertar se pone al día, así que no hay riesgo de sobreventa.
- El historial de demo queda con la fecha del primer arranque. El panel ("Hoy") lo muestra solo ese día; después solo muestra lo que se venda.
- Si la URL del servicio cambia, hay que volver a compilar el APK.
