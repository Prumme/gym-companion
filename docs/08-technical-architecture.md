# Architecture technique

## 1. Objectif de ce document

Ce document décrit l’architecture technique cible de Gym Companion.

Il définit notamment :

- l’organisation du monorepo ;
- la séparation des responsabilités ;
- l’architecture frontend ;
- l’architecture backend ;
- la communication HTTP et WebSocket ;
- la persistance ;
- le fonctionnement hors ligne ;
- l’authentification ;
- les traitements différés ;
- l’observabilité ;
- la stratégie d’évolution.

L’objectif est de fournir un cadre suffisamment précis pour garantir la cohérence du projet sans empêcher les ajustements nécessaires pendant l’implémentation.

## 2. Principes d’architecture

### 2.1 Monolithe modulaire

La première version du backend utilise un monolithe modulaire NestJS.

Le projet ne doit pas être découpé prématurément en microservices.

Les domaines sont séparés dans le code, mais peuvent partager :

- le même déploiement ;
- la même base PostgreSQL ;
- la même configuration ;
- le même processus backend.

Cette approche réduit :

- la complexité opérationnelle ;
- les coûts d’hébergement ;
- les problèmes de cohérence distribuée ;
- les besoins en observabilité avancée.

### 2.2 Frontend unique

La première version utilise une application React unique.

Elle fournit :

- l’interface desktop ;
- l’interface mobile ;
- la PWA ;
- la connexion à l’API ;
- la connexion Socket.IO.

Une application native n’est pas prévue dans les premières phases.

### 2.3 Séparation métier

Chaque domaine doit isoler :

- ses règles métier ;
- ses cas d’usage ;
- ses modèles ;
- sa persistance ;
- ses contrôleurs ;
- ses événements.

Les domaines principaux sont :

```text
auth
users
exercises
equipment
programs
workouts
progress
shared-workouts
nutrition
notifications
ai
data-management
admin
```

### 2.4 Dépendances dirigées

Les couches de haut niveau ne doivent pas dépendre directement de détails techniques non nécessaires.

Exemple :

```text
Controller
    ↓
Application service
    ↓
Domain service
    ↓
Repository interface
    ↓
Prisma repository
```

Le projet n’est pas obligé d’implémenter une architecture hexagonale stricte pour chaque CRUD simple.

La séparation doit être proportionnée à la complexité métier.

### 2.5 Backend autoritaire

Le backend reste l’autorité pour :

- l’identité ;
- les autorisations ;
- les données persistées ;
- les calculs métier ;
- les rotations ;
- les versions d’état ;
- les validations finales ;
- les opérations partagées.

### 2.6 Validation aux frontières

Toute donnée entrant dans le système est validée au niveau de sa frontière :

- HTTP ;
- WebSocket ;
- variables d’environnement ;
- fichiers importés ;
- service externe ;
- intelligence artificielle.

## 3. Organisation du monorepo

Structure cible :

