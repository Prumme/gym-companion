#!/usr/bin/env bash
# Prune old production backups (local files). Cron is configured on the VPS, not here.
# Usage :
#   BACKUP_RETENTION_DAYS=7 ./scripts/prod/prune-backups.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/prod}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

if [[ ! "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || [[ "$BACKUP_RETENTION_DAYS" -lt 1 ]]; then
  echo "error: BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 1
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "No backup directory: $BACKUP_DIR (nothing to prune)"
  exit 0
fi

echo "Pruning dumps older than ${BACKUP_RETENTION_DAYS} day(s) in $BACKUP_DIR"
# macOS/BSD find lacks -printf; use -mtime which is portable.
find "$BACKUP_DIR" -type f -name 'gym-prod-*.dump' -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete
echo "Prune done."
