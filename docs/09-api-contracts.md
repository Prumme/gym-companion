# Contrats API

## 1. Objectif de ce document

Ce document définit les conventions et principaux contrats de l’API HTTP.

Il sert de référence pour :

- les contrôleurs NestJS ;
- les clients frontend ;
- les schémas de validation ;
- les tests d’intégration ;
- la documentation OpenAPI ;
- les erreurs ;
- le versionnement.

Les événements WebSocket détaillés sont définis dans `docs/10-realtime-workouts.md`.

## 2. Conventions générales

### 2.1 Préfixe

```text
/api/v1
```

### 2.2 Format

Les échanges utilisent JSON, sauf :

- téléchargement d’export ;
- upload futur ;
- endpoints techniques.

### 2.3 Nommage

Les propriétés JSON utilisent le `camelCase`.

Exemple :

```json
{
  "displayName": "Aurélien",
  "weightUnit": "KG",
  "createdAt": "2026-08-03T09:30:00.000Z"
}
```

### 2.4 Dates

Les timestamps utilisent ISO 8601 en UTC.

Les dates locales sans heure utilisent :

```text
YYYY-MM-DD
```

### 2.5 Identifiants

Les identifiants sont opaques.

Le client ne doit pas déduire de signification depuis leur format.

### 2.6 Statut d’implémentation

À la clôture de la phase 2 :

- les contrats d’authentification et de profil de la phase 0 sont disponibles ;
- le catalogue d’exercices et les préférences de la phase 1 sont disponibles ;
- les programmes, modèles, exercices de modèles, séries cibles, activation et planification hebdomadaire de la phase 2 sont disponibles ;
- les séances actives, performances, records, partage temps réel, nutrition, notifications et IA restent des contrats cibles futurs.

Un endpoint décrit dans une section future ne doit pas être considéré comme disponible tant que la roadmap, le README et l’implémentation ne le confirment pas.

## 3. Authentification des requêtes

Les routes privées nécessitent un access token valide.

En-tête recommandé :

```text
Authorization: Bearer <access-token>
```

Le refresh token peut être transmis par cookie sécurisé.

Le frontend ne doit pas envoyer un `userId` pour identifier le propriétaire lorsqu’il peut être déduit de la session.

## 4. Format des réponses

### 4.1 Ressource simple

```json
{
  "data": {
    "id": "resource-id"
  }
}
```

### 4.2 Liste

```json
{
  "data": [
    {
      "id": "resource-id"
    }
  ],
  "pagination": {
    "nextCursor": "cursor-or-null",
    "hasMore": false
  }
}
```

### 4.3 Action sans contenu

Statut :

```text
204 No Content
```

### 4.4 Métadonnées facultatives

```json
{
  "data": {},
  "meta": {
    "requestId": "request-id"
  }
}
```

Le `requestId` peut également être transmis dans un en-tête.

## 5. Format des erreurs

```json
{
  "error": {
    "code": "WORKOUT_ALREADY_COMPLETED",
    "message": "Cette séance est déjà terminée.",
    "details": {
      "workoutSessionId": "session-id"
    },
    "fieldErrors": {
      "actualReps": ["Le nombre de répétitions doit être positif."]
    },
    "requestId": "request-id"
  }
}
```

### Propriétés

- `code` : code stable exploitable par le frontend ;
- `message` : message utilisateur ou générique ;
- `details` : informations non sensibles ;
- `fieldErrors` : erreurs de formulaire ;
- `requestId` : identifiant de suivi.

Le frontend ne doit pas dépendre uniquement de `message`.

## 6. Statuts HTTP

Conventions principales :

- `200 OK` : lecture ou mise à jour réussie ;
- `201 Created` : ressource créée ;
- `204 No Content` : suppression ou action sans réponse ;
- `400 Bad Request` : données invalides ;
- `401 Unauthorized` : session absente ou invalide ;
- `403 Forbidden` : accès interdit ;
- `404 Not Found` : ressource inexistante ou non accessible ;
- `409 Conflict` : conflit de version ou état incompatible ;
- `422 Unprocessable Entity` : règles métier non respectées ;
- `429 Too Many Requests` : limite atteinte ;
- `500 Internal Server Error` : erreur interne ;
- `503 Service Unavailable` : dépendance temporairement indisponible.

## 7. Pagination

### 7.1 Pagination cursor

Recommandée pour :

- historique ;
- notifications ;
- aliments ;
- exercices ;
- séances.

Paramètres :

```text
cursor
limit
```

Exemple :

```text
GET /api/v1/workouts?limit=20&cursor=abc
```

### 7.2 Limite

Une limite maximale doit être imposée côté serveur.

### 7.3 Tri

Paramètres possibles :

```text
sort
order
```

Les valeurs autorisées sont définies par endpoint.

## 8. Filtres

Les filtres utilisent les query parameters.

Exemple :

```text
GET /api/v1/exercises?search=bench&muscleGroup=chest&equipment=barbell
```

Les filtres non reconnus doivent être refusés ou ignorés selon une convention unique.

La recommandation est de refuser les valeurs invalides.

## 9. Idempotence HTTP

Les opérations critiques peuvent accepter :

```text
Idempotency-Key: <uuid>
```

Cas concernés :

- création de séance ;
- création de salle ;
- acceptation de proposition IA ;
- commande hors ligne ;
- export.

Le serveur doit retourner le résultat précédent lorsqu’une clé déjà appliquée est réutilisée avec le même payload.

## 10. Contrôle de concurrence

Les ressources modifiables peuvent exposer :

```json
{
  "version": 4
}
```

Le client transmet :

```json
{
  "expectedVersion": 4
}
```

Une version obsolète produit :

```text
409 Conflict
```

Cette règle est particulièrement importante pour :

- séance active ;
- salle partagée ;
- programme modifié depuis plusieurs appareils ;
- synchronisation hors ligne.

## 11. Endpoints d’authentification

### 11.1 Inscription

```text
POST /api/v1/auth/register
```

Requête :

