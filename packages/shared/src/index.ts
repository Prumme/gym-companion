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

/** Métriques du dashboard global (jalon 4.4 — dérivées). */
export type ProgressOverviewMetric =
  | 'WORKOUT_COUNT'
  | 'PERFORMED_SETS'
  | 'TOTAL_REPS'
  | 'WORKING_EXTERNAL_VOLUME'
  | 'TOTAL_DURATION'
  | 'TOTAL_DISTANCE';

export type ProgressOverviewBucket = 'DAY' | 'WEEK' | 'MONTH';

export type ProgressOverviewTotals = {
  workoutCount: number;
  /** Occurrences d’exercices avec ≥1 série réalisée (pas d’uniques). */
  exerciseCount: number;
  uniqueExerciseCount: number;
  performedSetCount: number;
  totalReps: number;
  workingExternalVolumeKg: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  /** Séries réalisées avec reachedFailure = true (≠ status FAILED). */
  failureSetCount: number;
};

export type ProgressOverviewFrequency = {
  activeDayCount: number;
  /** null si plage < 7 jours ou plage non bornée (`Tout`). */
  averageWorkoutsPerWeek: number | null;
};

export type ProgressOverviewPoint = {
  periodStart: string;
  periodEnd: string;
  workoutCount: number;
  performedSetCount: number;
  totalReps: number;
  workingExternalVolumeKg: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
};

export type ProgressOverviewComparison = {
  workoutCountChangePercent: number | null;
  performedSetCountChangePercent: number | null;
  workingExternalVolumeChangePercent: number | null;
};

export type ProgressTopExercise = {
  exerciseId: string;
  exerciseName: string;
  workoutCount: number;
  performedSetCount: number;
  latestPerformedOn: string;
};

export type ProgressOverviewResponse = {
  range: {
    from: string | null;
    to: string | null;
  };
  availableMetrics: ProgressOverviewMetric[];
  selectedMetric: ProgressOverviewMetric;
  totals: ProgressOverviewTotals;
  frequency: ProgressOverviewFrequency;
  comparison: ProgressOverviewComparison | null;
  timeline: {
    bucket: ProgressOverviewBucket;
    points: ProgressOverviewPoint[];
  };
  recentRecords: PersonalRecord[];
  topExercises: ProgressTopExercise[];
};

/** Formule e1RM (jalon 4.5 — dérivé, non matérialisé). */
export type OneRepMaxFormula = 'EPLEY_V1';

export type EstimatedStrengthSource = {
  workoutSessionId: string;
  workoutSessionExerciseId: string;
  workoutSetId: string;
  weightKg: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  reachedFailure: boolean;
  setType: WorkoutSetType;
  localDate: string;
};

export type EstimatedStrengthPoint = {
  workoutSessionId: string;
  workoutSessionExerciseIds: string[];
  localDate: string;
  startedAt: string;
  estimatedOneRepMaxKg: number;
  sourceSet: {
    workoutSessionExerciseId: string;
    workoutSetId: string;
    weightKg: number;
    reps: number;
    rir: number | null;
    rpe: number | null;
    reachedFailure: boolean;
    setType: WorkoutSetType;
  };
};

export type ExerciseStrengthSummary = {
  formula: OneRepMaxFormula;
  pointCount: number;
  firstEstimatedOneRepMaxKg: number | null;
  latestEstimatedOneRepMaxKg: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  absoluteChangeKg: number | null;
  percentageChange: number | null;
  firstDate: string | null;
  latestDate: string | null;
  bestDate: string | null;
  latestSource: EstimatedStrengthSource | null;
  bestSource: EstimatedStrengthSource | null;
};

/** Force estimée e1RM par exercice (jalon 4.5). */
export type ExerciseStrengthResponse = {
  exercise: {
    id: string;
    name: string;
    archived: boolean | null;
  };
  supported: boolean;
  formula: OneRepMaxFormula;
  eligibility: {
    minReps: number;
    maxReps: number;
  };
  range: {
    from: string | null;
    to: string | null;
  };
  summary: ExerciseStrengthSummary | null;
  points: EstimatedStrengthPoint[];
};

