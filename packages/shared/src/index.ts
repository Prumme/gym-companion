export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ApiListResponse<T> = {
  data: T[];
  pagination: PaginationMeta;
};

/** Métadonnées de pagination par cursor opaque (listes Phase 1+). */
export type CursorPaginationMeta = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type ApiCursorListResponse<T> = {
  data: T[];
  pagination: CursorPaginationMeta;
};

export type HealthStatus = 'ok' | 'degraded' | 'error';

export type HealthCheckResult = {
  status: HealthStatus;
  checks?: Record<
    string,
    {
      status: HealthStatus;
      message?: string;
    }
  >;
};

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DISABLED' | 'DELETION_PENDING';
export type UserRole = 'USER' | 'ADMIN';
export type WeightUnit = 'KG' | 'LB';
export type DistanceUnit = 'KM' | 'MI';
export type TrainingGoal =
  | 'ENDURANCE'
  | 'HYPERTROPHY'
  | 'STRENGTH'
  | 'GENERAL_FITNESS';
export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type EffortTrackingMode = 'NONE' | 'RIR' | 'RPE';

/** Référence système d’un groupe musculaire (lecture seule). */
export type MuscleGroupReference = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
};

/** Référence système d’un type d’équipement (lecture seule). */
export type EquipmentTypeReference = {
  id: string;
  code: string;
  name: string;
};

export type ExerciseSource = 'SYSTEM' | 'USER';

export type ExerciseMeasurementType =
  | 'WEIGHT_REPS'
  | 'BODYWEIGHT_REPS'
  | 'ASSISTED_BODYWEIGHT_REPS'
  | 'REPS_ONLY'
  | 'DURATION'
  | 'DISTANCE_DURATION'
  | 'WEIGHT_DURATION';

export type ExercisePermissions = {
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
};

export type ExerciseCompatibleEquipment = {
  equipmentType: EquipmentTypeReference;
  isPreferred: boolean;
  notes: string | null;
};

/** Préférences effectives de l’utilisateur authentifié pour un exercice. */
export type ExerciseUserPreference = {
  isFavorite: boolean;
  isExcludedFromSuggestions: boolean;
  preferredEquipmentType: EquipmentTypeReference | null;
  restSecondsOverride: number | null;
};

export type ExerciseListItem = {
  id: string;
  source: ExerciseSource;
  name: string;
  measurementType: ExerciseMeasurementType;
  primaryMuscleGroup: MuscleGroupReference;
  defaultEquipmentType: EquipmentTypeReference | null;
  defaultRestSeconds: number | null;
  archivedAt: string | null;
  permissions: ExercisePermissions;
  userPreference: ExerciseUserPreference;
};

export type ExerciseListResponse = ApiCursorListResponse<ExerciseListItem>;

export type ExerciseDetail = {
  id: string;
  source: ExerciseSource;
  name: string;
  measurementType: ExerciseMeasurementType;
  primaryMuscleGroup: MuscleGroupReference;
  secondaryMuscleGroups: MuscleGroupReference[];
  defaultEquipmentType: EquipmentTypeReference | null;
  compatibleEquipmentTypes: ExerciseCompatibleEquipment[];
  defaultRestSeconds: number | null;
  instructions: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: ExercisePermissions;
  userPreference: ExerciseUserPreference;
};

export type ProgramStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type ProgramPermissions = {
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canActivate: boolean;
  canDeactivate: boolean;
  canEditSchedule: boolean;
};

export type WorkoutTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  estimatedDurationMinutes: number | null;
  exerciseCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutSetType =
  | 'WARMUP'
  | 'WORKING'
  | 'BACKOFF'
  | 'DROP_SET'
  | 'AMRAP'
  | 'FAILURE_OPTIONAL';

/** Référence catalogue compacte dans un modèle (sans préférences personnelles). */
export type WorkoutTemplateExerciseRef = {
  id: string;
  source: ExerciseSource;
  name: string;
  measurementType: ExerciseMeasurementType;
  primaryMuscleGroup: MuscleGroupReference;
  defaultEquipmentType: EquipmentTypeReference | null;
  archivedAt: string | null;
};

