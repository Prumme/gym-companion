# Gym Companion

Gym Companion est une application mobile-first de suivi d’entraînement, de nutrition et de séances collaboratives.

Elle permet à un utilisateur de préparer ses programmes, enregistrer précisément ses performances et suivre sa progression.

Elle permet également à plusieurs personnes de lancer une séance commune, d’organiser leur rotation sur les machines et d’afficher des charges adaptées à chaque participant.

L’application est conçue comme une Progressive Web App afin d’être installable sur téléphone et utilisable dans une salle de sport.

## Objectifs principaux

- Réduire les manipulations nécessaires pendant une séance.
- Retrouver rapidement ses charges et performances précédentes.
- Enregistrer les séries réussies, partielles, échouées ou ignorées.
- Suivre sa progression exercice par exercice.
- Organiser des séances à plusieurs.
- Adapter les charges et répétitions au niveau de chaque participant.
- Synchroniser les séances partagées en temps réel.
- Suivre les calories et macronutriments.
- Proposer des programmes et ajustements à l’aide d’une IA.
- Continuer à fonctionner partiellement lorsque le réseau est indisponible.

## Fonctionnalité distinctive

La fonctionnalité centrale du produit est la séance collaborative.

Plusieurs utilisateurs peuvent rejoindre une même séance et tourner sur les équipements disponibles.

Chaque participant conserve :

- ses propres charges ;
- ses propres objectifs ;
- son nombre de répétitions ;
- son temps de repos ;
- son historique ;
- ses performances.

Le serveur synchronise notamment :

- l’état de la séance ;
- les participants présents ;
- les séries terminées ;
- les changements de station ;
- la rotation sur les machines ;
- la fin de séance.

## Architecture cible

```text
gym-companion/
├── AGENTS.md
├── README.md
│
├── docs/
│   ├── 00-vision.md
│   ├── 01-scope-and-roadmap.md
│   ├── 02-user-flows.md
│   ├── 03-functional-requirements.md
│   ├── 04-business-rules.md
│   ├── 05-data-model.md
│   ├── 06-pages-and-navigation.md
│   ├── 07-ui-ux-guidelines.md
│   ├── 08-technical-architecture.md
│   ├── 09-api-contracts.md
│   ├── 10-realtime-workouts.md
│   ├── 11-pwa-and-offline.md
│   ├── 12-ai-coach.md
│   ├── 13-security-and-privacy.md
│   ├── 14-testing-strategy.md
│   └── 15-deployment.md
│
├── apps/
│   ├── web/
│   └── api/
│
└── packages/
    ├── shared/
    ├── validation/
    └── config/
```

## Stack technique prévue

### Monorepo

- pnpm workspaces
- Turborepo

### Frontend

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- shadcn/ui
- Lucide React
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Socket.IO Client
- Recharts
- vite-plugin-pwa

### Backend

- NestJS
- TypeScript
- REST
- Socket.IO
- Prisma
- PostgreSQL
- JWT
- Refresh tokens
- Argon2
- Swagger / OpenAPI

### Infrastructure initiale

- Docker Compose
- Caddy ou Nginx
- PostgreSQL
- Un VPS
- HTTPS
- Sauvegardes régulières

## Répartition des responsabilités

### `apps/web`

Contient l’application React et la PWA.

Responsabilités principales :

- interface utilisateur ;
- navigation ;
- formulaires ;
- cache des données serveur ;
- état local temporaire ;
- fonctionnement hors ligne ;
- connexion Socket.IO ;
- notifications ;
- installation PWA.

### `apps/api`

Contient l’API NestJS.

Responsabilités principales :

- authentification ;
- autorisations ;
- logique métier ;
- persistance ;
- génération de programmes ;
- calculs ;
- séances partagées ;
- WebSocket ;
- notifications push ;
- intégration IA.

### `packages/shared`

Contient les éléments TypeScript partagés :

- enums ;
- types ;
- contrats de réponses ;
- événements WebSocket ;
- constantes métier non sensibles.

