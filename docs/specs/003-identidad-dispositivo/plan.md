# SPEC-003 — Plan técnico

## 1. Enfoque
- **La credencial la genera el dispositivo, no el servidor.** La app crea un secreto aleatorio de 32 bytes junto con su UUID y lo envía al registrarse; el servidor guarda solo su SHA-256. Así el registro es idempotente aunque se pierda la respuesta: reintentar con el mismo id y el mismo secreto da 200; con otro secreto, 409. Si el servidor generara el secreto, una respuesta perdida dejaría el id bloqueado para siempre. (Ajusta la redacción de RF-4: ver §7.)
- **Autenticación por `Authorization: Bearer <secreto>`.** El servidor busca `token_hash = sha256(secreto)` con índice único. Como el secreto tiene 256 bits, el tiempo de búsqueda no revela nada útil (RNF-3) y no hace falta comparar en tiempo constante.
- **Identidad local:** `device_id` y nombre en SQLite (tabla `settings`); el secreto en `expo-secure-store` con la clave `device_secret.<device_id>`. Atar la clave al id evita que, en iOS, un secreto que sobrevive a la desinstalación se reutilice con un id nuevo.
- **Sesión local:** tabla `sessions` con un índice único parcial que impide dos sesiones abiertas a nivel de BD (RF-9). `createSale` toma sola el dispositivo y la sesión abierta; sin sesión, lanza error.
- **Registro sin bloquear:** `ensureRegistered()` se lanza sin `await` al arrancar y antes de cada petición autenticada. La reconexión automática al recuperar red llega con el monitor de red (SPEC-006); mientras tanto basta reabrir la app o hacer la siguiente petición.
- **Dependencias nuevas (app):** `expo-secure-store` y `expo-device`, ambas disponibles en Expo Go SDK 58. Backend: ninguna (`node:crypto`).

## 2. Trazabilidad
| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1 | app `core/device/deviceIdentity.ts` | `getDeviceIdentity()`: lee `settings`; si no hay, crea UUID + secreto en una transacción y guarda el secreto en SecureStore |
| RF-2 | app `core/device/registration.ts` | `ensureRegistered()`: si `registered_at` es nulo y hay `API_URL`, `POST /devices/register`; guarda `registered_at` al recibir 200/201. Errores de red: se ignoran y se reintenta en la siguiente llamada |
| RF-3 | backend `routes/devices.ts` | `insert … on conflict (id) do nothing`; si ya existe con el mismo hash → 200, con otro → 409 `DEVICE_CONFLICT` |
| RF-4 | §1 | Secreto generado en la app; servidor guarda `sha256` en `devices.token_hash` |
| RF-5 | backend `http/auth.ts` → `requireDevice` | Middleware en `/prestamos` y `/sync`; deja `res.locals.deviceId`. Sin cabecera o hash desconocido → 401 `UNAUTHORIZED` |
| RF-6 | backend `routes/sync.ts` | Antes de tocar la BD: todo `event.device_id` y `sale.device_id` = `res.locals.deviceId`, si no → 403 `FORBIDDEN` |
| RF-7 | backend `0004_devices_auth.sql` | FK `sales.device_id → devices(id)` |
| RF-8, RF-11 | app `features/session/data/sessionRepository.ts`, `saleRepository.ts` | `openSession(sellerName)`; `createSale` lee la sesión abierta dentro de la transacción y guarda `session_id` |
| RF-9 | app migración v2 | `create unique index … on sessions((1)) where closed_at is null` + error claro en `openSession` |
| RF-10 | app `App.tsx` | Al arrancar carga la sesión abierta desde SQLite al store |
| RF-12 | `sessionRepository.ts` | `session_opened` / `session_closed` en `event_log` en la misma transacción que el cambio en `sessions` |
| RF-13 | app `features/settings/ui/SettingsScreen.tsx` | Nombre editable, id, estado de registro, sesión abierta + botón Cerrar |
| RNF-1 | — | Todo con APIs async; el registro no se espera en el render |
| RNF-2 | app y backend | Nunca se registra en log el secreto ni la cabecera `Authorization` |
| RNF-3 | §1 | Búsqueda por hash de secreto de 256 bits |
| RNF-4 | §6 | Pruebas backend (`node:test`) y de migraciones de la app (`node:sqlite`) |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `package.json` | Modificar | `npx expo install expo-secure-store expo-device`; script `"test": "node --test test/"` |
| `.env.example` | Crear | `EXPO_PUBLIC_API_URL=http://<IP-de-tu-PC>:3000` (se copia a `.env.local`, ya ignorado por git) |
| `src/core/config.ts` | Crear | `export const API_URL = process.env.EXPO_PUBLIC_API_URL` (acceso con punto, sin desestructurar: requisito de Expo) |
| `src/core/db/migrations.ts` | Modificar | Migración v2 (§4) |
| `src/core/device/deviceIdentity.ts` | Crear | `getDeviceIdentity()`, `getDeviceSecret()`, `setDeviceName()`; nombre por defecto `Device.modelName ?? 'Dispositivo POS'` |
| `src/core/device/registration.ts` | Crear | `ensureRegistered()` (una sola petición en vuelo a la vez) |
| `src/core/api/client.ts` | Crear | `apiFetch(path, init, { auth })`: añade `Authorization` si `auth`; devuelve el JSON o lanza `ApiError(status, code)` con el `code` de SPEC-002 |
| `src/features/session/data/sessionRepository.ts` | Crear | `getOpenSession()`, `openSession(sellerName)`, `closeSession()` |
| `src/features/sales/data/saleRepository.ts` | Modificar | `CreateSaleInput` sin `deviceId`; `Sale` con `session_id`; lanza `NoOpenSessionError` sin sesión |
| `src/shared/store/sessionStore.ts` | Modificar | `currentSession`, `setCurrentSession` |
| `src/features/session/ui/OpenSessionForm.tsx` | Crear | Campo nombre + botón Abrir |
| `src/features/sales/ui/SaleScreen.tsx` | Crear | Sin sesión → `OpenSessionForm`; con sesión → "Sesión de X" (el carrito es SPEC-007) |
| `src/features/settings/ui/SettingsScreen.tsx` | Crear | RF-13 |
| `src/navigation/RootNavigator.tsx` | Modificar | Usa `SaleScreen` y `SettingsScreen` |
| `src/App.tsx` | Modificar | Tras abrir la BD: `getDeviceIdentity()`, carga `currentSession`, lanza `ensureRegistered()` |
| `test/migrations.test.mjs` | Crear | §6 |