```json
{
  "email": "user@example.com",
  "password": "mot-de-passe",
  "acceptedTermsVersion": "2026-08"
}
```

Réponse :

```json
{
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "status": "ACTIVE",
      "emailVerified": false
    },
    "accessToken": "access-token",
    "expiresInSeconds": 900
  }
}
```

Le refresh token peut être défini dans un cookie.

### 11.2 Connexion

```text
POST /api/v1/auth/login
```

Requête :

```json
{
  "email": "user@example.com",
  "password": "mot-de-passe"
}
```

### 11.3 Renouvellement

```text
POST /api/v1/auth/refresh
```

Le refresh token est lu depuis le cookie ou la stratégie retenue.

### 11.4 Déconnexion

```text
POST /api/v1/auth/logout
```

### 11.5 Déconnexion de toutes les sessions

```text
POST /api/v1/auth/logout-all
```

### 11.6 Mot de passe oublié

```text
POST /api/v1/auth/forgot-password
```

Requête :

```json
{
  "email": "user@example.com"
}
```

La réponse est neutre.

### 11.7 Réinitialisation

```text
POST /api/v1/auth/reset-password
```

Requête :

```json
{
  "token": "reset-token",
  "password": "nouveau-mot-de-passe"
}
```

### 11.8 Vérification d’email

```text
POST /api/v1/auth/verify-email
```

### 11.9 Renvoyer la vérification

```text
POST /api/v1/auth/resend-verification
```

## 12. Utilisateur courant

### 12.1 Lire

```text
GET /api/v1/me
```

Réponse :

```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "status": "ACTIVE",
    "role": "USER",
    "profile": {
      "displayName": "Aurélien",
      "timezone": "Europe/Paris",
      "weightUnit": "KG",
      "distanceUnit": "KM",
      "primaryGoal": "HYPERTROPHY",
      "experienceLevel": "INTERMEDIATE",
      "effortTrackingMode": "RIR"
    }
  }
}
```

### 12.2 Modifier le profil

```text
PATCH /api/v1/me/profile
```

Requête :

```json
{
  "displayName": "Aurélien",
  "timezone": "Europe/Paris",
  "weightUnit": "KG",
  "distanceUnit": "KM",
  "primaryGoal": "HYPERTROPHY",
  "experienceLevel": "INTERMEDIATE",
  "effortTrackingMode": "RIR",
  "heightCm": 177,
  "currentWeightKg": 78
}
```

### 12.3 Sessions

```text
GET /api/v1/me/sessions
DELETE /api/v1/me/sessions/:sessionId
```

### 12.4 Restrictions

```text
GET    /api/v1/me/restrictions
POST   /api/v1/me/restrictions
PATCH  /api/v1/me/restrictions/:restrictionId
DELETE /api/v1/me/restrictions/:restrictionId
```

## 13. Exercices

Toutes les routes de cette section nécessitent un access token valide, sauf décision explicite différente pour les données de référence.

### 13.1 Lister

```text
GET /api/v1/exercises
```

Paramètres :

```text
search
muscleGroupId
equipmentTypeId
measurementType
source
favoriteOnly
includeArchived
cursor
limit
```

Règles principales :

- `favoriteOnly` et `includeArchived` utilisent un parsing booléen strict ;
- les exercices archivés sont exclus par défaut ;
- la recherche est normalisée côté serveur ;
- la pagination utilise un cursor opaque et un ordre stable.

### 13.2 Détail

```text
GET /api/v1/exercises/:exerciseId
```

Réponse conceptuelle :

```json
{
  "data": {
    "id": "exercise-id",
    "source": "SYSTEM",
    "name": "Développé couché",
    "primaryMuscleGroup": {
      "id": "chest-id",
      "code": "chest",
      "name": "Pectoraux"
    },
    "secondaryMuscleGroups": [],
    "measurementType": "WEIGHT_REPS",
    "defaultRestSeconds": 120,
    "instructions": "Instructions...",
    "defaultEquipmentType": {
      "id": "barbell-id",
      "code": "barbell",
      "name": "Barre"
    },
    "compatibleEquipmentTypes": [],
    "archivedAt": null,
    "userPreference": {
      "isFavorite": true,
      "isExcludedFromSuggestions": false,
      "preferredEquipmentType": {
        "id": "barbell-id",
        "code": "barbell",
        "name": "Barre"
      },
      "restSecondsOverride": 150
    },
    "permissions": {
      "canEdit": false,
      "canArchive": false,
      "canRestore": false
    }
  }
}
```

Un exercice personnel appartenant à un autre utilisateur doit rester indiscernable d’un exercice inexistant.

### 13.3 Créer

```text
POST /api/v1/exercises
```

Uniquement pour créer un exercice personnel.

Requête conceptuelle :

```json
{
  "name": "Nom",
  "primaryMuscleGroupId": "muscle-id",
  "secondaryMuscleGroupIds": [],
  "measurementType": "WEIGHT_REPS",
  "defaultEquipmentTypeId": "equipment-type-id",
  "compatibleEquipmentTypes": [
    {
      "equipmentTypeId": "equipment-type-id",
      "isPreferred": true,
      "notes": null
    }
  ],
  "defaultRestSeconds": 120,
  "instructions": null
}
```

Le client ne transmet pas `source`, `ownerUserId`, `normalizedName`, `archivedAt` ou les permissions.

### 13.4 Modifier

```text
PATCH /api/v1/exercises/:exerciseId
```

Uniquement pour un exercice personnel actif appartenant à l’utilisateur.

### 13.5 Archiver

```text
DELETE /api/v1/exercises/:exerciseId
```

La suppression réalise un archivage logique.

### 13.6 Restaurer

```text
POST /api/v1/exercises/:exerciseId/restore
```

### 13.7 Lire les préférences

```text
GET /api/v1/exercises/:exerciseId/preference
```

L’absence de ligne persistée retourne les valeurs effectives par défaut.

### 13.8 Mettre à jour les préférences

```text
PUT /api/v1/exercises/:exerciseId/preference
```

Requête :

