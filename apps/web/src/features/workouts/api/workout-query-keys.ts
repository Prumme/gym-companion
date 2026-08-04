export const workoutQueryKeys = {
  all: ['workouts'] as const,
  active: () => [...workoutQueryKeys.all, 'active'] as const,
  details: () => [...workoutQueryKeys.all, 'detail'] as const,
  detail: (workoutSessionId: string) =>
    [...workoutQueryKeys.details(), workoutSessionId] as const,
};