### `packages/validation`

Contient les schémas de validation partagés.

Exemples :

- formulaires ;
- DTO ;
- événements WebSocket ;
- réponses IA structurées ;
- imports de données.

### `packages/config`

Contient les configurations communes :

- TypeScript ;
- ESLint ;
- Prettier ;
- outils de test ;
- conventions de build.

## Documentation

Les documents doivent être lus dans cet ordre :

1. `docs/00-vision.md`
2. `docs/01-scope-and-roadmap.md`
3. `docs/02-user-flows.md`
4. `docs/03-functional-requirements.md`
5. `docs/04-business-rules.md`
6. `docs/05-data-model.md`

Les documents suivants détaillent l’interface, l’architecture et l’exploitation.

## Conventions initiales

### Langues

- Interface utilisateur : français.
- Code : anglais.
- Noms de variables et entités : anglais.
- Documentation : français.
- Textes envoyés par l’API : codes stables ou objets traduisibles côté frontend.

### Dates

- Les timestamps sont échangés au format ISO 8601.
- Les timestamps sont enregistrés en UTC.
- La timezone utilisateur est stockée explicitement.
- Les regroupements par journée utilisent la timezone utilisateur.

### Unités

Première version :

- poids : kilogrammes ;
- distance : kilomètres et mètres ;
- énergie : kilocalories ;
- durée : secondes côté données, format lisible dans l’interface.

L’architecture doit permettre l’ajout futur des livres et miles.

## Principes produit

- Mobile-first.
- Rapide pendant une séance.
- Accessible.
- Transparent sur les estimations.
- Fonctionnement dégradé hors ligne.
- L’utilisateur garde le contrôle.
- L’IA propose mais ne décide pas.
- Les données de santé et de performance sont protégées.
- Les fonctionnalités futures ne doivent pas complexifier prématurément la V1.

## Démarrage du développement

### Prérequis

- Node.js 22+
- pnpm 9+
- Docker (PostgreSQL local)