/** Actions de recommandation de charge (jalon 5.1 — déterministe, lecture seule). */
export type LoadRecommendationAction =
  | 'INCREASE'
  | 'HOLD'
  | 'DECREASE'
  | 'INSUFFICIENT_DATA'
  | 'REVIEW';

export type LoadRecommendationReason =
  | 'TARGET_RANGE_REACHED'
  | 'TARGET_RANGE_PARTIALLY_REACHED'
  | 'TARGET_RANGE_NOT_REACHED'
  | 'EFFORT_ON_TARGET'
  | 'EFFORT_TOO_HIGH'
  | 'EFFORT_LOWER_THAN_TARGET'
  | 'RECENT_FAILURES'
  | 'NO_ELIGIBLE_HISTORY'
  | 'NO_WORKING_SETS'
  | 'UNSUPPORTED_TARGET_CONFIGURATION'
  | 'INCONSISTENT_EQUIPMENT'
  | 'INSUFFICIENT_EFFORT_DATA'
  | 'UNSUPPORTED_MEASUREMENT_TYPE'
  | 'NO_TARGET_WEIGHT'
  | 'NO_TARGET_REP_RANGE'
  | 'SINGLE_UNDERPERFORMANCE'
  | 'COMPARABLE_LOAD_MISMATCH';

export type LoadIncrementSource =
  | 'USER_EXERCISE_PREFERENCE'
  | 'SYSTEM_DEFAULT';

export type LoadRecommendationEvidenceWorkout = {
  workoutSessionId: string;
  localDate: string;
  targetWeightKg: number | null;
  completedSetCount: number;
  partialSetCount: number;
  failedSetCount: number;
  performedReps: number[];
  actualRir: number[] | null;
  actualRpe: number[] | null;
};

/** Recommandation de charge dérivée (non persistée). */
export type LoadRecommendation = {
  workoutTemplateExerciseId: string;
  exerciseId: string;
  supported: boolean;
  action: LoadRecommendationAction;
  currentTarget: {
    weightKg: number | null;
    minReps: number | null;
    maxReps: number | null;
    targetRir: number | null;
    targetRpe: number | null;
  };
  recommendation: {
    suggestedWeightKg: number | null;
    adjustmentKg: number | null;
    incrementKg: number | null;
    incrementSource: LoadIncrementSource | null;
  };
  evidence: {
    workoutCount: number;
    latestWorkoutDate: string | null;
    effortDataUsed: boolean;
    recentWorkouts: LoadRecommendationEvidenceWorkout[];
  };
  reasons: LoadRecommendationReason[];
  engineVersion: 'LOAD_RECOMMENDATION_V1';
  recommendationFingerprint: string;
};

export type LoadRecommendationDecisionType =
  | 'ACCEPTED'
  | 'ADJUSTED'
  | 'IGNORED';

export type LoadRecommendationDecisionDto = {
  id: string;
  engineVersion: string;
  recommendationFingerprint: string;
  recommendationAction: LoadRecommendationAction;
  decisionType: LoadRecommendationDecisionType;
  currentTargetWeightKg: number | null;
  recommendedWeightKg: number | null;
  appliedWeightKg: number | null;
  incrementKg: number | null;
  incrementSource: LoadIncrementSource | null;
  reasons: LoadRecommendationReason[];
  latestEvidenceWorkoutDate: string | null;
  userNote: string | null;
  createdAt: string;
};

export type LoadRecommendationDecisionListItem = {
  id: string;
  engineVersion: string;
  recommendationAction: LoadRecommendationAction;
  decisionType: LoadRecommendationDecisionType;
  currentTargetWeightKg: number | null;
  recommendedWeightKg: number | null;
  appliedWeightKg: number | null;
  reasons: LoadRecommendationReason[];
  latestEvidenceWorkoutDate: string | null;
  userNote: string | null;
  createdAt: string;
};

export type LoadRecommendationDecisionListResponse =
  ApiCursorListResponse<LoadRecommendationDecisionListItem>;