export type WorkoutTemplateSetTarget = {
  id: string;
  position: number;
  setType: WorkoutSetType;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  targetWeightKg: number | null;
  targetIntensityPercent: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  restSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutTemplateExercisePermissions = {
  canEdit: boolean;
  canDelete: boolean;
  canReorder: boolean;
};

export type WorkoutTemplateExerciseDetail = {
  id: string;
  position: number;
  exercise: WorkoutTemplateExerciseRef;
  equipmentType: EquipmentTypeReference | null;
  restSecondsOverride: number | null;
  notes: string | null;
  sets: WorkoutTemplateSetTarget[];
  permissions: WorkoutTemplateExercisePermissions;
};

export type WorkoutTemplateDetail = WorkoutTemplateSummary & {
  exercises: WorkoutTemplateExerciseDetail[];
};

export type ProgramListItem = {
  id: string;
  name: string;
  description: string | null;
  goal: TrainingGoal;
  status: ProgramStatus;
  workoutTemplateCount: number;
  isCurrent: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: ProgramPermissions;
};

export type ProgramListResponse = ApiCursorListResponse<ProgramListItem>;

export type ProgramDetail = ProgramListItem & {
  workoutTemplates: WorkoutTemplateDetail[];
};

export type ProgramScheduleTemplateRef = {
  id: string;
  name: string;
  estimatedDurationMinutes: number | null;
  exerciseCount: number;
};

export type ProgramScheduleEntry = {
  id: string;
  weekday: Weekday;
  position: number;
  workoutTemplate: ProgramScheduleTemplateRef;
};

export type ProgramSchedule = {
  entries: ProgramScheduleEntry[];
};

export type ActiveProgramSummary = {
  activationId: string;
  startedOn: string;
  program: ProgramListItem;
  schedule: ProgramSchedule;
};

export const WEEKDAY_VALUES: Weekday[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
};

export type WorkoutStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

/** Statuts de performance réelle d’une série de séance. */
export type WorkoutSetStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED';

export type WorkoutSessionPermissions = {
  canPause: boolean;
  canResume: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canRecordSets: boolean;
};

/** Série de séance : cibles snapshot + valeurs réellement effectuées. */
export type WorkoutSessionSetDetail = {
  id: string;
  position: number;
  setType: WorkoutSetType;
  status: WorkoutSetStatus;

  targetWeightKg: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  targetIntensityPercent: number | null;
  targetRir: number | null;
  targetRpe: number | null;
  targetRestSeconds: number | null;

  actualWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: number | null;
  actualRir: number | null;
  actualRpe: number | null;

  reachedFailure: boolean;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

/** @deprecated Alias conservé — préférer WorkoutSessionSetDetail. */
export type WorkoutSessionSetTarget = WorkoutSessionSetDetail;

export type UpdateWorkoutSetResult = {
  workoutSet: WorkoutSessionSetDetail;
  workoutSessionVersion: number;
};

export type WorkoutLifecycleResult = {
  workoutSession: WorkoutSessionDetail;
  workoutSessionVersion: number;
};

export type WorkoutSessionExerciseDetail = {
  id: string;
  position: number;
  sourceExerciseId: string | null;
  exerciseName: string;
  measurementType: ExerciseMeasurementType;
  primaryMuscleGroupName: string | null;
  sourceExerciseArchivedAtCreation: boolean;
  equipment: {
    id: string | null;
    code: string | null;
    name: string | null;
  };
  notes: string | null;
  restSeconds: number | null;
  sets: WorkoutSessionSetDetail[];
};

export type WorkoutSessionDetail = {
  id: string;
  name: string;
  status: WorkoutStatus;
  localDate: string;
  timezone: string;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  notes: string | null;
  version: number;
  source: {
    programId: string | null;
    programName: string | null;
    workoutTemplateId: string | null;
    workoutTemplateName: string | null;
  };
  exercises: WorkoutSessionExerciseDetail[];
  permissions: WorkoutSessionPermissions;
  /**
   * Métriques officielles (jalon 4.2) — uniquement pour `COMPLETED`.
   * `null` pour ACTIVE / PAUSED / CANCELLED / PLANNED.
   */
  metrics: WorkoutMetrics | null;
};

/** Statuts exposés dans l’historique (hors ACTIVE / PAUSED). */
export type WorkoutHistoryStatus = 'COMPLETED' | 'CANCELLED';

/**
 * Métriques agrégées d’une séance (jalon 4.2).
 * Calculées à la demande depuis les snapshots — non matérialisées.
 *
 * Volume externe = somme(actualWeightKg × actualReps) pour types compatibles
 * (`WEIGHT_REPS` uniquement dans ce jalon). Bodyweight / assistance exclus.
 */
export type WorkoutMetrics = {
  exerciseCount: number;
  performedExerciseCount: number;
  sets: {
    total: number;
    processed: number;
    performed: number;
    completed: number;
    partial: number;
    failed: number;
    skipped: number;
    pending: number;
    cancelled: number;
    warmup: number;
    working: number;
    reachedFailure: number;
  };
  performance: {
    totalReps: number;
    totalExternalVolumeKg: number;
    workingExternalVolumeKg: number;
    totalDurationSeconds: number;
    totalDistanceMeters: number;
  };
  /** completedAt − startedAt en secondes ; null si incohérent / manquant. */
  elapsedDurationSeconds: number | null;
};

export type WorkoutHistorySetSummary = {
  exerciseCount: number;
  totalSetCount: number;
  processedSetCount: number;
  completedSetCount: number;
  partialSetCount: number;
  failedSetCount: number;
  skippedSetCount: number;
  pendingSetCount: number;
  /** Présent uniquement pour séances COMPLETED (jalon 4.2). */
  totalReps?: number;
  /** Volume de travail (hors warmup), séances COMPLETED uniquement. */
  workingExternalVolumeKg?: number;
};

export type WorkoutHistoryListItem = {
  id: string;
  name: string;
  status: WorkoutHistoryStatus;
  localDate: string;
  timezone: string;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  source: {
    programId: string | null;
    programName: string | null;
    workoutTemplateId: string | null;
    workoutTemplateName: string | null;
  };
  summary: WorkoutHistorySetSummary;
};

export type WorkoutHistoryListResponse =
  ApiCursorListResponse<WorkoutHistoryListItem>;

/** Types de records personnels simples (jalon 4.1 — calcul à la demande). */
export type PersonalRecordType =
  | 'MAX_WEIGHT'
  | 'MAX_REPS'
  | 'MAX_DURATION'
  | 'MAX_DISTANCE';

export type PersonalRecord = {
  exerciseId: string;
  exercise: {
    id: string;
    name: string;
    measurementType: ExerciseMeasurementType;
    archived: boolean | null;
  };
  equipment: {
    id: string | null;
    name: string | null;
  };
  recordType: PersonalRecordType;
  value: number;
  context: {
    weightKg: number | null;
    reps: number | null;
    durationSeconds: number | null;
    distanceMeters: number | null;
    rir: number | null;
    rpe: number | null;
    reachedFailure: boolean;
    setType: WorkoutSetType;
  };
  achievedOn: string;
  achievedAt: string | null;
  source: {
    workoutSessionId: string;
    workoutSessionExerciseId: string;
    workoutSetId: string;
  };
};

export type PersonalRecordListResponse = ApiCursorListResponse<PersonalRecord>;

/** Métriques de progression temporelle par exercice (jalon 4.3 — dérivées). */
export type ExerciseProgressMetric =
  | 'MAX_WEIGHT'
  | 'MAX_REPS'
  | 'WORKING_EXTERNAL_VOLUME'
  | 'TOTAL_REPS'
  | 'MAX_DURATION'
  | 'TOTAL_DURATION'
  | 'MAX_DISTANCE'
  | 'TOTAL_DISTANCE';

export type ExerciseProgressPointContext = {
  measurementType: ExerciseMeasurementType;
  maxWeightKg: number | null;
  maxReps: number | null;
  workingExternalVolumeKg: number | null;
  totalReps: number | null;
  maxDurationSeconds: number | null;
  totalDurationSeconds: number | null;
  maxDistanceMeters: number | null;
  totalDistanceMeters: number | null;
  performedSetCount: number;
  equipmentTypeId: string | null;
  equipmentName: string | null;
};

export type ExerciseProgressPoint = {
  workoutSessionId: string;
  workoutSessionExerciseIds: string[];
  localDate: string;
  startedAt: string;
  /** Valeur de la métrique sélectionnée. */
  value: number;
  context: ExerciseProgressPointContext;
};

export type ExerciseProgressSummary = {
  metric: ExerciseProgressMetric;
  pointCount: number;
  firstValue: number | null;
  latestValue: number | null;
  bestValue: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  firstDate: string | null;
  latestDate: string | null;
  bestDate: string | null;
};

export type ExerciseProgressResponse = {
  exercise: {
    id: string;
    name: string;
    archived: boolean | null;
  };
  availableMetrics: ExerciseProgressMetric[];
  selectedMetric: ExerciseProgressMetric | null;
  range: {
    from: string | null;
    to: string | null;
  };
  summary: ExerciseProgressSummary | null;
  points: ExerciseProgressPoint[];
};

export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}