### pos-backend
| Archivo | Acción | Detalle |
|---|---|---|
| `db/migrations/0004_devices_auth.sql` | Crear | §4 |
| `src/http/auth.ts` | Crear | `hashSecret()`, `requireDevice` |
| `src/http/errors.ts` | — | Sin cambios: `HttpError` ya sirve para 401/403/409 |
| `src/routes/devices.ts` | Crear | `POST /devices/register` |
| `src/routes/sync.ts` | Modificar | Chequeo de dispositivo (RF-6); `sale.session_id` opcional en el esquema y en el `insert` |
| `src/app.ts` | Modificar | Monta `/devices`; `requireDevice` en `/prestamos` y `/sync` |
| `test/helpers.ts` | Modificar | `registerDevice()` devuelve `{ deviceId, secret }`; `postJson` acepta cabeceras |
| `test/devices.test.ts` | Crear | §6 |
| `test/sync.test.ts`, `test/errors.test.ts` | Modificar | Peticiones con credencial; casos 401/403 |

## 4. Modelo de datos y migraciones

### PostgreSQL — `0004_devices_auth.sql`
```sql
alter table devices add column token_hash text;
create unique index devices_token_hash_key on devices(token_hash);

-- Ventas previas de dispositivos que no existen en devices (solo datos de desarrollo).
insert into devices (id) select distinct device_id from sales on conflict do nothing;
alter table sales add constraint sales_device_id_fkey foreign key (device_id) references devices(id);

-- P6: nulo solo en ventas anteriores a SPEC-003.
alter table sales add column session_id uuid;
```
Las sesiones no se guardan en el servidor (SPEC-008), así que `session_id` no tiene FK.

### SQLite — migración v2
```sql
create table settings (key text primary key, value text not null);

create table sessions (
  id text primary key,
  seller_name text not null check (length(trim(seller_name)) > 0),
  opened_at text not null,
  closed_at text
);
create unique index idx_sessions_one_open on sessions((1)) where closed_at is null;

alter table sales add column session_id text references sessions(id);
```
Claves de `settings`: `device_id`, `device_name`, `registered_at`.

## 5. Contratos HTTP
```
POST /devices/register            (público)
Request:  { "device_id": "<uuid>", "name": "Pixel 7", "secret": "<64 hex>" }
Response: 201 { "device_id", "name" }  la primera vez
          200 { "device_id", "name" }  mismo id y mismo secreto (reintento)
Errores:  400 VALIDATION_ERROR, 409 DEVICE_CONFLICT (id ya registrado con otro secreto)
```
`name` se actualiza si el reintento trae otro (renombrar desde Ajustes reusa la ruta).

