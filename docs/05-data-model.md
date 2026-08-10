# Modèle de données

## 1. Objectif de ce document

Ce document décrit le modèle logique de l’application.

Il guide :

- le schéma Prisma ;
- les relations entre entités ;
- les DTO ;
- les contrats partagés ;
- les règles de suppression ;
- les index ;
- les contraintes d’unicité.

Les noms exacts peuvent évoluer pendant l’implémentation, mais les responsabilités des entités doivent rester cohérentes.

## 2. Conventions

### 2.1 Identifiants

Toutes les entités persistées utilisent un identifiant opaque.

Format recommandé :

- UUID ;
- CUID ;
- ULID.

Le format doit être cohérent dans tout le projet.

### 2.2 Dates

Les timestamps sont stockés en UTC.

Conventions usuelles :

```ts
createdAt: Date;
updatedAt: Date;
```

Les entités archivables peuvent également utiliser :

```ts
archivedAt: Date | null;
```

### 2.3 Nombres décimaux

Les valeurs de poids, distance et nutrition nécessitant une précision doivent utiliser un type décimal compatible avec PostgreSQL et Prisma.

### 2.4 Suppression

La suppression physique est évitée pour les entités référencées par l’historique.

## 3. Enums principaux

```ts
type UserStatus = "PENDING" | "ACTIVE" | "DISABLED" | "DELETION_PENDING";

type UserRole = "USER" | "ADMIN";

type WeightUnit = "KG" | "LB";

type DistanceUnit = "KM" | "MI";

type TrainingGoal =
  | "ENDURANCE"
  | "HYPERTROPHY"
  | "STRENGTH"
  | "GENERAL_FITNESS";

type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

type EffortTrackingMode = "NONE" | "RIR" | "RPE";

type ExerciseSource = "SYSTEM" | "USER";

type ExerciseMeasurementType =
  | "WEIGHT_REPS"
  | "BODYWEIGHT_REPS"
  | "ASSISTED_BODYWEIGHT_REPS"
  | "REPS_ONLY"
  | "DURATION"
  | "DISTANCE_DURATION"
  | "WEIGHT_DURATION";

type WorkoutStatus =
  | "PLANNED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

type WorkoutSetStatus =
  | "PENDING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "SKIPPED"
  | "CANCELLED";

type WorkoutSetType =
  | "WARMUP"
  | "WORKING"
  | "BACKOFF"
  | "DROP_SET"
  | "AMRAP"
  | "FAILURE_OPTIONAL";

type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type SharedRoomStatus =
  | "LOBBY"
  | "PREPARING"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

type SharedParticipantRole = "HOST" | "PARTICIPANT";

type SharedParticipantStatus =
  | "INVITED"
  | "JOINED"
  | "READY"
  | "ACTIVE"
  | "TEMPORARILY_DISCONNECTED"
  | "PAUSED"
  | "FINISHED"
  | "LEFT"
  | "REMOVED";

type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "OTHER";

type DataSource = "SYSTEM" | "USER" | "EXTERNAL";

type AiProposalStatus =
  | "GENERATING"
  | "VALID"
  | "INVALID"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED";
```

Les groupes musculaires et types d’équipement doivent également être centralisés dans des enums ou tables de référence.

## 4. User

Représente le compte technique.

```ts
type User = {
  id: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  role: UserRole;

  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
  deletionRequestedAt: Date | null;
};
```

### Contraintes

- `email` unique après normalisation.
- `passwordHash` jamais exposé.
- Un utilisateur désactivé ne peut plus ouvrir de session.

### Relations

- un `UserProfile` ;
- plusieurs sessions ;
- plusieurs exercices personnels ;
- plusieurs programmes ;
- plusieurs séances ;
- plusieurs entrées nutritionnelles ;
- plusieurs participations à des salles partagées.

## 5. UserProfile

Contient les préférences et informations de profil.

