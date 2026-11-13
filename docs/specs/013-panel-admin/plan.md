# SPEC-013 — Plan técnico

## 1. Enfoque

### Lo que no cambia
- Las reglas de venta, préstamo y sync no cambian. Los contratos HTTP actuales tampoco.
- La sync de préstamos y bitácora en segundo plano sigue corriendo en los dos roles. Con el rol Administrador no hay sesión de vendedor abierta (RF-4), así que `leaseSync` solo cierra préstamos y `syncEvents` vacía lo pendiente: un teléfono que pasa a Administrador no deja nada colgado.
- Sin dependencias nuevas, en la app y en el backend.

### Autenticación de administrador (backend)
Va en **ADR-0007** antes de implementar:
- **Contraseña:** `scrypt` de `node:crypto` con sal aleatoria de 16 bytes, comparada con `timingSafeEqual` (RNF-1). Se guarda como `scrypt$<N>$<r>$<p>$<sal hex>$<hash hex>` para poder subir el costo más adelante.
- **Sesión:** token opaco de 32 bytes aleatorios (64 hex). El servidor guarda solo su SHA-256 en `admin_sessions`, con `expires_at = now() + 8 h` (RF-8). Es el mismo patrón que el secreto del dispositivo (SPEC-003): el token es aleatorio y largo, así que SHA-256 basta. Se descarta JWT porque no se puede revocar al cerrar sesión sin guardar estado igual.
- **Separación (RNF-2):** `requireAdmin` busca el token solo en `admin_sessions` y `requireDevice` solo en `devices`. Un secreto de dispositivo no está en `admin_sessions` y un token de admin no está en `devices`, así que cada uno falla en las rutas del otro (CA-8).
- **Bloqueo (RF-7):** columnas `failed_attempts` y `locked_until` en `admins`. El login bloquea la fila con `for update`, para que intentos simultáneos no se salten la cuenta. Al quinto fallo: `locked_until = now() + 15 min` y `failed_attempts = 0`. Con un login correcto, `failed_attempts = 0`.
- **Respuesta genérica (RF-6):** usuario inexistente, contraseña incorrecta y usuario bloqueado devuelven lo mismo: 401 `INVALID_CREDENTIALS`. Con un usuario inexistente se calcula igual un `scrypt` de relleno, para que el tiempo de respuesta no revele qué usuarios existen.
- **Cuentas (RF-9):** comando `npm run admin:set -- <usuario>`, que lee la contraseña de la variable `ADMIN_PASSWORD`, nunca de los argumentos (no queda en el historial). Crea el usuario o le cambia la contraseña. Al cambiarla, borra sus sesiones y quita el bloqueo. Mínimo 8 caracteres.

### Stock inicial en la base de datos
Hoy el "stock inicial" del reporte de SPEC-011 es la constante `SCENARIO_STOCK` del escenario de desarrollo. El panel necesita un valor real por producto:
- Nueva columna `products.initial_stock`. La migración la rellena con `central_stock + Σ quota_total (active) + Σ quota_used (released)`, así una base existente queda cuadrando desde el inicio.
- `resetScenario` y el seed la fijan junto con `central_stock`.
- El cálculo del reporte pasa de `src/dev/scenario.ts` a `src/services/stockService.ts`, porque ahora lo usa una ruta de producción. `checkStock` lee `initial_stock` de la fila en vez de `SCENARIO_STOCK`. `report:stock` y SPEC-011 siguen funcionando igual.
- SPEC-014 (RF-17) moverá `initial_stock` con cada alta y ajuste de stock.

### Último contacto del dispositivo (RF-12)
- Nueva columna `devices.last_seen_at`. `requireDevice` hace `update devices set last_seen_at = now() where token_hash = $1 returning id` en lugar del `select`: la misma consulta autentica y marca el contacto.
- La última sincronización sale de `max(sync_events.received_at)` por dispositivo.