```text
gym-companion/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── shared/
│   ├── validation/
│   └── config/
│
├── docs/
├── tooling/
├── docker/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 4. `apps/web`

Structure proposée :

```text
apps/web/
├── public/
├── src/
│   ├── app/
│   │   ├── router/
│   │   ├── providers/
│   │   ├── layouts/
│   │   └── entrypoints/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── common/
│   │   └── layout/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── exercises/
│   │   ├── equipment/
│   │   ├── programs/
│   │   ├── workouts/
│   │   ├── progress/
│   │   ├── shared-workouts/
│   │   ├── nutrition/
│   │   ├── notifications/
│   │   └── coach/
│   │
│   ├── lib/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── query/
│   │   ├── socket/
│   │   ├── storage/
│   │   ├── pwa/
│   │   └── utils/
│   │
│   ├── stores/
│   ├── hooks/
│   ├── styles/
│   ├── types/
│   └── main.tsx
│
├── index.html
├── vite.config.ts
└── package.json
```

## 5. Architecture frontend par fonctionnalité

Chaque fonctionnalité peut contenir :

```text
features/workouts/
├── api/
├── components/
├── hooks/
├── pages/
├── schemas/
├── stores/
├── types/
├── utils/
└── index.ts
```

### `api`

Contient :

- appels HTTP ;
- options TanStack Query ;
- mutations ;
- mapping des réponses.

### `components`

Contient les composants spécifiques au domaine.

### `hooks`

Contient les hooks de composition.

### `pages`

Contient les composants associés aux routes.

### `schemas`

Contient les schémas frontend spécifiques lorsqu’ils ne sont pas partagés.

### `stores`

Contient uniquement l’état client local à la fonctionnalité.

### `utils`

Contient des fonctions pures liées au domaine.

## 6. Gestion de l’état frontend

### 6.1 État serveur

TanStack Query gère :

- données récupérées depuis l’API ;
- cache ;
- chargement ;
- erreurs ;
- invalidation ;
- refetch ;
- mutations ;
- reprise après reconnexion.

Exemples :

```text
currentUser
exerciseCatalog
programs
workoutHistory
nutritionEntries
notificationPreferences
```

### 6.2 État client

Zustand gère uniquement les états qui ne correspondent pas directement à une ressource serveur.

Exemples :

- chronomètre local ;
- étape courante d’un éditeur ;
- état temporaire d’une séance ;
- commandes hors ligne ;
- état de connexion Socket.IO ;
- préférences d’affichage non persistées ;
- bottom sheet actuellement ouverte.

### 6.3 État de formulaire

React Hook Form gère les formulaires.

Les formulaires ne doivent pas utiliser Zustand par défaut.

### 6.4 État d’URL

Les filtres partageables ou restaurables doivent être stockés dans l’URL lorsque pertinent.

Exemples :

- période ;
- exercice sélectionné ;
- programme ;
- date nutritionnelle ;
- onglet actif.

## 7. Couche d’accès API frontend

La couche HTTP doit centraliser :

- URL de base ;
- en-têtes communs ;
- sérialisation ;
- parsing ;
- gestion des erreurs ;
- renouvellement de session ;
- annulation ;
- gestion des statuts HTTP.

Structure possible :

```text
lib/api/
├── api-client.ts
├── api-error.ts
├── auth-interceptor.ts
├── request.ts
└── response.ts
```

Le code métier ne doit pas utiliser directement `fetch` dans les composants.

## 8. Authentification frontend

### 8.1 Stratégie recommandée

Stratégie initiale recommandée :

- access token de courte durée conservé en mémoire ;
- refresh token conservé dans un cookie `HttpOnly`, `Secure`, `SameSite` adapté ;
- endpoint de renouvellement ;
- protection CSRF si nécessaire selon la configuration des cookies.

Cette stratégie doit être confirmée dans `docs/13-security-and-privacy.md`.

### 8.2 Démarrage de l’application

Au chargement :

1. l’application tente de récupérer l’utilisateur courant ;
2. si l’access token est absent ou expiré, elle tente un renouvellement ;
3. si le renouvellement échoue, l’utilisateur reste déconnecté ;
4. les routes privées sont protégées.

### 8.3 Expiration pendant une séance

Une expiration de session ne doit pas supprimer les données locales.

Le client doit :

- conserver la séance active ;
- proposer une reconnexion ;
- reprendre la synchronisation après authentification.

## 9. Routing frontend

React Router gère :

- routes publiques ;
- routes privées ;
- layouts ;
- chargement par route ;
- pages d’erreur ;
- redirections ;
- paramètres ;
- liens d’invitation.

Le lazy loading doit être utilisé pour les grandes sections non critiques :

- nutrition ;
- progression ;
- coach IA ;
- administration.

L’écran de séance active doit rester rapide à charger.

## 10. Design system

### 10.1 Base

Le design system utilise :

- Tailwind CSS ;
- variables CSS ;
- composants shadcn/ui ;
- Lucide React.

### 10.2 Composants métier

Les composants métier sont construits au-dessus des composants génériques.

Exemples :

```text
WorkoutSetEditor
ExerciseCard
RestTimer
SharedStationCard
NutritionSummary
SyncStatusBadge
```

### 10.3 Tokens

Les tokens sont centralisés :

- couleurs ;
- surfaces ;
- bordures ;
- rayons ;
- ombres ;
- espacements ;
- animations ;
- états métier.

## 11. PWA

### 11.1 Plugin

La PWA utilise `vite-plugin-pwa`.

### 11.2 Service worker

Le service worker gère :

- shell de l’application ;
- assets statiques ;
- stratégie de cache ;
- page hors ligne ;
- mise à jour de version ;
- réception des notifications push.

### 11.3 Cache

Les données sensibles ne doivent pas être mises en cache arbitrairement par le service worker.

Le stockage local applicatif doit être explicitement géré.

### 11.4 Mise à jour

Lorsqu’une nouvelle version est disponible :

- informer l’utilisateur ;
- éviter une actualisation pendant une saisie critique ;
- attendre que les commandes locales soient persistées ;
- permettre une mise à jour contrôlée.

## 12. Stockage local frontend

### 12.1 IndexedDB

IndexedDB est recommandé pour :

- séance active ;
- file de commandes hors ligne ;
- métadonnées de synchronisation ;
- catalogue récemment consulté ;
- données nécessaires au mode dégradé.

### 12.2 LocalStorage

LocalStorage peut être utilisé pour des préférences non sensibles et simples :

- thème ;
- état d’un tutoriel ;
- préférences d’affichage.

Il ne doit pas stocker :

- mot de passe ;
- refresh token ;
- données sensibles non chiffrées sans justification ;
- historique complet.

### 12.3 Abstraction

Une couche de stockage doit isoler IndexedDB.

Exemple :

```ts
interface OfflineWorkoutRepository {
  getActiveWorkout(): Promise<OfflineWorkout | null>;
  saveActiveWorkout(workout: OfflineWorkout): Promise<void>;
  addCommand(command: OfflineCommand): Promise<void>;
  listPendingCommands(): Promise<OfflineCommand[]>;
  markCommandConfirmed(commandId: string): Promise<void>;
}
```

## 13. Synchronisation hors ligne

### 13.1 Commandes

Le client enregistre des commandes plutôt que de remplacer arbitrairement un objet complet.

Exemples :

```text
CREATE_WORKOUT_SET
UPDATE_WORKOUT_SET
COMPLETE_WORKOUT
ADD_WORKOUT_EXERCISE
```

### 13.2 Cycle

```text
action utilisateur
    ↓
