import type {
  UpdateWorkoutSetResult,
  WorkoutSessionDetail,
  WorkoutSessionSetDetail,
} from '@gym-companion/shared';

export function replaceSetInWorkoutSession(
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

export function applyUpdateWorkoutSetResult(
  detail: WorkoutSessionDetail,
  result: UpdateWorkoutSetResult,
): WorkoutSessionDetail {
  return replaceSetInWorkoutSession(
    detail,
    result.workoutSet,
    result.workoutSessionVersion,
  );
}