export type DecideLoadRecommendationResult = {
  decision: LoadRecommendationDecisionDto;
  templateExercise: WorkoutTemplateExerciseDetail;
  program: ProgramDetail;
  recommendation: LoadRecommendation | null;
};

/** Statuts de détection de plateau (jalon 5.3 — dérivé, non persisté). */
export type PlateauStatus =
  | 'NONE'
  | 'WATCH'
  | 'PLATEAU'
  | 'INSUFFICIENT_DATA'
  | 'REVIEW';

export type PlateauReason =
  | 'NO_ELIGIBLE_HISTORY'
  | 'INSUFFICIENT_WORKOUTS'
  | 'INCONSISTENT_EQUIPMENT'
  | 'INCONSISTENT_TARGETS'
  | 'LOAD_NOT_INCREASING'
  | 'MAX_REPS_NOT_INCREASING'
  | 'E1RM_NOT_INCREASING'
  | 'REPEATED_TARGET_MISSES'
  | 'REPEATED_FAILURES'
  | 'EFFORT_TREND_HIGH'
  | 'RECENT_PROGRESS_DETECTED'
  | 'UNSUPPORTED_MEASUREMENT_TYPE'
  | 'SOURCE_EXERCISE_MISSING';

export type PlateauWorkoutPoint = {
  workoutSessionId: string;
  localDate: string;
  maxWeightKg: number | null;
  maxReps: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  workingExternalVolumeKg: number;
  workingSetCount: number;
  completedSetCount: number;
  partialSetCount: number;
  failedSetCount: number;
  targetMinReps: number | null;
  targetMaxReps: number | null;
  targetWeightKg: number | null;
  averageRir: number | null;
  averageRpe: number | null;
  effortCoverage: {
    trackedSetCount: number;
    eligibleSetCount: number;
  };
  reachedFailureCount: number;
};

/** Analyse de plateau dérivée (aucune table Prisma). */
export type PlateauAnalysis = {
  exerciseId: string;
  supported: boolean;
  status: PlateauStatus;
  range: {
    analyzedWorkoutCount: number;
    firstWorkoutDate: string | null;
    latestWorkoutDate: string | null;
  };
  current: {
    maxWeightKg: number | null;
    maxReps: number | null;
    estimatedOneRepMaxKg: number | null;
  };
  trend: {
    loadChangeKg: number | null;
    e1rmChangeKg: number | null;
    e1rmChangePercent: number | null;
    maxRepsChange: number | null;
  };
  evidence: PlateauWorkoutPoint[];
  reasons: PlateauReason[];
  effortCoverage: {
    trackedSetCount: number;
    eligibleSetCount: number;
  };
};

/** Statuts UI du Coach déterministe (jalon 5.4 — dérivé, non persisté). */
export type ExerciseCoachStatus =
  | 'NO_DATA'
  | 'BUILDING_HISTORY'
  | 'PROGRESSING'
  | 'STABLE'
  | 'WATCH'
  | 'PLATEAU'
  | 'REVIEW';

export type ExerciseCoachHeadline = {
  title: string;
  description: string;
};

export type CoachLoadRecommendationSummary = {
  action: LoadRecommendationAction;
  currentWeightKg: number | null;
  suggestedWeightKg: number | null;
  reasons: LoadRecommendationReason[];
  workoutCount: number;
  actionable: boolean;
  workoutTemplateExerciseId: string | null;
  programId: string | null;
};

export type CoachPlateauSummary = {
  status: PlateauStatus;
  reasons: PlateauReason[];
  analyzedWorkoutCount: number;
  firstWorkoutDate: string | null;
  latestWorkoutDate: string | null;
};

export type CoachProgressSummary = {
  maxWeightKg: {
    first: number | null;
    latest: number | null;
    change: number | null;
  };
  maxReps: {
    first: number | null;
    latest: number | null;
    change: number | null;
  };
  workoutCount: number;
};

export type CoachStrengthSummary = {
  latestEstimatedOneRepMaxKg: number | null;
  bestEstimatedOneRepMaxKg: number | null;
  changeKg: number | null;
  changePercent: number | null;
};