mise à jour locale
    ↓
commande persistée
    ↓
envoi réseau
    ↓
validation serveur
    ↓
confirmation ou conflit
```

### 13.3 Ordre

Les commandes liées au même agrégat sont envoyées dans l’ordre.

### 13.4 Conflit

Un conflit doit être transformé en objet compréhensible par l’interface.

## 14. Socket.IO frontend

La connexion Socket.IO doit être centralisée.

Structure possible :

```text
lib/socket/
├── socket-client.ts
├── socket-auth.ts
├── socket-events.ts
└── socket-status.ts
```

### Responsabilités

- ouverture de connexion ;
- authentification ;
- reconnexion ;
- abonnement aux événements ;
- désabonnement ;
- acknowledgements ;
- version d’état ;
- émission de commandes ;
- métriques de connexion.

Les composants ne doivent pas créer chacun leur propre socket.

## 15. `apps/api`

Structure proposée :

```text
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── common/
│   │   ├── decorators/
│   │   ├── exceptions/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── logging/
│   │   └── utils/
│   │
│   ├── config/
│   ├── database/
│   │   ├── prisma/
│   │   └── migrations/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── exercises/
│   │   ├── equipment/
│   │   ├── programs/
│   │   ├── workouts/
│   │   ├── progress/
│   │   ├── shared-workouts/
│   │   ├── nutrition/
│   │   ├── notifications/
│   │   ├── ai/
│   │   ├── data-management/
│   │   └── admin/
│   │
│   └── health/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
└── package.json
```

## 16. Structure d’un module backend

Exemple :

```text
modules/workouts/
├── application/
│   ├── commands/
│   ├── queries/
│   └── services/
│
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── services/
│   ├── policies/
│   └── repositories/
│
├── infrastructure/
│   ├── prisma/
│   └── mappers/
│
├── presentation/
│   ├── http/
│   └── websocket/
│
└── workouts.module.ts
```

Cette structure complète est recommandée pour les domaines complexes :

- séances ;
- progression ;
- séances partagées ;
- IA.

Pour un domaine simple, une structure plus légère est acceptable.

## 17. Couche présentation backend

### HTTP

Les contrôleurs :

- lisent les paramètres ;
- déclenchent la validation ;
- récupèrent l’utilisateur authentifié ;
- appellent un cas d’usage ;
- retournent une réponse.

Ils ne doivent pas contenir de calcul métier complexe.

### WebSocket

Les gateways :

- authentifient ;
- valident l’événement ;
- vérifient l’accès à la room ;
- appellent un service ;
- renvoient l’accusé ;
- diffusent l’événement approprié.

## 18. Couche application

La couche application orchestre les cas d’usage.

Exemples :

```text
CreateProgram
StartWorkout
CompleteWorkoutSet
CreateSharedWorkoutRoom
JoinSharedWorkoutRoom
ApplyRotation
GenerateAiProgramProposal
```

Elle gère notamment :

- transactions ;
- autorisations métier ;
- appels aux repositories ;
- événements métier ;
- réponses.

## 19. Couche domaine

La couche domaine contient :

- règles ;
- calculs ;
- politiques ;
- invariants ;
- objets valeur ;
- services déterministes.

Exemples :

```text
WeightRoundingPolicy
OneRepMaxEstimator
WorkoutProgressionPolicy
RotationPlanner
NutritionCalculator
```

Ces composants doivent pouvoir être testés sans serveur HTTP ni base réelle.

## 20. Accès aux données

### 20.1 Prisma

Prisma fournit :

- schéma ;
- migrations ;
- client ;
- transactions ;
- mapping avec PostgreSQL.

### 20.2 Repositories

Pour les domaines complexes, utiliser des repositories explicites.

Pour les CRUD simples, un service Prisma correctement encapsulé peut suffire.

### 20.3 Sélection des colonnes

Ne pas retourner systématiquement toutes les colonnes.

Les champs sensibles doivent être exclus explicitement.

### 20.4 Requêtes volumineuses

Les listes doivent utiliser :

- pagination ;
- filtres ;
- index ;
- sélection de colonnes ;
- limites maximales.

## 21. Transactions

Une transaction est nécessaire lorsqu’une opération doit rester atomique.

Exemples :

- créer une séance et son snapshot ;
- terminer une séance et calculer ses records ;
- appliquer une commande temps réel et incrémenter la version ;
- accepter une proposition IA et créer un programme ;
- supprimer un compte et révoquer les sessions.

Les transactions longues doivent être évitées.

Les appels externes ne doivent pas être exécutés au milieu d’une transaction PostgreSQL lorsque cela peut être évité.

## 22. Événements métier

Des événements internes peuvent être utilisés.

Exemples :

```text
WorkoutCompleted
PersonalRecordAchieved
SharedWorkoutStarted
SharedWorkoutCompleted
UserDeletionRequested
AiProposalAccepted
```

Ces événements permettent de déclencher :

- notification ;
- recalcul ;
- journalisation ;
- traitement différé.

L’usage d’un bus distribué n’est pas requis dans la première version.

Un event emitter interne ou une table de jobs peut suffire.

## 23. Traitements différés

Les traitements différés concernent :

- emails ;
- notifications push ;
- génération IA ;
- exports ;
- recalculs lourds ;
- nettoyage ;
- expiration de salles ;
- suppression différée.

### Première version

Une table de jobs PostgreSQL ou une librairie de queue légère peut suffire.

### Évolution

Redis et BullMQ deviennent pertinents lorsque :

- plusieurs workers sont nécessaires ;
- les volumes augmentent ;
- les retries doivent être avancés ;
- plusieurs instances backend sont utilisées.

Redis ne doit pas être ajouté uniquement par anticipation.

## 24. Authentification backend

### 24.1 Mot de passe

Utiliser Argon2.

### 24.2 Access token

Durée courte.

Contenu minimal :

- identifiant utilisateur ;
- rôle ;
- identifiant de session éventuel ;
- date d’expiration.

### 24.3 Refresh token

Le refresh token est :

- aléatoire ;
- de durée plus longue ;
- stocké sous forme hachée en base ;
- lié à une session ;
- révocable.

### 24.4 Rotation

La rotation des refresh tokens est recommandée.

La réutilisation d’un ancien token peut provoquer la révocation de la famille de session.

### 24.5 WebSocket

La connexion Socket.IO doit utiliser une preuve d’authentification valide.

Une stratégie possible :

- access token transmis lors du handshake ;
- renouvellement HTTP lorsque le token expire ;
- reconnexion Socket.IO.

## 25. Autorisations

Les autorisations sont vérifiées au niveau des cas d’usage.

Exemples :

- propriétaire d’un programme ;
- membre d’une salle ;
- hôte d’une salle ;
- administrateur ;
- propriétaire d’un aliment ;
- propriétaire d’une proposition IA.

Un simple identifiant valide ne donne pas automatiquement accès à la ressource.

## 26. API REST

L’API utilise :

- JSON ;
- version dans l’URL ou via convention explicite ;
- statuts HTTP ;
- erreurs structurées ;
- pagination cursor ou offset selon la ressource ;
- identifiants opaques.

Préfixe proposé :

```text
/api/v1
```

## 27. WebSocket

Namespace proposé :

```text
/shared-workouts
```

Les événements doivent être séparés entre :

- commandes client vers serveur ;
- événements serveur vers client ;
- acknowledgements ;
- snapshots.

Les noms exacts sont définis dans `docs/10-realtime-workouts.md`.

## 28. Cache serveur

La première version peut fonctionner sans cache distribué.

Un cache en mémoire peut être utilisé uniquement pour des données non critiques et faciles à reconstruire.

Ne pas conserver uniquement en mémoire :

- état autoritaire d’une salle ;
- commandes ;
- authentification ;
- performances ;
- invitations.

## 29. Calculs de progression

Les calculs doivent être centralisés.

Exemples :

```text
packages/shared
```

n’est pas nécessairement le bon emplacement si le calcul est strictement backend.

Les calculs métier sensibles doivent être côté serveur.

Le frontend peut reproduire certains calculs uniquement pour un aperçu.

## 30. Intégration IA

### 30.1 Service dédié

Le module IA encapsule le fournisseur.

Interface possible :

```ts
interface AiProvider {
  generateStructuredResponse<T>(
    request: StructuredAiRequest<T>,
  ): Promise<StructuredAiResponse<T>>;
}
```

### 30.2 Indépendance du fournisseur

Le code métier ne doit pas dépendre directement d’un SDK particulier.

### 30.3 Validation

La réponse est :

1. parsée ;
2. validée ;
3. contrôlée par les règles métier ;
4. enregistrée comme proposition ;
5. affichée à l’utilisateur.

### 30.4 Timeout et retry

Les appels IA utilisent :

- timeout ;
- retries limités ;
- limitation de débit ;
- suivi de coût ;
- annulation logique.

## 31. Notifications push

Le backend conserve les abonnements Web Push.

Un service de notifications :

- sélectionne les abonnements ;
- respecte les préférences ;
- respecte les horaires silencieux ;
- envoie ;
- traite les abonnements expirés ;
- journalise le résultat.

Le service worker reçoit la notification et gère le clic.

## 32. Emails

Les emails concernent notamment :

- vérification ;
- réinitialisation ;
- sécurité ;
- export prêt ;
- suppression.

Le fournisseur doit être abstrait.

Une instance locale de test peut utiliser un outil de capture d’emails.

## 33. Fichiers et exports

Les exports peuvent être :

- générés en mémoire pour de petits volumes ;
- stockés temporairement dans un stockage objet pour des volumes plus importants.

Le backend ne doit pas exposer directement un chemin local.

Les fichiers temporaires possèdent une expiration.

## 34. Configuration

Les variables d’environnement sont validées au démarrage.

Catégories :

- application ;
- base de données ;
- authentification ;
- CORS ;
- cookies ;
- email ;
- push ;
- IA ;
- logs ;
- stockage ;
- observabilité.

Le serveur doit refuser de démarrer si une variable critique est absente.

## 35. Journalisation

Utiliser des logs structurés.

Champs utiles :

- timestamp ;
- niveau ;
- requestId ;
- userId lorsque pertinent ;
- module ;
- action ;
- durée ;
- code d’erreur.

Ne jamais journaliser :

- mot de passe ;
- access token ;
- refresh token ;
- clé push ;
- contenu alimentaire détaillé sans nécessité ;
- prompt IA complet contenant des données personnelles.

## 36. Corrélation des requêtes

Chaque requête HTTP reçoit un `requestId`.

Chaque commande WebSocket reçoit un `commandId`.

Ces identifiants permettent de relier :

- logs ;
- erreurs ;
- audit ;
- réponses client.

## 37. Observabilité

Minimum recommandé :

- logs structurés ;
- endpoint de santé ;
- métriques de base ;
- suivi des erreurs ;
- suivi des temps de réponse ;
- suivi des connexions Socket.IO ;
- suivi des jobs ;
- suivi des appels IA.

## 38. Health checks

Endpoints possibles :

```text
GET /health/live
GET /health/ready
```

### `live`

Vérifie que le processus fonctionne.

### `ready`

Vérifie les dépendances nécessaires :

- base de données ;
- migrations compatibles ;
- services critiques.

L’indisponibilité de l’IA ne doit pas nécessairement rendre l’API entière non prête.

## 39. Tests

### Unitaires

- règles métier ;
- calculs ;
- rotations ;
- validation ;
- transformations.

### Intégration

- repositories ;
- transactions ;
- authentification ;
- API ;
- WebSocket ;
- persistance.

### End-to-end

- inscription ;
- connexion ;
- création de programme ;
- séance ;
- synchronisation ;
- séance partagée ;
- nutrition ;
- IA structurée.

## 40. Environnements

Environnements prévus :

- local ;
- test ;
- staging facultatif ;
- production.

La configuration ne doit pas dépendre de conditions dispersées dans le code.

## 41. Déploiement initial

Architecture initiale :

```text
Internet
   ↓
Caddy ou Nginx
   ├── PWA React
   └── API NestJS + Socket.IO
            ↓
        PostgreSQL
```

Le tout peut être déployé sur un seul VPS pour un usage personnel ou restreint.

## 42. Scalabilité future

Lorsque l’usage augmente, les évolutions possibles sont :

- séparer frontend et API ;
- déplacer PostgreSQL vers un service managé ;
- ajouter Redis ;
- ajouter plusieurs instances API ;
- utiliser un adapter Socket.IO Redis ;
- ajouter un worker ;
- ajouter un stockage objet ;
- ajouter un CDN.

Ces évolutions ne doivent pas modifier les contrats métier.

## 43. Décisions techniques à confirmer

Avant la phase concernée, confirmer :

- identifiant UUID, CUID ou ULID ;
- stratégie exacte de cookies ;
- méthode de protection CSRF ;
- librairie IndexedDB ;
- stratégie de queue ;
- fournisseur d’email ;
- fournisseur IA ;
- formule de 1RM initiale ;
- stockage des exports ;
- outil de monitoring ;
- Caddy ou Nginx ;
- stratégie de migration en production.
