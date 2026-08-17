#!/usr/bin/env bash
# Restore PostgreSQL production from a pg_dump -Fc file.
# DANGEROUS: overwrites the current database.
#
# Usage :
#   CONFIRM_RESTORE=yes ./scripts/prod/restore-postgres.sh /path/to/gym-prod-XXXX.dump
#
# Prefer testing restore against a temporary Postgres first (see production-runbook).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
DUMP_FILE="${1:-}"

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "error: refuse to restore without CONFIRM_RESTORE=yes" >&2
  echo "usage: CONFIRM_RESTORE=yes $0 /path/to/dump.dump" >&2
  exit 1
fi

if [[ -z "$DUMP_FILE" || ! -f "$DUMP_FILE" ]]; then
  echo "error: dump file required and must exist" >&2
  echo "usage: CONFIRM_RESTORE=yes $0 /path/to/dump.dump" >&2
  exit 1
fi

if [[ ! -s "$DUMP_FILE" ]]; then
  echo "error: dump file is empty: $DUMP_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: env file not found: $ENV_FILE" >&2
  exit 1
fi

echo "WARNING: restoring into production Postgres from: $DUMP_FILE"
echo "This will DROP and recreate objects as required by pg_restore --clean."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -c 'pg_restore --clean --if-exists --no-owner --dbname="$POSTGRES_DB" -U "$POSTGRES_USER"' \
  < "$DUMP_FILE"

echo "Restore finished. Run API healthchecks and smoke tests."
