# ADR-0007 — Autenticación de administrador

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Spec relacionada:** SPEC-013

## Contexto
Hasta SPEC-012 la única credencial del sistema es la del dispositivo (SPEC-003): un secreto aleatorio de 256 bits que genera el teléfono, del que el servidor guarda solo el SHA-256. SPEC-013 agrega un rol **Administrador** que entra con usuario y contraseña a un panel con datos de todos los dispositivos. Hace falta decidir:
- cómo se guardan las contraseñas;
- qué credencial recibe la app después del login y cómo vence;
- cómo se separa del secreto del dispositivo;
- cómo se frena la fuerza bruta.

El stack fijado no admite dependencias nativas nuevas sin motivo, y el backend no tiene ninguna librería de autenticación.

## Decisión
1. **Contraseñas con `scrypt`** de `node:crypto`, con sal aleatoria de 16 bytes por contraseña y comparación con `timingSafeEqual`. El hash se guarda como `scrypt$<N>$<r>$<p>$<sal hex>$<hash hex>`, para poder subir el costo sin migrar los hashes viejos. La contraseña nunca se registra ni se devuelve.
2. **Sesión con token opaco.** Un login correcto devuelve 32 bytes aleatorios (64 hex). El servidor guarda solo su SHA-256 en `admin_sessions`, con `expires_at` a las **8 h**. Cerrar sesión borra la fila. Como el token es aleatorio y largo, SHA-256 basta, igual que con el secreto del dispositivo.
3. **Credenciales separadas.** El token de administrador solo se busca en `admin_sessions` (`requireAdmin`, rutas `/admin/*`) y el secreto del dispositivo solo en `devices` (`requireDevice`, rutas `/prestamos` y `/sync`). Ninguna credencial sirve en las rutas de la otra.
4. **Bloqueo por usuario.** Tras 5 fallos seguidos, el usuario queda bloqueado 15 min. El login bloquea la fila del administrador (`for update`) para que intentos simultáneos no se salten la cuenta.
5. **Respuesta genérica.** Usuario inexistente, contraseña incorrecta y usuario bloqueado devuelven el mismo 401 `INVALID_CREDENTIALS`. Con un usuario inexistente también se calcula un `scrypt` de relleno, para que el tiempo de respuesta no revele qué usuarios existen.
6. **Cuentas desde el servidor.** Se crean y cambian de contraseña con `npm run admin:set -- <usuario>`, que lee la contraseña de `ADMIN_PASSWORD`. Cambiar la contraseña borra las sesiones de ese administrador y quita el bloqueo. No hay registro desde la app.
7. **En el teléfono**, el token va en `expo-secure-store`, igual que el secreto del dispositivo.

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| JWT firmado | Sin consulta a la BD por petición | No se revoca al cerrar sesión sin guardar estado; hay que gestionar la clave de firma |
| bcrypt / argon2 | Estándar conocido; argon2 es el más resistente | Dependencia nueva, nativa en el caso de argon2; `scrypt` ya viene en Node y es un hash lento con sal |
| Reutilizar la tabla `devices` con un rol | Una sola consulta de autenticación | Mezcla credenciales; un secreto de dispositivo filtrado podría dar acceso al panel |
| Rate limit por IP | Frena probar muchos usuarios | Más código y estado; en una red de evento muchos teléfonos comparten IP. Queda como deuda técnica |
| Sin bloqueo | Nadie puede bloquear la cuenta de otro | Fuerza bruta sin freno |

## Consecuencias
- El backend tiene dos mecanismos de autenticación, uno por tipo de credencial, con el mismo patrón (token aleatorio con hash).
- Cada petición de administrador hace una consulta a `admin_sessions`; las sesiones vencidas se ignoran por `expires_at` y no se borran solas.
- Quien sepa un nombre de usuario puede bloquearlo 15 min con 5 intentos. Se acepta: la cuenta se libera sola y `admin:set` la desbloquea.
- En desarrollo la app habla con el backend por HTTP en la red local, así que la contraseña viaja sin cifrar. **En producción hace falta HTTPS** antes de usar el panel; queda en `TECH_DEBT.md` al cerrar SPEC-013.
