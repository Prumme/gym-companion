import type {
  WorkoutSessionDetail,
  WorkoutSessionExerciseDetail,
  WorkoutSessionSetDetail,
  WorkoutSetStatus,
} from '@gym-companion/shared';

import { countRecordedSets } from './workout-labels';

const TREATED_STATUSES: WorkoutSetStatus[] = [
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'SKIPPED',
  'CANCELLED',
];

export function isSetTreated(status: WorkoutSetStatus): boolean {
  return TREATED_STATUSES.includes(status);
}

export function isExerciseTreated(
  exercise: Pick<WorkoutSessionExerciseDetail, 'sets'>,
): boolean {
  return (
    exercise.sets.length > 0 &&
    exercise.sets.every((set) => isSetTreated(set.status))
  );
}

export type ExerciseProgressState = 'NOT_STARTED' | 'IN_PROGRESS' | 'TREATED';

export function getExerciseProgressState(
  exercise: Pick<WorkoutSessionExerciseDetail, 'sets'>,
): ExerciseProgressState {
  if (exercise.sets.length === 0 || exercise.sets.every((s) => s.status === 'PENDING')) {
    return 'NOT_STARTED';
  }
  if (isExerciseTreated(exercise)) {
    return 'TREATED';
  }
  return 'IN_PROGRESS';
}

export function getExerciseProgressLabel(state: ExerciseProgressState): string {
  switch (state) {
    case 'NOT_STARTED':
      return 'À commencer';
    case 'IN_PROGRESS':
      return 'En cours';
    case 'TREATED':
      return 'Traité';
  }
}

export type WorkoutProgressSummary = {
  totalSets: number;
  recordedSets: number;
  pendingSets: number;
  completedSets: number;
  partialSets: number;
  failedSets: number;
  skippedSets: number;
  totalExercises: number;
  treatedExercises: number;
};

export function computeWorkoutProgress(
  session: Pick<WorkoutSessionDetail, 'exercises'>,
): WorkoutProgressSummary {
  const allSets = session.exercises.flatMap((exercise) => exercise.sets);
  return {
    totalSets: allSets.length,
    recordedSets: countRecordedSets(allSets),
    pendingSets: allSets.filter((set) => set.status === 'PENDING').length,
    completedSets: allSets.filter((set) => set.status === 'COMPLETED').length,
    partialSets: allSets.filter((set) => set.status === 'PARTIAL').length,
    failedSets: allSets.filter((set) => set.status === 'FAILED').length,
    skippedSets: allSets.filter((set) => set.status === 'SKIPPED').length,
    totalExercises: session.exercises.length,
    treatedExercises: session.exercises.filter(isExerciseTreated).length,
  };
}

export type NextPendingSetRef = {
  exerciseId: string;
  setId: string;
  exercise: WorkoutSessionExerciseDetail;
  set: WorkoutSessionSetDetail;
};

export function findNextPendingSet(
  session: Pick<WorkoutSessionDetail, 'exercises'>,
): NextPendingSetRef | null {
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.status === 'PENDING') {
        return {
          exerciseId: exercise.id,
          setId: set.id,
          exercise,
          set,
        };
      }
    }
  }
  return null;
}

export function findNextPendingSetInExercise(
  exercise: WorkoutSessionExerciseDetail,
): WorkoutSessionSetDetail | null {
  return exercise.sets.find((set) => set.status === 'PENDING') ?? null;
}

export function resolveInitialExerciseId(
  session: Pick<WorkoutSessionDetail, 'exercises'>,
  preferredExerciseId?: string | null,
): string | null {
  if (session.exercises.length === 0) {
    return null;
  }
  if (
    preferredExerciseId &&
    session.exercises.some((exercise) => exercise.id === preferredExerciseId)
  ) {
    return preferredExerciseId;
  }
  const next = findNextPendingSet(session);
  if (next) {
    return next.exerciseId;
  }
  return session.exercises[0]?.id ?? null;
}

export function countTreatedSetsInExercise(
  exercise: Pick<WorkoutSessionExerciseDetail, 'sets'>,
): number {
  return exercise.sets.filter((set) => isSetTreated(set.status)).length;
}

/** Repos snapshot : série puis exercice. */
export function resolveRestSeconds(
  set: Pick<WorkoutSessionSetDetail, 'targetRestSeconds'>,
  exercise: Pick<WorkoutSessionExerciseDetail, 'restSeconds'>,
): number | null {
  if (set.targetRestSeconds != null && set.targetRestSeconds > 0) {
    return set.targetRestSeconds;
  }
  if (exercise.restSeconds != null && exercise.restSeconds > 0) {
    return exercise.restSeconds;
  }
  return null;
}

export function shouldAutoStartRest(status: WorkoutSetStatus): boolean {
  return status === 'COMPLETED' || status === 'PARTIAL' || status === 'FAILED';
}
