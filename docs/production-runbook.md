# Runbook production — Gym Companion

Document opérationnel pour l’environnement **production** distinct du staging.

Références code :

- `docker-compose.prod.yml`
- `.env.prod.example` → copier en `.env.prod` (gitignored)
- `scripts/prod/backup-postgres.sh`
- `scripts/prod/restore-postgres.sh`
- `scripts/prod/prune-backups.sh`

**Règle absolue :** le staging est un environnement de test. Sa DB n’est **jamais** promue en production. Seul le **code** est promu. Les référentiels prod sont recréés via `migrate deploy` + seed.

---

## 0. Prérequis VPS

- Docker Engine + Docker Compose plugin
- Réseau externe `prumme-proxy` déjà utilisé par Caddy
- Accès git au dépôt
- DNS prêts (conceptuel) :
  - `gym.prumme.dev` → VPS
  - `api.gym.prumme.dev` → VPS
- Secrets générés localement (ne pas réutiliser staging) :

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # COOKIE_SECRET
openssl rand -hex 24   # POSTGRES_PASSWORD (ou plus long)
```

---

## 1. Première installation

### 1.1 Clone / pull

```bash
cd /chemin/vers/gym-companion
git pull
# Option recommandé au premier release : tag prod-v1.0.0 (à créer manuellement)
```

### 1.2 Créer `.env.prod`

```bash
cp .env.prod.example .env.prod
# Éditer : secrets, DATABASE_URL, URLs, CORS
```

Points critiques :

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Hostname Docker = `postgres` (service compose). **URL-encoder** le mot de passe si caractères spéciaux. |
| `CORS_ALLOWED_ORIGINS` | Uniquement `https://gym.prumme.dev` (pas staging, pas `*`) |
| `VITE_*` | Figées au **build** de l’image web → rebuild si changement |
| `AI_COACH_*` | Laisser disabled pour la V1 |
| `EMAIL_PROVIDER` | `none` (pas de Mailpit en prod) |

Valider la syntaxe Compose **sans démarrer** :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod config >/dev/null
```

### 1.3 Réseau reverse proxy

```bash
docker network inspect prumme-proxy >/dev/null || docker network create prumme-proxy
```

### 1.4 Build des images

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build
```

### 1.5 Démarrer PostgreSQL seul

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

Attendre `healthy` sur `gym-prod-postgres`.

### 1.6 Migrations (`migrate deploy` uniquement)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --entrypoint node \
  gym-api apps/api/scripts/run-prisma.cjs migrate deploy
```

**Interdit en prod :** `migrate dev`, `migrate reset`.

### 1.7 Seed référentiels (production-safe)

Le seed (`apps/api/prisma/seed.cjs`) crée uniquement :

- EquipmentTypes
- MuscleGroups
- Exercices SYSTEM

Il **ne crée pas** d’utilisateur, programme, séance, token, conversation Coach, Shared room.

Idempotent (upsert / sync par `slug` / `code`).

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --entrypoint node \
  gym-api apps/api/scripts/run-prisma.cjs db seed
```

### 1.8 Démarrer API + Web

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d gym-api gym-web
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

### 1.9 Caddy (snippet conceptuel — à appliquer manuellement)

Ne contient aucun secret. Adapter si les noms Docker diffèrent.

```caddy
gym.prumme.dev {
  encode gzip
  reverse_proxy gym-prod-web:80
}

api.gym.prumme.dev {
  encode gzip
  reverse_proxy gym-prod-api:3000
}
```

Caddy et les conteneurs `gym-prod-*` doivent partager le réseau `prumme-proxy`.  
Socket.IO / Shared Workouts : `reverse_proxy` Caddy suffit en général (pas de config WS spéciale).

Recharger Caddy **après** configuration DNS + containers up.

### 1.10 Healthchecks

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=100 gym-api