export type CoachDecisionSummary = {
  decisionType: LoadRecommendationDecisionType;
  recommendationAction: LoadRecommendationAction;
  recommendedWeightKg: number | null;
  appliedWeightKg: number | null;
  createdAt: string;
};

export type CoachActionType =
  | 'VIEW_LOAD_RECOMMENDATION'
  | 'VIEW_PROGRESS'
  | 'VIEW_RECORDS'
  | 'VIEW_HISTORY'
  | 'VIEW_PROGRAM';

export type CoachAction = {
  type: CoachActionType;
  label: string;
  href: string;
};

export type CoachNoticeSeverity = 'INFO' | 'ATTENTION';

export type CoachNotice = {
  code: string;
  severity: CoachNoticeSeverity;
  message: string;
};

export type ExerciseCoachSummary = {
  exercise: {
    id: string;
    name: string;
    archived: boolean | null;
    measurementType: ExerciseMeasurementType;
  };
  supported: boolean;
  status: ExerciseCoachStatus;
  headline: ExerciseCoachHeadline;
  loadRecommendation: CoachLoadRecommendationSummary | null;
  plateau: CoachPlateauSummary | null;
  progress: CoachProgressSummary | null;
  strength: CoachStrengthSummary | null;
  recentDecision: CoachDecisionSummary | null;
  actions: CoachAction[];
  notices: CoachNotice[];
  generatedFrom: {
    latestWorkoutDate: string | null;
    workoutCount: number;
  };
  /** Fingerprint déterministe du contexte Coach (jalon 5.5 — staleness IA). */
  coachSummaryFingerprint: string;
};

export type AiCoachExplanationFocus =
  | 'GENERAL'
  | 'LOAD'
  | 'PROGRESS'
  | 'PLATEAU';

export type AiCoachExplanation = {
  title: string;
  summary: string;
  keyPoints: string[];
  caution: string | null;
};

export type ExerciseCoachExplanationResponse = {
  explanation: AiCoachExplanation;
  meta: {
    schemaVersion: 'AI_COACH_EXPLANATION_V1';
    promptVersion: 'AI_COACH_PROMPT_V1';
    focus: AiCoachExplanationFocus;
    coachSummaryFingerprint: string;
    generatedAt: string;
  };
};

export type AiCoachChatReference =
  | {
      type: 'EXERCISE';
      exerciseId: string;
      label: string;
    }
  | {
      type: 'WORKOUT';
      workoutSessionId: string;
      label: string;
    }
  | {
      type: 'PROGRESS';
      exerciseId: string;
      label: string;
    };

export type AiCoachConversationListItem = {
  id: string;
  title: string | null;
  contextExercise: {
    id: string;
    name: string;
  } | null;
  lastMessagePreview: string | null;
  updatedAt: string;
};

export type AiCoachConversationMessage = {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  references: AiCoachChatReference[];
  suggestedFollowUps: string[];
  createdAt: string;
};