### Ventas consolidadas (RF-10, RF-11)
- Rango por `sales.created_at` (la hora del teléfono al cobrar), con el índice `idx_sales_created` que ya existe. Máximo 31 días.
- Una sola ruta devuelve todo el resumen, con varias consultas de agregación en la misma conexión: totales, por dispositivo, por sesión (con `sessions.seller_name`), por hora (`date_trunc('hour', created_at)` en UTC; la app la muestra en hora local), por método de pago y top 5 de productos.
- El ticket promedio se calcula en centavos enteros, igual que en SPEC-009.

### App: rol, login y panel
- **Rol:** en la tabla `settings` existente (clave `role`, `seller` | `admin`), sin migración. Se lee al arrancar y se copia al store.
- **Credencial de admin:** `expo-secure-store`, clave `admin_session`, con `{ token, username, expires_at }` (RNF-3). Al arrancar con rol `admin`, si no hay sesión o ya venció, se muestra el login (RF-3).
- **Navegación:** `RootNavigator` elige según el rol:
  - sin rol → `RoleSelectScreen`;
  - `seller` → las pestañas actuales, sin cambios;
  - `admin` sin sesión válida → `AdminLoginScreen`;
  - `admin` con sesión → pestañas `Ventas`, `Stock` y `Cuenta`.