Rutas autenticadas: `POST /prestamos/request`, `POST /sync/events`.
```
Cabecera: Authorization: Bearer <secreto>
Errores:  401 UNAUTHORIZED (falta o no corresponde a ningún dispositivo)
          403 FORBIDDEN    (/sync/events: device_id del evento ≠ dispositivo autenticado)
```
`POST /sync/events`: `payload.sale` admite `session_id` (uuid o `null`). Respuesta 200 sin cambios.

Eventos nuevos en `event_log` (se envían en SPEC-008):
```
session_opened  entity_type 'session'  payload { session: { id, device_id, seller_name, opened_at } }
session_closed  entity_type 'session'  payload { session: { id, device_id, seller_name, opened_at, closed_at } }
```

Al cerrar: copiar a `ARCHITECTURE.md` §5 y los códigos `UNAUTHORIZED`, `FORBIDDEN`, `DEVICE_CONFLICT` a la tabla de errores.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Backend (`devices.test.ts`) | Registro 201; mismo id + secreto → 200 y un solo dispositivo; mismo id + otro secreto → 409; `secret` corto o id no UUID → 400 | RF-2, RF-3, CA-3 |
| Backend (`errors.test.ts`) | `/prestamos/request` y `/sync/events` sin cabecera o con secreto falso → 401 y sin filas nuevas | RF-5, CA-4 |
| Backend (`sync.test.ts`) | Dispositivo A envía evento con `device_id` de B → 403, sin filas; venta con `session_id` se guarda; idempotencia sigue verde | RF-6, CA-5 |
| Backend (SQL directo) | `insert into sales` con `device_id` inexistente → violación de FK | RF-7, CA-9 |
| App (`migrations.test.mjs`, `node:sqlite`) | Aplicar v1+v2 sobre BD vacía y sobre BD v1 con una venta; segunda sesión abierta → error de unicidad; tras cerrar, se puede abrir otra | RF-9, P6, RNF-4 |
| Manual (Expo Go) | Instalación nueva sin red → id generado, igual tras reiniciar | CA-1 |
| Manual | Con backend arriba → Ajustes muestra "registrado" | CA-2 |
| Manual | Venta sin sesión pide abrirla; sin red, abrir como "Ana" y registrar una venta de prueba → `session_id` y evento `session_opened` | CA-6, CA-7 |
| Manual | Reabrir app conserva la sesión; cerrar desde Ajustes → evento `session_closed` | CA-8 |
| Manual | Revisar logs de Metro y del backend: sin secreto | CA-10 |

Para CA-7 en dispositivo se añade un botón temporal "Venta de prueba" en `SaleScreen` (solo en `__DEV__`), que se quita cuando SPEC-007 traiga el carrito.

## 7. Riesgos y alternativas descartadas
- **Cambio de redacción de RF-4:** dice "el servidor entrega una credencial". Con este plan la credencial la genera el dispositivo y el servidor la acepta. La garantía es la misma (solo ese dispositivo la conoce y el servidor no la guarda en claro), pero el registro queda idempotente. Si se aprueba el plan, se anota en "Cambios" de la spec.
- **Robo de identidad en el primer registro:** quien conozca un UUID aún no registrado podría registrarlo antes. Los UUID v4 no se pueden adivinar; riesgo aceptado para el MVP.
- **Sin HTTPS en desarrollo:** el secreto viaja en claro en la red local. Fuera de alcance (despliegue).
- **Sin reintento al recuperar red** hasta SPEC-006.
- **Descartado:** JWT (caducidad y firma sin beneficio aquí); secreto en SQLite (P3); bcrypt/argon2 (pensados para contraseñas de baja entropía; con 256 bits aleatorios SHA-256 basta y no añade dependencia).

## 8. Chequeo de constitución
- [x] Nunca sobrevender — prepara SPEC-005: solo un dispositivo autenticado puede pedir lease.
- [x] Offline-first — id, sesión y venta funcionan sin red; el registro es diferido.
- [x] Eventos inmutables — `session_opened` / `session_closed` se insertan, nunca se editan.
- [x] Idempotencia — registro idempotente; eventos con UUID.
- [x] UI fluida — registro en segundo plano.
- [x] Contratos documentados — §5, se copian a `ARCHITECTURE.md` al cerrar.