```json
{
  "isFavorite": true,
  "isExcludedFromSuggestions": false,
  "preferredEquipmentTypeId": "equipment-type-id",
  "restSecondsOverride": 150
}
```

Le `PUT` remplace l’état complet des préférences. Un simple changement de favori doit donc conserver explicitement les autres valeurs courantes.

### 13.9 Réinitialiser les préférences

```text
DELETE /api/v1/exercises/:exerciseId/preference
```

L’action est idempotente et restaure les valeurs effectives suivantes :

```json
{
  "isFavorite": false,
  "isExcludedFromSuggestions": false,
  "preferredEquipmentType": null,
  "restSecondsOverride": null
}
```

## 14. Groupes musculaires et types d’équipement

```text
GET /api/v1/reference/muscle-groups
GET /api/v1/reference/equipment-types
```

Ces données sont fortement cacheables.

## 15. Équipements personnels

```text
GET    /api/v1/equipment
POST   /api/v1/equipment
GET    /api/v1/equipment/:equipmentId
PATCH  /api/v1/equipment/:equipmentId
DELETE /api/v1/equipment/:equipmentId
POST   /api/v1/equipment/:equipmentId/restore
```

Création :

```json
{
  "name": "Presse à cuisses de ma salle",
  "equipmentTypeId": "machine-id",
  "minWeightKg": 10,
  "maxWeightKg": 200,
  "weightIncrementKg": 5,
  "baseWeightKg": 0,
  "availableWeightsKg": null
}
```

## 16. Références de force

```text
GET  /api/v1/exercises/:exerciseId/strength-references
POST /api/v1/exercises/:exerciseId/strength-references
```

Requête :

```json
{
  "equipmentId": "equipment-id",
  "referenceType": "TRAINING_MAX",
  "valueKg": 80,
  "evaluatedAt": "2026-08-03T09:30:00.000Z"
}
```

Endpoint facultatif de référence active :

```text
GET /api/v1/exercises/:exerciseId/strength-reference/current
```

## 17. Programmes

Toutes les routes de cette section utilisent `JwtAuthGuard`.

Le propriétaire est toujours déduit de la session. Le client ne transmet jamais `ownerUserId`.

### 17.1 Lister

```text
GET /api/v1/programs
```

Paramètres :

```text
includeArchived
cursor
limit
```

Règles :

- les programmes archivés sont exclus par défaut ;
- `includeArchived` utilise un parsing booléen strict ;
- la pagination utilise un cursor opaque et un ordre stable ;
- seuls les programmes de l’utilisateur connecté sont retournés.

Réponse conceptuelle :

```json
{
  "data": [
    {
      "id": "program-id",
      "name": "Programme force",
      "description": null,
      "goal": "STRENGTH",
      "workoutTemplateCount": 3,
      "archivedAt": null,
      "createdAt": "2026-08-03T09:30:00.000Z",
      "updatedAt": "2026-08-03T10:00:00.000Z",
      "permissions": {
        "canEdit": true,
        "canArchive": true,
        "canRestore": false,
        "canActivate": true,
        "canDeactivate": false,
        "canEditSchedule": true
      }
    }
  ],
  "pagination": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

### 17.2 Créer

```text
POST /api/v1/programs
```

Requête :

```json
{
  "name": "Programme force",
  "description": null,
  "goal": "STRENGTH"
}
```

### 17.3 Lire le programme courant

```text
GET /api/v1/programs/active
```

Cette route doit être déclarée avant la route dynamique `/:programId`.

S’il n’existe aucun programme courant :

```json
{
  "data": null
}
```

Lorsqu’un programme est courant :

```json
{
  "data": {
    "activationId": "activation-id",
    "startedOn": "2026-08-03",
    "program": {
      "id": "program-id",
      "name": "Programme force",
      "description": null,
      "goal": "STRENGTH",
      "workoutTemplateCount": 3,
      "archivedAt": null,
      "createdAt": "2026-08-03T09:30:00.000Z",
      "updatedAt": "2026-08-03T10:00:00.000Z",
      "permissions": {
        "canEdit": true,
        "canArchive": false,
        "canRestore": false,
        "canActivate": false,
        "canDeactivate": true,
        "canEditSchedule": true
      }
    },
    "schedule": {
      "entries": []
    }
  }
}
```

### 17.4 Détail

```text
GET /api/v1/programs/:programId
```

Le détail contient les modèles ordonnés, leurs exercices ordonnés et les séries cibles ordonnées.

Structure conceptuelle :

```text
program
└── workoutTemplates
    └── exercises
        └── sets