- **Cambio de rol (RF-3, RF-4):** botón en Ajustes del vendedor y en `Cuenta`. Si hay una sesión de vendedor abierta (`currentSession`), el botón queda deshabilitado con el texto "Cierra la sesión de vendedor para cambiar de rol". Desde `Cuenta`, cambiar de rol también cierra la sesión de admin.
- **Vencimiento (RF-8, CA-7):** antes de cada petición la app compara `expires_at` con la hora local. Además, cualquier 401 de una ruta `/admin` borra la sesión guardada y vuelve al login, así un reloj del teléfono desfasado no deja la sesión abierta.
- **Sin red (RF-5, RNF-5):** el botón Entrar se deshabilita con "El login necesita conexión" cuando `isOnline` es falso. Las pantallas del panel muestran `OfflineBanner` y no guardan datos en el teléfono.
- **Diseño (RNF-7):** solo componentes de `shared/ui` (`ScreenHeader`, `Card`, `Button`, `TextField`, `Pill`, `AppText`) y colores de `theme.ts`.

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | app `admin/ui/RoleSelectScreen.tsx`, `RootNavigator.tsx` | Sin `role` en `settings`, se muestra la selección |
| RF-2 | `RootNavigator.tsx` | `seller` monta las pestañas actuales sin cambios |
| RF-3 | `admin/data/roleRepository.ts`, `SettingsScreen.tsx`, `AdminAccountScreen.tsx` | Rol guardado en `settings`; botón "Cambiar de rol" en los dos lados |
| RF-4 | `admin/domain/role.ts` (`canSwitchRole`) | Deshabilitado con sesión de vendedor abierta |
| RF-5, RF-6 | backend `routes/admin.ts`, `services/adminAuthService.ts`; app `AdminLoginScreen.tsx` | `POST /admin/login`; 401 genérico; sin red, botón deshabilitado |
| RF-7 | `adminAuthService.ts` | `failed_attempts`, `locked_until` con `for update` |
| RF-8 | `admin_sessions.expires_at`, `requireAdmin`; app `admin/domain/session.ts` | 8 h en el servidor; la app vuelve al login al vencer o con un 401 |
| RF-9 | `src/db/cli.ts` (`admin:set`) | Comando con `ADMIN_PASSWORD` |
| RF-10, RF-11 | `services/adminSalesService.ts`, `GET /admin/sales`; app `AdminSalesScreen.tsx` | Agregaciones por rango |
| RF-12 | `devices.last_seen_at`, `requireDevice`; `adminSalesService.ts` | Último contacto y última sync por dispositivo |
| RF-13, RF-14 | `services/stockService.ts`, `GET /admin/stock`; app `AdminStockScreen.tsx` | Mismo cálculo que `report:stock`, con `initial_stock` |
| RNF-1 | `adminAuthService.ts` | `scrypt` + sal; nunca se registra ni devuelve la contraseña |
| RNF-2 | `http/auth.ts` | Tablas distintas para cada credencial |
| RNF-3 | `admin/data/adminSession.ts` | `expo-secure-store` |
| RNF-4 | — | No se toca el flujo de venta; la sync sigue igual |
| RNF-5 | pantallas admin | `OfflineBanner`, sin caché |
| RNF-6 | `test/admin.test.ts` | Prueba con 10 dispositivos, 2 000 productos y 10 000 ventas: cada ruta en < 2 s |
| RNF-7 | pantallas admin | Solo `shared/ui` y `theme.ts` |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `src/features/admin/domain/role.ts` | crear | `Role` (`seller` / `admin`), `canSwitchRole(sessionOpen)`. Puro, sin Expo |
| `src/features/admin/domain/session.ts` | crear | `AdminSession`, `isSessionValid(session, nowMs)`, `todayRange(nowMs)` (inicio del día local → ahora). Puro |
| `src/features/admin/data/roleRepository.ts` | crear | `getRole()`, `setRole(role \| null)` sobre `settings` |
| `src/features/admin/data/adminSession.ts` | crear | Leer, guardar y borrar `admin_session` en `expo-secure-store` |
| `src/features/admin/data/adminApi.ts` | crear | `login`, `logout`, `getSales(range)`, `getStock()` con `apiFetch`; un 401 borra la sesión y avisa al store |
| `src/features/admin/ui/RoleSelectScreen.tsx` | crear | Dos botones grandes: Vendedor, Administrador |
| `src/features/admin/ui/AdminLoginScreen.tsx` | crear | Usuario, contraseña, Entrar; error genérico; deshabilitado sin red |
| `src/features/admin/ui/AdminSalesScreen.tsx` | crear | Totales, por dispositivo (último contacto y sync), por sesión, por hora, por método, top 5; actualizar al enfocar y a mano |
| `src/features/admin/ui/AdminStockScreen.tsx` | crear | Por producto: central, prestado, informado, estado; los que no cuadran arriba y resaltados |
| `src/features/admin/ui/AdminAccountScreen.tsx` | crear | Usuario, vencimiento, Cerrar sesión, Cambiar de rol |
| `src/navigation/RootNavigator.tsx` | modificar | Elegir pantallas según rol y sesión de admin |
| `src/shared/store/sessionStore.ts` | modificar | `role`, `setRole`, `adminSession`, `setAdminSession` |
| `src/App.tsx` | modificar | Leer rol y sesión de admin al arrancar, antes de `setDb('ready')` |
| `src/features/settings/ui/SettingsScreen.tsx` | modificar | Botón "Cambiar de rol" (RF-3, RF-4) |
| `src/core/api/client.ts` | modificar | Comentario de `secret`: también lleva el token de admin. Sin cambio de forma |
| `test/admin.test.mjs` | crear | `canSwitchRole`, `isSessionValid`, `todayRange` |

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `db/migrations/0007_admin.sql` | crear | Ver §4 |
| `db/seed/*.sql` | modificar | Fijar `initial_stock` igual que `central_stock` |
| `src/services/adminAuthService.ts` | crear | `hashPassword`, `verifyPassword`, `login`, `logout`, `setAdmin` |
| `src/services/adminSalesService.ts` | crear | `salesSummary(pool, from, to)` |
| `src/services/stockService.ts` | crear | `STOCK_REPORT_SQL`, `checkStock`, `stockReport` movidos desde `dev/scenario.ts`, con `initial_stock` |
| `src/dev/scenario.ts` | modificar | Usa `stockService`; `resetScenario` fija también `initial_stock` |
| `src/http/auth.ts` | modificar | `requireDevice` actualiza `last_seen_at`; nuevo `requireAdmin` (deja `res.locals.adminId`) |
| `src/routes/admin.ts` | crear | `/login`, `/logout`, `/sales`, `/stock` |
| `src/app.ts` | modificar | `app.use('/admin', adminRouter)`; `requireAdmin` dentro del router salvo en `/login` |
| `src/db/cli.ts` | modificar | Comando `admin-set <usuario>` |
| `package.json` | modificar | Script `admin:set` |
| `.env.example` | modificar | Comentario de `ADMIN_PASSWORD` (solo para `admin:set`; no se guarda) |
| `test/admin.test.ts` | crear | Ver §6 |
| `test/scenario.test.ts` | modificar | Usa `initial_stock` |

