import type { ExerciseMeasurementType, WorkoutSessionSetDetail } from '@gym-companion/shared';

export type CopyableActualKey =
  'actualWeightKg' | 'actualReps' | 'actualDurationSeconds' | 'actualDistanceMeters';

export type CopyableActuals = Partial<Pick<WorkoutSessionSetDetail, CopyableActualKey>>;

export type WorkoutSetActualFieldVisibility = {
  weight: boolean;
  reps: boolean;
  duration: boolean;
  distance: boolean;
};

const REPS_TYPES: ReadonlySet<ExerciseMeasurementType> = new Set([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'REPS_ONLY',
]);

const WEIGHT_TYPES: ReadonlySet<ExerciseMeasurementType> = new Set([
  'WEIGHT_REPS',
  'BODYWEIGHT_REPS',
  'ASSISTED_BODYWEIGHT_REPS',
  'WEIGHT_DURATION',
]);

const DURATION_TYPES: ReadonlySet<ExerciseMeasurementType> = new Set([
  'DURATION',
  'DISTANCE_DURATION',
  'WEIGHT_DURATION',
]);

export function getWorkoutSetActualFieldVisibility(
  measurementType: ExerciseMeasurementType,
): WorkoutSetActualFieldVisibility {
  return {
    reps: REPS_TYPES.has(measurementType),
    weight: WEIGHT_TYPES.has(measurementType),
    duration: DURATION_TYPES.has(measurementType),
    distance: measurementType === 'DISTANCE_DURATION',
  };
}

export function findPreviousSetInExercise(
  sets: readonly WorkoutSessionSetDetail[],
  currentSetId: string,
): WorkoutSessionSetDetail | null {
  const current = sets.find((set) => set.id === currentSetId);
  if (!current) {
    return null;
  }
  const previous = sets
    .filter((set) => set.position < current.position)
    .sort((a, b) => b.position - a.position)[0];
  return previous ?? null;
}

export function pickCopyableActuals(
  previous: WorkoutSessionSetDetail,
  measurementType: ExerciseMeasurementType,
): CopyableActuals {
  const visibility = getWorkoutSetActualFieldVisibility(measurementType);
  const copied: CopyableActuals = {};

  if (visibility.weight && previous.actualWeightKg != null) {
    copied.actualWeightKg = previous.actualWeightKg;
  }
  if (visibility.reps && previous.actualReps != null) {
    copied.actualReps = previous.actualReps;
  }
  if (visibility.duration && previous.actualDurationSeconds != null) {
    copied.actualDurationSeconds = previous.actualDurationSeconds;
  }
  if (visibility.distance && previous.actualDistanceMeters != null) {
    copied.actualDistanceMeters = previous.actualDistanceMeters;
  }

  return copied;
}

export function hasCopyableActuals(
  previous: WorkoutSessionSetDetail | null,
  measurementType: ExerciseMeasurementType,
): boolean {
  if (!previous) {
    return false;
  }
  return Object.keys(pickCopyableActuals(previous, measurementType)).length > 0;
}

export function canCopyPreviousSetIntoCurrent(
  currentStatus: WorkoutSessionSetDetail['status'],
): boolean {
  return currentStatus !== 'COMPLETED';
}
