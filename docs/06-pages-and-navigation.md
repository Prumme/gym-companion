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

type ProgramStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

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

Préférences d’un utilisateur pour un exercice.

```ts
type UserExercisePreference = {
  id: string;
  userId: string;
  exerciseId: string;

  preferredEquipmentId: string | null;
  defaultRestSeconds: number | null;
  defaultSetCount: number | null;
  notes: string | null;

  isFavorite: boolean;
  isExcluded: boolean;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contrainte

Clé unique :

```text
userId + exerciseId
```

## 17. ExerciseStrengthReference

Référence de force pour une combinaison utilisateur, exercice et équipement.

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

```ts
type Program = {
  id: string;
  ownerUserId: string;

  name: string;
  description: string | null;
  goal: TrainingGoal;
  status: ProgramStatus;

  activatedAt: Date | null;
  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

La première version limite à un programme principal actif par utilisateur.

Cette contrainte peut être appliquée dans le service métier plutôt que par un index simple.

## 19. WorkoutTemplate

```ts
type WorkoutTemplate = {
  id: string;
  ownerUserId: string;
  programId: string | null;

  name: string;
  description: string | null;

  positionInProgram: number | null;
  estimatedDurationMinutes: number | null;

  archivedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

## 20. WorkoutTemplateExercise

```ts
type WorkoutTemplateExercise = {
  id: string;
  workoutTemplateId: string;
  exerciseId: string;

  position: number;
  notes: string | null;

  preferredEquipmentId: string | null;
  targetSetCount: number;

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

- `position` unique dans une séance modèle ;
- les cibles doivent être compatibles avec le type de mesure.

## 21. WorkoutTemplateSet

Cette entité est recommandée si chaque série doit disposer d’une cible distincte.

```ts
type WorkoutTemplateSet = {
  id: string;
  workoutTemplateExerciseId: string;

  setNumber: number;
  setType: WorkoutSetType;

  targetWeightKg: Decimal | null;
  targetRepMin: number | null;
  targetRepMax: number | null;

  targetDurationSeconds: number | null;
  targetDistanceMeters: Decimal | null;

  targetRir: number | null;
  targetRpe: Decimal | null;

  restSeconds: number | null;
};
```

### Décision d’implémentation

Deux approches sont possibles :

1. conserver uniquement `targetSetCount` sur `WorkoutTemplateExercise` lorsque toutes les séries sont identiques ;
2. créer des lignes `WorkoutTemplateSet` pour une configuration détaillée.

La seconde approche est plus flexible et recommandée pour le projet final.

## 22. WorkoutSession

```ts
type WorkoutSession = {
  id: string;
  ownerUserId: string;

  sourceTemplateId: string | null;
  sharedWorkoutRoomId: string | null;

  name: string;
  status: WorkoutStatus;

  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;

  localDate: string;
  timezone: string;

  notes: string | null;

  version: number;

  createdAt: Date;
  updatedAt: Date;
};
```

### Contraintes

- `localDate` utilise le format `YYYY-MM-DD` ;
- `version` augmente lors des changements nécessitant un contrôle de concurrence ;
- une séance partagée peut produire une séance individuelle liée pour chaque participant.

## 23. WorkoutSessionExercise

Snapshot d’un exercice dans une séance.

```ts
type WorkoutSessionExercise = {
  id: string;
  workoutSessionId: string;
  exerciseId: string;

  sourceTemplateExerciseId: string | null;

  exerciseNameSnapshot: string;
  measurementTypeSnapshot: ExerciseMeasurementType;

  position: number;
  notes: string | null;

  equipmentId: string | null;
  equipmentNameSnapshot: string | null;

  plannedSetCount: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetRestSeconds: number | null;

  createdAt: Date;
  updatedAt: Date;
};
```

Les champs snapshot permettent de conserver une lecture correcte si l’exercice est renommé ou archivé.

## 24. WorkoutSet

```ts
type WorkoutSet = {
  id: string;
  workoutSessionExerciseId: string;
  userId: string;

  sourceTemplateSetId: string | null;

  setNumber: number;
  setType: WorkoutSetType;
  status: WorkoutSetStatus;

  targetWeightKg: Decimal | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: Decimal | null;
  targetRir: number | null;
  targetRpe: Decimal | null;

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

- `setNumber` unique dans un `WorkoutSessionExercise` pour un utilisateur ;
- `clientCommandId` peut être unique par utilisateur ;
- les valeurs réelles doivent respecter le type de mesure.

## 25. WorkoutSessionEvent

Journal métier facultatif mais recommandé.

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

### Utilité

- audit ;
- reconstruction ;
- diagnostic de synchronisation ;
- suivi des corrections ;
- idempotence.

Cette table n’oblige pas à adopter un event sourcing complet.

## 26. PersonalRecord

Cache ou matérialisation d’un record calculé.

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

Les records peuvent aussi être calculés à la demande. Cette table sert si les calculs deviennent coûteux ou si l’on souhaite notifier immédiatement un record.

## 27. SharedWorkoutRoom

```ts
type SharedWorkoutRoom = {
  id: string;
  hostUserId: string;

  sourceTemplateId: string | null;

  name: string;
  status: SharedRoomStatus;

  invitationCodeHash: string | null;
  invitationExpiresAt: Date | null;
  invitationRevokedAt: Date | null;

  maxParticipants: number;
  targetDurationMinutes: number | null;

  stateVersion: number;
  rotationAlgorithmVersion: string;

  startedAt: Date | null;
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};
```

### Sécurité

Le code d’invitation peut être stocké sous forme hachée lorsque sa récupération en clair n’est pas nécessaire.

## 28. SharedWorkoutParticipant

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

## 29. SharedWorkoutStation

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

## 30. SharedParticipantExercisePlan

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

## 31. SharedRotationAssignment

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

## 32. RealtimeCommand

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

## 33. Food

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

## 34. Recipe

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

## 35. RecipeIngredient

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

## 36. NutritionGoal

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

## 37. FoodLogEntry

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

## 38. SavedMeal

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

## 39. SavedMealItem

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

## 40. BodyMeasurement

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

## 41. ExerciseEnergyEstimate

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

## 42. PushSubscription

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

## 43. NotificationPreference

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

## 44. NotificationDelivery

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

## 45. AiRequest

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

## 46. AiProposal

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

## 47. OfflineCommand

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

## 48. DataExport

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

## 49. AuditLog

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

## 50. Index recommandés

### Utilisateurs

- `User.email` unique ;
- `AuthSession.userId` ;
- `AuthSession.expiresAt`.

### Exercices

- `Exercise.ownerUserId` ;
- `Exercise.normalizedName` ;
- `Exercise.primaryMuscleGroupId` ;
- `Exercise.archivedAt`.

### Programmes

- `Program.ownerUserId` ;
- `Program.status` ;
- `WorkoutTemplate.programId`.

### Séances

- `WorkoutSession.ownerUserId + localDate` ;
- `WorkoutSession.ownerUserId + status` ;
- `WorkoutSession.sharedWorkoutRoomId` ;
- `WorkoutSet.userId + completedAt` ;
- `WorkoutSet.workoutSessionExerciseId`.

### Partage

- `SharedWorkoutRoom.hostUserId` ;
- `SharedWorkoutRoom.status` ;
- `SharedWorkoutParticipant.sharedWorkoutRoomId` ;
- `SharedWorkoutParticipant.userId` ;
- `RealtimeCommand.commandId` unique.

### Nutrition

- `Food.ownerUserId` ;
- `FoodLogEntry.userId + localDate` ;
- `NutritionGoal.userId + effectiveFromLocalDate` ;
- `BodyMeasurement.userId + measuredAt`.

### Notifications et IA

- `PushSubscription.userId` ;
- `NotificationDelivery.status + scheduledAt` ;
- `AiRequest.userId + createdAt`.

## 51. Contraintes de suppression

### Suppression en cascade possible

- tokens d’authentification ;
- sessions ;
- préférences sans historique ;
- brouillons non référencés.

### Archivage recommandé

- exercices ;
- équipements ;
- programmes ;
- modèles ;
- aliments ;
- recettes ;
- repas sauvegardés.

### Conservation ou anonymisation

- séances partagées ;
- événements d’audit ;
- historiques nécessaires aux autres participants.

## 52. Agrégats métier recommandés

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
- WorkoutTemplateSet.

### Agrégat séance

- WorkoutSession ;
- WorkoutSessionExercise ;
- WorkoutSet ;
- WorkoutSessionEvent.

### Agrégat salle partagée

- SharedWorkoutRoom ;
- SharedWorkoutParticipant ;
- SharedWorkoutStation ;
- SharedRotationAssignment ;
- RealtimeCommand.

### Agrégat nutrition

- Food ;
- Recipe ;
- FoodLogEntry ;
- NutritionGoal.

### Agrégat IA

- AiRequest ;
- AiProposal.

## 53. Modèle minimal pour commencer

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
- Equipment ;
- Exercise ;
- ExerciseSecondaryMuscle ;
- UserExercisePreference.

### Phase 2

- Program ;
- WorkoutTemplate ;
- WorkoutTemplateExercise ;
- WorkoutTemplateSet.

### Phase 3

- WorkoutSession ;
- WorkoutSessionExercise ;
- WorkoutSet ;
- OfflineCommand ou mécanisme équivalent.

### Phase 4

- ExerciseStrengthReference ;
- PersonalRecord.

### Phase 5

- SharedWorkoutRoom ;
- SharedWorkoutParticipant ;
- SharedWorkoutStation ;
- SharedParticipantExercisePlan ;
- SharedRotationAssignment ;
- RealtimeCommand.

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

## 54. Décisions à confirmer pendant l’implémentation

Les points suivants restent volontairement ouverts :

- UUID, CUID ou ULID ;
- refresh token en cookie ou autre stratégie sécurisée ;
- conservation ou non d’un journal détaillé de tous les événements ;
- calcul des records à la demande ou matérialisation ;
- granularité exacte des séries modèles ;
- source initiale du catalogue alimentaire ;
- durée de conservation des demandes IA ;
- stratégie de suppression différée ;
- précision décimale exacte des colonnes PostgreSQL.

Ces décisions devront être prises avant l’implémentation du module concerné et documentées dans les fichiers techniques.
