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
  plateauAnalyses: () =>
    [...coachingQueryKeys.all, 'plateau-analysis'] as const,
  plateauAnalysis: (
    exerciseId: string,
    filters: { equipmentId?: string } = {},
  ) =>
    [
      ...coachingQueryKeys.plateauAnalyses(),
      exerciseId,
      filters.equipmentId ?? null,
    ] as const,
  overview: () => [...coachingQueryKeys.all, 'overview'] as const,
  exerciseSummaries: () =>
    [...coachingQueryKeys.all, 'exercise-summary'] as const,
  exerciseSummary: (
    exerciseId: string,
    filters: { equipmentId?: string; from?: string; to?: string } = {},
  ) =>
    [
      ...coachingQueryKeys.exerciseSummaries(),
      exerciseId,
      filters.equipmentId ?? null,
      filters.from ?? null,
      filters.to ?? null,
    ] as const,
  conversations: () => [...coachingQueryKeys.all, 'conversations'] as const,
  conversation: (conversationId: string) =>
    [...coachingQueryKeys.conversations(), conversationId] as const,
};