### Installation

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm --filter @gym-companion/api prisma:deploy
pnpm --filter @gym-companion/api prisma:seed
pnpm build
```

### Développement

```bash
pnpm dev
```

- Web : http://localhost:5173
  - Catalogue : http://localhost:5173/exercises (auth requise)
  - Création : http://localhost:5173/exercises/new
  - Édition : http://localhost:5173/exercises/:exerciseId/edit (exercices personnels actifs)
  - Détail : http://localhost:5173/exercises/:exerciseId (favoris, préférences, archivage/restauration selon permissions)
  - Programmes : http://localhost:5173/programs (auth requise)
  - Planning : http://localhost:5173/planning (auth requise, programme courant)
  - Création : http://localhost:5173/programs/new
  - Détail / constructeur : http://localhost:5173/programs/:programId
  - Édition infos : http://localhost:5173/programs/:programId/edit
  - Planning : http://localhost:5173/programs/:programId/schedule
  - Séance active (interface complète) : http://localhost:5173/workouts/active
  - Détail séance (lecture seule si terminée/annulée) : http://localhost:5173/workouts/:workoutSessionId
  - Query optionnelle : `/workouts/active?exerciseId=...`
- API : http://localhost:3000
- Health : http://localhost:3000/health/live et `/health/ready`
- OpenAPI : http://localhost:3000/docs
- Références : http://localhost:3000/api/v1/reference/muscle-groups et `/equipment-types`
- Exercices : http://localhost:3000/api/v1/exercises
  - Query : `search`, `muscleGroupId`, `equipmentTypeId`, `measurementType`, `source`, `includeArchived`, `favoriteOnly`, `cursor`, `limit` (défaut 20, max 100)
  - Réponse : `{ data, pagination: { nextCursor, hasMore } }` (chaque item inclut `userPreference`)
  - Préférences : `GET|PUT|DELETE /api/v1/exercises/:exerciseId/preference`
- Programmes : http://localhost:3000/api/v1/programs
  - Query liste : `includeArchived`, `cursor`, `limit`
  - CRUD : `POST|GET|PATCH|DELETE /api/v1/programs`, `POST .../restore`
  - Modèles vides : `POST|PATCH|DELETE /api/v1/programs/:programId/workout-templates/...`
  - Réordonnancement modèles : `PUT /api/v1/programs/:programId/workout-templates/order`
  - Exercices du modèle : `POST|PATCH|DELETE .../workout-templates/:id/exercises/...`
  - Réordonnancement exercices : `PUT .../exercises/order`
  - Séries cibles : `POST|PATCH|DELETE .../exercises/:id/sets/...`
  - Réordonnancement séries : `PUT .../sets/order`
  - Programme courant : `GET /api/v1/programs/active`
  - Activation : `POST /api/v1/programs/:programId/activate` (body `{ startedOn, replaceCurrentProgram }`)
  - Désactivation : `POST /api/v1/programs/:programId/deactivate`
  - Planning : `GET|PUT /api/v1/programs/:programId/schedule`
- Séances : http://localhost:3000/api/v1/workouts
  - Active : `GET /api/v1/workouts/active` (`data: null` si aucune)
  - Création snapshot : `POST /api/v1/workouts` (body `{ sourceWorkoutTemplateId, localDate, timezone }`)
  - Détail : `GET /api/v1/workouts/:workoutSessionId`
  - Saisie série : `PATCH /api/v1/workouts/:workoutSessionId/exercises/:sessionExerciseId/sets/:workoutSetId`
  - Pause / reprise / fin / annulation : `POST /api/v1/workouts/:id/{pause|resume|complete|cancel}`
  - Historique : `GET /api/v1/workouts` (pagination cursor, filtres statut/dates) ; page http://localhost:5173/workouts
  - Détail séance : http://localhost:5173/workouts/:workoutSessionId
  - Minuterie de repos : locale uniquement (localStorage), non synchronisée, aucune donnée serveur
  - Hors ligne (3.5) : file IndexedDB de commandes pour séries + pause/reprise/fin/annulation ; création de séance toujours en ligne
  - Hors périmètre actuel : démarrage de séance hors ligne, 1RM / volume / graphiques / progression temporelle, WebSocket, Background Sync garanti, IA
- Mailpit : http://localhost:8025 (`docker compose up -d mailpit`)

Compose complet (profil `full`) :

```bash
docker compose --profile full up --build
```

### Vérifications

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Avant de générer du code métier, lire :

- `AGENTS.md` ;
- `docs/00-vision.md` ;
- `docs/01-scope-and-roadmap.md` ;
- les documents liés à la fonctionnalité demandée.

## Statut du projet

Le socle (Phase 0) et le catalogue d’exercices (Phase 1) sont en place.

Les jalons **2.1–2.4** couvrent programmes, modèles, exercices/séries, constructeur UI,
programme courant et planification hebdomadaire.

Le jalon **3.1** ajoute la création d’une séance active depuis un modèle (`WorkoutSession` snapshot),
les endpoints `GET/POST /api/v1/workouts` et `GET /api/v1/workouts/:id`, et la page `/workouts/active`.

Le jalon **3.2** permet d’enregistrer les séries effectuées (`PENDING` → `COMPLETED`/`PARTIAL`/`FAILED`/`SKIPPED`)
avec contrôle de version (`expectedVersion`) et idempotence optionnelle (`clientCommandId`).

Le jalon **3.3** ajoute le cycle de vie : pause, reprise, fin et annulation
(`POST .../pause|resume|complete|cancel`), avec libération du verrou d’unicité après fin/annulation.

Le jalon **3.4** transforme `/workouts/active` en interface de séance complète :
navigation entre exercices, progression, saisie des séries, actions rapides,
cycle de vie dans l’en-tête, et **minuterie de repos locale** (non synchronisée,
restaurable uniquement sur le même navigateur via `localStorage`, aucune entité backend).

Le jalon **3.5** ajoute la résilience réseau : snapshot IndexedDB, file de commandes
(`UPDATE_WORKOUT_SET`, `PAUSE`/`RESUME`/`COMPLETE`/`CANCEL`), application optimiste,
synchronisation séquentielle à la reprise du réseau (application ouverte), résolution
explicite des conflits, cloisonnement par utilisateur et nettoyage à la déconnexion.
La création de séance reste en ligne. Pas de WebSocket ni de Background Sync garanti.

Le jalon **3.6** ajoute l’historique des séances : `GET /api/v1/workouts` (pagination cursor,
filtres statut/dates/programme/modèle), page `/workouts`, détail lecture seule des snapshots
`COMPLETED`/`CANCELLED`, invalidation après fin/annulation, et affichage local des séances
terminales en attente de sync. Hors scope : records, progression, graphiques, volume officiel,
modification/suppression/duplication d’historique, IndexedDB d’archives complètes.

Le jalon **4.1** ajoute les records personnels simples en lecture : calcul à la demande depuis
les séances/séries `COMPLETED` (hors échauffement), endpoints
`GET /api/v1/personal-records` et `GET /api/v1/exercises/:exerciseId/personal-records`,
page `/records` et section sur le détail d’exercice. Pas de table `PersonalRecord`, pas de 1RM,
pas de volume, pas de graphiques. Invalidation TanStack Query uniquement après `COMPLETE_WORKOUT`
confirmé serveur.

Le jalon **4.2** ajoute les métriques agrégées de séance (calcul à la demande) : compteurs de
séries, répétitions, volume externe (`WEIGHT_REPS` uniquement, warmups exclus du volume de
travail), durée/distance enregistrées, durée écoulée. Exposées sur le détail `COMPLETED`
(`metrics`) et en résumé léger sur l’historique. Bodyweight / assistance exclus du volume.
Pas de page `/progress`, pas de graphiques, pas de table matérialisée.

Le jalon **4.3** ajoute la progression temporelle par exercice : série dérivée des séances
`COMPLETED` et snapshots (`sourceExerciseId`), endpoint
`GET /api/v1/progress/exercises/:exerciseId`, page `/progress/exercises/:exerciseId`
(graphique Recharts + résumé + liste accessible), métriques selon le type de mesure,
périodes `from`/`to` locales. Warmups exclus de `MAX_WEIGHT` / `MAX_REPS` / volume de
travail, inclus dans les totaux. Pas de 1RM, pas de table matérialisée, pas de dashboard
global `/progress`.

Le jalon **4.4** ajoute le dashboard global `/progress` : `GET /api/v1/progress/overview`,
totaux et fréquence dérivés des séances `COMPLETED` (réutilise les métriques 4.2),
timeline avec granularité DAY/WEEK/MONTH et buckets vides, comparaison de période
précédente, records récents (4.1) et top exercices. Descriptif uniquement — pas de
coaching, pas de statistiques persistées.

Le jalon **4.5** ajoute le 1RM estimé (e1RM) : formule Epley V1
(`weight × (1 + reps / 30)`), uniquement `WEIGHT_REPS`, séries `COMPLETED` hors warmup
entre 1 et 12 reps, RIR/RPE non intégrés. Endpoint
`GET /api/v1/progress/exercises/:exerciseId/strength`, section « Force estimée » sur
la page de progression d’exercice. Dérivé à la demande (pas de table), clairement
distinct des records réels.

Le jalon **5.1** ajoute le premier moteur de coaching : recommandations déterministes
de charge (lecture seule) pour `WEIGHT_REPS`, basées sur le `WorkoutTemplateExercise`,
au plus 3 séances `COMPLETED`, warmups exclus. Actions
`INCREASE` / `HOLD` / `DECREASE` / `INSUFFICIENT_DATA` / `REVIEW`. Endpoint
`GET /api/v1/coaching/workout-template-exercises/:id/load-recommendation`.
Carte « Suggestion pour la prochaine séance » sur le détail programme — **aucune
application automatique**, aucune IA. Incrément actuel : **2,5 kg système**
(`SYSTEM_DEFAULT`) — pas encore de préférence utilisateur d’incrément en base.

Le jalon **5.2** ajoute la **décision explicite** de l’utilisateur
(`ACCEPTED` / `ADJUSTED` / `IGNORED`) face à une recommandation 5.1. Le serveur
recalcule la recommandation, vérifie un `recommendationFingerprint`, et n’applique
une charge qu’après confirmation. Application limitée à `targetWeightKg` des séries
`WORKING` du modèle. Table d’audit `LoadRecommendationDecision` (idempotence
`clientCommandId`). Endpoints
`POST .../load-recommendation/decision` et
`GET .../load-recommendation-decisions`. Snapshots de séances actives / terminées
immuables. Pas d’auto-apply, pas d’IA, pas de commande offline.

Le jalon **5.3** ajoute la **détection déterministe de stagnation / plateau**
(lecture seule, `WEIGHT_REPS`). Analyse au plus 6 séances `COMPLETED` (min. 3)
par `sourceExerciseId` + équipement stable. Statuts
`NONE` / `WATCH` / `PLATEAU` / `INSUFFICIENT_DATA` / `REVIEW`. Endpoint
`GET /api/v1/coaching/exercises/:exerciseId/plateau-analysis`. Section
« Analyse de progression » sur `/progress/exercises/:exerciseId`.
**Aucune** prescription (deload, changement d’exercice…), aucune table Prisma,
aucune IA. Indépendant de 5.1/5.2.

Le jalon **5.4** ajoute le **Coach déterministe explicatif** : composition des
résultats 4.x / 5.1 / 5.2 / 5.3 en synthèse lisible (statut, headline, notices,
actions). Endpoints `GET /api/v1/coaching/exercises/:id/summary` et
`GET /api/v1/coaching/overview`. Route `/coach` + section Coach sur la
progression d’exercice. **Aucun LLM**, aucune persistance de résumé, aucune
mutation métier.

Le jalon **5.5** ajoute la **première couche LLM explicative** : reformulation
naturelle d’un `ExerciseCoachSummary` déterministe via
`POST /api/v1/coaching/exercises/:id/explanation`. Génération **à la demande**
uniquement (pas au chargement de `/coach`). Feature flag serveur
`AI_COACH_ENABLED` ; disponibilité exposée via `GET /api/v1/me` → `ai.available`.
Sortie structurée validée ; le LLM ne décide ni charge, ni plateau, ni programme.
Aucune table de génération ; fallback sur le Coach 5.4 en cas d’indisponibilité.

Le jalon **5.6** ajoute le **chat multi-tour** (`/coach/chat`) avec outils
**lecture seule** (summary, progression, force, records, séances). Conversations
persistées (`AiCoachConversation` / `AiCoachMessage` / `AiCoachToolInvocation`).
Aucun outil de mutation ; le LLM n’accède jamais à Prisma directement.
Idempotence `clientCommandId`, rate limit, boucle d’outils bornée (max 4).

> **Nomenclature :** les jalons techniques **5.1 → 5.6** forment la **Couche Coaching**
> (livrée sous la Phase 4 produit). La **roadmap Phase 5 — Séances partagées** est
> distincte : **Shared 5.1** (fondations salle REST) est **livré** ; invitations /
> Socket.IO restent à venir. « 5.6 complete » ≠ séances partagées terminées.

### Phase 5 produit — Shared 5.1 (livré)

Fondations des salles de séance partagée :

- `SharedWorkoutRoom` + `SharedWorkoutRoomMember` (`OWNER` / `MEMBER`) ;
- lifecycle `LOBBY` / `ACTIVE` / `COMPLETED` / `CANCELLED` (REST uniquement) ;
- endpoints `/api/v1/shared-workouts` ; UI `/shared-workouts` ;
- aucune invitation, aucun Socket.IO, aucune `WorkoutSession` créée automatiquement.

Les documents du dossier `docs/` restent la source de vérité produit et technique.
