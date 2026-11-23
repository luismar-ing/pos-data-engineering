# POS-DE

POS móvil offline-first con Stock Leasing, Edge Analytics y Batch ETL. Visión y documentación en [docs/](docs/README.md).

## Entrega

| Qué | Liga |
|---|---|
| APK de Android (v1.0.0) | [Descargar `pos-de-v1.0.0.apk`](https://github.com/luismar-ing/pos-data-engineering/releases/download/v1.0.0/pos-de-v1.0.0.apk) · [Release](https://github.com/luismar-ing/pos-data-engineering/releases/tag/v1.0.0) |
| Backend de demo (Render) | <https://posde-backend.onrender.com/health> |
| Bitácora de uso de IA | [docs/BITACORA_IA.md](docs/BITACORA_IA.md) |
| Diario de decisiones | [docs/DIARIO_DECISIONES.md](docs/DIARIO_DECISIONES.md) |
| Guion de demo | [docs/demo/guion.md](docs/demo/guion.md) |

### Probar la app

1. En un teléfono Android 10 o superior, descarga el APK desde la liga de arriba e instálalo. Android pide permitir "instalar apps de fuentes desconocidas" para el navegador.
2. Abre **POS-DE**. Si dice "Sin conexión", espera hasta 1 minuto: el servidor gratuito se duerme sin uso y tarda en despertar. La app reintenta sola cada 15 s.
3. **Vendedor:** "Entrar como vendedor", escribe un nombre y abre sesión. Agrega productos, cobra y muestra el recibo QR. Con el modo avión puedes seguir vendiendo lo que el teléfono tiene prestado; "Hot dog" se agota pronto a propósito.
4. **Administrador:** Ajustes → Cerrar sesión → Cambiar de rol → "Entrar como administrador". Usuario `demo`; la contraseña se entrega aparte, no está en el repositorio.

Límites del servidor gratuito (ADR-0009): se duerme tras 15 min sin uso y su base de datos vence a los 30 días de creada.

| Carpeta | Contenido |
|---|---|
| `pos-app/` | App móvil (Expo 58, React Native 0.88, expo-sqlite) |
| `pos-backend/` | API (Node, Express 5, PostgreSQL 16) |
| `docs/` | Specs, arquitectura y progreso (flujo SDD) |
| `compose.yaml` | Infraestructura local (Postgres) |
| `render.yaml` | Backend de demo en Render (ADR-0009) |

## Puesta en marcha

Requisitos: Node 22.13+ o 24.3+ (no versiones impares), Docker Desktop, Expo Go para SDK 58 o un emulador.

```bash
# 1. Base de datos (desde la raíz)
docker compose up -d

# 2. Backend
cd pos-backend
cp .env.example .env      # solo la primera vez
npm install
npm run db:migrate
npm run demo:reset        # datos de demo (SPEC-015)
npm run dev

# 3. App
cd pos-app
npm install
npx expo start
```

| Servicio | Dirección |
|---|---|
| Postgres | `localhost:5434`, BD `posde`, usuario/clave `postgres`/`postgres` (solo desarrollo) |
| API | `http://localhost:3000` |

### Base de datos

- Las migraciones (`pos-backend/db/migrations/`) se aplican con `npm run db:migrate` (ADR-0006); Docker solo crea las bases `posde` y `posde_test`.
- `npm run demo:reset` deja la base lista para una demo (solo en `posde`/`posde_test`).
- Consola SQL: `docker compose exec db psql -U postgres -d posde`.
