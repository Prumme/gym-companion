# Runbook production — Gym Companion

Document opérationnel pour l’environnement **production** distinct du staging.

Références code :

- `docker-compose.prod.yml`
- `.env.prod.example` → copier en `.env.prod` (gitignored)
- `scripts/prod/deploy.sh` (déploiement versionné — utilisé par GitHub Actions)
- `scripts/prod/backup-postgres.sh`
- `scripts/prod/restore-postgres.sh`
- `scripts/prod/prune-backups.sh`
- `.github/workflows/deploy-production.yml`

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
- [ ] Partage programme/séance : lien 1 h, preview, import copie DRAFT
- [ ] PWA (install / update après reload)
- [ ] Coach IA : indisponible / désactivé selon UX (config `AI_COACH_ENABLED=false`)

### 1.12 Test mobile (manuel)

iPhone / Android réel : safe-area, bottom nav, focus workout, clavier, sheets, PWA.

---

## 2. Déploiement suivant (release)

**Préféré :** GitHub Actions → workflow **Deploy production** (manuel). Voir §4bis.

Déploiement SSH manuel (secours) :

1. **Backup DB** (obligatoire si migration ; fortement recommandé sinon)

```bash
BACKUP_DIR=/var/backups/gym-companion ./scripts/prod/backup-postgres.sh
# Vérifier taille non nulle affichée par le script
```

2. Déployer un SHA précis :

```bash
./scripts/prod/deploy.sh <git-sha-40-chars>
```

### Release incluant `TrainingShareLink` (`20260817140000_add_training_share_links`)

```bash
./scripts/prod/deploy.sh <sha>
# ou workflow Deploy production
# Smoke : créer share programme → ouvrir /share/:token → importer sur un 2ᵉ compte
```

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

Les migrations Prisma en production doivent rester **backward-compatible** autant que possible (API ancienne encore en ligne pendant le build, puis migrate, puis recreate).

---

## 4bis. CI/CD production (GitHub Actions)

### Architecture

```text
GitHub Actions (workflow_dispatch « Deploy production »)
  → quality gate (réutilise CI)
  → SSH VPS
  → /opt/gym-companion/scripts/prod/deploy.sh <github.sha>
```

La CI **ne contient pas** `.env.prod` ni secrets applicatifs (JWT, DB, Coach…).  
Ceux-ci restent uniquement sur le VPS dans `/opt/gym-companion/.env.prod`.

Caddy / DNS / staging : **hors scope** de ce workflow.

### Workflow

- Fichier : `.github/workflows/deploy-production.yml`
- Trigger : **manuel uniquement** (`workflow_dispatch`)
- Environment GitHub : `production` (URL `https://gym.prumme.dev`)
- Concurrency : groupe `gym-production` (pas d’annulation d’un run en cours)
- Timeout job deploy : 15 min
- SHA déployé : **exactement** `github.sha` (pas `git pull origin main`)

### Secrets GitHub (environment `production`)

| Secret | Rôle |
|---|---|
| `PROD_SSH_HOST` | Hostname / IP du VPS |
| `PROD_SSH_USER` | Utilisateur SSH (idéalement `deploy`, pas root) |
| `PROD_SSH_PRIVATE_KEY` | Clé privée Ed25519 (PEM) |
| `PROD_SSH_KNOWN_HOSTS` | Sortie `ssh-keyscan -H <host>` **vérifiée** |
| `PROD_SSH_PORT` | Optionnel (défaut 22) |

**Ne jamais** mettre dans GitHub : `DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_*`, `COOKIE_SECRET`, `AI_COACH_API_KEY`, contenu de `.env.prod`.

### Protection environment

Dans GitHub → Settings → Environments → `production` :

1. Créer l’environment `production`
2. Ajouter les secrets ci-dessus **sur l’environment** (pas repository-wide si possible)
3. Optionnel : Required reviewers (approbation avant deploy)
4. Optionnel : limiter aux branches `main` / tags `prod-*`

### Déroulé du script `scripts/prod/deploy.sh`

1. `flock` `/var/lock/gym-companion-prod-deploy.lock` (fail si concurrent)
2. Vérifie `.env.prod` + `docker-compose.prod.yml`
3. Refuse si arbre git **tracked** dirty (`git status -uno`)
4. `git fetch` + vérifie le SHA
5. Backup via `BACKUP_DIR=/var/backups/gym-companion ./scripts/prod/backup-postgres.sh`
6. `git checkout --detach <sha>`
7. `docker compose … config`
8. `build gym-api gym-web` (ancienne version encore up)
9. `prisma migrate deploy` (jamais `migrate dev` / `reset`)
10. `up -d --no-deps --force-recreate gym-api gym-web`
11. Attend Docker healthy (`gym-prod-api`, `gym-prod-web`)
12. `curl` HTTPS `api…/health/live` puis `gym.prumme.dev`

Mode dry-run :

```bash
./scripts/prod/deploy.sh --check <sha>
```

### Seed

**Aucun seed** automatique en release. Seed catalogue = opération manuelle distincte.

### Rollback manuel

En cas d’échec après migration :

1. Lire dans les logs CI : `previous=<sha>` / `target=<sha>`
2. Si migration rétrocompatible :  
   `ssh … '/opt/gym-companion/scripts/prod/deploy.sh <previous>'`
3. Sinon : restaurer dump + redeploy code compatible (voir §3–4)

Pas de rollback DB automatique.

### Utilisateur SSH recommandé

Préférence : compte `deploy` avec accès à `/opt/gym-companion`, Docker, `/var/backups/gym-companion`.  
Si la prod tourne encore via root/sudo : acceptable pour V1, migrer plus tard.

### Création clé SSH (manuel admin)

Sur une machine d’admin (pas dans le repo) :

```bash
ssh-keygen -t ed25519 -C "gym-companion-ci-prod" -f gym-companion-ci-prod -N ""
# privée → secret GitHub PROD_SSH_PRIVATE_KEY (contenu PEM)
# publique → ~/.ssh/authorized_keys du compte deploy sur le VPS
```

Known hosts (vérifier l’empreinte avant stockage CI) :

```bash
ssh-keyscan -H <VPS_HOST>
# coller la sortie dans secret PROD_SSH_KNOWN_HOSTS
```

### Déclencher un déploiement

1. CI verte sur le commit voulu
2. GitHub → Actions → **Deploy production** → Run workflow
3. Choisir la branche/tag (donc le `github.sha`)
4. Suivre les logs `quality` puis `deploy`

### Troubleshooting

| Symptôme | Piste |
|---|---|
| `HOST KEY VERIFICATION FAILED` | `PROD_SSH_KNOWN_HOSTS` incorrect / obsolète |
| `Permission denied (publickey)` | clé / user / `authorized_keys` |
| `arbre git dirty` | fichiers tracked modifiés sur le VPS |
| `another deployment is in progress` | flock ; attendre ou inspecter process |
| backup vide / fail | Postgres down / droits `BACKUP_DIR` |
| timeout healthy | `docker logs gym-prod-api` / `gym-prod-web` |
| migrate fail | ne pas seed ; restaurer dump si besoin |

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
