# POS-DE

POS móvil offline-first con Stock Leasing, Edge Analytics y Batch ETL. Visión y documentación en [docs/](docs/README.md).

| Carpeta | Contenido |
|---|---|
| `pos-app/` | App móvil (Expo 57, React Native, expo-sqlite) |
| `pos-backend/` | API (Node, Express 5, PostgreSQL 16) |
| `docs/` | Specs, arquitectura y progreso (flujo SDD) |
| `compose.yaml` | Infraestructura local (Postgres) |

## Puesta en marcha

Requisitos: Node 20+, Docker Desktop, Expo Go o un emulador.

```bash
# 1. Base de datos (desde la raíz). La primera vez aplica migraciones y datos semilla.
docker compose up -d

# 2. Backend
cd pos-backend
cp .env.example .env      # solo la primera vez
npm install
npx tsx src/index.ts

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

- Las migraciones (`pos-backend/db/migrations/`) y los datos semilla (`pos-backend/db/seed/`) solo se aplican cuando el volumen se crea por primera vez.
- Para empezar de cero tras cambiar migraciones: `docker compose down -v && docker compose up -d` (borra todos los datos locales).
- Consola SQL: `docker compose exec db psql -U postgres -d posde`.