```ts
type UserProfile = {
  id: string;
  userId: string;

  displayName: string;
  timezone: string;

  weightUnit: WeightUnit;
  distanceUnit: DistanceUnit;

  primaryGoal: TrainingGoal;
  experienceLevel: ExperienceLevel;
  effortTrackingMode: EffortTrackingMode;

  heightCm: Decimal | null;
  currentWeightKg: Decimal | null;

  weeklyTrainingTarget: number | null;
  defaultWorkoutDurationMinutes: number | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- relation unique avec `User`;
- timezone IANA valide ;
- les données physiques restent facultatives.

## 6. UserRestriction

Représente une limitation volontairement déclarée par l’utilisateur.

```ts
type UserRestriction = {
  id: string;
  userId: string;

  label: string;
  description: string | null;
  restrictionType:
    | "EXCLUDED_EXERCISE"
    | "EXCLUDED_EQUIPMENT"
    | "MOVEMENT_LIMITATION"
    | "OTHER";

  exerciseId: string | null;
  equipmentTypeId: string | null;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
};
```

Cette donnée ne constitue pas un dossier médical.

## 7. AuthSession

Représente une session renouvelable.

```ts
type AuthSession = {
  id: string;
  userId: string;

  refreshTokenHash: string;
  userAgent: string | null;
  ipHash: string | null;

  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;

  createdAt: Date;
};
```

### Contraintes

- le refresh token brut n’est jamais stocké ;
- une session révoquée ne peut plus être renouvelée.

## 8. PasswordResetToken

```ts
type PasswordResetToken = {
  id: string;
  userId: string;

  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;

  createdAt: Date;
};
```

## 9. EmailVerificationToken

```ts
type EmailVerificationToken = {
  id: string;
  userId: string;

  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;

  createdAt: Date;
};
```

## 10. MuscleGroup

Table de référence recommandée.

```ts
type MuscleGroup = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
};
```

Exemples :

- chest ;
- back ;
- shoulders ;
- biceps ;
- triceps ;
- quadriceps ;
- hamstrings ;
- glutes ;
- calves ;
- core.

## 11. EquipmentType

Catégorie d’équipement.

```ts
type EquipmentType = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
};
```

Exemples :

- barbell ;
- dumbbell ;
- cable ;
- machine ;
- bodyweight ;
- resistance-band ;
- cardio-machine ;
- other.

## 12. Equipment

Représente un équipement précis ou une configuration personnelle.

```ts
type Equipment = {
  id: string;
  ownerUserId: string | null;
  equipmentTypeId: string;

  name: string;
  description: string | null;

  minWeightKg: Decimal | null;
  maxWeightKg: Decimal | null;
  weightIncrementKg: Decimal | null;
  baseWeightKg: Decimal | null;

  availableWeightsKg: Decimal[] | null;

  isSystem: boolean;
  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Usage

Un équipement système peut représenter une catégorie générique.

Un équipement utilisateur peut représenter une machine précise d’une salle.

## 13. Exercise

```ts
type Exercise = {
  id: string;
  ownerUserId: string | null;

  source: ExerciseSource;
  name: string;
  normalizedName: string;
  slug: string | null;

  primaryMuscleGroupId: string;
  measurementType: ExerciseMeasurementType;
  defaultEquipmentTypeId: string | null;

  defaultRestSeconds: number | null;
  instructions: string | null;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- un exercice système possède `ownerUserId = null` ;
- un exercice utilisateur possède un propriétaire ;
- `normalizedName` aide à détecter les doublons ;
- un exercice archivé reste accessible dans les historiques.

## 14. ExerciseSecondaryMuscle

Table d’association.

```ts
type ExerciseSecondaryMuscle = {
  exerciseId: string;
  muscleGroupId: string;
};
```

### Contrainte

Clé unique :

```text
exerciseId + muscleGroupId
```

## 15. ExerciseEquipmentCompatibility

Décrit les équipements compatibles avec un exercice.

```ts
type ExerciseEquipmentCompatibility = {
  id: string;
  exerciseId: string;
  equipmentTypeId: string;

  isPreferred: boolean;
  notes: string | null;
};
```

## 16. UserExercisePreference

Préférences privées d’un utilisateur pour un exercice accessible.

```ts
type UserExercisePreference = {
  id: string;
  userId: string;
  exerciseId: string;

  isFavorite: boolean;
  isExcludedFromSuggestions: boolean;

  preferredEquipmentTypeId: string | null;
  restSecondsOverride: number | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

Clé unique :

```text
userId + exerciseId
```

Règles :

- les préférences sont isolées par utilisateur ;
- l’exercice doit être un exercice système ou un exercice personnel appartenant à l’utilisateur ;
- `preferredEquipmentTypeId` doit référencer un type d’équipement actif et compatible avec l’exercice ;
- `restSecondsOverride` est un entier compris entre `0` et `1800` secondes ;
- l’archivage d’un exercice personnel ne supprime pas les préférences existantes ;
- l’absence de ligne correspond aux valeurs effectives par défaut.

Valeurs effectives par défaut :

```ts
{
  isFavorite: false,
  isExcludedFromSuggestions: false,
  preferredEquipmentTypeId: null,
  restSecondsOverride: null
}
```

Cette préférence globale est distincte de la configuration d’un exercice dans un programme.

## 17. ExerciseStrengthReference

Référence de force pour une combinaison utilisateur, exercice et équipement.

> **Hors phase 4** : cette table n’est **pas** implémentée. En 4.5, l’e1RM est uniquement
> dérivé à la lecture (`EPLEY_V1`), sans `PersonalRecordType` e1RM et sans ligne Prisma.
> Le type conceptuel ci-dessous documente une matérialisation / référence coach **future**.

```ts
type ExerciseStrengthReference = {
  id: string;
  userId: string;
  exerciseId: string;
  equipmentId: string | null;

  referenceType:
    | "DECLARED_ONE_REP_MAX"
    | "ESTIMATED_ONE_REP_MAX"
    | "OBSERVED_MAX_WEIGHT"
    | "TRAINING_MAX"
    | "MACHINE_REFERENCE_MAX";

  valueKg: Decimal;
  estimatedFromSetId: string | null;

  formulaCode: string | null;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH" | null;

  evaluatedAt: Date;
  expiresAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

Une stratégie pourra déterminer la référence actuellement utilisée.

## 18. Program

Représente un programme d’entraînement appartenant à un utilisateur.

```ts
type Program = {
  id: string;
  ownerUserId: string;

  name: string;
  description: string | null;
  goal: TrainingGoal;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- un programme appartient toujours à un utilisateur ;
- le propriétaire est déduit de la session et n’est jamais choisi par le client ;
- plusieurs programmes d’un même utilisateur peuvent avoir le même nom ;
- l’archivage est logique ;
- un programme archivé reste consultable, mais ne peut plus être modifié, activé ou planifié ;
- un programme courant doit être désactivé avant archivage ;
- l’état « programme courant » n’est pas stocké dans un enum du programme : il est représenté par `ProgramActivation`.

### Relations

- plusieurs `WorkoutTemplate` ordonnés ;
- plusieurs `ProgramActivation` historiques ;
- plusieurs `ProgramScheduleEntry`.

## 19. ProgramActivation

Historise l’utilisation d’un programme comme programme courant.

```ts
type ProgramActivation = {
  id: string;
  userId: string;
  programId: string;

  startedOn: string;
  endedOn: string | null;

  createdAt: Date;
  updatedAt: Date;
};
```

`startedOn` et `endedOn` sont des dates locales au format `YYYY-MM-DD`, persistées avec un type PostgreSQL `date` ou une représentation équivalente ne contenant pas d’heure.

### Signification

- `endedOn = null` : activation courante ;
- `endedOn != null` : activation terminée et conservée dans l’historique.

### Contraintes

- l’utilisateur et le propriétaire du programme doivent être identiques ;
- un programme archivé ne peut pas être activé ;
- une seule activation courante est autorisée par utilisateur ;
- cette unicité est protégée par un index PostgreSQL partiel sur `userId` lorsque `endedOn IS NULL` ;
- remplacer le programme courant termine l’ancienne activation et crée la nouvelle dans une transaction ;
- réactiver ultérieurement un programme crée une nouvelle activation sans réécrire l’historique.

## 20. ProgramScheduleEntry

Représente une occurrence prévue d’un modèle de séance dans une semaine type.

```ts
type ProgramScheduleEntry = {
  id: string;
  programId: string;
  workoutTemplateId: string;

  weekday: Weekday;
  position: number;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- le modèle doit appartenir au programme ;
- un même modèle peut être planifié plusieurs fois dans la semaine ;
- un même modèle peut être planifié plusieurs fois le même jour ;
- les positions sont compactes et déterministes dans chaque journée ;
- la combinaison `programId + weekday + position` est unique ;
- la planification appartient au programme et reste conservée après désactivation ;
- une planification vide est valide ;
- supprimer un modèle supprime ses entrées de planification et compacte les positions restantes des journées concernées ;
- un programme archivé conserve sa planification en lecture seule.

La planification représente une intention hebdomadaire. Elle ne crée pas de `WorkoutSession`.

## 21. WorkoutTemplate

Conteneur ordonné représentant une séance modèle dans un programme.

```ts
type WorkoutTemplate = {
  id: string;
  programId: string;

  name: string;
  description: string | null;

  position: number;
  estimatedDurationMinutes: number | null;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- un modèle appartient à un seul programme ;
- la propriété utilisateur est déduite du programme ;
- `position` est unique dans le programme ;
- un nouveau modèle est ajouté à la fin ;
- les positions sont compactées après suppression ;
- un programme archivé rend ses modèles non modifiables ;
- le champ `archivedAt` existe dans le schéma, mais aucun workflow d’archivage individuel n’est exposé en phase 2 ;
- en phase 2, l’action de retrait d’un modèle effectue une suppression physique de ce conteneur et de son contenu dépendant.

Le rôle futur de `archivedAt` doit être clarifié avant d’exposer un archivage individuel des modèles.

## 22. WorkoutTemplateExercise

Association ordonnée entre un modèle de séance et un exercice du catalogue.

```ts
type WorkoutTemplateExercise = {
  id: string;
  workoutTemplateId: string;
  exerciseId: string;

  position: number;

  equipmentTypeId: string | null;
  restSecondsOverride: number | null;
  notes: string | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- la combinaison `workoutTemplateId + exerciseId` est unique ;
- `position` est unique dans le modèle ;
- l’exercice doit être accessible au propriétaire du programme ;
- un exercice archivé ne peut pas être ajouté à un nouveau modèle ;
- l’archivage ultérieur d’un exercice déjà associé ne supprime pas l’association ;
- `equipmentTypeId` doit être actif et compatible avec l’exercice ;
- `restSecondsOverride` est un entier compris entre `0` et `1800` secondes ;
- retirer cette association ne supprime jamais l’exercice du catalogue ;
- retirer cette association supprime ses `WorkoutTemplateSet` dépendants.

`equipmentTypeId` représente l’équipement prévu dans ce modèle. Il est distinct de l’équipement par défaut de l’exercice et des préférences globales de l’utilisateur.

## 23. WorkoutTemplateSet

Représente une série cible distincte et ordonnée.

```ts
type WorkoutTemplateSet = {
  id: string;
  workoutTemplateExerciseId: string;

  position: number;
  setType: WorkoutSetType;

  targetRepMin: number | null;
  targetRepMax: number | null;

  targetDurationSeconds: number | null;
  targetDistanceMeters: Decimal | null;
  targetWeightKg: Decimal | null;
  targetIntensityPercent: Decimal | null;

  targetRir: number | null;
  targetRpe: Decimal | null;

  restSeconds: number | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- `position` est unique dans un `WorkoutTemplateExercise` ;
- les positions sont compactées après suppression ;
- les champs de cible doivent être compatibles avec `Exercise.measurementType` ;
- `targetRepMin <= targetRepMax` ;
- RIR est un entier compris entre `0` et `10` ;
- RPE est compris entre `1` et `10` ;
- RIR et RPE ne sont pas renseignés simultanément ;
- `targetIntensityPercent` est strictement positif et inférieur ou égal à `100` ;
- les durées et repos sont stockés en secondes ;
- les distances sont stockées en mètres ;
- les poids sont stockés en kilogrammes ;
- les statuts de performance réelle ne s’appliquent pas à cette entité.

### Validation selon le type de mesure

- `WEIGHT_REPS`, `BODYWEIGHT_REPS`, `ASSISTED_BODYWEIGHT_REPS` et `REPS_ONLY` nécessitent une cible de répétitions ;
- `DURATION` et `WEIGHT_DURATION` nécessitent une durée cible ;
- `DISTANCE_DURATION` nécessite au minimum une distance cible et peut également définir une durée ;
- la charge cible reste facultative dans les modèles où elle est autorisée.

À l’issue de la phase 2, chaque série possède sa propre ligne. L’ancienne approche consistant à stocker uniquement un nombre de séries et des cibles globales sur `WorkoutTemplateExercise` n’est plus utilisée.

## 24. WorkoutSession

> Statut : **implémenté à la clôture de la phase 3** (jalons 3.1–3.6).  
> Couvre création depuis un modèle, lecture active, saisie des séries, cycle de vie, historique paginé et détail en lecture seule.  
> Records, statistiques, progression et graphiques restent hors périmètre (phase 4).

```ts
type WorkoutSession = {
  id: string;
  ownerUserId: string;

  sourceProgramId: string | null;
  sourceWorkoutTemplateId: string | null;

  programNameSnapshot: string | null;
  workoutTemplateNameSnapshot: string | null;

  name: string;
  status: WorkoutStatus; // ACTIVE | PAUSED | COMPLETED | CANCELLED (PLANNED réservé, non utilisé par le flux actif)

  localDate: string; // YYYY-MM-DD, stocké en DATE PostgreSQL
  timezone: string;

  startedAt: Date;
  pausedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;

  notes: string | null;
  version: number;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- `localDate` utilise le format `YYYY-MM-DD` sans conversion UTC qui décale le jour ;
- `timezone` est snapshotée à la création ;
- `version` protège les mutations concurrentes (séries et cycle de vie) ;
- au plus une séance `ACTIVE` ou `PAUSED` par utilisateur (index partiel PostgreSQL `workout_sessions_one_in_progress_per_user`) ;
- `cancellationReason` est renseigné à l’annulation lorsque fourni ;
- l’historique cumulé des pauses n’est pas stocké : seul le dernier `pausedAt` est conservé (pas de durée active nette calculable côté serveur) ;
- les relations sources (`Program`, `WorkoutTemplate`) sont facultatives et utilisent `ON DELETE SET NULL` : supprimer une source ne supprime jamais la séance ;
- l’affichage et l’historique reposent exclusivement sur le snapshot, pas sur les sources actuelles ;
- une séance `COMPLETED` ou `CANCELLED` est immuable (aucune mutation d’exécution).

## 25. WorkoutSessionExercise

Snapshot d’un exercice dans une séance (phase 3 livrée).

```ts
type WorkoutSessionExercise = {
  id: string;
  workoutSessionId: string;

  sourceExerciseId: string | null;
  sourceTemplateExerciseId: string | null;

  exerciseNameSnapshot: string;
  measurementTypeSnapshot: ExerciseMeasurementType;

  position: number;

  primaryMuscleGroupNameSnapshot: string | null;
  sourceExerciseArchivedAtCreation: boolean;

  equipmentTypeId: string | null;
  equipmentNameSnapshot: string | null;
  equipmentCodeSnapshot: string | null;

  notesSnapshot: string | null;
  restSecondsSnapshot: number | null;

  createdAt: Date;
  updatedAt: Date;
};
```

Les champs snapshot permettent de conserver une lecture correcte si l’exercice est renommé ou archivé.

L’équipement prévu copie le type d’équipement du modèle (`equipmentTypeId` + nom/code snapshot), pas un équipement physique.

Les relations `sourceExercise` / `sourceTemplateExercise` / `equipmentType` utilisent `ON DELETE SET NULL`.

## 26. WorkoutSet

Ligne de série d’une séance : cibles immuables du snapshot + résultats réels (phase 3 livrée).

```ts
type WorkoutSet = {
  id: string;
  workoutSessionExerciseId: string;
  ownerUserId: string;

  sourceTemplateSetId: string | null;

  position: number;
  setType: WorkoutSetType;
  status: WorkoutSetStatus; // PENDING | COMPLETED | PARTIAL | FAILED | SKIPPED | CANCELLED

  targetWeightKg: Decimal | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: Decimal | null;
  targetIntensityPercent: Decimal | null;
  targetRir: number | null;
  targetRpe: Decimal | null;
  targetRestSeconds: number | null;

  actualWeightKg: Decimal | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: Decimal | null;
  actualRir: number | null;
  actualRpe: Decimal | null;

  reachedFailure: boolean;
  notes: string | null;

  startedAt: Date | null;
  completedAt: Date | null;

  clientCommandId: string | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- `position` unique dans un `WorkoutSessionExercise` ;
- `status` vaut `PENDING` à la création du snapshot ;
- les champs `target*` sont immuables après création : une mutation de performance ne les modifie jamais ;
- les valeurs réelles (`actual*`) sont stockées séparément et validées selon `measurementTypeSnapshot` ;
- RIR et RPE réels ne sont pas renseignés simultanément ;
- `reachedFailure` est distinct de `status = FAILED` ;
- `completedAt` correspond à la dernière validation de la série ;
- `clientCommandId` est unique par utilisateur lorsqu’il est renseigné (idempotence best-effort sur la ligne) ;
- la relation `sourceTemplateSet` utilise `ON DELETE SET NULL` ;
- unités canoniques persistées : kg, secondes, mètres.

## 26 bis. WorkoutSetCommand

Reçu d’idempotence serveur pour les mises à jour de séries (jalon 3.5 / rejeu hors ligne).

Table Prisma : `workout_set_commands`.

```ts
type WorkoutSetCommand = {
  id: string;
  ownerUserId: string;
  workoutSessionId: string;
  workoutSetId: string;
  clientCommandId: string;
  payloadFingerprint: string;
  appliedVersion: number;
  createdAt: Date;
};
```

### Contraintes

- unicité `(ownerUserId, clientCommandId)` ;
- même identifiant + même empreinte → rejeu sans double effet (retourne la version déjà appliquée) ;
- même identifiant + empreinte différente → conflit (`WORKOUT_SET_COMMAND_CONFLICT`) ;
- le lookup du reçu précède le contrôle de version obsolète afin de tolérer une réponse réseau perdue.

## 26 ter. WorkoutLifecycleCommand

Reçu d’idempotence serveur pour pause / reprise / fin / annulation.

Table Prisma : `workout_lifecycle_commands`.

```ts
type WorkoutLifecycleCommand = {
  id: string;
  ownerUserId: string;
  workoutSessionId: string;
  clientCommandId: string;
  action: string; // PAUSE | RESUME | COMPLETE | CANCEL
  payloadFingerprint: string;
  createdAt: Date;
};
```

### Contraintes

- unicité `(ownerUserId, clientCommandId)` ;
- protection contre les doubles effets et les payloads contradictoires sur le même identifiant ;
- les transitions déjà appliquées sont idempotentes (`noop` sans nouvel incrément de version).

## 26 quater. File hors ligne (client)

La file de commandes hors ligne **n’est pas** une table Prisma.

Elle est stockée côté client dans IndexedDB (`gym-companion-offline`) :

- `workoutSnapshots` — snapshot local de séance ;
- `workoutCommands` — file ordonnée (`UPDATE_WORKOUT_SET`, `PAUSE_WORKOUT`, `RESUME_WORKOUT`, `COMPLETE_WORKOUT`, `CANCEL_WORKOUT`) ;
- `workoutSyncState` — état de sync, conflit, lease multi-onglets.

Les données sont cloisonnées par `userId`. Voir `docs/11-pwa-and-offline.md`.

## 27. WorkoutSessionEvent

Journal métier facultatif, **non implémenté** en phase 3.

```ts
type WorkoutSessionEvent = {
  id: string;
  workoutSessionId: string;
  userId: string | null;

  eventType: string;
  payload: Json;

  clientCommandId: string | null;
  serverVersion: number;

  createdAt: Date;
};
```

### Utilité future

- audit ;
- reconstruction ;
- diagnostic de synchronisation ;
- suivi des corrections.

L’idempotence opérationnelle de la phase 3 repose sur `WorkoutSetCommand` et `WorkoutLifecycleCommand`, pas sur cette table.

## 28. PersonalRecord

> **Jalon 4.1** : aucune table `PersonalRecord` n’est créée. Les records sont **calculés à la demande** depuis les snapshots de séances `COMPLETED` et séries `COMPLETED` (hors `WARMUP`). Les séances terminées restent la source de vérité.

Cette section décrit une **matérialisation future** éventuelle si l’agrégation à la demande devient réellement coûteuse (notifications immédiates, volumes très élevés, etc.). Elle n’est pas implémentée en 4.1.

```ts
type PersonalRecord = {
  id: string;
  userId: string;
  exerciseId: string;
  equipmentId: string | null;

  recordType:
    | "MAX_WEIGHT"
    | "MAX_REPS"
    | "MAX_REPS_AT_WEIGHT"
    | "MAX_SET_VOLUME"
    | "MAX_SESSION_VOLUME"
    | "ESTIMATED_ONE_REP_MAX"
    | "MAX_DURATION"
    | "MAX_DISTANCE";

  numericValue: Decimal;
  secondaryValue: Decimal | null;

  sourceWorkoutSetId: string | null;
  sourceWorkoutSessionId: string | null;

  calculationStrategy: string | null;

  achievedAt: Date;

  createdAt: Date;
  updatedAt: Date;
};
```

En 4.1, le contrat API exposé est un DTO dérivé (sans `ownerUserId`, sans ligne Prisma) : types `MAX_WEIGHT` | `MAX_REPS` | `MAX_DURATION` | `MAX_DISTANCE` uniquement.

> **Phase 4 — e1RM** : aucun `PersonalRecordType` `ESTIMATED_ONE_REP_MAX` n’existe.
> Aucun modèle Prisma e1RM n’est créé. L’e1RM est une **métrique dérivée** (jalon 4.5,
> formule `EPLEY_V1` / Epley) exposée via `GET …/progress/exercises/:id/strength`,
> distincte des records réels. Une matérialisation éventuelle (ci-dessus ou
> `ExerciseStrengthReference`) reste **future**.

## 28bis. Progression temporelle (jalon 4.3)

> **Jalon 4.3** : aucune table de série temporelle / métrique de progression n’est créée.
> La progression est **dérivée à la demande** depuis `WorkoutSession` → `WorkoutSessionExercise` → `WorkoutSet`
> (séances `COMPLETED`, regroupement par `sourceExerciseId`).
> Les snapshots historiques restent la source de vérité même si l’exercice catalogue est renommé ou archivé.

## 28ter. Dashboard global (jalon 4.4)

> **Jalon 4.4** : aucune table de statistiques globales.
> Le dashboard (`GET /api/v1/progress/overview`, page `/progress`) agrège à la demande
> les séances `COMPLETED` (totaux 4.2, records 4.1, top exercices par `sourceExerciseId`).
> Granularité DAY / WEEK / MONTH ; buckets vides inclus ; pas de coaching.

## 28quater. Force estimée e1RM (jalon 4.5)

> **Jalon 4.5** : aucune table `EstimatedOneRepMax` / `StrengthMetric` / `StrengthRecord`.
> L’e1RM est **dérivé à la demande** depuis les séries `COMPLETED` des séances `COMPLETED`
> (`measurementTypeSnapshot = WEIGHT_REPS`, hors warmup, 1–12 reps, charge > 0).
> Formule **Epley V1** : `e1RM = weight × (1 + reps / 30)` (`reps = 1` → `e1RM = weight`).
> RIR / RPE n’influencent pas le calcul. L’estimation ≠ charge réellement soulevée
> (records 4.1 restent distincts). Aucune recommandation de charge.

## 29. SharedWorkoutRoom

> **Shared 5.1 + 5.2 + 5.3 (livrés)** — modèle ci-dessous.
> Template / codes publics / rotation / sync workout = Shared 5.4+.
> Shared 5.3 n’ajoute **aucune** colonne ni table de présence.

```ts
type SharedWorkoutRoomStatus =
  | "LOBBY"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

type SharedWorkoutRoom = {
  id: string; // UUID
  ownerUserId: string;

  name: string; // 1–80, trim ; défaut serveur « Séance partagée »
  status: SharedWorkoutRoomStatus; // défaut LOBBY

  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  // relations
  owner: User;
  members: SharedWorkoutRoomMember[];
  commands: SharedWorkoutRoomLifecycleCommand[];
  invitations: SharedWorkoutRoomInvitation[]; // Shared 5.2
};
```

Index : `ownerUserId`, `status`, `(updatedAt, id)`.

### Invariants Shared 5.1 / 5.2 / 5.3

- création transactionnelle room + membership `OWNER` ;
- `ownerUserId` = source autoritative de propriété ;
- membership actif = `leftAt IS NULL` ;
- invitations email persistées (pas de code public en 5.2) ;
- room ≠ `WorkoutSession` (aucun lien automatique) ;
- **pas** de modèle `Presence` / colonnes `onlineAt` : présence Socket.IO
  **in-memory only** (Shared 5.3).

### Cible produit (Shared 5.4+)

Champs futurs possibles (non en base) :

- `sourceTemplateId` ;
- invitation code hash / expiration / révocation (codes publics) ;
- `maxParticipants`, `targetDurationMinutes` ;
- `stateVersion`, `rotationAlgorithmVersion`.

## 30. SharedWorkoutRoomMember

> **Shared 5.1 + `leftAt` Shared 5.2 (livrés).**

```ts
type SharedWorkoutRoomMemberRole = "OWNER" | "MEMBER";

type SharedWorkoutRoomMember = {
  id: string;
  roomId: string;
  userId: string;
  role: SharedWorkoutRoomMemberRole;
  joinedAt: Date;
  /** null = actif ; non-null = a quitté (Shared 5.2). */
  leftAt: Date | null;
};
```

Contraintes : `UNIQUE(roomId, userId)` ; index `userId`, `roomId`, `(userId, leftAt)`.

Leave = soft (`leftAt`) ; rejoin via accept réutilise la ligne et remet `leftAt = null`.

### SharedWorkoutRoomLifecycleCommand

Idempotence start / complete / cancel (miroir `WorkoutLifecycleCommand`) :

```ts
type SharedWorkoutRoomLifecycleCommand = {
  id: string;
  ownerUserId: string;
  roomId: string;
  clientCommandId: string;
  action: string;
  payloadFingerprint: string;
  createdAt: Date;
};
```

`UNIQUE(ownerUserId, clientCommandId)`.

## 30bis. SharedWorkoutRoomInvitation (Shared 5.2 — livré)

Invitation directe vers un compte existant (email). Pas de code / token public.

```ts
type SharedWorkoutRoomInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED";

type SharedWorkoutRoomInvitation = {
  id: string;
  roomId: string;
  invitedByUserId: string;
  inviteeUserId: string;
  status: SharedWorkoutRoomInvitationStatus; // défaut PENDING
  createdAt: Date;
  respondedAt: Date | null; // accept / decline
  cancelledAt: Date | null; // cancel owner ou auto terminal room
};
```

Index : `(inviteeUserId, status, createdAt)`, `(roomId, status, createdAt)`,
`(roomId, inviteeUserId)`, `(createdAt, id)`.

Index unique partiel : une seule ligne `PENDING` par `(roomId, inviteeUserId)`.

## 30ter. SharedWorkoutParticipant (cible Shared 5.4+)

Ancien nom conceptuel du participant enrichi (stations, ready, etc.). **Non créé**.
Membership = `SharedWorkoutRoomMember` ; présence Shared 5.3 = mémoire process
(pas de table). Ne pas confondre membership et présence en ligne.

```ts
type SharedWorkoutParticipant = {
  id: string;
  sharedWorkoutRoomId: string;
  userId: string;

  role: SharedParticipantRole;
  status: SharedParticipantStatus;

  joinedAt: Date | null;
  readyAt: Date | null;
  disconnectedAt: Date | null;
  finishedAt: Date | null;
  leftAt: Date | null;

  currentStationId: string | null;
  nextStationId: string | null;

  lastAcknowledgedVersion: number | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

Clé unique :

```text
sharedWorkoutRoomId + userId
```

## 31. SharedWorkoutStation

Représente une station utilisable dans la rotation.

```ts
type SharedWorkoutStation = {
  id: string;
  sharedWorkoutRoomId: string;

  exerciseId: string;
  equipmentId: string | null;

  nameSnapshot: string;
  position: number;

  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "DISABLED";

  createdAt: Date;
  updatedAt: Date;
};
```

La capacité initiale sera généralement égale à 1.

## 32. SharedParticipantExercisePlan

Plan personnalisé d’un participant dans la séance partagée.

```ts
type SharedParticipantExercisePlan = {
  id: string;
  participantId: string;
  stationId: string;

  workoutSessionExerciseId: string | null;

  position: number;

  targetSetCount: number;
  targetWeightKg: Decimal | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: Decimal | null;
  targetRir: number | null;
  targetRpe: Decimal | null;
  restSeconds: number | null;

  status: "PENDING" | "ACTIVE" | "COMPLETED" | "SKIPPED";

  createdAt: Date;
  updatedAt: Date;
};
```

## 33. SharedRotationAssignment

Historise les affectations de rotation.

```ts
type SharedRotationAssignment = {
  id: string;
  sharedWorkoutRoomId: string;
  participantId: string;
  stationId: string | null;

  roundNumber: number;
  stateVersion: number;

  assignedAt: Date;
  releasedAt: Date | null;

  reason:
    | "INITIAL"
    | "AUTOMATIC_ROTATION"
    | "HOST_OVERRIDE"
    | "RECONNECTION"
    | "PARTICIPANT_ADDED"
    | "PARTICIPANT_PAUSED";
};
```

## 34. RealtimeCommand

> Cible **Shared 5.4+** (idempotence commandes workout). **Non créé** en Shared 5.3
> (présence in-memory, pas de table de commandes socket).

Permet de suivre l’idempotence des commandes critiques.

```ts
type RealtimeCommand = {
  id: string;
  commandId: string;

  sharedWorkoutRoomId: string;
  userId: string;

  commandType: string;
  expectedVersion: number | null;
  appliedVersion: number | null;

  status: "RECEIVED" | "APPLIED" | "REJECTED" | "CONFLICT";

  resultPayload: Json | null;
  errorCode: string | null;

  createdAt: Date;
  processedAt: Date | null;
};
```

### Contrainte

`commandId` doit être unique dans le périmètre défini.

## 35. Food

```ts
type Food = {
  id: string;
  ownerUserId: string | null;

  source: DataSource;
  externalReference: string | null;

  name: string;
  brand: string | null;

  referenceAmount: Decimal;
  referenceUnit: "GRAM" | "MILLILITER" | "UNIT" | "PORTION";

  caloriesKcal: Decimal;
  proteinGrams: Decimal;
  carbohydrateGrams: Decimal;
  fatGrams: Decimal;

  fiberGrams: Decimal | null;
  saltGrams: Decimal | null;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

Les valeurs correspondent à la quantité de référence.

## 36. Recipe

```ts
type Recipe = {
  id: string;
  ownerUserId: string;

  name: string;
  description: string | null;
  servingCount: Decimal;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

## 37. RecipeIngredient

```ts
type RecipeIngredient = {
  id: string;
  recipeId: string;
  foodId: string;

  amount: Decimal;
  unit: "GRAM" | "MILLILITER" | "UNIT" | "PORTION";

  position: number;
};
```

Les valeurs nutritionnelles d’une recette sont calculées depuis ses ingrédients.

Un snapshot peut être conservé lors de l’ajout au journal afin qu’une modification future de recette ne modifie pas les anciens repas.

## 38. NutritionGoal

```ts
type NutritionGoal = {
  id: string;
  userId: string;

  effectiveFromLocalDate: string;
  effectiveToLocalDate: string | null;

  calorieTargetKcal: Decimal;
  proteinTargetGrams: Decimal | null;
  carbohydrateTargetGrams: Decimal | null;
  fatTargetGrams: Decimal | null;

  source: "USER_DEFINED" | "CALCULATED" | "AI_PROPOSED";

  createdAt: Date;
  updatedAt: Date;
};
```

Une modification crée une nouvelle période au lieu de réécrire l’objectif passé.

## 39. FoodLogEntry

```ts
type FoodLogEntry = {
  id: string;
  userId: string;

  localDate: string;
  timezone: string;
  mealType: MealType;

  foodId: string | null;
  recipeId: string | null;

  nameSnapshot: string;

  amount: Decimal;
  unit: "GRAM" | "MILLILITER" | "UNIT" | "PORTION";

  caloriesKcal: Decimal;
  proteinGrams: Decimal;
  carbohydrateGrams: Decimal;
  fatGrams: Decimal;
  fiberGrams: Decimal | null;
  saltGrams: Decimal | null;

  consumedAt: Date | null;
  notes: string | null;

  createdAt: Date;
  updatedAt: Date;
};
```

Les valeurs calculées sont enregistrées sous forme de snapshot.

## 40. SavedMeal

Repas réutilisable indépendant d’une recette.

```ts
type SavedMeal = {
  id: string;
  ownerUserId: string;

  name: string;
  defaultMealType: MealType | null;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

## 41. SavedMealItem

```ts
type SavedMealItem = {
  id: string;
  savedMealId: string;

  foodId: string | null;
  recipeId: string | null;

  amount: Decimal;
  unit: "GRAM" | "MILLILITER" | "UNIT" | "PORTION";

  position: number;
};
```

## 42. BodyMeasurement

```ts
type BodyMeasurement = {
  id: string;
  userId: string;

  measurementType:
    | "WEIGHT"
    | "BODY_FAT_PERCENT"
    | "WAIST_CIRCUMFERENCE"
    | "OTHER";

  value: Decimal;
  unit: string;

  measuredAt: Date;
  source: DataSource;
  notes: string | null;

  createdAt: Date;
  updatedAt: Date;
};
```

La première version utilise principalement `WEIGHT`.

## 43. ExerciseEnergyEstimate

Estimation de dépense associée à une séance.

```ts
type ExerciseEnergyEstimate = {
  id: string;
  userId: string;
  workoutSessionId: string;

  estimatedCaloriesKcal: Decimal;

  calculationStrategy: string;
  calculationVersion: string;

  inputSnapshot: Json;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";

  calculatedAt: Date;
};
```

Cette valeur doit être affichée comme estimation.

## 44. PushSubscription

```ts
type PushSubscription = {
  id: string;
  userId: string;

  endpoint: string;
  p256dhKey: string;
  authKey: string;

  userAgent: string | null;
  deviceLabel: string | null;

  expiresAt: Date | null;
  revokedAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

Les clés doivent être protégées et ne jamais être exposées inutilement.

## 45. NotificationPreference

```ts
type NotificationPreference = {
  id: string;
  userId: string;

  category:
    | "PLANNED_WORKOUT"
    | "REST_TIMER"
    | "SHARED_INVITATION"
    | "SHARED_WORKOUT_START"
    | "STATION_CHANGE"
    | "NUTRITION_REMINDER"
    | "ACCOUNT_SECURITY";

  isEnabled: boolean;

  quietHoursStart: string | null;
  quietHoursEnd: string | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contrainte

Clé unique :

```text
userId + category
```

## 46. NotificationDelivery

```ts
type NotificationDelivery = {
  id: string;
  userId: string;
  pushSubscriptionId: string | null;

  category: string;
  title: string;
  body: string;
  payload: Json | null;

  scheduledAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;

  status: "PENDING" | "SENT" | "FAILED" | "CANCELLED";

  failureCode: string | null;

  createdAt: Date;
};
```

## 47. AiRequest

```ts
type AiRequest = {
  id: string;
  userId: string;

  requestType:
    | "PROGRAM_GENERATION"
    | "WORKOUT_GENERATION"
    | "PROGRESS_ANALYSIS"
    | "LOAD_ADJUSTMENT"
    | "EXERCISE_ALTERNATIVE";

  provider: string;
  model: string;

  inputSummary: Json;
  consentedDataTypes: string[];

  promptVersion: string;
  schemaVersion: string;

  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

  tokenUsageInput: number | null;
  tokenUsageOutput: number | null;
  estimatedCost: Decimal | null;

  createdAt: Date;
  completedAt: Date | null;
};
```

Le prompt complet contenant des données sensibles ne doit pas nécessairement être conservé.

## 48. AiProposal

```ts
type AiProposal = {
  id: string;
  aiRequestId: string;
  userId: string;

  proposalType:
    | "PROGRAM"
    | "WORKOUT"
    | "PROGRESS_ANALYSIS"
    | "LOAD_ADJUSTMENT"
    | "EXERCISE_ALTERNATIVE";

  status: AiProposalStatus;

  structuredPayload: Json | null;
  explanation: string | null;
  assumptions: string[];
  warnings: string[];

  validationErrors: Json | null;

  acceptedAt: Date | null;
  rejectedAt: Date | null;
  expiresAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

## 49. OfflineCommand

Optionnel côté serveur pour les commandes synchronisées depuis la PWA.

```ts
type OfflineCommand = {
  id: string;
  commandId: string;
  userId: string;

  aggregateType: string;
  aggregateId: string;

  commandType: string;
  expectedVersion: number | null;
  payload: Json;

  status: "RECEIVED" | "APPLIED" | "REJECTED" | "CONFLICT";

  resultPayload: Json | null;
  errorCode: string | null;

  createdAt: Date;
  processedAt: Date | null;
};
```

## 50. DataExport

```ts
type DataExport = {
  id: string;
  userId: string;

  formatVersion: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED" | "EXPIRED";

  fileReference: string | null;
  expiresAt: Date | null;

  createdAt: Date;
  completedAt: Date | null;
};
```

## 51. AuditLog

```ts
type AuditLog = {
  id: string;

  actorUserId: string | null;
  targetUserId: string | null;

  action: string;
  entityType: string;
  entityId: string | null;

  metadata: Json | null;

  createdAt: Date;
};
```

L’audit ne doit pas contenir :

- mots de passe ;
- tokens ;
- clés push ;
- prompts complets sensibles ;
- données inutiles.

## 52. Index recommandés

### Utilisateurs

- `User.email` unique ;
- `AuthSession.userId` ;
- `AuthSession.expiresAt`.

### Exercices

- `Exercise.ownerUserId` ;
- `Exercise.normalizedName` ;
- `Exercise.primaryMuscleGroupId` ;
- `Exercise.archivedAt` ;
- `UserExercisePreference.userId + exerciseId` unique.

### Programmes et planification

- `Program.ownerUserId` ;
- `Program.ownerUserId + archivedAt` ;
- `WorkoutTemplate.programId` ;
- `WorkoutTemplate.programId + position` unique ;
- `WorkoutTemplateExercise.workoutTemplateId + exerciseId` unique ;
- `WorkoutTemplateExercise.workoutTemplateId + position` unique ;
- `WorkoutTemplateExercise.exerciseId` ;
- `WorkoutTemplateSet.workoutTemplateExerciseId + position` unique ;
- `ProgramActivation.userId` ;
- `ProgramActivation.programId` ;
- index PostgreSQL partiel unique sur `ProgramActivation.userId` lorsque `endedOn IS NULL` ;
- `ProgramScheduleEntry.programId + weekday + position` unique ;
- `ProgramScheduleEntry.workoutTemplateId`.

### Séances

- `WorkoutSession.ownerUserId + localDate` ;
- `WorkoutSession.ownerUserId + status` ;
- `WorkoutSession.sharedWorkoutRoomId` ;
- `WorkoutSet.userId + completedAt` ;
- `WorkoutSet.workoutSessionExerciseId`.

### Partage

- `SharedWorkoutRoom.ownerUserId` ;
- `SharedWorkoutRoom.status` ;
- `SharedWorkoutRoomMember.userId` ;
- `SharedWorkoutRoomMember.(roomId, userId)` unique ;
- `SharedWorkoutRoomMember.(userId, leftAt)` ;
- `SharedWorkoutRoomLifecycleCommand.(ownerUserId, clientCommandId)` unique ;
- `SharedWorkoutRoomInvitation.(inviteeUserId, status, createdAt)` ;
- `SharedWorkoutRoomInvitation` unique partiel `(roomId, inviteeUserId) WHERE status = PENDING` ;
- (futur) `SharedWorkoutParticipant.*` / `RealtimeCommand.commandId`.

### Nutrition

- `Food.ownerUserId` ;
- `FoodLogEntry.userId + localDate` ;
- `NutritionGoal.userId + effectiveFromLocalDate` ;
- `BodyMeasurement.userId + measuredAt`.

### Notifications et IA

- `PushSubscription.userId` ;
- `NotificationDelivery.status + scheduledAt` ;
- `AiRequest.userId + createdAt`.

## 53. Contraintes de suppression

### Suppression en cascade possible

- tokens d’authentification ;
- sessions ;
- préférences sans historique ;
- `WorkoutTemplateSet` lors du retrait de son `WorkoutTemplateExercise` ;
- `WorkoutTemplateExercise` lors de la suppression de son `WorkoutTemplate` ;
- `ProgramScheduleEntry` référant un modèle supprimé.

### Comportement de phase 2

- `Program` : archivage logique ;
- `WorkoutTemplate` : suppression physique depuis le constructeur, car aucune séance historique ne le référence encore ;
- `WorkoutTemplate.archivedAt` : champ réservé, sans workflow exposé ;
- `ProgramActivation` : historique conservé ;
- `ProgramScheduleEntry` : supprimé lors du retrait du modèle correspondant ;
- exercices du catalogue : archivage logique ;
- préférences utilisateur : conservées lors de l’archivage d’un exercice.

### Archivage recommandé pour les modules futurs

- équipements ;
- aliments ;
- recettes ;
- repas sauvegardés.

### Conservation ou anonymisation

- séances individuelles ;
- séances partagées ;
- événements d’audit ;
- historiques nécessaires aux autres participants.

À partir de la phase 3, une séance réelle doit utiliser des snapshots afin qu’une modification ou suppression ultérieure d’un programme ne réécrive pas son historique.

## 54. Agrégats métier recommandés

Pour éviter des transactions trop larges, le domaine peut être séparé en agrégats.

### Agrégat utilisateur

- User ;
- UserProfile ;
- AuthSession.

### Agrégat catalogue

- Exercise ;
- Equipment ;
- préférences utilisateur.

### Agrégat programme

- Program ;
- WorkoutTemplate ;
- WorkoutTemplateExercise ;
- WorkoutTemplateSet ;
- ProgramScheduleEntry.

L’activation courante utilise `ProgramActivation` et impose une contrainte d’unicité par utilisateur.

### Agrégat séance

- WorkoutSession ;
- WorkoutSessionExercise ;
- WorkoutSet ;
- WorkoutSessionEvent.

> **Jalon 4.2** : les métriques de séance (`WorkoutMetrics`) sont **dérivées à la demande** depuis les snapshots. Aucune table `WorkoutMetrics` / `WorkoutStatistics` / `WorkoutSummary` n’est créée.
>
> Volume externe = `somme(actualWeightKg × actualReps)` pour `WEIGHT_REPS` uniquement.
> Bodyweight et assistance exclus. Warmup inclus dans `totalExternalVolumeKg`, exclu de `workingExternalVolumeKg`.
> `PARTIAL` / `FAILED` peuvent contribuer avec leurs valeurs réelles. Records 4.1 restent plus stricts.
> `elapsedDurationSeconds` = `completedAt − startedAt` (pas une durée active nette).
> Métriques officielles uniquement pour séances `COMPLETED`.

### Agrégat salle partagée

- SharedWorkoutRoom ;
- SharedWorkoutRoomMember ;
- SharedWorkoutRoomInvitation ; *(Shared 5.2)*
- SharedWorkoutRoomLifecycleCommand ;
- SharedWorkoutParticipant ; *(cible Shared 5.4+)*
- SharedWorkoutStation ;
- SharedRotationAssignment ;
- RealtimeCommand.

> Présence Shared 5.3 : **pas** de modèle — mémoire process API uniquement.

### Agrégat nutrition

- Food ;
- Recipe ;
- FoodLogEntry ;
- NutritionGoal.

### Agrégat IA

- AiRequest ;
- AiProposal.

## 55. Modèle minimal pour commencer

La totalité du modèle ne doit pas être implémentée dès la phase 0.

### Phase 0

- User ;
- UserProfile ;
- AuthSession ;
- PasswordResetToken ;
- EmailVerificationToken.

### Phase 1

- MuscleGroup ;
- EquipmentType ;
- Exercise ;
- ExerciseSecondaryMuscle ;
- ExerciseEquipmentCompatibility ;
- UserExercisePreference.

Le modèle `Equipment` reste prévu pour une phase ultérieure consacrée aux équipements physiques ou personnels.

### Phase 2

- Program ;
- WorkoutTemplate ;
- WorkoutTemplateExercise ;
- WorkoutTemplateSet ;
- ProgramActivation ;
- ProgramScheduleEntry.

### Phase 3

- WorkoutSession ;
- WorkoutSessionExercise ;
- WorkoutSet ;
- WorkoutSetCommand ;
- WorkoutLifecycleCommand ;
- file IndexedDB client (`workoutSnapshots`, `workoutCommands`, `workoutSyncState`) — hors schéma Prisma.

La création d’une séance depuis un modèle copie un snapshot immuable des informations nécessaires : noms, ordre, type de mesure, équipement prévu, repos, notes et séries cibles.

À la clôture de la phase 3, l’historique paginé et le détail en lecture seule reposent sur ces snapshots. En phase 4 (jalons 4.1 / 4.2 / 4.3 / 4.4 / 4.5), records, métriques de séance, progression temporelle, dashboard global et e1RM sont calculés à la demande sans matérialisation Prisma.

### Phase 4

- ExerciseStrengthReference (future) ;
- PersonalRecord (matérialisation future — 4.1 calcule à la demande) ;
- métriques de séance dérivées (4.2 — pas de table) ;
- progression temporelle dérivée (4.3 — pas de table) ;
- dashboard global dérivé (4.4 — pas de table) ;
- e1RM / force estimée dérivé (4.5 — pas de table).

### Jalon 5.1 — Coaching déterministe (hors tables)

Les recommandations de charge sont **dérivées à la lecture** :

- pas de modèle Prisma `LoadRecommendation` / `CoachingRecommendation` (recommandation elle-même non persistée) ;
- calcul depuis `WorkoutTemplateExercise` + séries cibles + snapshots de séances `COMPLETED`.

### Jalon 5.2 — Décisions de charge (audit)

```prisma
enum LoadRecommendationDecisionType {
  ACCEPTED
  ADJUSTED
  IGNORED
}

model LoadRecommendationDecision {
  id                        String
  ownerUserId               String
  workoutTemplateExerciseId String? // onDelete: SetNull
  workoutTemplateId         String? // onDelete: SetNull
  programId                 String? // onDelete: SetNull
  exerciseId                String? // onDelete: SetNull
  engineVersion             String
  recommendationFingerprint String
  recommendationAction      String
  decisionType              LoadRecommendationDecisionType
  currentTargetWeightKg     Decimal?
  recommendedWeightKg       Decimal?
  appliedWeightKg           Decimal?
  incrementKg               Decimal?
  incrementSource           String?
  reasons                   Json
  evidenceSnapshot          Json // audit compact (pas le profil complet)
  userNote                  String?
  clientCommandId           String
  payloadFingerprint        String
  createdAt                 DateTime

  @@unique([ownerUserId, clientCommandId])
  @@index([ownerUserId, createdAt])
  @@index([workoutTemplateExerciseId, createdAt])
}
```

La suppression d’un programme / template / exercice source **ne cascade pas** sur
l’historique (SetNull) : le snapshot conserve le contexte d’audit.

### Jalon 5.3 — Plateau / stagnation (hors tables)

L’analyse de plateau est **dérivée à la lecture** :

- pas de modèle Prisma `PlateauDetection` / `PlateauAnalysis` / `StagnationAlert` ;
- calcul depuis séances `COMPLETED` + snapshots (`sourceExerciseId`, équipement, cibles, perfs) ;
- le statut n’est **pas** matérialisé : il évolue avec de nouvelles séances.

### Jalon 5.4 — Coach explicatif (hors tables)

Les synthèses Coach (`ExerciseCoachSummary`, `CoachingOverview`) sont **dérivées** :

- pas de modèle Prisma `CoachSummary` / `CoachInsight` / `CoachAlert` ;
- composition des résultats progression / force / load reco / plateau / décisions ;
- aucun texte généré par LLM.

### Jalon 5.5 — Explications IA (hors tables)

Les explications LLM (`ExerciseCoachExplanationResponse`) sont **éphémères** :

- pas de modèle Prisma `AiExplanation` / `CoachInsight` / historique de génération ;
- calculées à la demande depuis `ExerciseCoachSummary` + provider ;
- non stockées dans IndexedDB ;
- fingerprint `coachSummaryFingerprint` dérivé du summary (staleness UI uniquement).

### Jalon 5.6 — Chat Coach (tables dédiées)

Persistance minimale pour le multi-tour. Les analyses sportives restent dérivées ailleurs.

```ts
type AiCoachConversation = {
  id: string;
  ownerUserId: string; // Cascade avec User
  title: string | null; // heuristique locale (pas d’appel IA)
  contextExerciseId: string | null; // onDelete: SetNull
  archivedAt: DateTime | null;
  generationStartedAt: DateTime | null; // informatif ; busy lock process-local
  createdAt: DateTime;
  updatedAt: DateTime;
};

type AiCoachMessage = {
  id: string;
  conversationId: string; // Cascade avec conversation
  role: 'USER' | 'ASSISTANT';
  content: string;
  clientCommandId: string | null; // unique avec conversationId (idempotence USER)
  payloadFingerprint: string | null;
  providerRequestId: string | null;
  generatedFromSchemaVersion: string | null;
  promptVersion: string | null;
  referencesJson: Json | null; // références filtrées serveur
  suggestedFollowUpsJson: Json | null;
  createdAt: DateTime;
};

type AiCoachToolInvocation = {
  id: string;
  assistantMessageId: string; // Cascade
  toolName: string;
  inputSnapshot: Json; // args sanitizés (pas ownerUserId)
  outputSummary: Json; // résumé audit, pas payload sportif complet
  createdAt: DateTime;
};
```

Index utiles : `(ownerUserId, updatedAt)` conversations ; `(conversationId, createdAt)` messages ;
`(assistantMessageId, createdAt)` tool invocations.

**Non persisté :** chaîne de pensée, raw provider payload, secrets, tokens, objets Prisma.

**Dettes d’exploitation (volontaires) :** busy lock et rate limiter IA restent **process-local / mémoire**
(pas Redis) — acceptable monolithe mono-instance.

### Phase 5 produit (séances partagées — Shared 5.1 + 5.2 + 5.3 livrés)

Livré : `SharedWorkoutRoom`, `SharedWorkoutRoomMember` (+ `leftAt`),
`SharedWorkoutRoomLifecycleCommand`, `SharedWorkoutRoomInvitation`.
Présence Socket.IO **non persistée** (mémoire process).

Modèles futurs (Shared 5.4+) :
- SharedWorkoutParticipant (enrichi) ;
- SharedWorkoutStation ;
- SharedParticipantExercisePlan ;
- SharedRotationAssignment ;
- RealtimeCommand ;
- codes d’invitation publics (si retenus).

### Phase 6

- Food ;
- Recipe ;
- RecipeIngredient ;
- NutritionGoal ;
- FoodLogEntry ;
- SavedMeal ;
- SavedMealItem ;
- BodyMeasurement ;
- ExerciseEnergyEstimate.

### Phases suivantes

- PushSubscription ;
- NotificationPreference ;
- NotificationDelivery ;
- AiRequest ;
- AiProposal ;
- DataExport ;
- AuditLog.

## 56. Décisions à confirmer pendant l’implémentation

Les points suivants restent volontairement ouverts :

- UUID, CUID ou ULID ;
- refresh token en cookie ou autre stratégie sécurisée ;
- conservation ou non d’un journal détaillé de tous les événements ;
- calcul des records à la demande ou matérialisation ;
- stratégie d’archivage individuel de `WorkoutTemplate` et usage futur de `archivedAt` ;
- stratégie de versionnement ou de concurrence des programmes sur plusieurs appareils ;
- source initiale du catalogue alimentaire ;
- durée de conservation des demandes IA ;
- stratégie de suppression différée ;
- précision décimale exacte des colonnes PostgreSQL.

Les décisions suivantes sont confirmées à la clôture de la phase 2 :

- une série cible possède une ligne `WorkoutTemplateSet` distincte ;
- un exercice ne peut apparaître qu’une fois dans un même modèle ;
- RIR et RPE ne sont pas renseignés simultanément sur une série cible ;

Les décisions suivantes sont confirmées pour le jalon 3.2 :

- `WorkoutSetStatus` inclut `PENDING` comme état initial explicite ;
- la saisie passe par un unique `PATCH` imbriqué avec `status` explicite ;
- `expectedVersion` protège la séance entière ;
- `clientCommandId` offre une idempotence best-effort via l’unicité `(ownerUserId, clientCommandId)` ;
- `actualWeightKg` sur `ASSISTED_BODYWEIGHT_REPS` représente une assistance éventuelle (pas le poids corporel) ;
- `reachedFailure` reste distinct de `status = FAILED`.

Les décisions suivantes sont confirmées pour le jalon 3.3 :

- transitions `ACTIVE`/`PAUSED` ↔ pause/reprise/fin/annulation via machine à états explicite ;
- commandes déjà appliquées idempotentes (`noop` sans incrément de version) ;
- saisie des séries interdite pendant `PAUSED` ;
- `keepRecordedData` forcé à `true` (effacement des performances reporté) ;
- idempotence lifecycle via table `WorkoutLifecycleCommand` (`ownerUserId` + `clientCommandId`).
- idempotence séries via table `WorkoutSetCommand` (`ownerUserId` + `clientCommandId`, `payloadFingerprint`, `appliedVersion`) : le rejeu avec `expectedVersion` obsolète après perte de réponse renvoie le reçu sans double effet.

Les décisions encore ouvertes devront être prises avant l’implémentation du module concerné et documentées dans les fichiers techniques.