```

Les réponses n’exposent pas `ownerUserId` ni d’objets Prisma bruts.

### 17.5 Modifier

```text
PATCH /api/v1/programs/:programId
```

Requête :

```json
{
  "name": "Programme force 2",
  "description": "Description",
  "goal": "STRENGTH"
}
```

Un programme archivé n’est pas modifiable.

### 17.6 Archiver

```text
DELETE /api/v1/programs/:programId
```

L’action renseigne `archivedAt`.

Un programme courant doit d’abord être désactivé. Dans le cas contraire, l’API retourne une erreur métier telle que :

```text
PROGRAM_MUST_BE_INACTIVE_BEFORE_ARCHIVE
```

### 17.7 Restaurer

```text
POST /api/v1/programs/:programId/restore
```

### 17.8 Activer

```text
POST /api/v1/programs/:programId/activate
```

Requête :

```json
{
  "startedOn": "2026-08-03",
  "replaceCurrentProgram": false
}
```

Règles :

- `startedOn` est une date locale `YYYY-MM-DD` ;
- activer le programme déjà courant est idempotent ;
- si un autre programme est courant et `replaceCurrentProgram=false`, l’API retourne `409 Conflict` ;
- `replaceCurrentProgram=true` termine l’ancienne activation et crée la nouvelle dans une même transaction ;
- un programme archivé ou étranger n’est pas activable ;
- une contrainte PostgreSQL empêche deux activations courantes pour le même utilisateur.

### 17.9 Désactiver

```text
POST /api/v1/programs/:programId/deactivate
```

Règles :

- le programme doit appartenir à l’utilisateur ;
- l’activation courante reçoit une date de fin ;
- la planification du programme est conservée ;
- une nouvelle désactivation reste idempotente ou retourne l’état courant sans effet destructeur.

Après désactivation, le programme courant est représenté par :

```json
{
  "data": null
}
```

### 17.10 Lire la planification

```text
GET /api/v1/programs/:programId/schedule
```

Réponse :

```json
{
  "data": {
    "entries": [
      {
        "id": "schedule-entry-id",
        "weekday": "MONDAY",
        "position": 0,
        "workoutTemplate": {
          "id": "template-id",
          "name": "Haut du corps",
          "estimatedDurationMinutes": 60,
          "exerciseCount": 6
        }
      }
    ]
  }
}
```

### 17.11 Remplacer la planification

```text
PUT /api/v1/programs/:programId/schedule
```

Le body remplace toute la semaine type dans une transaction.

```json
{
  "entries": [
    {
      "workoutTemplateId": "template-a",
      "weekday": "MONDAY",
      "position": 0
    },
    {
      "workoutTemplateId": "template-b",
      "weekday": "THURSDAY",
      "position": 0
    }
  ]
}
```

Règles :

- une planification vide est valide ;
- plusieurs séances sont possibles le même jour ;
- un même modèle peut apparaître plusieurs fois ;
- les positions sont complètes et compactes dans chaque journée ;
- tous les modèles doivent appartenir au programme ;
- le programme doit être actif au sens « non archivé », mais il n’a pas besoin d’être le programme courant pour être planifié ;
- un programme archivé conserve sa planification en lecture seule.

La planification ne crée aucune séance active.

### 17.12 Duplication

La duplication de programme reste une exigence future de priorité `SHOULD`.

Elle n’est pas implémentée à la clôture de la phase 2.

Aucun client ne doit appeler :

```text
POST /api/v1/programs/:programId/duplicate
```

tant qu’un jalon ultérieur n’a pas explicitement ajouté et testé cet endpoint.

## 18. Constructeur de programmes

Le contenu d’un programme est géré par des routes imbriquées.

Le détail du programme constitue la lecture principale du constructeur. Aucun endpoint top-level `/workout-templates/:id` n’est nécessaire en phase 2.

### 18.1 Créer un modèle de séance

```text
POST /api/v1/programs/:programId/workout-templates
```

Requête :

```json
{
  "name": "Haut du corps",
  "description": null,
  "estimatedDurationMinutes": 60
}
```

Le modèle est ajouté à la fin.

### 18.2 Modifier un modèle

```text
PATCH /api/v1/programs/:programId/workout-templates/:workoutTemplateId
```

### 18.3 Supprimer un modèle

```text
DELETE /api/v1/programs/:programId/workout-templates/:workoutTemplateId
```

En phase 2, cette action supprime le modèle et son contenu dépendant.

Elle :

- supprime les exercices associés et leurs séries cibles ;
- supprime les entrées de planification référençant ce modèle ;
- compacte les positions des modèles et des journées concernées ;
- ne supprime aucun exercice du catalogue.

Le champ `WorkoutTemplate.archivedAt` n’est pas exposé par un workflow d’archivage individuel.

### 18.4 Réordonner les modèles

```text
PUT /api/v1/programs/:programId/workout-templates/order
```

Requête :

```json
{
  "workoutTemplateIds": [
    "template-3",
    "template-1",
    "template-2"
  ]
}
```

La liste doit être complète, sans doublon et ne contenir que les modèles du programme.

### 18.5 Ajouter un exercice au modèle

```text
POST /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises
```

Requête :

```json
{
  "exerciseId": "exercise-id",
  "equipmentTypeId": "equipment-type-id",
  "restSecondsOverride": 120,
  "notes": null
}
```

Règles :

- l’exercice doit être accessible ;
- un exercice archivé ne peut pas être ajouté ;
- un exercice ne peut apparaître qu’une fois dans le même modèle ;
- l’équipement doit être actif et compatible ;
- la nouvelle association est ajoutée à la fin.

### 18.6 Modifier la configuration d’un exercice

```text
PATCH /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId
```

Champs modifiables :

```json
{
  "equipmentTypeId": "equipment-type-id",
  "restSecondsOverride": 150,
  "notes": "Contrôler la descente."
}
```

L’exercice associé n’est pas remplacé par cette route.

### 18.7 Retirer un exercice du modèle

```text
DELETE /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId
```

L’action supprime les séries cibles dépendantes et compacte les positions.

L’exercice reste disponible dans le catalogue.

### 18.8 Réordonner les exercices

```text
PUT /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises/order
```

Requête :

```json
{
  "workoutTemplateExerciseIds": [
    "template-exercise-3",
    "template-exercise-1",
    "template-exercise-2"
  ]
}
```

### 18.9 Créer une série cible

```text
POST /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets
```

Requête conceptuelle :

```json
{
  "setType": "WORKING",
  "targetRepMin": 8,
  "targetRepMax": 10,
  "targetDurationSeconds": null,
  "targetDistanceMeters": null,
  "targetWeightKg": 60,
  "targetIntensityPercent": null,
  "targetRir": 2,
  "targetRpe": null,
  "restSeconds": 120
}
```

La validation dépend du `measurementType` de l’exercice.

### 18.10 Modifier une série cible

```text
PATCH /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets/:setId
```

### 18.11 Supprimer une série cible

```text
DELETE /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets/:setId
```

Les positions restantes sont compactées.

### 18.12 Réordonner les séries

```text
PUT /api/v1/programs/:programId/workout-templates/:workoutTemplateId/exercises/:templateExerciseId/sets/order
```

Requête :

```json
{
  "setIds": [
    "set-2",
    "set-1",
    "set-3"
  ]
}
```

### 18.13 Règles communes des routes imbriquées

Pour chaque route, l’API vérifie toute la chaîne :

```text
programme
→ modèle
→ exercice du modèle
→ série
```

Un identifiant valide appartenant à un autre parent est traité comme inaccessible.

Toutes les mutations sont interdites lorsque le programme est archivé.

Les réordonnancements, suppressions avec compactage et mises à jour de plusieurs lignes sont transactionnels.

### 18.14 Duplication et archivage individuel

La duplication d’un modèle et son archivage individuel ne sont pas implémentés en phase 2.

Aucun endpoint top-level de type :

```text
POST /api/v1/workout-templates/:templateId/duplicate
DELETE /api/v1/workout-templates/:templateId
```

ne doit être considéré comme disponible.

## 19. Séances individuelles

> Statut : jalon 3.1 — création et lecture de séance active disponibles.  
> Pause, reprise, fin, annulation, saisie de performances et historique restent hors périmètre.

### 19.1 Séance active

```text
GET /api/v1/workouts/active
```

Retourne `{ "data": null }` si aucune séance `ACTIVE` ou `PAUSED`.

### 19.2 Créer depuis un modèle

```text
POST /api/v1/workouts
```

Requête :

```json
{
  "sourceWorkoutTemplateId": "template-id",
  "localDate": "2026-08-04",
  "timezone": "Europe/Paris"
}
```

Réponse : `201 Created` avec le détail complet `WorkoutSessionDetail` (snapshot).

Le client n’envoie jamais le contenu du modèle. Le serveur construit le snapshot en transaction.

Codes d’erreur utiles :

- `WORKOUT_ACTIVE_ALREADY_EXISTS` (`409`) — détails éventuels `{ activeWorkoutSessionId }` ;
- `WORKOUT_TEMPLATE_NOT_FOUND` ;
- `WORKOUT_TEMPLATE_EMPTY` ;
- `WORKOUT_TEMPLATE_EXERCISE_WITHOUT_SETS` ;
- `WORKOUT_TEMPLATE_NOT_STARTABLE` ;
- `WORKOUT_SNAPSHOT_CREATION_FAILED`.

### 19.3 Créer une séance libre

Hors périmètre du jalon 3.1.

### 19.4 Détail

```text
GET /api/v1/workouts/:workoutSessionId
```

Propriétaire uniquement. Ressource étrangère → `WORKOUT_NOT_FOUND`.

### 19.5 Lister

Hors périmètre du jalon 3.1.

### 19.6 Démarrer

Non utilisé pour le flux modèle → `ACTIVE` immédiat (3.1).

### 19.7 Mettre en pause

Hors périmètre du jalon 3.1.

### 19.8 Reprendre

Hors périmètre du jalon 3.1.

### 19.9 Terminer

Hors périmètre du jalon 3.1.

### 19.10 Annuler

```text
POST /api/v1/workouts/:workoutSessionId/cancel
```

Requête :

```json
{
  "keepRecordedData": true,
  "reason": null,
  "expectedVersion": 12
}
```

## 20. Exercices d’une séance active

### 20.1 Ajouter

```text
POST /api/v1/workouts/:workoutSessionId/exercises
```

Requête :

```json
{
  "exerciseId": "exercise-id",
  "equipmentId": "equipment-id",
  "position": 3,
  "expectedVersion": 4
}
```

### 20.2 Modifier

```text
PATCH /api/v1/workouts/:workoutSessionId/exercises/:sessionExerciseId
```

### 20.3 Réordonner

```text
PUT /api/v1/workouts/:workoutSessionId/exercise-order
```

Requête :

```json
{
  "exerciseIds": ["session-exercise-1", "session-exercise-2"],
  "expectedVersion": 5
}
```

### 20.4 Supprimer ou annuler

```text
DELETE /api/v1/workouts/:workoutSessionId/exercises/:sessionExerciseId
```

## 21. Séries

### 21.1 Créer ou enregistrer

```text
POST /api/v1/workouts/:workoutSessionId/exercises/:sessionExerciseId/sets
```

Requête :

```json
{
  "clientCommandId": "command-id",
  "setNumber": 1,
  "setType": "WORKING",
  "status": "COMPLETED",
  "targetWeightKg": 60,
  "targetRepMin": 8,
  "targetRepMax": 10,
  "actualWeightKg": 60,
  "actualReps": 10,
  "actualRir": 2,
  "reachedFailure": false,
  "completedAt": "2026-08-03T09:45:00.000Z",
  "expectedVersion": 6
}
```

### 21.2 Modifier

```text
PATCH /api/v1/workout-sets/:workoutSetId
```

### 21.3 Supprimer

```text
DELETE /api/v1/workout-sets/:workoutSetId
```

La suppression peut devenir un statut `CANCELLED` si la série a déjà été synchronisée.

## 22. Synchronisation hors ligne

Endpoint groupé proposé :

```text
POST /api/v1/sync/commands
```

Requête :

```json
{
  "deviceId": "device-id",
  "commands": [
    {
      "commandId": "command-id",
      "aggregateType": "WORKOUT_SESSION",
      "aggregateId": "workout-id",
      "commandType": "CREATE_WORKOUT_SET",
      "expectedVersion": 6,
      "createdAt": "2026-08-03T09:45:00.000Z",
      "payload": {}
    }
  ]
}
```

Réponse :

```json
{
  "data": {
    "results": [
      {
        "commandId": "command-id",
        "status": "APPLIED",
        "serverVersion": 7,
        "result": {
          "workoutSetId": "set-id"
        },
        "error": null
      }
    ]
  }
}
```

Statuts :

- `APPLIED` ;
- `ALREADY_APPLIED` ;
- `REJECTED` ;
- `CONFLICT`.

## 23. Progression

### 23.1 Vue globale

```text
GET /api/v1/progress/overview
```

Paramètres :

```text
from
to
```

### 23.2 Progression d’un exercice

```text
GET /api/v1/progress/exercises/:exerciseId
```

Paramètres :

```text
from
to
equipmentId
includeWarmup
```

Réponse possible :

```json
{
  "data": {
    "exercise": {
      "id": "exercise-id",
      "name": "Développé couché"
    },
    "summary": {
      "maxWeightKg": 80,
      "bestEstimatedOneRepMaxKg": 92.4,
      "totalVolumeKg": 12400,
      "sessionCount": 8
    },
    "series": [
      {
        "date": "2026-08-03",
        "maxWeightKg": 80,
        "estimatedOneRepMaxKg": 92.4,
        "volumeKg": 2400
      }
    ],
    "calculation": {
      "oneRepMaxFormula": "EPLEY_V1"
    }
  }
}
```

### 23.3 Records

```text
GET /api/v1/personal-records
GET /api/v1/exercises/:exerciseId/personal-records
```

## 24. Salles partagées en HTTP

Le temps réel passe par Socket.IO, mais la création et la lecture de base utilisent HTTP.

### 24.1 Créer

```text
POST /api/v1/shared-workouts
```

Requête :

```json
{
  "name": "Séance du lundi",
  "sourceTemplateId": "template-id",
  "maxParticipants": 3,
  "targetDurationMinutes": 75,
  "equipmentIds": ["equipment-1", "equipment-2"],
  "invitationExpiresAt": "2026-08-03T18:00:00.000Z"
}
```

### 24.2 Détail

```text
GET /api/v1/shared-workouts/:roomId
```

### 24.3 Résoudre une invitation

```text
GET /api/v1/shared-workouts/invitations/:invitationCode
```

La réponse publique doit rester limitée.

### 24.4 Rejoindre

```text
POST /api/v1/shared-workouts/:roomId/join
```

Requête :

```json
{
  "invitationCode": "ABC123"
}
```

### 24.5 Quitter

```text
POST /api/v1/shared-workouts/:roomId/leave
```

### 24.6 Révoquer l’invitation

```text
POST /api/v1/shared-workouts/:roomId/revoke-invitation
```

### 24.7 Régénérer

```text
POST /api/v1/shared-workouts/:roomId/regenerate-invitation
```

### 24.8 Snapshot

```text
GET /api/v1/shared-workouts/:roomId/snapshot
```

Utilisé notamment après reconnexion.

### 24.9 Résumé

```text
GET /api/v1/shared-workouts/:roomId/summary
```

## 25. Nutrition

### 25.1 Objectif actuel

```text
GET /api/v1/nutrition/goals/current
```

### 25.2 Historique des objectifs

```text
GET /api/v1/nutrition/goals
```

### 25.3 Créer un nouvel objectif

```text
POST /api/v1/nutrition/goals
```

Requête :

```json
{
  "effectiveFromLocalDate": "2026-08-03",
  "calorieTargetKcal": 2200,
  "proteinTargetGrams": 140,
  "carbohydrateTargetGrams": 240,
  "fatTargetGrams": 70,
  "source": "USER_DEFINED"
}
```

### 25.4 Résumé journalier

```text
GET /api/v1/nutrition/days/:localDate
```

Réponse :

```json
{
  "data": {
    "localDate": "2026-08-03",
    "goal": {
      "calorieTargetKcal": 2200,
      "proteinTargetGrams": 140
    },
    "consumed": {
      "caloriesKcal": 1750,
      "proteinGrams": 105,
      "carbohydrateGrams": 180,
      "fatGrams": 55
    },
    "exerciseEnergy": {
      "estimatedCaloriesKcal": 320,
      "confidenceLevel": "LOW"
    },
    "meals": []
  }
}
```

## 26. Aliments

```text
GET    /api/v1/foods
POST   /api/v1/foods
GET    /api/v1/foods/:foodId
PATCH  /api/v1/foods/:foodId
DELETE /api/v1/foods/:foodId
POST   /api/v1/foods/:foodId/restore
```

Création :

```json
{
  "name": "Skyr nature",
  "brand": null,
  "referenceAmount": 100,
  "referenceUnit": "GRAM",
  "caloriesKcal": 60,
  "proteinGrams": 10,
  "carbohydrateGrams": 4,
  "fatGrams": 0.2,
  "fiberGrams": 0,
  "saltGrams": 0.1
}
```

## 27. Journal alimentaire

### 27.1 Ajouter une entrée

```text
POST /api/v1/nutrition/entries
```

Requête :

```json
{
  "localDate": "2026-08-03",
  "timezone": "Europe/Paris",
  "mealType": "BREAKFAST",
  "foodId": "food-id",
  "amount": 250,
  "unit": "GRAM",
  "consumedAt": "2026-08-03T06:30:00.000Z"
}
```

### 27.2 Modifier

```text
PATCH /api/v1/nutrition/entries/:entryId
```

### 27.3 Supprimer

```text
DELETE /api/v1/nutrition/entries/:entryId
```

### 27.4 Copier un repas

```text
POST /api/v1/nutrition/entries/copy-meal
```

Requête :

```json
{
  "sourceLocalDate": "2026-08-02",
  "sourceMealType": "BREAKFAST",
  "targetLocalDate": "2026-08-03",
  "targetMealType": "BREAKFAST"
}
```

## 28. Recettes

```text
GET    /api/v1/recipes
POST   /api/v1/recipes
GET    /api/v1/recipes/:recipeId
PUT    /api/v1/recipes/:recipeId
DELETE /api/v1/recipes/:recipeId
```

## 29. Repas sauvegardés

```text
GET    /api/v1/saved-meals
POST   /api/v1/saved-meals
GET    /api/v1/saved-meals/:savedMealId
PUT    /api/v1/saved-meals/:savedMealId
DELETE /api/v1/saved-meals/:savedMealId
POST   /api/v1/saved-meals/:savedMealId/add-to-day
```

## 30. Mesures corporelles

```text
GET    /api/v1/body-measurements
POST   /api/v1/body-measurements
PATCH  /api/v1/body-measurements/:measurementId
DELETE /api/v1/body-measurements/:measurementId
```

Filtres :

```text
type
from
to
```

Création :

```json
{
  "measurementType": "WEIGHT",
  "value": 78,
  "unit": "KG",
  "measuredAt": "2026-08-03T06:00:00.000Z",
  "source": "USER",
  "notes": null
}
```

## 31. Notifications

### 31.1 Préférences

```text
GET /api/v1/notification-preferences
PUT /api/v1/notification-preferences/:category
```

Requête :

```json
{
  "isEnabled": true,
  "quietHoursStart": "22:00",
  "quietHoursEnd": "07:00"
}
```

### 31.2 Abonnement push

```text
POST /api/v1/push-subscriptions
```

Requête :

```json
{
  "endpoint": "https://push-service.example/...",
  "keys": {
    "p256dh": "key",
    "auth": "key"
  },
  "deviceLabel": "Téléphone"
}
```

### 31.3 Supprimer un abonnement

```text
DELETE /api/v1/push-subscriptions/:subscriptionId
```

### 31.4 Tester

```text
POST /api/v1/push-subscriptions/:subscriptionId/test
```

### 31.5 Notifications internes

```text
GET   /api/v1/notifications
PATCH /api/v1/notifications/:notificationId/read
POST  /api/v1/notifications/read-all
```

## 32. Coach IA

### 32.1 Créer une demande de programme

```text
POST /api/v1/ai/program-proposals
```

Requête :

```json
{
  "goal": "HYPERTROPHY",
  "experienceLevel": "INTERMEDIATE",
  "sessionsPerWeek": 3,
  "sessionDurationMinutes": 60,
  "availableEquipmentIds": [],
  "excludedExerciseIds": [],
  "preferences": {
    "includeCardio": false,
    "preferredSplit": null
  },
  "consentedDataTypes": ["PROFILE", "RECENT_WORKOUTS", "EXERCISE_REFERENCES"]
}
```

Réponse initiale :

```json
{
  "data": {
    "requestId": "ai-request-id",
    "proposalId": "proposal-id",
    "status": "GENERATING"
  }
}
```

### 32.2 Lire une proposition

```text
GET /api/v1/ai/proposals/:proposalId
```

### 32.3 Accepter

```text
POST /api/v1/ai/proposals/:proposalId/accept
```

Requête :

```json
{
  "expectedProposalVersion": 1,
  "programName": "Programme IA personnalisé"
}
```

### 32.4 Refuser

```text
POST /api/v1/ai/proposals/:proposalId/reject
```

### 32.5 Analyse de progression

```text
POST /api/v1/ai/progress-analysis
```

Requête :

```json
{
  "exerciseIds": ["exercise-id"],
  "from": "2026-06-01",
  "to": "2026-08-03",
  "consentedDataTypes": ["WORKOUT_HISTORY", "EXERCISE_REFERENCES"]
}
```

### 32.6 Limites

Un dépassement de quota retourne :

```text
429 Too Many Requests
```

Code :

```text
AI_RATE_LIMIT_EXCEEDED
```

## 33. Export des données

### 33.1 Demander

```text
POST /api/v1/data-exports
```

Requête :

```json
{
  "format": "JSON",
  "include": ["PROFILE", "WORKOUTS", "NUTRITION", "BODY_MEASUREMENTS"]
}
```

### 33.2 Statut

```text
GET /api/v1/data-exports/:exportId
```

### 33.3 Télécharger

```text
GET /api/v1/data-exports/:exportId/download
```

L’URL ou le fichier doit être temporaire.

## 34. Suppression du compte

### 34.1 Demander

```text
POST /api/v1/me/deletion-request
```

Requête :

```json
{
  "password": "mot-de-passe",
  "confirmation": "DELETE"
}
```

### 34.2 Annuler pendant la période de grâce

```text
POST /api/v1/me/deletion-request/cancel
```

## 35. Administration

### 35.1 Utilisateurs

```text
GET  /api/v1/admin/users
GET  /api/v1/admin/users/:userId
POST /api/v1/admin/users/:userId/disable
POST /api/v1/admin/users/:userId/enable
```

### 35.2 Catalogue système

```text
POST   /api/v1/admin/exercises
PATCH  /api/v1/admin/exercises/:exerciseId
DELETE /api/v1/admin/exercises/:exerciseId
```

### 35.3 Audit

```text
GET /api/v1/admin/audit-logs
```

Les données retournées doivent être limitées.

## 36. Codes d’erreur métier recommandés

### Authentification

```text
AUTH_INVALID_CREDENTIALS
AUTH_SESSION_EXPIRED
AUTH_REFRESH_TOKEN_REVOKED
AUTH_EMAIL_ALREADY_USED
AUTH_EMAIL_NOT_VERIFIED
AUTH_ACCOUNT_DISABLED
AUTH_RATE_LIMITED
```

### Autorisation

```text
ACCESS_FORBIDDEN
RESOURCE_NOT_OWNED
ADMIN_ROLE_REQUIRED
SHARED_ROOM_MEMBERSHIP_REQUIRED
SHARED_ROOM_HOST_REQUIRED
```

### Exercices

```text
EXERCISE_NOT_FOUND
EXERCISE_NOT_EDITABLE
EXERCISE_ALREADY_ARCHIVED
EXERCISE_MEASUREMENT_INCOMPATIBLE
EQUIPMENT_WEIGHT_UNAVAILABLE
```

### Programmes et constructeur

```text
PROGRAM_NOT_FOUND
PROGRAM_NOT_EDITABLE
PROGRAM_ALREADY_ARCHIVED
PROGRAM_NOT_ARCHIVED
PROGRAM_ARCHIVED
PROGRAM_ALREADY_ACTIVE
PROGRAM_ACTIVE_CONFLICT
PROGRAM_NOT_ACTIVE
PROGRAM_MUST_BE_INACTIVE_BEFORE_ARCHIVE