export type AiCoachConversationDetail = {
  id: string;
  title: string | null;
  contextExercise: {
    id: string;
    name: string;
    measurementType: ExerciseMeasurementType;
  } | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: AiCoachConversationMessage[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type SendAiCoachMessageResponse = {
  userMessage: AiCoachConversationMessage;
  assistantMessage: AiCoachConversationMessage | null;
};

export type CoachingOverviewItem = {
  exerciseId: string;
  exerciseName: string;
  status: ExerciseCoachStatus;
  headline: string;
  latestWorkoutDate: string | null;
};

export type CoachingOverview = {
  items: CoachingOverviewItem[];
};

/** Shared 5.1 — salle de coordination (≠ WorkoutSession). */
export type SharedWorkoutRoomStatus =
  | 'LOBBY'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export type SharedWorkoutRoomMemberRole = 'OWNER' | 'MEMBER';

/** Shared 5.4 — résumé séance individuelle d’un membre (sans perfs). */
export type SharedWorkoutRoomMemberWorkoutStatus =
  | 'NOT_STARTED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type SharedWorkoutRoomMemberWorkoutSummary = {
  status: SharedWorkoutRoomMemberWorkoutStatus;
  workoutName: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type SharedWorkoutRoomMemberDto = {
  userId: string;
  role: SharedWorkoutRoomMemberRole;
  displayName: string | null;
  joinedAt: string;
  /** Résumé séance rattachée (NOT_STARTED si aucune). */
  memberWorkout: SharedWorkoutRoomMemberWorkoutSummary;
};

export type SharedWorkoutRoomListItem = {
  id: string;
  name: string;
  status: SharedWorkoutRoomStatus;
  memberCount: number;
  owner: {
    userId: string;
    displayName: string | null;
  };
  updatedAt: string;
  createdAt: string;
};

export type SharedWorkoutRoomDetail = {
  id: string;
  name: string;
  status: SharedWorkoutRoomStatus;
  owner: {
    userId: string;
    displayName: string | null;
  };
  members: SharedWorkoutRoomMemberDto[];
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** true si l’utilisateur courant est le propriétaire. */
  isOwner: boolean;
  /**
   * ID de la WorkoutSession du viewer s’il en a rattaché une.
   * Jamais l’ID des autres membres (Shared 5.4).
   */
  myWorkoutSessionId: string | null;
};

/**
 * Shared 5.4 — état « ma séance » pour le lobby (attach / create).
 */
export type MySharedWorkoutSessionDto = {
  linked: boolean;
  workoutSession: {
    id: string;
    status: WorkoutStatus;
    workoutName: string;
    startedAt: string;
  } | null;
  /**
   * Séance ACTIVE/PAUSED du viewer non rattachée à cette room
   * (candidat attach, ou déjà liée ailleurs).
   */
  activeWorkoutElsewhere: {
    id: string;
    status: WorkoutStatus;
    workoutName: string;
    linkedToOtherRoom: boolean;
  } | null;
};

export type SharedWorkoutRoomListResponse =
  ApiCursorListResponse<SharedWorkoutRoomListItem>;

/** Shared 5.2 — invitation directe (email). */
export type SharedWorkoutRoomInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED';

export type SharedWorkoutRoomInvitationDto = {
  id: string;
  room: {
    id: string;
    name: string;
    status: SharedWorkoutRoomStatus;
  };
  inviter: {
    displayName: string | null;
  };
  invitee: {
    displayName: string | null;
  };
  status: SharedWorkoutRoomInvitationStatus;
  createdAt: string;
  respondedAt: string | null;
  cancelledAt: string | null;
};

export type SharedWorkoutRoomInvitationListResponse =
  ApiCursorListResponse<SharedWorkoutRoomInvitationDto>;

/** Shared 5.3 — protocole Socket.IO (présence + invalidation). */
export const SHARED_WORKOUT_REALTIME_PROTOCOL_V1 = 1 as const;

export const SHARED_WORKOUT_SOCKET_NAMESPACE = '/shared-workouts';

export type SharedWorkoutRoomChangeReason =
  | 'RENAMED'
  | 'STARTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'MEMBER_JOINED'
  | 'MEMBER_LEFT'
  | 'MEMBER_WORKOUT_CHANGED';

export type SharedWorkoutRoomSubscribeInput = {
  roomId: string;
};

export type SharedWorkoutRoomUnsubscribeInput = {
  roomId: string;
};

export type SharedWorkoutRoomSubscribeAck =
  | {
      ok: true;
      roomId: string;
      presence: {
        connectedUserIds: string[];
      };
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type SharedWorkoutPresenceSnapshotEvent = {
  roomId: string;
  connectedUserIds: string[];
};

export type SharedWorkoutPresenceJoinedEvent = {
  roomId: string;
  userId: string;
};

export type SharedWorkoutPresenceLeftEvent = {
  roomId: string;
  userId: string;
};

export type SharedWorkoutRoomChangedEvent = {
  roomId: string;
  reason: SharedWorkoutRoomChangeReason;
};

export type SharedWorkoutRealtimeSocketErrorCode =
  | 'UNAUTHORIZED'
  | 'ROOM_NOT_ACCESSIBLE'
  | 'VALIDATION_ERROR';

export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}
