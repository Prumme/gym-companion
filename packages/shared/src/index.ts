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

export type ProgramPermissions = {
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
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
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: ProgramPermissions;
};

export type ProgramListResponse = ApiCursorListResponse<ProgramListItem>;

export type ProgramDetail = ProgramListItem & {
  workoutTemplates: WorkoutTemplateDetail[];
};

export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}
