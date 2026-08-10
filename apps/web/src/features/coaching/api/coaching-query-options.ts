import { queryOptions } from '@tanstack/react-query';

import {
  getLoadRecommendation,
  getPlateauAnalysis,
  listLoadRecommendationDecisions,
} from './coaching-api';
import { coachingQueryKeys } from './coaching-query-keys';

export function loadRecommendationQueryOptions(
  workoutTemplateExerciseId: string,
) {
  return queryOptions({
    queryKey: coachingQueryKeys.loadRecommendation(workoutTemplateExerciseId),
    queryFn: () => getLoadRecommendation(workoutTemplateExerciseId),
    staleTime: 30_000,
  });
}

export function loadRecommendationDecisionsQueryOptions(
  workoutTemplateExerciseId: string,
) {
  return queryOptions({
    queryKey: coachingQueryKeys.loadRecommendationDecisions(
      workoutTemplateExerciseId,
    ),
    queryFn: () =>
      listLoadRecommendationDecisions(workoutTemplateExerciseId, { limit: 10 }),
    staleTime: 30_000,
  });
}

export function plateauAnalysisQueryOptions(
  exerciseId: string,
  filters: { equipmentId?: string } = {},
) {
  return queryOptions({
    queryKey: coachingQueryKeys.plateauAnalysis(exerciseId, filters),
    queryFn: () => getPlateauAnalysis(exerciseId, filters),
    staleTime: 30_000,
  });
}
