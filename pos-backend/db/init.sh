#!/bin/bash
# Lo ejecuta la imagen de Postgres solo la primera vez que crea la BD.
# Aplica las migraciones en orden y después los datos semilla de desarrollo.
set -euo pipefail

run_dir() {
  local dir="$1"
  for f in "$dir"/*.sql; do
    [ -e "$f" ] || continue
    echo "init: aplicando $f"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
  done
}

run_dir /migrations
run_dir /seed