# Depuis un conteneur sur prumme-proxy, ou via HTTPS public :
curl -fsS https://api.gym.prumme.dev/health/live
curl -fsS https://api.gym.prumme.dev/health/ready
curl -fsSI https://gym.prumme.dev/
```

- `/health/live` : process up (utilisé par Docker healthcheck)
- `/health/ready` : DB joignable

Swagger `/docs` : **désactivé** en prod (`GYM_ENV=production`). Staging inchangé.

### 1.11 Smoke tests (checklist)

- [ ] Ouverture web HTTPS
- [ ] Register
- [ ] Login
- [ ] Refresh page → session restaurée (cookie Secure)
- [ ] Logout / login
- [ ] Profil
- [ ] Catalogue exercices (SYSTEM présents sans exercice perso)
- [ ] Création programme + activation + planning
- [ ] Démarrer séance, séries, timer repos, terminer
- [ ] Historique / progression / records
- [ ] Shared room + join code + 2ᵉ utilisateur + présence
- [ ] PWA (install / update après reload)
- [ ] Coach IA : indisponible / désactivé selon UX (config `AI_COACH_ENABLED=false`)

### 1.12 Test mobile (manuel)

iPhone / Android réel : safe-area, bottom nav, focus workout, clavier, sheets, PWA.

---

## 2. Déploiement suivant (release)

1. **Backup DB** (obligatoire si migration ; fortement recommandé sinon)

```bash
./scripts/prod/backup-postgres.sh
# Vérifier taille non nulle affichée par le script
```

2. `git fetch && git checkout <tag-ou-commit>` (ex. `prod-v1.0.1`)
3. Vérifier / ajuster `.env.prod` si nouvelles variables (sans commit)
4. Build

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build
```

5. Si migration Prisma présente :

```bash
# backup déjà fait
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm --entrypoint node \
  gym-api apps/api/scripts/run-prisma.cjs migrate deploy
```

6. Recreate services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

7. Healthchecks + smoke tests courts
8. Si `VITE_*` ont changé : s’assurer que `gym-web` a bien été **rebuild** (pas seulement restart)

### PWA après déploiement web

Nouveau build → nouveau service worker. Les clients reçoivent la mise à jour selon le comportement Workbox actuel (souvent après refresh / nouvel onglet). Pas de cache-busting custom dans ce jalon.

---

## 3. Backups

### Créer

```bash
./scripts/prod/backup-postgres.sh
# → backups/prod/gym-prod-<UTC>.dump
```

### Restaurer (dangereux)

```bash
CONFIRM_RESTORE=yes ./scripts/prod/restore-postgres.sh backups/prod/gym-prod-XXXX.dump
```

Un backup n’est pas fiable tant qu’une **restauration n’a jamais été testée**.  
Tester d’abord vers un Postgres temporaire (container jetable), **pas** sur la prod vivante.

### Rétention

```bash
BACKUP_RETENTION_DAYS=7 ./scripts/prod/prune-backups.sh
```

Cron VPS : à configurer manuellement (hors repo).

---

## 4. Rollback code

```bash
./scripts/prod/backup-postgres.sh
git checkout <previous-tag>   # ex. prod-v1.0.0
docker compose -f docker-compose.prod.yml --env-file .env.prod build
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

**Limite :** une migration DB non rétrocompatible empêche un simple rollback code.  
Ne pas automatiser un rollback DB destructif. Prévoir restauration dump uniquement si nécessaire et après confirmation.

---

## 5. Isolation staging / prod

| | Staging | Prod |
|---|---|---|
| Compose | `docker-compose.staging.yml` | `docker-compose.prod.yml` |
| Env | `.env.staging` | `.env.prod` |
| Containers | `gym-staging-*` | `gym-prod-*` |
| Volume PG | `gym_staging_pg_data` | `gym_prod_pg_data` |
| Réseau privé | `gym` | `gym-prod` |
| Proxy | `prumme-proxy` | `prumme-proxy` |
| Coach IA | peut être enabled | disabled par défaut |

Les deux stacks peuvent tourner **simultanément** sur le même VPS.

---

## 6. Décisions techniques (PROD-1)

| Sujet | Décision |
|---|---|
| Swagger | Désactivé si `GYM_ENV=production` |
| Trust proxy | `1` hop en `NODE_ENV=production` |
| Cookies | `Secure` si `isProduction` ; `HttpOnly` ; `SameSite=lax` ; path `/api/v1/auth` |
| CORS | Liste explicite via env (pas `*`) |
| Email | `EMAIL_PROVIDER=none` ; SMTP réel = dette ultérieure |
| Mailpit / Adminer | Absents de prod |
| Helmet / CSP | Non ajouté (dette documentée) |
| Rate limits | Process-local (`Throttler`) ; skip uniquement `NODE_ENV=test` |
| User non-root API | Déjà `USER gym` dans `docker/api.Dockerfile` |
| Web nginx | Tourne root image officielle (dette acceptable V1) |
| Resource limits | Non définis dans compose (config VPS plus tard) |

---

## 7. Tag de première prod

Créer manuellement au moment du release :

```text
prod-v1.0.0
```

Ne pas créer automatiquement dans ce jalon.