WORKOUT_TEMPLATE_NOT_FOUND
WORKOUT_TEMPLATE_NOT_EDITABLE
WORKOUT_TEMPLATE_INVALID_ORDER
WORKOUT_TEMPLATE_DUPLICATE_IN_ORDER
WORKOUT_TEMPLATE_ORDER_INCOMPLETE

WORKOUT_TEMPLATE_EXERCISE_NOT_FOUND
WORKOUT_TEMPLATE_EXERCISE_ALREADY_EXISTS
WORKOUT_TEMPLATE_EXERCISE_NOT_EDITABLE
WORKOUT_TEMPLATE_EXERCISE_INVALID_ORDER
WORKOUT_TEMPLATE_EXERCISE_ORDER_INCOMPLETE
WORKOUT_TEMPLATE_EXERCISE_DUPLICATE_IN_ORDER
WORKOUT_TEMPLATE_EXERCISE_INVALID_EQUIPMENT

WORKOUT_TEMPLATE_SET_NOT_FOUND
WORKOUT_TEMPLATE_SET_INVALID_TARGET
WORKOUT_TEMPLATE_SET_INVALID_REP_RANGE
WORKOUT_TEMPLATE_SET_CONFLICTING_INTENSITY_TARGETS
WORKOUT_TEMPLATE_SET_INVALID_ORDER
WORKOUT_TEMPLATE_SET_ORDER_INCOMPLETE
WORKOUT_TEMPLATE_SET_DUPLICATE_IN_ORDER

