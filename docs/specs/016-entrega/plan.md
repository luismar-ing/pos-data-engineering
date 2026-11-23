# SPEC-016 — Plan

## 1. Trazabilidad

| RF | Componente |
|---|---|
| RF-1 | `render.yaml` (raíz): servicio web `posde-backend` (`rootDir: pos-backend`) y base `posde-db` (`databaseName: posde`, Postgres 16) |
| RF-2, RF-3 | Comando `demo-init` en `pos-backend/src/db/cli.ts`, con `initDemo(pool, env)` en `src/dev/demo.ts` |
| RF-4 | `pos-app/app.json` (`android.package`, nombre); compilación local; `gh release create v1.0.0` |
| RF-5 | `docs/BITACORA_IA.md` |
| RF-6 | `docs/DIARIO_DECISIONES.md` |
| RF-7 | `README.md` de la raíz |

## 2. Diseño

### Render (`render.yaml`)
- **Build:** `npm ci && npm run build`.
- **Arranque:** `node dist/db/cli.js migrate && node dist/db/cli.js demo-init && node dist/index.js`.
- **Health check:** `/health`.
- **Variables de entorno:**
  - `DB_URL` desde `fromDatabase.connectionString`;
  - `ADMIN_USERNAME=demo`;
  - `ADMIN_PASSWORD` con `sync: false`: Render la pide al crear el Blueprint y no queda en el repo.

### `initDemo(pool, { username, password })`
1. `assertDevDatabase` (la base se llama `posde`).
2. Si `products` está vacía, llama a `resetDemo`.
3. Si hay usuario y contraseña y no existe ese administrador, llama a `setAdmin`. Si ya existe, no hace nada (RF-3).
4. Imprime qué hizo, sin la contraseña.

### APK
1. `app.json`: `name` "POS-DE" y `android.package` `com.luismaring.posde`.
2. `npx expo prebuild -p android --clean`; `android/` va al `.gitignore` de la app.
3. `EXPO_PUBLIC_API_URL=https://<servicio>.onrender.com`, y `gradlew assembleRelease` con el JDK de Android Studio.
4. Probar el APK en el emulador (`adb install`) contra Render.
5. `gh release create v1.0.0 pos-de-v1.0.0.apk` con notas de uso.

### Docs
- **Bitácora de IA:** una tabla por etapa (fecha, spec, herramienta, qué se pidió, qué produjo la IA, qué revisó o decidió la persona, errores de la IA corregidos) y una sección de prácticas (SDD, aprobación por fase, pruebas y emulador como verificación).
- **Diario de decisiones:** una entrada por decisión, en orden cronológico, con enlace a su ADR, spec o DEVLOG.

## 3. Archivos

| Repo | Archivo | Cambio |
|---|---|---|
| raíz | `render.yaml`, `README.md` | Nuevo / actualizado |
| backend | `src/dev/demo.ts`, `src/db/cli.ts`, `test/demo.test.ts` | `initDemo` y `demo-init` |
| app | `app.json`, `.gitignore` | Paquete y nombre; ignorar `android/` |
| docs | `adr/0009-…`, `BITACORA_IA.md`, `DIARIO_DECISIONES.md`, cierre | Nuevos / actualizados |

## 4. Pruebas
- **Automáticas:** CA-1 en `test/demo.test.ts`.
- **A mano:** CA-2 con `curl`; CA-3 con el APK en el emulador; CA-4 descargando de la liga.

## 5. Constitución
No cambia reglas de venta, préstamos ni sync. El principio 7 se cumple: no hay rutas HTTP nuevas. El cambio de ambiente queda registrado en ADR-0009.
