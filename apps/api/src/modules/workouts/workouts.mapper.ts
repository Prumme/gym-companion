import type {
  ExerciseMeasurementType,
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSessionPermissions,
  WorkoutSessionSetTarget,
  WorkoutSetType,
  WorkoutStatus,
} from '@gym-companion/shared';
import { utcDateToLocalDateString } from '@gym-companion/validation';

export type WorkoutSetSnapshotRow = {
  id: string;
  position: number;
  setType: WorkoutSetType;
  targetWeightKg: unknown;
  targetRepMin: number | null;
  targetRepMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: unknown;
  targetIntensityPercent: unknown;
  targetRir: number | null;
  targetRpe: unknown;
  targetRestSeconds: number | null;
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
      canRecordSets: true,
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

function toSetTarget(row: WorkoutSetSnapshotRow): WorkoutSessionSetTarget {
  return {
    id: row.id,
    position: row.position,
    setType: row.setType,
    targetWeightKg: decimalToNumber(row.targetWeightKg),
    targetRepMin: row.targetRepMin,
    targetRepMax: row.targetRepMax,
    targetDurationSeconds: row.targetDurationSeconds,
    targetDistanceMeters: decimalToNumber(row.targetDistanceMeters),
    targetIntensityPercent: decimalToNumber(row.targetIntensityPercent),
    targetRir: row.targetRir,
    targetRpe: decimalToNumber(row.targetRpe),
    targetRestSeconds: row.targetRestSeconds,
  };
}

function toExerciseDetail(
  row: WorkoutSessionExerciseSnapshotRow,
): WorkoutSessionExerciseDetail {
  const sets = [...row.sets]
    .sort((a, b) => a.position - b.position)
    .map(toSetTarget);

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