PROGRAM_SCHEDULE_INVALID
PROGRAM_SCHEDULE_TEMPLATE_NOT_FOUND
PROGRAM_SCHEDULE_TEMPLATE_MISMATCH
PROGRAM_SCHEDULE_INVALID_POSITION
PROGRAM_SCHEDULE_DUPLICATE_POSITION
```

### Séances

```text
WORKOUT_NOT_FOUND
WORKOUT_ACTIVE_ALREADY_EXISTS
WORKOUT_TEMPLATE_NOT_FOUND
WORKOUT_TEMPLATE_EMPTY
WORKOUT_TEMPLATE_EXERCISE_WITHOUT_SETS
WORKOUT_TEMPLATE_NOT_STARTABLE
WORKOUT_SNAPSHOT_CREATION_FAILED
WORKOUT_INVALID_LOCAL_DATE
WORKOUT_INVALID_TIMEZONE
WORKOUT_ALREADY_COMPLETED
WORKOUT_ALREADY_CANCELLED
WORKOUT_VERSION_CONFLICT
WORKOUT_SET_INVALID
WORKOUT_SET_DUPLICATE_COMMAND
WORKOUT_OFFLINE_CONFLICT
```

### Séances partagées

```text
SHARED_ROOM_NOT_FOUND
SHARED_ROOM_FULL
SHARED_ROOM_ALREADY_STARTED
SHARED_ROOM_ALREADY_COMPLETED
SHARED_INVITATION_EXPIRED
SHARED_INVITATION_REVOKED
SHARED_PARTICIPANT_ALREADY_JOINED
SHARED_ROTATION_CONFLICT
SHARED_STATE_VERSION_CONFLICT
```

### Nutrition

```text
FOOD_NOT_FOUND
FOOD_NOT_EDITABLE
NUTRITION_ENTRY_INVALID
NUTRITION_GOAL_OVERLAP
RECIPE_INVALID
```

### Notifications

```text
PUSH_SUBSCRIPTION_INVALID
PUSH_PERMISSION_REQUIRED
NOTIFICATION_CATEGORY_DISABLED
```

### IA

```text
AI_PROVIDER_UNAVAILABLE
AI_RESPONSE_INVALID
AI_PROPOSAL_NOT_FOUND
AI_PROPOSAL_EXPIRED
AI_PROPOSAL_ALREADY_PROCESSED
AI_RATE_LIMIT_EXCEEDED
AI_UNSAFE_REQUEST
```

## 37. Documentation OpenAPI

Chaque endpoint doit documenter :

- authentification ;
- paramètres ;
- corps ;
- réponse ;
- erreurs ;
- exemples ;
- permissions ;
- idempotence ;
- phase du projet.

Les DTO de documentation doivent rester cohérents avec les schémas de validation réellement exécutés.

## 38. Compatibilité et versionnement

Une modification cassante nécessite :

- nouvelle version d’API ;
- ou période de compatibilité ;
- ou migration coordonnée frontend/backend.

Les changements non cassants peuvent ajouter :

- champs facultatifs ;
- nouveaux codes ;
- nouvelles routes ;
- nouvelles valeurs d’enum uniquement si le client les gère correctement.

Le frontend doit prévoir un comportement de secours face à une valeur inconnue lorsque cela est raisonnable.

## 39. Données à ne jamais exposer

L’API ne doit jamais retourner :

- hash de mot de passe ;
- hash de refresh token ;
- token de réinitialisation ;
- token de vérification ;
- clé privée Web Push ;
- clé de fournisseur IA ;
- détails Prisma ;
- stack trace ;
- données d’un autre utilisateur sans autorisation ;
- prompt interne complet ;
- secrets de configuration.

## 40. Implémentation progressive

Les endpoints sont implémentés selon la roadmap.

### Disponible à la clôture de la phase 2

- authentification et profil de base ;
- références musculaires et équipements ;
- catalogue d’exercices ;
- préférences et favoris ;
- programmes ;
- modèles de séance ;
- exercices et séries cibles des modèles ;
- activation du programme courant ;
- planification hebdomadaire.

### Disponible à partir du jalon 3.1

- création d’une séance active depuis un modèle (snapshot immuable) ;
- lecture de la séance active ;
- détail d’une séance par identifiant ;
- interface minimale en lecture seule (`/workouts/active`) ;
- démarrage depuis le planning et le constructeur de programme.

### Non disponible (reste phase 3+)

- duplication de programme ou de modèle ;
- saisie des performances réelles ;
- validation / échec de série ;
- pause, reprise, fin, annulation ;
- historique de séance ;
- records et progression ;
- synchronisation hors ligne des séances ;
- partage Socket.IO ;
- nutrition ;
- notifications ;
- coach IA.

Créer toutes les routes à l’avance avec des réponses fictives est déconseillé.

Chaque endpoint implémenté doit posséder :

- validation ;
- autorisation ;
- documentation ;
- tests ;
- gestion d’erreur ;
- métriques ou logs adaptés.