## 4. Modelo de datos y migraciones

### PostgreSQL — `0007_admin.sql`
```sql
-- SPEC-013: cuentas y sesiones de administrador, último contacto del dispositivo y stock inicial.
create table admins (
    id uuid primary key default gen_random_uuid(),
    username text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
    password_hash text not null,
    failed_attempts integer not null default 0 check (failed_attempts >= 0),
    locked_until timestamptz,
    created_at timestamptz not null default now()
);

create table admin_sessions (
    token_hash text primary key,
    admin_id uuid not null references admins(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);
create index idx_admin_sessions_admin on admin_sessions(admin_id);

alter table devices add column last_seen_at timestamptz;

alter table products add column initial_stock integer check (initial_stock >= 0);
update products p set initial_stock = p.central_stock
    + coalesce((select sum(quota_total) from stock_leases l where l.product_id = p.id and l.status = 'active'), 0)
    + coalesce((select sum(quota_used) from stock_leases l where l.product_id = p.id and l.status = 'released'), 0);

create index idx_sales_device_created on sales(device_id, created_at);
```
- `initial_stock` queda nulo solo para productos que se agreguen fuera del seed y del panel. `checkStock` los marca "sin stock inicial".
- Las sesiones vencidas no se borran solas: se ignoran por `expires_at`. `logout` y `admin:set` borran las del administrador.

### SQLite (app)
Sin migración. Clave nueva `role` en `settings`.

## 5. Contratos HTTP
Se copian a `ARCHITECTURE.md` §5 antes de implementar las rutas (CONSTITUTION, principio 7).

🔑 = exige `Authorization: Bearer <token de administrador>` vigente.

```
POST /admin/login
Request:  { username: string 3–40, password: string 1–200 }
Response: 200 { token: 64 hex, username, expires_at: ISO-8601 }
Errores:  400 VALIDATION_ERROR, 401 INVALID_CREDENTIALS (usuario inexistente, contraseña incorrecta o bloqueado 15 min)

POST /admin/logout 🔑
Request:  —
Response: 204 (borra esa sesión; repetirlo da 401)
Errores:  401 UNAUTHORIZED

GET /admin/sales?from=ISO&to=ISO 🔑
Response: 200 {
  generated_at, from, to,
  totals: { revenue_cents, sales, average_ticket_cents },
  by_device: [{ device_id, name, revenue_cents, sales, last_seen_at|null, last_sync_at|null }],
  by_session: [{ session_id|null, seller_name|null, device_id, revenue_cents, sales }],
  by_hour: [{ hour: ISO (UTC, inicio de la hora), revenue_cents, sales }],
  by_payment_method: [{ payment_method, revenue_cents, sales }],
  top_products: [{ product_id, name, units, revenue_cents }]   // máx. 5
}
Errores:  400 VALIDATION_ERROR (falta from/to, from > to o rango > 31 días), 401 UNAUTHORIZED

GET /admin/stock 🔑
Response: 200 {
  generated_at,
  products: [{ product_id, name, initial_stock|null, central_stock, leased_active, reported_sold,
               synced_sold, balance, status: "ok" | "no_cuadra" | "sync_supera_stock" | "sin_stock_inicial" }]
}
Errores:  401 UNAUTHORIZED
```
- `by_device` incluye los dispositivos sin ventas en el rango, para ver su último contacto.
- Códigos nuevos en la tabla de errores: `INVALID_CREDENTIALS` (401). `UNAUTHORIZED` pasa a cubrir también las rutas 🔑.
- `report:stock` sigue mostrando los textos actuales; la ruta usa los códigos estables de arriba.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria (backend) | `hashPassword`/`verifyPassword`: correcta, incorrecta, formato con sal distinta cada vez | RNF-1 |
| Integración (backend) | Login correcto da token y `expires_at` ≈ 8 h; la respuesta no contiene la contraseña ni el hash | CA-4, RNF-1 |
| Integración (backend) | Contraseña incorrecta y usuario inexistente dan el mismo 401 | RF-6 |
| Integración (backend) | 5 fallos y luego la correcta: 401; con `locked_until` en el pasado, la correcta entra | CA-5 |
| Integración (backend) | 5 logins fallidos simultáneos dejan el usuario bloqueado | RF-7 |
| Integración (backend) | Sesión con `expires_at` en el pasado: 401 | CA-7 |
| Integración (backend) | Secreto de dispositivo en `/admin/*`: 401; token de admin en `/prestamos` y `/sync`: 401 | CA-8 |
| Integración (backend) | Logout: el mismo token da 401 después | RF-8 |
| Integración (backend) | Ventas de dos dispositivos: `by_device` suma `totals`; `by_hour`, `by_payment_method` y `by_session` también suman | CA-9 |
| Integración (backend) | Tras el escenario de SPEC-011 con préstamos y cierres, `/admin/stock` coincide con `stockReport` y marca `ok` | CA-10 |
| Integración (backend) | Migración 0007 sobre una base con préstamos: `initial_stock` deja todo cuadrando | §4 |
| Integración (backend) | Una petición de dispositivo actualiza `last_seen_at` | RF-12 |
| Rendimiento (backend) | 10 dispositivos, 2 000 productos, 10 000 ventas: `/admin/sales` del día y `/admin/stock` en < 2 s cada una | RNF-6 |
| Unitaria (app) | `canSwitchRole`, `isSessionValid` (antes, justo y después de vencer), `todayRange` | RF-4, RF-8 |
| Manual (emulador) | Primer arranque → Vendedor sin contraseña; reabrir entra directo | CA-1, CA-2 |
| Manual (emulador) | Con sesión de vendedor abierta, "Cambiar de rol" deshabilitado | CA-3 |
| Manual (emulador) | Login con red; sin red el botón queda deshabilitado con el aviso | CA-4, CA-6 |
| Manual (emulador) | Ventas y Stock con datos de una venta hecha en otro dispositivo; Stock coincide con `npm run report:stock` | CA-9, CA-10 |
| Manual (emulador + iPhone) | El iPhone cobra sin red mientras el emulador usa el panel: cobro igual de rápido | CA-11, RNF-4 |

