export const coachingQueryKeys = {
  all: ['coaching'] as const,
  loadRecommendations: () =>
    [...coachingQueryKeys.all, 'load-recommendation'] as const,
  loadRecommendation: (workoutTemplateExerciseId: string) =>
    [
      ...coachingQueryKeys.loadRecommendations(),
      workoutTemplateExerciseId,
    ] as const,
  loadRecommendationDecisions: (workoutTemplateExerciseId: string) =>
    [
      ...coachingQueryKeys.all,
      'load-recommendation-decisions',
      workoutTemplateExerciseId,
    ] as const,
};
