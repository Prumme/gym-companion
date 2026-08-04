import type {
  ExerciseMeasurementType,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSessionPermissions,
  WorkoutSessionSetDetail,
  WorkoutSetStatus,
  WorkoutSetType,
  WorkoutStatus,
} from '@gym-companion/shared';
import { utcDateToLocalDateString } from '@gym-companion/validation';

export type WorkoutSetSnapshotRow = {
  id: string;
  position: number;
  setType: WorkoutSetType;
  status: WorkoutSetStatus;
  targetWeightKg: unknown;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: unknown;
  targetIntensityPercent: unknown;
  targetRir: number | null;
  targetRpe: unknown;
  targetRestSeconds: number | null;
  actualWeightKg: unknown;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  actualDistanceMeters: unknown;
  actualRir: number | null;
  actualRpe: unknown;
  reachedFailure: boolean;
  notes: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type WorkoutSessionExerciseSnapshotRow = {
  id: string;
  position: number;
  sourceExerciseId: string | null;
  exerciseNameSnapshot: string;
  measurementTypeSnapshot: ExerciseMeasurementType;
  primaryMuscleGroupNameSnapshot: string | null;
  sourceExerciseArchivedAtCreation: boolean;
  equipmentTypeId: string | null;
  equipmentNameSnapshot: string | null;
  equipmentCodeSnapshot: string | null;
  notesSnapshot: string | null;
  restSecondsSnapshot: number | null;
  sets: WorkoutSetSnapshotRow[];
};

export type WorkoutSessionSnapshotRow = {
  id: string;
  name: string;
  status: WorkoutStatus;
  localDate: Date;
  timezone: string;
  startedAt: Date;
  pausedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  notes: string | null;
  version: number;
  sourceProgramId: string | null;
  sourceWorkoutTemplateId: string | null;
  programNameSnapshot: string | null;
  workoutTemplateNameSnapshot: string | null;
  exercises: WorkoutSessionExerciseSnapshotRow[];
};

function decimalToNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
}

export function computeActiveWorkoutPermissions(
  status: WorkoutStatus,
): WorkoutSessionPermissions {
  if (status === 'ACTIVE') {
    return {
      canPause: true,
      canResume: false,
      canComplete: true,
      canCancel: true,
      canRecordSets: true,
    };
  }
  if (status === 'PAUSED') {
    return {
      canPause: false,
      canResume: true,
      canComplete: true,
      canCancel: true,
      canRecordSets: false,
    };
  }
  return {
    canPause: false,
    canResume: false,
    canComplete: false,
    canCancel: false,
    canRecordSets: false,
  };
}

export function toWorkoutSetDetail(row: WorkoutSetSnapshotRow): WorkoutSessionSetDetail {
  return {
    id: row.id,
    position: row.position,
    setType: row.setType,
    status: row.status,
    targetWeightKg: decimalToNumber(row.targetWeightKg),
    targetRepMin: row.targetRepMin,
    targetRepMax: row.targetRepMax,
    targetDurationSeconds: row.targetDurationSeconds,
    targetDistanceMeters: decimalToNumber(row.targetDistanceMeters),
    targetIntensityPercent: decimalToNumber(row.targetIntensityPercent),
    targetRir: row.targetRir,
    targetRpe: decimalToNumber(row.targetRpe),
    targetRestSeconds: row.targetRestSeconds,
    actualWeightKg: decimalToNumber(row.actualWeightKg),
    actualReps: row.actualReps,
    actualDurationSeconds: row.actualDurationSeconds,
    actualDistanceMeters: decimalToNumber(row.actualDistanceMeters),
    actualRir: row.actualRir,
    actualRpe: decimalToNumber(row.actualRpe),
    reachedFailure: row.reachedFailure,
    notes: row.notes,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function toExerciseDetail(
  row: WorkoutSessionExerciseSnapshotRow,
): WorkoutSessionExerciseDetail {
  const sets = [...row.sets]
    .sort((a, b) => a.position - b.position)
    .map(toWorkoutSetDetail);

  return {
    id: row.id,
    position: row.position,
    sourceExerciseId: row.sourceExerciseId,
    exerciseName: row.exerciseNameSnapshot,
    measurementType: row.measurementTypeSnapshot,
    primaryMuscleGroupName: row.primaryMuscleGroupNameSnapshot,
    sourceExerciseArchivedAtCreation: row.sourceExerciseArchivedAtCreation,
    equipment: {
      id: row.equipmentTypeId,
      code: row.equipmentCodeSnapshot,
      name: row.equipmentNameSnapshot,
    },
    notes: row.notesSnapshot,
    restSeconds: row.restSecondsSnapshot,
    sets,
  };
}

/**
 * Mappe uniquement les champs snapshot de la séance.
 * Ne reconstruit jamais l’affichage depuis le programme / modèle / catalogue.
 */
export function toWorkoutSessionDetail(
  row: WorkoutSessionSnapshotRow,
): WorkoutSessionDetail {
  const exercises = [...row.exercises]
    .sort((a, b) => a.position - b.position)
    .map(toExerciseDetail);

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    localDate: utcDateToLocalDateString(row.localDate),
    timezone: row.timezone,
    startedAt: row.startedAt.toISOString(),
    pausedAt: row.pausedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    notes: row.notes,
    version: row.version,
    source: {
      programId: row.sourceProgramId,
      programName: row.programNameSnapshot,
      workoutTemplateId: row.sourceWorkoutTemplateId,
      workoutTemplateName: row.workoutTemplateNameSnapshot,
    },
    exercises,
    permissions: computeActiveWorkoutPermissions(row.status),
  };
}

/** Remplace une série dans un détail de séance (cache frontend / helpers). */
export function replaceSetInSessionDetail(
  detail: WorkoutSessionDetail,
  workoutSet: WorkoutSessionSetDetail,
  workoutSessionVersion: number,
): WorkoutSessionDetail {
  return {
    ...detail,
    version: workoutSessionVersion,
    exercises: detail.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) =>
        set.id === workoutSet.id ? workoutSet : set,
      ),
    })),
  };
}