## 7. Riesgos y alternativas descartadas
- **HTTP sin cifrar.** En desarrollo la app habla con el backend por HTTP en la red local, así que la contraseña viaja en claro. Es aceptable para la demo; en producción hace falta HTTPS. Se anota como deuda técnica.
- **Bloqueo solo por usuario.** Alguien puede probar muchos usuarios distintos. Sin rate limit por IP en esta spec; se anota como deuda técnica (`shortcut:` en el código).
- **Bloqueo como ataque.** Cualquiera que sepa un nombre de usuario puede bloquearlo 15 min con 5 intentos. Se acepta: la cuenta se libera sola y `admin:set` la desbloquea.
- **Hora del teléfono.** Las ventas se agrupan por `created_at` del teléfono; un reloj desfasado mueve ventas de hora. Se acepta, igual que en SPEC-009.
- **Descartado: JWT.** No se puede revocar al cerrar sesión sin guardar estado; el token opaco con hash es más simple y usa el patrón que ya existe.
- **Descartado: bcrypt o argon2.** Suman una dependencia nativa; `scrypt` viene en Node y es un hash lento con sal.
- **Descartado: panel con datos guardados en el teléfono.** Fuera de alcance (RNF-5).

## 8. Chequeo de constitución
- [x] **Nunca sobrevender:** las rutas nuevas solo leen; no cambian stock ni préstamos.
- [x] **Offline-first:** el rol Vendedor no cambia y sigue sin red; la sync sigue en segundo plano en los dos roles.
- [x] **Eventos inmutables:** no se tocan `event_log` ni `sync_events`.
- [x] **Idempotencia:** sin eventos nuevos. Logout repetido da 401 sin efectos.
- [x] **UI fluida:** las peticiones del panel son asíncronas y no corren en el render.
- [x] **Contratos documentados:** §5 se copia a `ARCHITECTURE.md` antes de implementar (T2).
