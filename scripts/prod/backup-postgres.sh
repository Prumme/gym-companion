#!/usr/bin/env bash
# Backup PostgreSQL production (pg_dump -Fc).
# Usage (depuis la racine du repo, sur le VPS) :
#   ./scripts/prod/backup-postgres.sh
# Variables optionnelles : BACKUP_DIR, COMPOSE_FILE, ENV_FILE
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: env file not found: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "error: compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/gym-prod-${STAMP}.dump"

echo "Creating backup: $OUT_FILE"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$OUT_FILE"

if [[ ! -s "$OUT_FILE" ]]; then
  echo "error: backup file is empty: $OUT_FILE" >&2
  rm -f "$OUT_FILE"
  exit 1
fi

SIZE="$(wc -c < "$OUT_FILE" | tr -d ' ')"
echo "Backup OK (${SIZE} bytes): $OUT_FILE"
