#!/usr/bin/env bash
# Déploiement production Gym Companion (source de vérité VPS).
#
# Usage :
#   ./scripts/prod/deploy.sh <git-sha>
#   ./scripts/prod/deploy.sh --check <git-sha>
#
# Variables optionnelles :
#   GYM_PROD_ROOT          (défaut : racine du repo / /opt/gym-companion)
#   BACKUP_DIR             (défaut : /var/backups/gym-companion)
#   DEPLOY_LOCK_FILE       (défaut : /var/lock/gym-companion-prod-deploy.lock)
#   COMPOSE_FILE           (défaut : docker-compose.prod.yml)
#   ENV_FILE               (défaut : .env.prod)
#   API_HEALTH_URL         (défaut : https://api.gym.prumme.dev/health/live)
#   WEB_HEALTH_URL         (défaut : https://gym.prumme.dev/)
#   HEALTH_WAIT_SECONDS    (défaut : 120)
#   HTTP_HEALTH_RETRIES    (défaut : 5)
#   HTTP_HEALTH_INTERVAL   (défaut : 3)
#
# Ne logge jamais .env.prod / secrets.
# Ne touche pas Caddy, DNS, ni seed.
set -Eeuo pipefail

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF' >&2
Usage: ./scripts/prod/deploy.sh [--check] <git-sha>

  --check   validations seules (pas de backup / build / migrate / recreate)
EOF
  exit 2
}

CHECK_ONLY=0
TARGET_SHA=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      CHECK_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      ;;
    -*)
      die "option inconnue: $1"
      ;;
    *)
      if [[ -n "$TARGET_SHA" ]]; then
        die "un seul SHA attendu"
      fi
      TARGET_SHA="$1"
      shift
      ;;
  esac
done

[[ -n "$TARGET_SHA" ]] || usage

# Accepte SHA court ou long (hex uniquement).
if [[ ! "$TARGET_SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
  die "SHA invalide (attendu ^[0-9a-f]{7,40}$): refuse"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ROOT_DIR="${GYM_PROD_ROOT:-$DEFAULT_ROOT}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/gym-companion}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-/var/lock/gym-companion-prod-deploy.lock}"
API_HEALTH_URL="${API_HEALTH_URL:-https://api.gym.prumme.dev/health/live}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-https://gym.prumme.dev/}"
HEALTH_WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-120}"
HTTP_HEALTH_RETRIES="${HTTP_HEALTH_RETRIES:-5}"
HTTP_HEALTH_INTERVAL="${HTTP_HEALTH_INTERVAL:-3}"

cd "$ROOT_DIR" 2>/dev/null || die "GYM_PROD_ROOT inaccessible: $ROOT_DIR"

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

require_preconditions() {
  [[ -f "$ENV_FILE" ]] || die "fichier manquant: $ENV_FILE (ne pas le créer depuis la CI)"
  [[ -f "$COMPOSE_FILE" ]] || die "fichier manquant: $COMPOSE_FILE"
  command -v docker >/dev/null 2>&1 || die "docker introuvable"
  docker compose version >/dev/null 2>&1 || die "docker compose plugin introuvable"
  command -v git >/dev/null 2>&1 || die "git introuvable"
  command -v curl >/dev/null 2>&1 || die "curl introuvable"
  [[ -d .git ]] || die "pas un dépôt git: $ROOT_DIR"
}

assert_clean_tracked_tree() {
  # Ignore untracked (.env.prod, backups, etc.).
  local dirty
  dirty="$(git status --porcelain -uno || true)"
  if [[ -n "$dirty" ]]; then
    printf '%s\n' "$dirty" >&2
    die "arbre git dirty (fichiers tracked modifiés). Arrêt pour éviter d’écraser des changements locaux."
  fi
}

wait_container_healthy() {
  local container="$1"
  local deadline=$((SECONDS + HEALTH_WAIT_SECONDS))
  local status

  log "wait healthy ${container} (timeout ${HEALTH_WAIT_SECONDS}s)"
  while (( SECONDS < deadline )); do
    if ! docker inspect "$container" >/dev/null 2>&1; then
      sleep 2
      continue
    fi
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo missing)"
    case "$status" in
      healthy|running)
        # Sans Healthcheck, "running" suffit ; avec Healthcheck, exiger healthy.
        if docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null | grep -q .; then
          if [[ "$status" == "healthy" ]]; then
            log "healthy ${container}"
            return 0
          fi
        else
          if [[ "$status" == "running" ]]; then
            log "running ${container} (no healthcheck)"
            return 0
          fi
        fi
        ;;
      unhealthy)
        die "${container} unhealthy"
        ;;
    esac
    sleep 2
  done
  die "timeout health Docker: ${container}"
}

http_health() {
  local url="$1"
  local attempt
  for attempt in $(seq 1 "$HTTP_HEALTH_RETRIES"); do
    if curl --fail --silent --show-error --max-time 15 -L -o /dev/null "$url"; then
      log "http ok ${url}"
      return 0
    fi
    log "http retry ${attempt}/${HTTP_HEALTH_RETRIES} ${url}"
    sleep "$HTTP_HEALTH_INTERVAL"
  done
  die "http health failed: ${url}"
}

run_check() {
  log "check mode"
  require_preconditions
  assert_clean_tracked_tree
  git fetch --quiet origin
  git cat-file -e "${TARGET_SHA}^{commit}" 2>/dev/null \
    || die "commit introuvable après fetch: ${TARGET_SHA}"
  compose config >/dev/null
  mkdir -p "$BACKUP_DIR"
  [[ -w "$BACKUP_DIR" ]] || die "BACKUP_DIR non inscriptible: $BACKUP_DIR"
  log "check ok target=$(git rev-parse --short "$TARGET_SHA")"
}

run_deploy() {
  require_preconditions

  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    die "un autre déploiement est déjà en cours (lock: $LOCK_FILE)"
  fi

  local previous
  previous="$(git rev-parse HEAD)"
  local previous_short target_short
  previous_short="$(git rev-parse --short HEAD)"
  target_short="$(git rev-parse --short "$TARGET_SHA" 2>/dev/null || echo "$TARGET_SHA")"

  log "previous=${previous_short}"
  log "target=${target_short}"

  assert_clean_tracked_tree

  log "fetch"
  git fetch origin
  git cat-file -e "${TARGET_SHA}^{commit}" 2>/dev/null \
    || die "commit introuvable après fetch: ${TARGET_SHA}"
  target_short="$(git rev-parse --short "$TARGET_SHA")"
  log "target=${target_short}"

  log "backup"
  BACKUP_DIR="$BACKUP_DIR" \
    COMPOSE_FILE="$COMPOSE_FILE" \
    ENV_FILE="$ENV_FILE" \
    ./scripts/prod/backup-postgres.sh

  log "checkout --detach ${target_short}"
  git checkout --detach "$TARGET_SHA"

  log "compose config"
  compose config >/dev/null

  log "build gym-api gym-web"
  compose build gym-api gym-web

  log "migrate deploy"
  compose run --rm --entrypoint node \
    gym-api apps/api/scripts/run-prisma.cjs migrate deploy

  log "recreate gym-api gym-web"
  compose up -d --no-deps --force-recreate gym-api gym-web

  wait_container_healthy gym-prod-api
  wait_container_healthy gym-prod-web

  log "https health"
  http_health "$API_HEALTH_URL"
  http_health "$WEB_HEALTH_URL"

  log "success previous=${previous_short} target=${target_short}"
  log "rollback manuel éventuel: ./scripts/prod/deploy.sh ${previous}"
}

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  run_check
else
  run_deploy
fi
