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

Avant de générer du code, lire :

- `AGENTS.md` ;
- `docs/00-vision.md` ;
- `docs/01-scope-and-roadmap.md` ;
- les documents liés à la fonctionnalité demandée.

Exemple de consigne à fournir à Cursor :

> Lis `AGENTS.md` ainsi que les documents du dossier `docs/` nécessaires à cette tâche. Considère-les comme la source de vérité. Analyse d’abord le projet existant, puis propose un plan d’implémentation limité au périmètre courant. N’invente pas de règle métier manquante et ne développe pas les phases futures.

## Statut du projet

Le projet est actuellement en phase de conception.

Les documents du dossier `docs/` doivent être finalisés progressivement avant l’implémentation complète.
